[CmdletBinding()]
param(
    [switch]$DeploySupabase,
    # Codex v41.0 ch.4: Claude Code is the sole governing agent. The old
    # 'claude' | 'gemini' VENDOR selector is destroyed; what remains is a LENS
    # selector, every lens driven by the one agent. 2026-09-18 (MISSION 1):
    # the two lenses became the five-stage role pipeline
    # plan -> code -> security -> ux -> e2e. 'all' is the whole pipeline,
    # 'review' the four read-only stages, and 'both' still resolves to the
    # legacy security+ux pair so older invocations keep working.
    #
    # The default is 'review', not 'all': this script already runs `npm test`
    # (doctrine:verify -> typecheck -> vitest -> build) a few lines below, so
    # adding the e2e stage here would pay for the same measurement twice. Use
    # -Review all when a release genuinely needs the Playwright tier.
    [ValidateSet('plan', 'code', 'security', 'ux', 'e2e', 'review', 'all', 'both', 'none')]
    [string]$Review = 'review'
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
