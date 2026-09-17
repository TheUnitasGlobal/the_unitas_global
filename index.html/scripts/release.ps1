[CmdletBinding()]
param(
    [switch]$DeploySupabase,
    # Codex v41.0 ch.4: Claude Code is the sole governing agent. The old
    # 'claude' | 'gemini' VENDOR selector is destroyed; what remains is a LENS
    # selector, both lenses driven by the one agent.
    [ValidateSet('security', 'ux', 'both', 'none')]
    [string]$Review = 'both'
)

$ErrorActionPreference = 'Stop'

npm run build:pages
npm test

if ($Review -ne 'none') {
    & powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent-review.ps1 -Lens $Review
    if ($LASTEXITCODE -ne 0) { throw "Agent review failed with exit code $LASTEXITCODE." }
}

if ($DeploySupabase) {
    npm run deploy:supabase
}

npm run build:site
Write-Host 'Release pipeline completed.'
