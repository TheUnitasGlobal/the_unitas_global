<#
.SYNOPSIS
  Register (or remove) the headless Figma MCP server for Claude Code - fail-closed, token never written to config.

.DESCRIPTION
  FOUNDER DECREE 2026-09-18 (MISSION 1): route A (headless, personal access token) is ADOPTED as the
  sole route. Route B (Figma's OAuth remote server) is RETIRED AT THE SOURCE and this script refuses
  to take it - it needs an interactive browser consent and, on Starter plans and View/Collab seats,
  caps out near 6 tool calls PER MONTH, which contradicts the unattended-automation doctrine
  (Codex ch.6 Zero-Hands, ch.7 Zero-Touch unmanned auth). The -Official switch is kept only so that
  invoking it reports the decision instead of silently doing something the founder struck down.

  MEASURED 2026-09-18 - there is no official Figma MCP server on npm:
      npm view @modelcontextprotocol/server-figma version  ->  npm error code E404
      npm view @figma/mcp version                          ->  npm error code E404
  What actually exists, and what is wired here, is the Framelink server:
      npx -y figma-developer-mcp@0.13.2 --stdio        (real, version verified on the registry)
  It authenticates with a Figma personal access token from the FIGMA_API_KEY environment variable.
  `--stdio` is mandatory: without it the package starts an HTTP server instead and an stdio client
  hangs waiting for a handshake that never comes.

  A third route exists and is NOT implemented: Figma's desktop app can host a local server at
  http://127.0.0.1:3845/mcp. It requires the Figma desktop application to be installed and running
  with a Dev Mode seat. The application is not installed on this machine (nothing is listening on
  3845), so registering it would guarantee a failed server on every session start.

  STANDBY (-Standby) - the wiring the founder ratified on 2026-09-18. It is idempotent and is the
  only mode that is safe to call unattended, from the toolchain board or a session hook:
      already connected      -> reports CONNECTED, changes nothing, exit 0
      FIGMA_API_KEY absent   -> reports ARMED (waiting for the token), changes nothing, exit 0
      FIGMA_API_KEY present  -> runs the full validated registration below, exit 0 (throws on failure)
  So the founder plants the token in the OS (User or Machine) environment and does nothing else; the
  next standby probe recognises it and completes the connection with no human in the loop.

  SECRET HANDLING (same contract as scripts/agent/setup-21st.ps1):
    * The token is registered as the literal reference  FIGMA_API_KEY=${FIGMA_API_KEY}  so
      ~/.claude.json never contains it. Claude Code expands ${VAR} at connect time.
    * The token itself lives only in the Windows *User* environment variable FIGMA_API_KEY
      (-Persist writes it there, with no console echo).
    * Every error path is routed through Hide-Token, so a rejected token cannot be echoed into a
      transcript, a log, or a CI artifact.

  FAIL-CLOSED. Registering a server that cannot authenticate costs something real: it turns into a
  connection failure on every single session start, exactly as the unreachable playwright plugin
  already does in this workspace. So this script refuses to register until it has PROVEN the
  credential against Figma's own REST API, and rolls the registration back if the server does not
  reach Connected. The credential is proven BEFORE -Persist writes it to the User environment, so a
  rejected token is never persisted. Scope: user.

.PARAMETER Standby   Idempotent unattended probe: connect if the token exists, stay armed if it does not.
.PARAMETER Persist   Copy the resolved token into the User environment (after Figma accepts it; no echo).
.PARAMETER Official  RETIRED 2026-09-18 by founder decree. Reports the decision and exits 3.
.PARAMETER Remove    Unregister the server (the environment variable is left untouched).
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Standby
.EXAMPLE
  $env:FIGMA_API_KEY = 'figd_...'
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Persist
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Remove
#>
[CmdletBinding()]
param(
    [switch]$Standby,
    [switch]$Persist,
    [switch]$Official,
    [switch]$Remove
)
$ErrorActionPreference = 'Stop'

# Pinned so a future major of the Framelink server cannot silently change the tool surface or the
# CLI contract under an unattended agent. Bump deliberately, after re-reading its changelog.
$FigmaServerPackage = 'figma-developer-mcp@0.13.2'

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) { throw 'claude CLI not found on PATH.' }

# Figma personal access tokens have carried both the figd_ and fdk_ prefixes; redact either, plus
# any OAuth bearer that a verbose error might surface.
function Hide-Token([string]$text) {
    if ($null -eq $text) { return '' }
    return ($text -replace '(figd_|fdk_)[A-Za-z0-9_-]+', '$1[REDACTED]')
}

# Process env first, then the persisted User env, then Machine - a fresh shell, a scheduled task and
# a session hook each see a different subset, and "the founder planted it in the OS" has to mean all
# three. Returns $null when nothing is set anywhere.
function Resolve-FigmaKey {
    foreach ($candidate in @(
            $env:FIGMA_API_KEY,
            [Environment]::GetEnvironmentVariable('FIGMA_API_KEY', 'User'),
            [Environment]::GetEnvironmentVariable('FIGMA_API_KEY', 'Machine'))) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) { return $candidate }
    }
    return $null
}

# `claude mcp get figma` as one string; '' when the server is not registered at all. Piped to
# Out-String rather than returned raw: a PowerShell function returns everything a native call writes
# to stdout, so an unpiped call would poison every caller's return value.
function Get-FigmaRegistration {
    try { return ((& $claude.Source mcp get figma 2>&1 | Out-String)) } catch { return '' }
}

