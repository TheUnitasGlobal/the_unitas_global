<#
.SYNOPSIS
  Overwrite .claude/skills/unitas-component/SKILL.md from the repo's canonical staging copy.

.DESCRIPTION
  FOUNDER DECREE 2026-09-18 (MISSION 2). The shipped project skill
  `.claude/skills/unitas-component/SKILL.md` was measured as outdated: it describes SIX locales
  (the app ships TWENTY), and it does not mention the quantum-white surface, the THE ONE CARD SKIN
  `--qw-card-*` tokens, the one-layer-glass rule, the motion tokens, ModalPortal/UIGateProvider, the
  live-DB truth contract, or the guard tests a component change must ship with. An agent following
  it produces components that leave 14 locale files empty and ignore the shipped design system.
  `docs/process/IMPECCABLE_TASTE.md` §5 already carries this as a known open item.

  The agent cannot write it directly: the harness auto-mode classifier blocks every write under
  `.claude/**` as [Self-Modification], by design. So the new text is version-controlled in the repo
  at `docs/skills/unitas-component/SKILL.md` -- reviewable in a diff, covered by a guard test -- and
  this script is the founder-run bridge that copies it into place.

  FAIL-CLOSED, in this order:
    1. refuses if the staging copy is missing, empty, or lacks the `---` YAML frontmatter a skill
       file must open with (a malformed SKILL.md silently stops loading as a skill);
    2. backs up the existing target to SKILL.md.bak-<utc timestamp> before touching it;
    3. writes UTF-8 with NO byte-order mark and the staging copy's exact bytes -- a BOM ahead of
       `---` breaks frontmatter parsing, and `Set-Content -Encoding utf8` on Windows PowerShell 5.1
       emits one, which is why this uses UTF8Encoding($false) directly;
    4. re-reads the target and compares sha256 against the source, and restores the backup if they
       differ.

  Nothing else is touched: no settings, no permissions, no other skill, no MCP registration.

.PARAMETER Verify   Report the drift between staging and target, write nothing. Exit 0 = in sync.
.PARAMETER Restore  Put the newest SKILL.md.bak-* back and exit (undo).
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/sync-component-skill.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/sync-component-skill.ps1 -Verify
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/sync-component-skill.ps1 -Restore
#>
[CmdletBinding()]
param(
    [switch]$Verify,
    [switch]$Restore
)
$ErrorActionPreference = 'Stop'

# scripts/agent -> scripts -> index.html
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Source = Join-Path $RepoRoot 'docs\skills\unitas-component\SKILL.md'
$TargetDir = Join-Path $RepoRoot '.claude\skills\unitas-component'
$Target = Join-Path $TargetDir 'SKILL.md'

function Get-Sha256([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
}

function Write-NoBom([string]$path, [string]$text) {
    # UTF8Encoding($false) = no BOM. WriteAllText does not rewrite line endings, so the staging
    # copy's LF endings survive intact.
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

if ($Restore) {
    $backup = Get-ChildItem -LiteralPath $TargetDir -Filter 'SKILL.md.bak-*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if (-not $backup) { throw "No SKILL.md.bak-* found in $TargetDir -- nothing to restore." }
    Write-NoBom $Target ([System.IO.File]::ReadAllText($backup.FullName))
    Write-Host "Restored $($backup.Name) -> SKILL.md"
    exit 0
}

# ---- 1. prove the source before touching anything ---------------------------------------------
if (-not (Test-Path -LiteralPath $Source)) {
    throw "Staging copy missing: $Source. Nothing was written (fail-closed). Pull the branch that carries it."
}
$sourceText = [System.IO.File]::ReadAllText($Source)
if ($sourceText.Length -lt 500) {
    throw "Staging copy is suspiciously small ($($sourceText.Length) chars). Nothing was written (fail-closed)."
}
if ($sourceText -notmatch '^---\r?\n') {
    throw 'Staging copy does not open with YAML frontmatter (---). A SKILL.md without it stops loading as a skill. Nothing was written (fail-closed).'
}
if ($sourceText -notmatch '(?m)^name:\s*unitas-component\s*$') {
    throw 'Staging copy frontmatter does not declare name: unitas-component. Nothing was written (fail-closed).'
}

$sourceHash = Get-Sha256 $Source
$targetHash = Get-Sha256 $Target

if ($Verify) {
    if ($null -eq $targetHash) { Write-Host 'DRIFT: target does not exist yet.'; exit 1 }
    if ($sourceHash -eq $targetHash) { Write-Host 'IN SYNC: .claude/skills/unitas-component/SKILL.md matches the staging copy.'; exit 0 }
    $targetText = [System.IO.File]::ReadAllText($Target)
    Write-Host "DRIFT: target differs from staging (target $($targetText.Length) chars, staging $($sourceText.Length) chars)."
    Write-Host 'Run this script without -Verify to overwrite it.'
    exit 1
}

if ($sourceHash -eq $targetHash) {
    Write-Host 'Already in sync -- nothing to do.'
    exit 0
}

# ---- 2. back up whatever is there today -------------------------------------------------------
$backupPath = $null
if (-not (Test-Path -LiteralPath $TargetDir)) { New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null }
if ($null -ne $targetHash) {
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
    $backupPath = Join-Path $TargetDir "SKILL.md.bak-$stamp"
    Copy-Item -LiteralPath $Target -Destination $backupPath -Force
    Write-Host "Backed up the old skill -> $(Split-Path -Leaf $backupPath)"
}

# ---- 3. write ---------------------------------------------------------------------------------
Write-NoBom $Target $sourceText

# ---- 4. prove the write, or roll back ---------------------------------------------------------
$writtenHash = Get-Sha256 $Target
if ($writtenHash -ne $sourceHash) {
    if ($null -ne $targetHash -and (Test-Path -LiteralPath $backupPath)) {
        Copy-Item -LiteralPath $backupPath -Destination $Target -Force
        throw "Write verification failed (sha256 mismatch) -- restored the backup (fail-closed)."
    }
    throw 'Write verification failed (sha256 mismatch) and there was no backup to restore (fail-closed).'
}

Write-Host "Overwrote .claude/skills/unitas-component/SKILL.md ($($sourceText.Length) chars, sha256 $($writtenHash.Substring(0,16))...)."
Write-Host 'Restart Claude Code (or /clear) so the new skill text is loaded into the next session.'
exit 0
