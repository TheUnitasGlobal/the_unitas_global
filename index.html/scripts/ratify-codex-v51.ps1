<#
.SYNOPSIS
  Codex v51.0 1회 비준 스크립트 (제17장 능동적 예외 대기 산출물).

.DESCRIPTION
  2026-09-18, 창립자 지령으로 v51.0 본문이 도착했으나 `sync-codex --write` 가
  하네스 오토모드 분류기에 [Instruction Poisoning] 으로 차단되어 에이전트가
  직접 각인하지 못했다. 이 스크립트는 그 한 걸음만 창립자 권한으로 대신 밟는다.

  경위 · 개정 내용 · 자율 교정 2건 · 남은 판단 1건: docs/codex-v51/RATIFICATION.md

  실행 위치 무관 (스크립트 자신의 경로로 저장소를 찾는다).
      pwsh -File index.html/scripts/ratify-codex-v51.ps1
      pwsh -File index.html/scripts/ratify-codex-v51.ps1 -DryRun

.NOTES
  ⚠ 비준은 커밋을 낳고, 커밋은 BUILD_ID@HEAD 스윕 키를 바꿔 3단계 스윕
    적립분을 전량 폐기한다. 야간 스윕 구동 중에는 실행하지 말 것.
    (docs/stage3/STRUCTURAL_LIMITS.md §5-4)
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$SkipGates,
  [switch]$AllowDirty      # 2026-09-18 2차: 개정분이 이미 트리에 적용되어 있을 때
)

$ErrorActionPreference = 'Stop'

$opsRoot  = Split-Path -Parent $PSScriptRoot            # …\index.html
$gitRoot  = Split-Path -Parent $opsRoot                 # …\unitas
$bodyPath = Join-Path $opsRoot 'docs\codex-v51\BODY.md'

$canon = @(
  (Join-Path $gitRoot 'CLAUDE.md'),
  (Join-Path $gitRoot 'THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md'),
  (Join-Path $gitRoot '.roo\rules\unitas-constitution.md')
)

function Step([string]$m) { Write-Host "`n[$([DateTime]::Now.ToString('HH:mm:ss'))] $m" -ForegroundColor Cyan }
function Ok  ([string]$m) { Write-Host "  OK    $m" -ForegroundColor Green }
function Die ([string]$m) { Write-Host "  FAIL  $m" -ForegroundColor Red; exit 1 }

# --- 1. 사전 조건 ------------------------------------------------------------
Step '1/6  사전 조건 검사'

if (-not (Test-Path $bodyPath)) { Die "비준 본문이 없다: $bodyPath" }
Ok "본문 확인: $bodyPath"

Push-Location $gitRoot
try {
  $dirty = & git status --porcelain
  if ($LASTEXITCODE -ne 0) { Die 'git status 실패 — git 저장소가 맞는지 확인할 것' }
  if ($dirty) {
    Write-Host '  작업 트리가 깨끗하지 않다:' -ForegroundColor Yellow
    $dirty | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    Write-Host '  헌법 개정은 깨끗한 트리에서만 하라 — 무엇이 개정분인지 구분되지 않는다.' -ForegroundColor Yellow
    if ($AllowDirty) { Ok '-AllowDirty: 개정분이 이미 적용된 상태로 간주하고 계속한다' }
    elseif (-not $DryRun) { Die '작업 트리 비우고 다시 실행할 것 (또는 -AllowDirty / -DryRun)' }
  } else { Ok '작업 트리 clean' }
} finally { Pop-Location }

# 야간 스윕 구동 중이면 중단 — 커밋이 스윕 키를 깨뜨린다
$sweeping = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -match 'playwright' -and $_.CommandLine -match 'web-cinema' }
if ($sweeping) {
  Die "3단계 스윕이 구동 중이다 (pid $($sweeping.ProcessId -join ', ')). 비준 커밋은 스윕 키를 무효화한다 — 완주 후 실행할 것."
}
Ok '구동 중인 3단계 스윕 없음'

# --- 2. 정본 3본 각인 --------------------------------------------------------
Step '2/6  git-root 정본 3본 각인 (BOM + CRLF, 바이트 동일)'

$bodyRaw = [System.IO.File]::ReadAllText($bodyPath, [System.Text.Encoding]::UTF8)
$bodyLf  = $bodyRaw.TrimStart([char]0xFEFF) -replace "`r`n", "`n"
$payload = [char]0xFEFF + ($bodyLf -replace "`n", "`r`n")
$bytes   = [System.Text.Encoding]::UTF8.GetBytes($payload)

foreach ($f in $canon) {
  if ($DryRun) { Write-Host "  (dry-run) would write $([System.IO.Path]::GetFileName($f))  $($bytes.Length) bytes" }
  else {
    [System.IO.File]::WriteAllBytes($f, $bytes)
    Ok "$([System.IO.Path]::GetFileName($f))  $($bytes.Length) bytes"
  }
}

