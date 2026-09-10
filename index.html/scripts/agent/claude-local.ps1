<#
.SYNOPSIS
  Launch Claude Code against the LOCAL Ollama model (zero API cost, fully private, opt-in, per-process).

.DESCRIPTION
  Ollama >= 0.14 exposes the Anthropic Messages API at http://localhost:11434/v1/messages, so Claude Code
  can drive a local model with three env vars. This launcher sets them ONLY for the spawned `claude`
  process (identical to what `ollama launch claude` does) - nothing is written to ~/.claude/settings.json.

  Hardware doctrine (measured 2026-09-10 on the founder laptop: 7.6 GB RAM, Iris Xe, CPU inference):
    * qwen3:4b (Q4_K_M, 2.5 GB on disk) + 32k q8_0 KV cache = ~5.3 GB resident -> needs >= 3.5 GB FREE RAM.
    * Ollama server env (User scope, set by scripts/setup-toolchain.ps1):
        OLLAMA_CONTEXT_LENGTH=32768  OLLAMA_MAX_LOADED_MODELS=1  OLLAMA_NUM_PARALLEL=1
        OLLAMA_FLASH_ATTENTION=1     OLLAMA_KV_CACHE_TYPE=q8_0   OLLAMA_KEEP_ALIVE=5m
    * The model unloads itself 5 min after the last request (keep_alive) - idle cost is zero.

.PARAMETER Model
  Ollama model tag (default qwen3:4b). Lighter fallback: qwen3:1.7b. Do NOT pull > 4B on this laptop.

.PARAMETER MinFreeGB
  Free-RAM guard (default 3.5). Use -Force to launch anyway.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/claude-local.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/claude-local.ps1 -Model qwen3:1.7b -- -p "summarize README.md"
#>
[CmdletBinding()]
param(
    [string]$Model = 'qwen3:4b',
    [double]$MinFreeGB = 3.5,
    [switch]$Force,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$ClaudeArgs
)

$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:11434'

function Test-Ollama { try { $null = Invoke-RestMethod -Uri "$base/api/version" -TimeoutSec 3; return $true } catch { return $false } }

$ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (-not (Test-Path $ollamaExe)) { $cmd = Get-Command ollama -ErrorAction SilentlyContinue; if ($cmd) { $ollamaExe = $cmd.Source } else { throw 'Ollama not installed. Run: winget install --id Ollama.Ollama -e  (or scripts/setup-toolchain.ps1 -Install)' } }

if (-not (Test-Ollama)) {
    $app = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'
    Write-Host 'Ollama server is down - starting the tray app (detached)...'
    if (Test-Path $app) { explorer.exe $app } else { Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden }
    $ok = $false
    for ($i = 0; $i -lt 30 -and -not $ok; $i++) { Start-Sleep -Seconds 2; $ok = Test-Ollama }
    if (-not $ok) { throw "Ollama did not come up on $base - aborting (fail-closed)." }
}

$tags = Invoke-RestMethod -Uri "$base/api/tags" -TimeoutSec 10
if (-not ($tags.models | Where-Object { $_.name -eq $Model })) {
    Write-Host "Model $Model not present - pulling (one-time download)..."
    & $ollamaExe pull $Model
    if ($LASTEXITCODE -ne 0) { throw "ollama pull $Model failed." }
}

$freeGB = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
if ($freeGB -lt $MinFreeGB -and -not $Force) {
    throw "Only $freeGB GB RAM free (< $MinFreeGB GB). Close heavy apps (browser/IDE) or pass -Force. Local inference would swap-thrash."
}
Write-Host "Free RAM: $freeGB GB  ->  launching Claude Code on local model '$Model' (context 32k, CPU)."

# Per-process only (same trio `ollama launch claude` uses). Never persisted.
$env:ANTHROPIC_BASE_URL   = $base
$env:ANTHROPIC_AUTH_TOKEN = 'ollama'
$env:ANTHROPIC_API_KEY    = ''
$env:ANTHROPIC_DEFAULT_OPUS_MODEL   = $Model
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = $Model
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL  = $Model
$env:CLAUDE_CODE_SUBAGENT_MODEL     = $Model
$env:CLAUDE_CODE_ATTRIBUTION_HEADER = '0'
$env:DISABLE_ERROR_REPORTING        = '1'

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) { throw 'claude CLI not found on PATH.' }
& $claude.Source --model $Model @ClaudeArgs
exit $LASTEXITCODE
