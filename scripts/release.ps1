[CmdletBinding()]
param(
    [switch]$DeploySupabase,
    [ValidateSet('claude', 'gemini', 'both', 'none')]
    [string]$Review = 'both'
)

$ErrorActionPreference = 'Stop'

npm run build:pages
npm test

if ($Review -ne 'none') {
    & powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent-review.ps1 -Agent $Review
    if ($LASTEXITCODE -ne 0) { throw "Agent review failed with exit code $LASTEXITCODE." }
}

if ($DeploySupabase) {
    npm run deploy:supabase
}

npm run build:site
Write-Host 'Release pipeline completed.'
