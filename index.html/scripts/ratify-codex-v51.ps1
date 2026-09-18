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
  [switch]$SkipGates
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
    if (-not $DryRun) { Die '작업 트리 비우고 다시 실행할 것 (또는 -DryRun 으로 점검만)' }
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
      '  요약본이 판번 때문에 빨개졌을 가능성이 높다. 장 구조(17장)는 v49.0 과 동일하므로',
      '  대개 판번 문자열 교체만 필요하다. 대상 9종:',
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
  Step '5/6  수용 게이트 전수 (typecheck · test · build · trust:verify)'
  Push-Location $opsRoot
  try {
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
  '  남은 판단 1건 - 제2장 "순수 고유 1000선, 중복 0":',
  '    이 저장소의 web/scripts/codex-structure-core.mjs 가 그 주장을 반증한다',
  '    (814종 중 138종이 324슬롯 반복 등재). 독트린 테스트가 빨갛다면 프로그램이',
  '    헌법 문장을 기각한 것이다. docs/codex-v51/RATIFICATION.md 3절 참조.',
  '',
  '  다음 단계: 게이트 전항 EXIT 0 이면 제14장 초자동화 자율 승인에 따라',
  '    에이전트 세션이 커밋, 푸시, Vercel 프로덕션 배포를 자율 강행한다.',
  ''
) | ForEach-Object { Write-Host $_ -ForegroundColor Green }
