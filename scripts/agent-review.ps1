[CmdletBinding()]
param(
    [ValidateSet('claude', 'gemini', 'both')]
    [string]$Agent = 'both'
)

$ErrorActionPreference = 'Stop'
$prompt = @'
Review the current THE UNITAS GLOBAL workspace. Do not edit files and do not print secrets.
Inspect index.html, config/modules.json, generated revenue pages, Supabase functions, and tests.
Return only actionable findings ordered by severity, covering security, checkout integrity, accessibility, and deployment risk.
'@

function Invoke-Agent([string]$Name, [string]$Command) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        Write-Warning "$Name CLI is not installed; skipping this review."
        return
    }
    Write-Host "Running $Name review..."
    & $Command -p $prompt
    if ($LASTEXITCODE -ne 0) { throw "$Name review failed with exit code $LASTEXITCODE." }
}

if ($Agent -in @('claude', 'both')) { Invoke-Agent 'Claude Code' 'claude' }
if ($Agent -in @('gemini', 'both')) { Invoke-Agent 'Gemini' 'gemini' }
