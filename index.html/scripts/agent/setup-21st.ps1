<#
.SYNOPSIS
  Register (or remove) the 21st.dev MCP server for Claude Code - fail-closed on a missing key.

.DESCRIPTION
  21st.dev now serves one remote HTTP MCP at https://21st.dev/api/mcp authenticated with an
  x-api-key header (keys: https://21st.dev/settings/api-keys, prefix 21st_sk_). The legacy
  @21st-dev/magic stdio proxy and its console keys were retired in 2026-09.
  Registering a server without a key would show "Failed to connect" on every session start, so this
  script refuses to register until API_KEY_21ST is set. Scope: user (~/.claude.json), so the key
  never enters the repository.

  Tool surface (free tier after login): search, search_picker, search_logo, get_theme, get_usage,
  bookmarks; get_component metered (2/day free); generate / iterate_generation need a Builder/AI plan.

.PARAMETER Remove  Unregister the server.
.EXAMPLE
  $env:API_KEY_21ST = '21st_sk_...'
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-21st.ps1
#>
[CmdletBinding()]
param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) { throw 'claude CLI not found on PATH.' }

if ($Remove) { & $claude.Source mcp remove 21st --scope user; exit $LASTEXITCODE }

if ([string]::IsNullOrWhiteSpace($env:API_KEY_21ST)) {
    Write-Warning 'API_KEY_21ST is not set. Get a key at https://21st.dev/settings/api-keys, set $env:API_KEY_21ST and re-run. Nothing was registered (fail-closed).'
    exit 2
}
$header = 'x-api-key: ' + $env:API_KEY_21ST
& $claude.Source mcp add --transport http --scope user 21st https://21st.dev/api/mcp --header $header
if ($LASTEXITCODE -ne 0) { throw 'claude mcp add failed.' }
& $claude.Source mcp get 21st
Write-Host 'Registered. Verify inside a session with /mcp (tool count) and the get_usage tool.'
