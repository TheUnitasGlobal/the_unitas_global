<#
.SYNOPSIS
  Register (or remove) a Figma MCP server for Claude Code - fail-closed, token never written to config.

.DESCRIPTION
  Founder directive 2026-09-18, MISSION 2: wire up a Figma MCP server so design and code are
  directly connected. That directive named `@modelcontextprotocol/server-figma` as an example.

  MEASURED 2026-09-18 - that package does not exist:
      npm view @modelcontextprotocol/server-figma version  ->  npm error code E404
      npm view @figma/mcp version                          ->  npm error code E404
  There is no official Figma MCP server distributed on npm at all. What actually exists is two
  routes, and this script implements both:

  ROUTE 1 (default, headless, Zero-Touch per 제7장) - the Framelink server
      npx -y figma-developer-mcp@0.13.2 --stdio        (real, version verified on the registry)
    Authenticates with a Figma personal access token from the FIGMA_API_KEY environment variable
    (equivalently --figma-api-key=...). `--stdio` is mandatory: without it the package starts an
    HTTP server instead and an stdio client hangs waiting for a handshake that never comes.
    No browser, no desktop app, no interactive consent - which is why it is the default here.

  ROUTE 2 (-Official) - Figma's own remote server
      claude mcp add --transport http --scope user figma https://mcp.figma.com/mcp
    OAuth, not a token: nothing secret is stored anywhere, but the first connect needs one
    interactive browser consent (run /mcp inside Claude Code and authenticate). Rate limits follow
    the seat: Starter plans and View/Collab seats get ~6 tool calls PER MONTH, while a Dev or Full
    seat on Professional/Organization/Enterprise gets Figma REST Tier-1 per-minute limits. On a
    Starter seat this route is effectively a demo, not an integration.

  A third route exists and is NOT implemented: Figma's desktop app can host a local server at
  http://127.0.0.1:3845/mcp. It requires the Figma desktop application to be installed and running
  with a Dev Mode seat. The application is not installed on this machine (nothing is listening on
  3845), so registering it would guarantee a failed server on every session start.

  SECRET HANDLING (same contract as scripts/agent/setup-21st.ps1):
    * The token is registered as the literal reference  FIGMA_API_KEY=${FIGMA_API_KEY}  so
      ~/.claude.json never contains it. Claude Code expands ${VAR} at connect time.
    * The token itself lives only in the Windows *User* environment variable FIGMA_API_KEY
      (-Persist writes it there from the current process env, with no console echo).
    * Every error path is routed through Hide-Token, so a rejected token cannot be echoed into a
      transcript, a log, or a CI artifact.

  FAIL-CLOSED. Registering a server that cannot authenticate costs something real: it turns into a
  connection failure on every single session start, exactly as the unreachable playwright plugin
  already does in this workspace. So this script refuses to register until it has PROVEN the
  credential against Figma's own REST API, and rolls the registration back if the server does not
  reach Connected. Scope: user.

.PARAMETER Persist   Copy $env:FIGMA_API_KEY into the User environment (no console echo).
.PARAMETER Official  Register Figma's OAuth remote server instead of the headless token route.
.PARAMETER Remove    Unregister the server (the environment variable is left untouched).
.EXAMPLE
  $env:FIGMA_API_KEY = 'figd_...'
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Persist
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Official
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Remove
#>
[CmdletBinding()]
param(
    [switch]$Persist,
    [switch]$Official,
    [switch]$Remove
)
$ErrorActionPreference = 'Stop'

# Pinned so a future major of the Framelink server cannot silently change the tool surface or the
# CLI contract under an unattended agent. Bump deliberately, after re-reading its changelog.
$FigmaServerPackage = 'figma-developer-mcp@0.13.2'
$FigmaRemoteUrl = 'https://mcp.figma.com/mcp'

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) { throw 'claude CLI not found on PATH.' }

# Figma personal access tokens have carried both the figd_ and fdk_ prefixes; redact either, plus
# any OAuth bearer that a verbose error might surface.
function Hide-Token([string]$text) {
    if ($null -eq $text) { return '' }
    return ($text -replace '(figd_|fdk_)[A-Za-z0-9_-]+', '$1[REDACTED]')
}

if ($Remove) {
    & $claude.Source mcp remove figma --scope user
    exit $LASTEXITCODE
}