# The validated registration. Throws on every failure path, leaving nothing half-registered.
function Connect-Figma([string]$key, [bool]$persist) {
    # Deliberately NOT a prefix regex. Figma has shipped more than one token format, and rejecting a
    # working token because it does not match a guessed pattern is a self-inflicted outage. The REST
    # probe is a stronger check than any regex: it asks Figma whether the credential works.
    # /v1/me is the cheapest authenticated endpoint Figma exposes and consumes no meaningful quota.
    try {
        $me = Invoke-RestMethod -Uri 'https://api.figma.com/v1/me' -Method Get -TimeoutSec 30 -Headers @{ 'X-Figma-Token' = $key }
        if (-not $me) { throw 'empty response' }
        Write-Host "Figma accepted the token (handle=$($me.handle))."
    } catch {
        throw ('Figma rejected the token (' + (Hide-Token $_.Exception.Message) + '). Nothing was registered, nothing was persisted (fail-closed).')
    }

    # Persist only AFTER Figma has accepted it, so a rejected token never lands in the User env.
    if ($persist) {
        [Environment]::SetEnvironmentVariable('FIGMA_API_KEY', $key, 'User')
        Write-Host "Persisted FIGMA_API_KEY to the User environment (len=$($key.Length), tail=$($key.Substring([Math]::Max(0, $key.Length - 4))))."
    }

    # Register with the ${VAR} reference - the literal token must never land in ~/.claude.json.
    # Single quotes are load-bearing: in double quotes PowerShell would expand ${FIGMA_API_KEY}
    # itself and write the secret into the config, which is the exact failure this line avoids.
    $env:FIGMA_API_KEY = $key
    & $claude.Source mcp remove figma --scope user 2>$null | Out-Null
    & $claude.Source mcp add --scope user figma -e 'FIGMA_API_KEY=${FIGMA_API_KEY}' -- npx -y $FigmaServerPackage --stdio
    if ($LASTEXITCODE -ne 0) { throw 'claude mcp add failed.' }

    $get = Get-FigmaRegistration
    Write-Host (Hide-Token $get)

    # Belt and braces: if ${VAR} was stored expanded rather than as a reference, the secret is now in
    # a user-global file. Detect that and roll back rather than leave it there.
    if ($get -match [regex]::Escape($key)) {
        & $claude.Source mcp remove figma --scope user 2>$null | Out-Null
        throw 'The token was stored literally instead of as a ${FIGMA_API_KEY} reference -- rolled back (fail-closed).'
    }
    if ($get -notmatch 'Connected') {
        & $claude.Source mcp remove figma --scope user 2>$null | Out-Null
        throw 'Figma MCP registered but did not connect - rolled back (fail-closed). Check FIGMA_API_KEY and network.'
    }
    Write-Host 'Registered (user scope, env-referenced token). Restart Claude Code / VS Code so new sessions inherit FIGMA_API_KEY; then /mcp shows figma.'
}

$ActivationHelp = @'
To activate the headless route, plant the token in the OS environment once:
  1. Create a personal access token at https://www.figma.com/developers/api#access-tokens
     (Figma -> account settings -> Security -> Personal access tokens). Scope it read-only unless a
     task genuinely needs to write to the canvas.
  2. setx FIGMA_API_KEY "<token>"     (User environment; or System Properties -> Environment Variables)
  3. Nothing else. The next standby probe - npm run setup:toolchain, or scripts/agent/setup-figma.ps1
     -Standby - detects it and completes the connection unattended.
Explicit one-shot alternative, same result, in the current shell:
  $env:FIGMA_API_KEY = '<token>'
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Persist
'@

if ($Remove) {
    & $claude.Source mcp remove figma --scope user
    exit $LASTEXITCODE
}

if ($Official) {
    # Kept as a tombstone, not a route. Silently falling back to the headless path would hide the
    # decision; silently taking the OAuth path would defy it.
    Write-Warning @'
The OAuth remote route (https://mcp.figma.com/mcp) was RETIRED by founder decree on 2026-09-18.

Reason of record: it needs one interactive browser consent per machine, and on Starter plans and
View/Collab seats it caps out near 6 tool calls PER MONTH. Both contradict unattended operation
(Codex ch.6 Zero-Hands, ch.7 Zero-Touch unmanned auth). Nothing was registered.

Use the adopted headless route instead:
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Standby
'@
    exit 3
}

# ---- Standby: the unattended, idempotent probe ------------------------------------------------
if ($Standby) {
    $key = Resolve-FigmaKey
    $get = Get-FigmaRegistration

    if ($get -match 'Connected') {
        Write-Host 'Figma MCP standby: CONNECTED (user scope, ${FIGMA_API_KEY} reference). Nothing to do.'
        exit 0
    }

    if ($null -eq $key) {
        if ($get -match 'Scope') {
            # Registered but the reference resolves nowhere: that is the "every session start fails"
            # state this script exists to prevent. Roll it back to clean standby.
            & $claude.Source mcp remove figma --scope user 2>$null | Out-Null
            Write-Warning 'Figma MCP was registered but FIGMA_API_KEY resolves nowhere -- unregistered it (fail-closed) and returned to standby.'
        }
        Write-Host 'Figma MCP standby: ARMED -- wiring is in place, waiting for FIGMA_API_KEY in the OS environment.'
        Write-Host $ActivationHelp
        exit 0
    }

    Write-Host 'Figma MCP standby: token detected -- connecting unattended.'
    Connect-Figma -key $key -persist $true
    exit 0
}

# ---- Explicit one-shot route ------------------------------------------------------------------
$key = Resolve-FigmaKey
if ($null -eq $key) {
    Write-Warning ("FIGMA_API_KEY is not set (process, User or Machine env). Nothing was registered (fail-closed)." + [Environment]::NewLine + [Environment]::NewLine + $ActivationHelp)
    exit 2
}
Connect-Figma -key $key -persist ([bool]$Persist)
exit 0
