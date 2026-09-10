<#
.SYNOPSIS
  Start / stop / check the local OmniRoute multi-model gateway (on-demand, loopback-only).

.DESCRIPTION
  OmniRoute (npm `omniroute`, MIT) is an OpenAI + Anthropic compatible gateway with a dashboard,
  quota-aware fallback routing and "combos" (auto/coding, auto/cheap, auto/offline ...). It is NOT
  auto-started at login (low-memory doctrine: a Next.js gateway costs ~300-500 MB RAM) - run this
  launcher when you want multi-provider / local fallback routing, stop it when done.

  Sovereign shield defaults enforced here:
    * OMNIROUTE_SERVER_HOST=127.0.0.1  (upstream default is 0.0.0.0 = LAN exposure - refused)
    * dashboard password: generated once, stored in %USERPROFILE%\.omniroute\initial-password.txt (user-only file)
    * data dir: %USERPROFILE%\.omniroute  (storage.sqlite + .env with STORAGE_ENCRYPTION_KEY, created by OmniRoute)
    * measured cold start on the 7.6 GB laptop: ~195 s (Next.js server boot + 159 SQLite migrations on first run)

.PARAMETER Port   Gateway port (default 20128).
.PARAMETER Stop   Stop the running gateway.
.PARAMETER Status Health check only.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/omniroute-gateway.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/omniroute-gateway.ps1 -Status
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/omniroute-gateway.ps1 -Stop

.NOTES
  Add Ollama as a provider once: Dashboard -> Providers -> Ollama card -> base URL http://localhost:11434/v1
  (no API key). Models are then addressed as ollama/<tag>, e.g. ollama/qwen3:4b, or via combo auto/offline.
  Create a gateway key under Dashboard -> Endpoints (oma_live_...) and export it as OMNIROUTE_API_KEY
  for scripts/agent/claude-omniroute.ps1.
#>
[CmdletBinding()]
param(
    [int]$Port = 20128,
    [switch]$Stop,
    [switch]$Status
)

$ErrorActionPreference = 'Stop'
$health = "http://127.0.0.1:$Port/api/monitoring/health"

function Test-Gateway { try { $r = Invoke-RestMethod -Uri $health -TimeoutSec 4; return ($null -ne $r) } catch { return $false } }
function Get-ListenerPids { Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique }

if ($Status) {
    if (Test-Gateway) { Write-Host "OmniRoute healthy on http://127.0.0.1:$Port  (dashboard: http://127.0.0.1:$Port/)"; exit 0 }
    Write-Host "OmniRoute not running on $Port"; exit 1
}

if ($Stop) {
    $pids = Get-ListenerPids
    if (-not $pids) { Write-Host "no gateway listening on $Port"; return }
    foreach ($procId in $pids) {
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$procId" -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "stopped omniroute pid $procId"
    }
    return
}

if (Test-Gateway) { Write-Host "OmniRoute already healthy on http://127.0.0.1:$Port"; return }

$omni = Get-Command omniroute -ErrorAction SilentlyContinue
if (-not $omni) { throw 'omniroute CLI not found. Run scripts/setup-toolchain.ps1 -Install (npm install -g omniroute@3.8.50 with --allow-scripts).' }

$dataDir = Join-Path $env:USERPROFILE ".omniroute"
New-Item -ItemType Directory -Force $dataDir | Out-Null
$pwFile = Join-Path $dataDir 'initial-password.txt'
if (-not (Test-Path $pwFile)) {
    $bytes = New-Object byte[] 18
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $pw = ([Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', 'x')
    [System.IO.File]::WriteAllText($pwFile, $pw)
    icacls $pwFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
    Write-Host "Generated dashboard password -> $pwFile (login user: admin)"
}
$env:INITIAL_PASSWORD = [System.IO.File]::ReadAllText($pwFile).Trim()
$env:OMNIROUTE_SERVER_HOST = '127.0.0.1'
$env:PORT = "$Port"

Write-Host "Starting OmniRoute on 127.0.0.1:$Port (data: $dataDir) ..."
Start-Process -FilePath $omni.Source -ArgumentList @('--no-open', '--port', "$Port") -WindowStyle Hidden
$ok = $false
for ($i = 0; $i -lt 150 -and -not $ok; $i++) { Start-Sleep -Seconds 2; $ok = Test-Gateway }
if (-not $ok) { throw "OmniRoute did not become healthy on $health within 300s (measured cold start 195s on the 7.6 GB laptop; GH #8654 = request hang on some Node 24 / Win11 builds). Run: omniroute doctor" }
Write-Host "OmniRoute healthy. Dashboard: http://127.0.0.1:$Port/   Anthropic base URL for Claude Code: http://127.0.0.1:$Port"