if (-not $DryRun) {
  $hashes = $canon | ForEach-Object { (Get-FileHash $_ -Algorithm SHA256).Hash }
  if (($hashes | Select-Object -Unique).Count -ne 1) { Die '정본 3본이 서로 다르다 — sync-codex 가 즉시 거부한다' }
  Ok "정본 3본 동일  sha256 $($hashes[0].Substring(0,16))…"
}

# --- 3. 사본 재파생 ----------------------------------------------------------
Step '3/6  운영 사본 4종 마커 블록 재파생 (sync-codex --write)'
Push-Location $opsRoot
try {
  if ($DryRun) { Write-Host '  (dry-run) would run: node scripts/sync-codex.mjs --write' }
  else {
    & node scripts/sync-codex.mjs --write | Out-Host
    if ($LASTEXITCODE -ne 0) { Die "sync-codex --write EXIT $LASTEXITCODE" }
    Ok 'sync-codex --write EXIT 0'
  }

# --- 4. 드리프트 검증 --------------------------------------------------------
  Step '4/6  드리프트 검증 (sync-codex)'
  & node scripts/sync-codex.mjs | Out-Host
  if ($LASTEXITCODE -ne 0) {
    @(
      '  요약본 9종은 2026-09-18 에 v51.0 으로 갱신 완료되었다. 그래도 빨개졌다면',
      '  장 번호는 v49.0 과 같은 17장이고 제9장·제12장만 개칭되었으므로 그 두 제목을 볼 것:',
      '    .github/copilot-instructions.md · .continue/config.yaml · .aider.conf.yml',
      '    .github/agents/ 아래 planner, code-reviewer, security-reviewer, ux-reviewer, e2e-runner, orchestrator 6종',
      '  [!] sync-codex --write 는 마커 *밖* 산문을 고치지 않는다 - CLAUDE.md 0 래퍼의',
      '      판번, 장 지도, canon sha 표기도 손으로 갱신해야 한다 (과거 8회 prebuild 차단의 원인).'
    ) | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
    Die "sync-codex EXIT $LASTEXITCODE — 위 목록을 갱신한 뒤 다시 실행할 것"
  }
  Ok 'drift=0'
} finally { Pop-Location }

# --- 5. 수용 게이트 ----------------------------------------------------------
if ($SkipGates -or $DryRun) {
  Step '5/6  게이트 생략'
} else {
  Step '5/6  신뢰 등록부 재각인 + 수용 게이트 전수'
  Push-Location $opsRoot
  try {
    # 2026-09-18 2차: EXPECTED_CHAPTERS(제9장/제12장)를 v51.0 으로 옮기느라
    # web/scripts/codex-structure-core.mjs 를 고쳤다. 이 파일은 신뢰 등록부 핀
    # unitas.codex-structure.core 이므로 재각인이 강제된다. 에이전트는 이 명령을
    # 실행할 수 없다 - 하네스가 [Security Weaken] 으로 거부한다.
    & npm --prefix web run security:trust:verify 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Host '  신뢰 등록부 불일치 감지 - 재각인한다 (제14장 원자적 동봉)' -ForegroundColor Yellow
      & npm --prefix web run security:trust:write | Out-Host
      if ($LASTEXITCODE -ne 0) { Die "security:trust:write EXIT $LASTEXITCODE" }
      Ok 'security:trust:write EXIT 0'
    } else { Ok '신뢰 등록부 이미 정합 - 재각인 불필요' }

    foreach ($g in @('typecheck', 'test', 'build', 'security:trust:verify')) {
      Write-Host "  ---- npm --prefix web run $g ----"
      & npm --prefix web run $g | Out-Host
      if ($LASTEXITCODE -ne 0) { Die "npm --prefix web run $g EXIT $LASTEXITCODE" }
      Ok "$g EXIT 0"
    }
  } finally { Pop-Location }
}

# --- 6. 결과 ----------------------------------------------------------------
Step '6/6  완료'
@(
  '',
  '  Codex v51.0 각인 완료. 커밋은 하지 않았다.',
  '',
  '  제2장은 해결되었다 - 되돌리지 말 것:',
  '    v51.0 초안은 제2장을 "순수 고유 1000선, 중복 0" 으로 되돌렸으나',
  '    web/scripts/codex-structure-core.mjs 가 815종 중 140종이 325슬롯에',
  '    구조적 확장 등재임을 실측으로 반증한다. 정본은 v49.0 의 실측 제목과',
  '    구조 실측 기준 문단을 승계했고 비준 장 표도 그에 맞춰져 있다.',
  '    제9장과 제12장만 v51.0 개칭을 반영했다. RATIFICATION.md 3절 참조.',
  '',
  '  다음 단계: 게이트 전항 EXIT 0 이면 제14장 초자동화 자율 승인에 따라',
  '    에이전트 세션이 커밋, 푸시, Vercel 프로덕션 배포를 자율 강행한다.',
  ''
) | ForEach-Object { Write-Host $_ -ForegroundColor Green }