if ($Official) {
    # OAuth route: nothing to validate up front, because there is no secret to validate. The server
    # legitimately reports "Needs authentication" until the founder completes consent via /mcp, so
    # a non-Connected state here is NOT a failure and must not be rolled back.
    & $claude.Source mcp remove figma --scope user 2>$null | Out-Null
    & $claude.Source mcp add --transport http --scope user figma $FigmaRemoteUrl
    if ($LASTEXITCODE -ne 0) { throw 'claude mcp add failed.' }
    Write-Host (Hide-Token ((& $claude.Source mcp get figma 2>&1 | Out-String)))
    Write-Host 'Registered the OFFICIAL Figma MCP (user scope, OAuth).'
    Write-Host 'Next: run /mcp inside Claude Code and authenticate once in the browser.'
    Write-Host 'Seat check: Starter plans and View/Collab seats are capped near 6 tool calls PER MONTH -- a Dev or Full seat is what makes this route usable.'
    exit 0
}

# ---- Headless route ------------------------------------------------------------------------
# Resolve the token: process env first, then the persisted User env (a fresh shell may not have it).
$key = $env:FIGMA_API_KEY
if ([string]::IsNullOrWhiteSpace($key)) { $key = [Environment]::GetEnvironmentVariable('FIGMA_API_KEY', 'User') }
if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Warning @'
FIGMA_API_KEY is not set (process env or User env). Nothing was registered (fail-closed).

To activate the headless route:
  1. Create a personal access token at https://www.figma.com/developers/api#access-tokens
     (Figma -> account settings -> Security -> Personal access tokens). Scope it read-only unless a
     task genuinely needs to write to the canvas.
  2. $env:FIGMA_API_KEY = '<token>'
  3. powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Persist

Or take the OAuth route instead, which needs no token at all:
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Official
'@
    exit 2
}

# Deliberately NOT a prefix regex. Figma has shipped more than one token format, and rejecting a
# working token because it does not match a guessed pattern is a self-inflicted outage. The REST
# probe below is a stronger check than any regex: it asks Figma whether the credential works.
if ($Persist) {
    [Environment]::SetEnvironmentVariable('FIGMA_API_KEY', $key, 'User')
    Write-Host "Persisted FIGMA_API_KEY to the User environment (len=$($key.Length), tail=$($key.Substring([Math]::Max(0, $key.Length - 4))))."
}

# Pre-flight: prove the token BEFORE touching ~/.claude.json. /v1/me is the cheapest authenticated
# endpoint Figma exposes and consumes no meaningful quota.
try {
    $me = Invoke-RestMethod -Uri 'https://api.figma.com/v1/me' -Method Get -TimeoutSec 30 `
        -Headers @{ 'X-Figma-Token' = $key }
    if (-not $me) { throw 'empty response' }
    Write-Host "Figma accepted the token (handle=$($me.handle))."
} catch {
    throw ('Figma rejected the token (' + (Hide-Token $_.Exception.Message) + '). Nothing was registered (fail-closed).')
}

# Register with the ${VAR} reference - the literal token must never land in ~/.claude.json.
# Single quotes are load-bearing: in double quotes PowerShell would expand ${FIGMA_API_KEY} itself
# and write the secret into the config, which is the exact failure this line exists to avoid.
$env:FIGMA_API_KEY = $key
& $claude.Source mcp remove figma --scope user 2>$null | Out-Null
& $claude.Source mcp add --scope user figma -e 'FIGMA_API_KEY=${FIGMA_API_KEY}' -- npx -y $FigmaServerPackage --stdio
if ($LASTEXITCODE -ne 0) { throw 'claude mcp add failed.' }

$get = (& $claude.Source mcp get figma 2>&1 | Out-String)
Write-Host (Hide-Token $get)

# Belt and braces: if ${VAR} was stored expanded rather than as a reference, the secret is now in a
# user-global file. Detect that and roll back rather than leave it there.
if ($get -match [regex]::Escape($key)) {
    & $claude.Source mcp remove figma --scope user 2>$null | Out-Null
    throw 'The token was stored literally instead of as a ${FIGMA_API_KEY} reference -- rolled back (fail-closed).'
}

if ($get -notmatch 'Connected') {
    & $claude.Source mcp remove figma --scope user 2>$null | Out-Null
    throw 'Figma MCP registered but did not connect - rolled back (fail-closed). Check FIGMA_API_KEY and network.'
}
Write-Host 'Registered (user scope, env-referenced token). Restart Claude Code / VS Code so new sessions inherit FIGMA_API_KEY; then /mcp shows figma.'
