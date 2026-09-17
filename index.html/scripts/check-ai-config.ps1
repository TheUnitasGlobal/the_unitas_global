[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
# Codex v41.0 ch.4 -- Claude Code is the sole governing agent; Gemini was
# removed from this roster on 2026-09-17 along with every call site, so this
# check no longer reports a key for an agent the constitution excludes.
# OpenAI and DeepSeek stay: they are MODEL providers the app itself calls
# (web/ U-AI falls back to OPENAI_API_KEY on Vercel), not rival control towers.
$providers = @(
    @{ Name = 'Claude'; Variable = 'ANTHROPIC_API_KEY' },
    @{ Name = 'OpenAI GPT'; Variable = 'OPENAI_API_KEY' },
    @{ Name = 'DeepSeek'; Variable = 'DEEPSEEK_API_KEY' }
)

foreach ($provider in $providers) {
    $value = [Environment]::GetEnvironmentVariable($provider.Variable)
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Warning "$($provider.Name): $($provider.Variable) is not set"
    } else {
        Write-Host "$($provider.Name): configured"
    }
}

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Write-Warning 'Claude Code CLI is not installed; the VS Code extension can still be used.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Warning 'Git CLI is not available in the current shell.' }

Write-Host 'AI provider configuration check completed without printing secret values.'
