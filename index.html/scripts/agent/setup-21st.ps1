<#
.SYNOPSIS
  Register (or remove) the 21st.dev MCP server for Claude Code - fail-closed, key never written to config.

.DESCRIPTION
  21st.dev serves one remote HTTP MCP at https://21st.dev/api/mcp authenticated with an x-api-key
  header (keys: https://21st.dev/settings/api-keys, prefix 21st_sk_). The legacy @21st-dev/magic
  stdio proxy and its console keys were retired in 2026-09.

  Secret handling (measured 2026-09-10, Claude Code 2.1.x):
    * The header is registered as the literal reference  x-api-key: ${API_KEY_21ST}  - Claude Code
      expands ${VAR} at connect time for user-scope servers too, so ~/.claude.json never contains
      the key. With the variable unset the server shows "Needs authentication" instead of leaking.
    * The key itself lives only in the Windows *User* environment variable API_KEY_21ST
      (-Persist writes it there from the current process env). New shells / VS Code windows must be
      started after -Persist to inherit it.
    * The same variable feeds web/components.json ("@21st" registry, params.api_key = ${API_KEY_21ST})
      so  npx shadcn@latest add @21st/<author>/<slug>  works without pasting the key.

  Registering without a key would show "Failed to connect" on every session start, so this script
  refuses to register until API_KEY_21ST is available (process env or User env). Scope: user.

  Tool surface (free tier, measured 2026-09-10): 33 tools - search / search_picker / get_inspiration /
  search_logo / get_theme / bookmarks / teams / profile are free; get_component is metered (2 per day
  on the free tier; one shadcn `view`/`add` of a 21st item also counts against it); generate /
  iterate_generation need a Builder/AI plan (aiGenerationEnabled=false on free).

.PARAMETER Persist  Copy $env:API_KEY_21ST into the User environment (setx-equivalent, no console echo).
.PARAMETER Remove   Unregister the server (the env var is left untouched).
.EXAMPLE
  $env:API_KEY_21ST = '21st_sk_...'
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-21st.ps1 -Persist
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-21st.ps1 -Remove
#>
[CmdletBinding()]
param(
    [switch]$Persist,
    [switch]$Remove
)
$ErrorActionPreference = 'Stop'
$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) { throw 'claude CLI not found on PATH.' }

function Hide-Key([string]$text) { return ($text -replace '21st_sk_[A-Za-z0-9]+', '21st_sk_[REDACTED]') }

if ($Remove) {
    & $claude.Source mcp remove 21st --scope user
    exit $LASTEXITCODE
}

# Resolve the key: process env first, then the persisted User env (a fresh shell may not have it yet).
$key = $env:API_KEY_21ST
if ([string]::IsNullOrWhiteSpace($key)) { $key = [Environment]::GetEnvironmentVariable('API_KEY_21ST', 'User') }
if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Warning 'API_KEY_21ST is not set (process or User env). Get a key at https://21st.dev/settings/api-keys, set $env:API_KEY_21ST and re-run with -Persist. Nothing was registered (fail-closed).'
    exit 2
}
if ($key -notmatch '^21st_sk_[A-Za-z0-9]{16,}$') { throw 'API_KEY_21ST does not look like a 21st.dev key (expected prefix 21st_sk_). Refusing to register.' }

if ($Persist) {
    [Environment]::SetEnvironmentVariable('API_KEY_21ST', $key, 'User')
    Write-Host "Persisted API_KEY_21ST to the User environment (len=$($key.Length), tail=$($key.Substring($key.Length - 4)))."
}

# Pre-flight: prove the key is accepted before touching ~/.claude.json (no quota is consumed by initialize).
$init = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"unitas-setup-21st","version":"1.0"}}}'
try {
    $probe = Invoke-WebRequest -Uri 'https://21st.dev/api/mcp' -Method Post -TimeoutSec 30 -UseBasicParsing -ContentType 'application/json' -Body $init `
        -Headers @{ 'x-api-key' = $key; 'Accept' = 'application/json, text/event-stream' }
    if ($probe.StatusCode -ne 200) { throw "initialize returned HTTP $($probe.StatusCode)" }
} catch {
    throw ('21st.dev rejected the key (' + (Hide-Key $_.Exception.Message) + '). Nothing was registered (fail-closed).')
}

# Register with the ${VAR} reference - the literal key must never land in ~/.claude.json.
$env:API_KEY_21ST = $key
& $claude.Source mcp remove 21st --scope user 2>$null | Out-Null
& $claude.Source mcp add --transport http --scope user 21st https://21st.dev/api/mcp --header 'x-api-key: ${API_KEY_21ST}'
if ($LASTEXITCODE -ne 0) { throw 'claude mcp add failed.' }

$get = (& $claude.Source mcp get 21st 2>&1 | Out-String)
Write-Host (Hide-Key $get)
if ($get -notmatch 'Connected') {
    & $claude.Source mcp remove 21st --scope user 2>$null | Out-Null
    throw '21st MCP registered but did not connect - rolled back (fail-closed). Check API_KEY_21ST and network.'
}
Write-Host 'Registered (user scope, env-referenced key). Restart Claude Code / VS Code so new sessions inherit API_KEY_21ST; then /mcp shows 21st with 33 tools.'
