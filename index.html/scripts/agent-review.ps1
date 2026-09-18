[CmdletBinding()]
param(
    # Five pipeline stages, in execution order, plus three group selectors:
    #   review = plan,code,security,ux (read-only lenses)
    #   all    = the full pipeline, review + e2e  (default)
    #   both   = the legacy security+ux pair, kept so existing callers keep working
    [ValidateSet('plan', 'code', 'security', 'ux', 'e2e', 'review', 'all', 'both')]
    [string]$Lens = 'all',
    [switch]$AllowMissing
)

# ---------------------------------------------------------------------------
# agent-review.ps1 -- THE UNITAS GLOBAL sovereign review pass.
# Codex v41.0 ch.4 (Sole Absolute Governing Agent) + ch.13 (Fail-Closed).
#
# WHY THIS FILE WAS REWRITTEN (founder directive 2026-09-17, MISSION 1).
# Until this revision the script ran TWO agents: `claude -p` and `gemini -p`,
# and `-Agent both` was its default. Chapter 4 of the v41.0 canon is explicit:
#
#   "오직 Claude Code만이 팩토리의 중앙 컨트롤 타워로서 ... 총괄한다.
#    ... Gemini, Roo Code 등 일체의 수동 서포트 에이전트 연동 및 수동 개입
#    의존성을 완전히 파기하고 영구 배제한다."
#
# A file that shells out to `gemini` is therefore not a stylistic preference
# to weigh -- it is a live violation of the governing constitution, and it was
# reachable from `npm run review:agents` and from every `npm run release`.
# The Gemini invocation is destroyed here, permanently. It is not commented
# out, not behind a flag, and not recoverable by passing an argument: the
# parameter that used to select it no longer exists.
#
# WHAT REPLACES IT. The Gemini pass was not worthless -- it carried the
# UX / content / accessibility LENS, which the security lens does not cover.
# Losing the lens would have been a regression, so the lens was kept and the
# vendor was dropped: `.github/agents/unitas-gemini-reviewer.agent.md` became
# `.github/agents/unitas-ux-reviewer.agent.md`, and Claude Code runs both
# lenses. One governing agent, two perspectives.
#
# THE ROLE PIPELINE (founder directive 2026-09-18, MISSION 1). Two lenses were
# never the whole job. A change is only actually verified when someone has
# scoped it before it was written, read it for correctness, read it for
# security, read it for UX, and then MEASURED it. Those are five roles, so the
# two lenses became a five-stage ordered pipeline:
#
#   plan -> code -> security -> ux -> e2e
#
# Stage order is the [ordered] hashtable below, and a stage that exits non-zero
# stops the pipeline (ch.13 fail-closed) -- there is no point reviewing the UX
# of a change whose plan was rejected.
#
# This is NOT a re-introduction of auxiliary agents. Chapter 4 forbids handing
# work to another vendor's CLI; it does not forbid the one governing agent from
# running several passes over the same workspace. Every stage below is the same
# `claude` binary reading a different charter. `unitas-claude-reviewer.agent.md`
# was renamed `unitas-security-reviewer.agent.md` in the same pass: with five
# roles, naming one after the vendor was the last fossil of the destroyed
# vendor selector.
#
# SINGLE SOURCE OF TRUTH. The review criteria are NOT duplicated in this
# script. They are read out of the five agent definition files, with their YAML
# frontmatter stripped. Edit the criteria there; this file only drives them.
# `scripts/sync-codex.mjs` discovers `.github/agents/*.agent.md` by glob, so a
# role added here is gated against doctrine drift automatically.
#
# FAIL-CLOSED. The old script warned and continued when a CLI was missing --
# defensible then, because the other agent could still run. With a single
# governing agent there is no second opinion left, so "claude is not
# installed" now means the review did not happen, and a review that did not
# happen must not report success (ch.13). Pass -AllowMissing to downgrade
# that to a warning for a machine that deliberately has no CLI.
#
# Usage:
#   powershell -File scripts/agent-review.ps1                 # full pipeline (plan->code->security->ux->e2e)
#   powershell -File scripts/agent-review.ps1 -Lens review    # the four read-only lenses, no test execution
#   powershell -File scripts/agent-review.ps1 -Lens security  # one stage only
#   powershell -File scripts/agent-review.ps1 -Lens both      # legacy security+ux pair
#   npm run review:agents
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$agentDir = Join-Path $repoRoot '.github/agents'

