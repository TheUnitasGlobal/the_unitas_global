<#
.SYNOPSIS
  Register (or remove) the Bright Data MCP server for Claude Code - standby wiring, fail-closed, token never written to config.

.DESCRIPTION
  REV-43 (founder directive 2026-09-18, Codex ch.6 autonomous evolution): the "global automation /
  data scraping (Bright Data compatible)" target. The scraping PLAYBOOKS are skills
  (scripts/agent/setup-skillset.ps1: brightdata/skills@scrape, @search, @bright-data-mcp); the live
  scraping capability is Bright Data's own MCP server, which needs an account API token:

      npx -y @brightdata/mcp@2.11.3          (stdio; authenticates with the API_TOKEN environment variable)

  Registering it without a token would put a "Failed to connect" line on every session start, exactly
  what the unreachable playwright plugin already does in this workspace. So this script follows the
  standby contract scripts/agent/setup-figma.ps1 -Standby ratified on 2026-09-18:

      already connected            -> reports CONNECTED, changes nothing, exit 0
      BRIGHTDATA_API_TOKEN absent  -> reports ARMED (waiting for the token), changes nothing, exit 0
      BRIGHTDATA_API_TOKEN present -> registers the server (user scope), verifies Connected, rolls back
                                      on failure; exit 0 on success, throws on failure

  The founder plants the token once (setx BRIGHTDATA_API_TOKEN <token>, or -Persist from a shell that
  holds it) and does nothing else: the next standby probe - run by scripts/setup-toolchain.ps1's status
  board - completes the connection with no human in the loop.

  SECRET HANDLING (same contract as setup-21st.ps1 / setup-figma.ps1):
    * The server is registered with the literal reference  API_TOKEN=${BRIGHTDATA_API_TOKEN}  so
      ~/.claude.json never contains the token; Claude Code expands ${VAR} at connect time.
    * The token lives only in the Windows *User* environment variable BRIGHTDATA_API_TOKEN.
    * Every message is routed through Hide-Token so a token can never be echoed into a transcript.

.PARAMETER Standby  Idempotent unattended probe: connect if the token exists, stay armed if it does not.
.PARAMETER Persist  Copy $env:BRIGHTDATA_API_TOKEN into the User environment (no console echo), then connect.
.PARAMETER Remove   Unregister the server (the environment variable is left untouched).
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-brightdata.ps1 -Standby
.EXAMPLE
  $env:BRIGHTDATA_API_TOKEN = '...'
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-brightdata.ps1 -Persist
#>
[CmdletBinding()]
param(
    [switch]$Standby,
    [switch]$Persist,
    [switch]$Remove
)
$ErrorActionPreference = 'Stop'

# Pinned so a future major cannot change the tool surface under an unattended agent. Verified on the
# registry 2026-09-18 (npm view @brightdata/mcp version -> 2.11.3). Bump deliberately.
$BrightDataPackage = '@brightdata/mcp@2.11.3'
$ServerName = 'brightdata'
$EnvVar = 'BRIGHTDATA_API_TOKEN'

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) { throw 'claude CLI not found on PATH.' }

function Hide-Token([string]$text) {
    $t = $text
    foreach ($candidate in @($env:BRIGHTDATA_API_TOKEN, [Environment]::GetEnvironmentVariable($EnvVar, 'User'), [Environment]::GetEnvironmentVariable($EnvVar, 'Machine'))) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and $candidate.Length -ge 8) { $t = $t.Replace($candidate, '[REDACTED]') }
    }
    return ($t -replace '[0-9a-f]{32,}', '[REDACTED]')
}

function Resolve-Token {
    foreach ($candidate in @($env:BRIGHTDATA_API_TOKEN, [Environment]::GetEnvironmentVariable($EnvVar, 'User'), [Environment]::GetEnvironmentVariable($EnvVar, 'Machine'))) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) { return $candidate.Trim() }
    }
    return $null
}

# `claude mcp get <name>` as one string; '' when the server is not registered. Same shape as
# setup-figma.ps1's Get-FigmaRegistration: under $ErrorActionPreference = 'Stop' a native command
# that writes "No MCP server named ..." to stderr surfaces as a NativeCommandError, so the probe is
# wrapped in try/catch and an unregistered server reads as the empty string, not as a crash.
function Get-ServerState {
    try {
        $out = ((& $claude.Source mcp get $ServerName 2>&1 | Out-String))
        if ($LASTEXITCODE -ne 0 -or $out -match 'No MCP server named') { return '' }
        return $out
    } catch { return '' }
}

function Test-Connected([string]$state) { return ($state -match 'Connected') -and ($state -notmatch 'Failed|Needs authentication') }

if ($Remove) {
    & $claude.Source mcp remove $ServerName --scope user
    exit $LASTEXITCODE
}

function Register-Server {
    # The reference form keeps the token out of ~/.claude.json; the value resolves at connect time.
    & $claude.Source mcp add --scope user --transport stdio --env ('{0}=${{{1}}}' -f 'API_TOKEN', $EnvVar) $ServerName -- npx -y $BrightDataPackage
    if ($LASTEXITCODE -ne 0) { throw 'claude mcp add failed.' }
    $state = Get-ServerState
    if (-not (Test-Connected $state)) {
        # Roll back: a registered-but-failing server is worse than no server (session-start noise).
        & $claude.Source mcp remove $ServerName --scope user | Out-Null
        throw ('Bright Data MCP did not reach Connected after registration; rolled back. State: ' + (Hide-Token $state))
    }
    Write-Host 'Bright Data MCP: CONNECTED (user scope, token by ${' + $EnvVar + '} reference).'
}

if ($Persist) {
    $token = $env:BRIGHTDATA_API_TOKEN
    if ([string]::IsNullOrWhiteSpace($token)) { throw ('$env:' + $EnvVar + ' is empty - set it in this shell first, then re-run -Persist.') }
    [Environment]::SetEnvironmentVariable($EnvVar, $token.Trim(), 'User')
    Write-Host ('{0} persisted to the User environment (no echo). New shells inherit it.' -f $EnvVar)
    Register-Server
    exit 0
}

if ($Standby) {
    $state = Get-ServerState
    if (Test-Connected $state) {
        Write-Host 'Bright Data MCP standby: CONNECTED -- nothing to do.'
        exit 0
    }
    $token = Resolve-Token
    if ($null -eq $token) {
        if ($state -ne '') {
            # Registered but cannot authenticate: keep it out of the session-start noise until the token exists.
            & $claude.Source mcp remove $ServerName --scope user | Out-Null
            Write-Host 'Bright Data MCP standby: registration without a token was removed (fail-closed).'
        }
        Write-Host ('Bright Data MCP standby: ARMED -- wiring is in place, waiting for {0} in the OS environment (setx {0} <token>).' -f $EnvVar)
        exit 0
    }
    $env:BRIGHTDATA_API_TOKEN = $token
    Register-Server
    exit 0
}

Write-Host 'Nothing requested. Use -Standby (unattended probe), -Persist (store the token, then connect) or -Remove.'
exit 2
