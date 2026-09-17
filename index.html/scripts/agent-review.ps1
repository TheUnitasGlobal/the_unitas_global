[CmdletBinding()]
param(
    [ValidateSet('security', 'ux', 'both')]
    [string]$Lens = 'both',
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
# SINGLE SOURCE OF TRUTH. The review criteria are NOT duplicated in this
# script. They are read out of the two agent definition files, with their YAML
# frontmatter stripped. Edit the criteria there; this file only drives them.
#
# FAIL-CLOSED. The old script warned and continued when a CLI was missing --
# defensible then, because the other agent could still run. With a single
# governing agent there is no second opinion left, so "claude is not
# installed" now means the review did not happen, and a review that did not
# happen must not report success (ch.13). Pass -AllowMissing to downgrade
# that to a warning for a machine that deliberately has no CLI.
#
# Usage:
#   powershell -File scripts/agent-review.ps1                 # both lenses
#   powershell -File scripts/agent-review.ps1 -Lens security  # security only
#   powershell -File scripts/agent-review.ps1 -Lens ux        # UX only
#   npm run review:agents
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$agentDir = Join-Path $repoRoot '.github/agents'

$lenses = [ordered]@{
    security = @{
        Title = 'Sovereign security & deployment review'
        File  = Join-Path $agentDir 'unitas-claude-reviewer.agent.md'
    }
    ux = @{
        Title = 'Sovereign UX, content & accessibility review'
        File  = Join-Path $agentDir 'unitas-ux-reviewer.agent.md'
    }
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

$selected = if ($Lens -eq 'both') { @('security', 'ux') } else { @($Lens) }

foreach ($key in $selected) {
    $lens = $lenses[$key]
    $prompt = Get-AgentPrompt $lens.File
    $scope = @"
$($prompt)

Scope for this run: the THE UNITAS GLOBAL workspace rooted at $repoRoot.
Inspect index.html, config/modules.json, the generated revenue pages, the Next.js app under web/, the Supabase functions and the tests.
Do not edit files. Do not print secrets. Return only actionable findings, ordered by severity.
"@
    Write-Host "== $($lens.Title) ==" -ForegroundColor Cyan
    & $claude.Source -p $scope
    if ($LASTEXITCODE -ne 0) { throw "$($lens.Title) failed with exit code $LASTEXITCODE." }
}

Write-Host 'Sovereign review complete -- single governing agent (Codex ch.4).'
