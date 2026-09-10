<#
.SYNOPSIS
  Launch Claude Code through the local OmniRoute gateway (multi-model fallback / local-first routing), per-process.

.DESCRIPTION
  Requires a gateway key (Dashboard -> Endpoints -> create, starts with oma_live_) in $env:OMNIROUTE_API_KEY.
  Routing is applied ONLY to the spawned `claude` process; nothing is persisted.

.PARAMETER Model   Gateway model id. Examples: auto/coding, auto/cheap, auto/offline, ollama/qwen3:4b (default auto/coding)
.EXAMPLE
  $env:OMNIROUTE_API_KEY = 'oma_live_...'
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/claude-omniroute.ps1 -Model ollama/qwen3:4b
#>
[CmdletBinding()]
param(
    [string]$Model = 'auto/coding',
    [int]$Port = 20128,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$ClaudeArgs
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:OMNIROUTE_API_KEY)) { throw 'Set $env:OMNIROUTE_API_KEY (OmniRoute Dashboard -> Endpoints -> oma_live_...). Fail-closed: refusing to launch without a gateway key.' }
$gateway = Join-Path $PSScriptRoot 'omniroute-gateway.ps1'
& $gateway -Port $Port -Status | Out-Null
if ($LASTEXITCODE -ne 0) { & $gateway -Port $Port }

$env:ANTHROPIC_BASE_URL   = "http://127.0.0.1:$Port"      # no /v1 suffix - Claude Code appends /v1/messages
$env:ANTHROPIC_AUTH_TOKEN = $env:OMNIROUTE_API_KEY
$env:ANTHROPIC_API_KEY    = ''
$env:ANTHROPIC_MODEL      = $Model
$env:CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = '1'   # /model picker lists gateway models (Claude Code >= 2.1.219)

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) { throw 'claude CLI not found on PATH.' }
& $claude.Source @ClaudeArgs
exit $LASTEXITCODE
