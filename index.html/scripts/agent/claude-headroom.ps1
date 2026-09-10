<#
.SYNOPSIS
  Launch Claude Code through the local Headroom context-compression proxy (opt-in, per-process).

.DESCRIPTION
  Headroom (headroom-ai, Apache-2.0) sits between Claude Code and api.anthropic.com and compresses
  tool output / logs / JSON before it reaches the model. This launcher NEVER edits
  ~/.claude/settings.json or the project settings: ANTHROPIC_BASE_URL is set only for the
  `claude` child process spawned here, so every other session keeps its normal routing.
  (Doctrine: fail-closed - if the proxy is not healthy, we abort instead of launching a broken session.)

.PARAMETER Port
  Proxy port (default 8787). If busy, Headroom picks the next free port and we abort (explicit is safer).

.PARAMETER StopProxy
  Stop a running proxy on the port and exit.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/claude-headroom.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/claude-headroom.ps1 -- --model sonnet

.NOTES
  * Custom ANTHROPIC_BASE_URL disables Claude Code Remote Control (/rc) on 2.1.196+ - run plain `claude`
    when you need Remote Control.
  * Savings dashboard: http://127.0.0.1:<Port>/dashboard  ·  stats: /stats  ·  health: /health
  * Windows: the proxy is detached (survives this window). Stop it with -StopProxy.
#>
[CmdletBinding()]
param(
    [int]$Port = 8787,
    [switch]$StopProxy,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$ClaudeArgs
)

$ErrorActionPreference = 'Stop'
$health = "http://127.0.0.1:$Port/health"

function Test-Proxy {
    try { $r = Invoke-RestMethod -Uri $health -TimeoutSec 3; return ($null -ne $r) } catch { return $false }
}

$headroom = Get-Command headroom -ErrorAction SilentlyContinue
if (-not $headroom) {
    $candidate = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\Scripts\headroom.exe'
    if (Test-Path $candidate) { $headroom = Get-Command $candidate } else {
        throw 'headroom CLI not found. Run: python -m pip install "headroom-ai[proxy]==0.37.0"  (or scripts/setup-toolchain.ps1 -Install)'
    }
}

if ($StopProxy) {
    $owners = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($procId in $owners) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue; Write-Host "stopped proxy pid $procId" }
    if (-not $owners) { Write-Host "no proxy listening on $Port" }
    return
}

if (-not (Test-Proxy)) {
    Write-Host "Starting Headroom proxy on 127.0.0.1:$Port ..."
    Start-Process -FilePath $headroom.Source -ArgumentList @('proxy', '--port', "$Port") -WindowStyle Hidden
    $ok = $false
    for ($i = 0; $i -lt 30 -and -not $ok; $i++) { Start-Sleep -Seconds 1; $ok = Test-Proxy }
    if (-not $ok) { throw "Headroom proxy did not become healthy on $health - aborting (fail-closed). Check: headroom doctor" }
}
Write-Host "Headroom proxy healthy: $health  (dashboard: http://127.0.0.1:$Port/dashboard)"

# Per-process routing only. Nothing below is persisted anywhere.
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:$Port"
$env:ENABLE_TOOL_SEARCH = 'true'   # keep tool schemas deferred behind a custom base URL (headroom GH #746)

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) { throw 'claude CLI not found on PATH.' }
& $claude.Source @ClaudeArgs
exit $LASTEXITCODE
