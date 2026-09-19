<#
.SYNOPSIS
  Install (or audit) the REV-43 business-automation skillset into the user-scope skills folder - idempotent, fail-closed.

.DESCRIPTION
  FOUNDER DIRECTIVE 2026-09-18 (Codex ch.6 autonomous evolution / tool extension): the four capability
  targets - UI/UX architecture (web-artifacts-builder, theme-factory), data & finance, legal & PDF,
  global automation (Bright Data scraping, marketing / sales pipelines) - are installed as agent SKILLS
  from the open skills registry (https://skills.sh), the same channel the 2026-09-10 toolchain used.

  Design (docs/rev43/SPEC.md D-1 / D-2):
    * User scope, COPIED: ~/.claude/skills/<skill>/SKILL.md  (npx skills add ... -g -y --copy). The
      session starts at the git root while the app lives in index.html/web, so a project scope would
      never line up; and --copy sidesteps the Windows junction gap (vercel-labs/skills#851).
    * Nothing in the repository is modified by an install: no CLAUDE.md, no .claude/**, no settings,
      no .mcp.json. The manifest of what SHOULD be installed lives here (and mirrored in
      config/agent-toolkit.json "skillset"), so a new laptop reproduces the set with one command.
    * Fail-closed: every entry is verified by the presence of its SKILL.md after the install; a missing
      or failed entry is reported by name and the script exits non-zero. -Status never installs.
    * Selection criteria (SPEC §1): official sources first (anthropics/skills, anthropics/
      knowledge-work-plugins, the vendor's own brightdata/skills), then the registry leaderboard
      (coreyhaines31/marketingskills) - nothing below ~1K installs, no unverifiable finance advice.

  Python helpers: the anthropics `pdf` and `xlsx` skills ship scripts that import pypdf / pdfplumber /
  openpyxl. -PythonDeps installs those three for the current user (pip --user); it is separate from
  the skill copy so an offline audit still works.

.PARAMETER Install     Install every entry that is not already present (idempotent).
.PARAMETER PythonDeps  pip install --user pypdf pdfplumber openpyxl (the pdf / xlsx skill scripts need them).
.PARAMETER Status      Print the audit table only (default when no switch is given).
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-skillset.ps1 -Install -PythonDeps
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-skillset.ps1 -Status
#>
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$PythonDeps,
    [switch]$Status
)
$ErrorActionPreference = 'Stop'

# Pinned to the CLI the 2026-09-10 toolchain verified; bump deliberately with scripts/setup-toolchain.ps1.
$SkillsCli = 'skills@1.5.25'

# The manifest. `skill` is the folder name the CLI creates under ~/.claude/skills.
$SKILLSET = @(
    # -- UI/UX architecture (U-Square hyper-theme rendering) ----------------------------------
    @{ repo = 'anthropics/skills';                 skill = 'web-artifacts-builder'; group = 'ui';        purpose = 'single-file React/Tailwind artifact bundler for theme prototypes (never pasted into web/ verbatim: re-key to UNITAS tokens)' },
    @{ repo = 'anthropics/skills';                 skill = 'theme-factory';         group = 'ui';        purpose = 'theme token generation for the twenty U-Square themes' },
    # -- Data / finance (Wise & Xolo close, Micro-Burn margin tracking) ------------------------
    @{ repo = 'anthropics/skills';                 skill = 'xlsx';                  group = 'data';      purpose = 'spreadsheet read/write with formulas (needs openpyxl)' },
    @{ repo = 'anthropics/knowledge-work-plugins'; skill = 'explore-data';          group = 'data';      purpose = 'structured exploratory analysis of a dataset' },
    @{ repo = 'anthropics/knowledge-work-plugins'; skill = 'data-visualization';    group = 'data';      purpose = 'chart and dashboard drafting from tabular data' },
    @{ repo = 'anthropics/knowledge-work-plugins'; skill = 'financial-statements';  group = 'finance';   purpose = 'income statement / balance sheet / cash-flow analysis' },
    @{ repo = 'anthropics/knowledge-work-plugins'; skill = 'close-management';      group = 'finance';   purpose = 'month-end close checklist and reconciliation flow' },
    @{ repo = 'anthropics/knowledge-work-plugins'; skill = 'invoice-chase';         group = 'finance';   purpose = 'receivables follow-up drafting' },
    # -- Legal / PDF (U-Signature document integrity) ------------------------------------------
    @{ repo = 'anthropics/skills';                 skill = 'pdf';                   group = 'legal';     purpose = 'PDF text/table extraction, merge, fill, sign-field inspection (needs pypdf, pdfplumber)' },
    @{ repo = 'anthropics/knowledge-work-plugins'; skill = 'legal-risk-assessment'; group = 'legal';     purpose = 'clause-level legal risk scan' },
    @{ repo = 'anthropics/knowledge-work-plugins'; skill = 'review-contract';       group = 'legal';     purpose = 'contract review checklist and redline notes' },
    # -- Global automation (scraping, marketing, sales) -----------------------------------------
    @{ repo = 'brightdata/skills';                 skill = 'scrape';                group = 'scraping';  purpose = 'Bright Data scraping playbook (CLI / MCP usage patterns)' },
    @{ repo = 'brightdata/skills';                 skill = 'search';                group = 'scraping';  purpose = 'Bright Data SERP search playbook' },
    @{ repo = 'brightdata/skills';                 skill = 'bright-data-mcp';       group = 'scraping';  purpose = 'how to drive the Bright Data MCP server (registered by setup-brightdata.ps1 -Standby once BRIGHTDATA_API_TOKEN exists)' },
    @{ repo = 'coreyhaines31/marketingskills';     skill = 'copywriting';           group = 'marketing'; purpose = 'landing / launch copy frameworks' },
    @{ repo = 'coreyhaines31/marketingskills';     skill = 'seo-audit';             group = 'marketing'; purpose = 'technical + content SEO audit' },
    @{ repo = 'coreyhaines31/marketingskills';     skill = 'content-strategy';      group = 'marketing'; purpose = 'editorial calendar and pillar planning' },
    @{ repo = 'coreyhaines31/marketingskills';     skill = 'sales-enablement';      group = 'sales';     purpose = 'sales collateral, objection handling, playbooks' },
    @{ repo = 'anthropics/knowledge-work-plugins'; skill = 'draft-outreach';        group = 'sales';     purpose = 'outbound outreach drafting' }
)

$userHome = [Environment]::GetFolderPath('UserProfile')
$skillsDir = Join-Path $userHome '.claude\skills'

function Test-Installed([string]$Skill) {
    return Test-Path (Join-Path (Join-Path $skillsDir $Skill) 'SKILL.md')
}

function Write-Board {
    $rows = foreach ($s in $SKILLSET) {
        [pscustomobject]@{
            group     = $s.group
            skill     = $s.skill
            source    = $s.repo
            installed = if (Test-Installed $s.skill) { 'yes' } else { 'NO' }
        }
    }
    $rows | Format-Table -AutoSize | Out-String | Write-Host
    $missing = @($rows | Where-Object { $_.installed -eq 'NO' })
    Write-Host ("Skillset: {0}/{1} installed under {2}" -f ($rows.Count - $missing.Count), $rows.Count, $skillsDir)
    return $missing.Count
}

if (-not $Install -and -not $PythonDeps) { $Status = $true }

if ($Install) {
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { throw 'npx not found on PATH (Node.js is required).' }
    $failed = @()
    foreach ($s in $SKILLSET) {
        if (Test-Installed $s.skill) { Write-Host ("  = {0} already installed" -f $s.skill); continue }
        Write-Host ("  + {0}  <-  {1}@{2}" -f $s.skill, $s.repo, $s.skill)
        # Same command shape scripts/setup-toolchain.ps1 used on 2026-09-10 (user scope, copied, no prompts).
        & npx -y $SkillsCli add $s.repo --skill $s.skill -a claude-code -g -y --copy
        if ($LASTEXITCODE -ne 0 -or -not (Test-Installed $s.skill)) {
            Write-Warning ("  ! {0} did not land ({1}@{2}, exit {3})" -f $s.skill, $s.repo, $s.skill, $LASTEXITCODE)
            $failed += $s.skill
        }
    }
    if ($failed.Count -gt 0) {
        Write-Warning ("Skillset install incomplete: {0}" -f ($failed -join ', '))
    }
}

if ($PythonDeps) {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'python not found on PATH.' }
    Write-Host '  + pip --user pypdf pdfplumber openpyxl (pdf / xlsx skill scripts)'
    & python -m pip install --user --disable-pip-version-check --quiet pypdf pdfplumber openpyxl
    if ($LASTEXITCODE -ne 0) { throw 'pip install of the pdf / xlsx helpers failed.' }
    & python -c "import pypdf, pdfplumber, openpyxl; print('python deps ok:', pypdf.__version__, pdfplumber.__version__, openpyxl.__version__)"
    if ($LASTEXITCODE -ne 0) { throw 'the pdf / xlsx helpers do not import after install.' }
}

$missingCount = Write-Board
if ($missingCount -gt 0) {
    Write-Warning ("{0} skill(s) missing - run with -Install (fail-closed)." -f $missingCount)
    exit 1
}
exit 0