# Declaration order IS pipeline order. Adding a role here and dropping its
# charter into .github/agents/ is the whole registration -- nothing else in the
# repo enumerates the roles.
$lenses = [ordered]@{
    plan = @{
        Title   = 'Sovereign planning & scope review'
        File    = Join-Path $agentDir 'unitas-planner.agent.md'
        Charter = 'Do not edit files. Produce a plan: ETA first, scope fence, approval boundaries, gate commands, blast radius.'
    }
    code = @{
        Title   = 'Sovereign correctness, reuse & simplicity review'
        File    = Join-Path $agentDir 'unitas-code-reviewer.agent.md'
        Charter = 'Do not edit files. Do not print secrets. Return only actionable correctness findings, ordered by severity, each with file:line.'
    }
    security = @{
        Title   = 'Sovereign security & deployment review'
        File    = Join-Path $agentDir 'unitas-security-reviewer.agent.md'
        Charter = 'Do not edit files. Do not print secrets. Return only actionable findings, ordered by severity.'
    }
    ux = @{
        Title   = 'Sovereign UX, content & accessibility review'
        File    = Join-Path $agentDir 'unitas-ux-reviewer.agent.md'
        Charter = 'Do not edit files. Do not print secrets. Return only actionable findings, ordered by severity.'
    }
    e2e = @{
        Title   = 'Sovereign verification tier selection & execution'
        File    = Join-Path $agentDir 'unitas-e2e-runner.agent.md'
        # The only stage permitted to run commands -- and still barred from the
        # tier-3 sweep, which belongs to the UnitasIdleSensorStage3 daemon.
        Charter = 'Do not edit application code. You may RUN verification commands. Never start the three-engine full sweep in the foreground, and never omit --output=test-results/stage3-artifacts from a Playwright run. Report the tier chosen, the exact command, the measured output, and the failure classification.'
    }
}

# Group selectors. 'both' predates the pipeline and is kept so existing callers
# (scripts/release.ps1, any founder muscle memory) keep resolving.
$groups = @{
    review = @('plan', 'code', 'security', 'ux')
    all    = @('plan', 'code', 'security', 'ux', 'e2e')
    both   = @('security', 'ux')
}

# Strips the leading `---` YAML frontmatter block so only the instruction body
# reaches the CLI. Anything before the second `---` is metadata for the agent
# registry, not a prompt.
function Get-AgentPrompt([string]$Path) {
    if (-not (Test-Path $Path -PathType Leaf)) {
        throw "Agent definition is missing at $Path -- the review criteria have no source."
    }
    $raw = Get-Content $Path -Raw
    if ($raw -match '(?s)^\s*---\r?\n.*?\r?\n---\r?\n(.*)$') { return $Matches[1].Trim() }
    return $raw.Trim()
}

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) {
    $message = 'Claude Code CLI is not on PATH. Codex ch.4 names it the sole governing agent, so no review ran.'
    if ($AllowMissing) {
        Write-Warning "$message (-AllowMissing: continuing without a review.)"
        return
    }
    throw "$message Install it, or re-run with -AllowMissing to skip the review deliberately."
}

$selected = if ($groups.ContainsKey($Lens)) { $groups[$Lens] } else { @($Lens) }

$stage = 0
foreach ($key in $selected) {
    $stage++
    $lens = $lenses[$key]
    $prompt = Get-AgentPrompt $lens.File
    $scope = @"
$($prompt)

Scope for this run: the THE UNITAS GLOBAL workspace rooted at $repoRoot.
Inspect index.html, config/modules.json, the generated revenue pages, the Next.js app under web/, the Supabase functions and the tests.
You are stage $stage of $($selected.Count) in the sovereign role pipeline ($($selected -join ' -> ')). Stay in your own lane: a finding that belongs to another stage gets one line, not an adjudication.
$($lens.Charter)
"@
    Write-Host "== [$stage/$($selected.Count)] $($lens.Title) ==" -ForegroundColor Cyan
    & $claude.Source -p $scope
    # Fail-closed, and fail EARLY (ch.13): a rejected plan makes the later
    # stages meaningless, so the pipeline stops at the first non-zero stage.
    if ($LASTEXITCODE -ne 0) { throw "$($lens.Title) failed with exit code $LASTEXITCODE. Pipeline stopped at stage $stage/$($selected.Count)." }
}

Write-Host "Sovereign role pipeline complete -- $($selected.Count) stage(s), single governing agent (Codex ch.4)." -ForegroundColor Green
