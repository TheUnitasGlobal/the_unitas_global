[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$providers = @(
    @{ Name = 'Claude'; Variable = 'ANTHROPIC_API_KEY' },
    @{ Name = 'OpenAI GPT'; Variable = 'OPENAI_API_KEY' },
    @{ Name = 'Google Gemini'; Variable = 'GEMINI_API_KEY' },
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
if (-not (Get-Command gemini -ErrorAction SilentlyContinue)) { Write-Warning 'Gemini CLI is not installed; Gemini Code Assist can still be used.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Warning 'Git CLI is not available in the current shell.' }

Write-Host 'AI provider configuration check completed without printing secret values.'
