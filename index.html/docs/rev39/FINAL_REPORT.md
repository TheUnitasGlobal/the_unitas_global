# REV-39 최종 완결 종합 보고서 — v37.0 잔여 블로커 소멸 및 아키텍처 실체화

창립자 지령 2026-09-16 · 기준: Codex v37.0 제1장~제14장 · 근거: v37 독트린 6축 전수 감사 잔여 8건

## 0. 선행 정정 — MISSION 1은 이미 존재했다

지령은 "유휴 감지기를 새롭게 창조하라"였으나, 해당 실행체는 **REV-35에서 구축·배포되어 가동 중**이었고 REV-36에서 디스크 프로브·신뢰 등록·자기 증명으로 강화됐다. 재창조 대신 실측해 **진짜 공백**을 찾았고, 그것이 훨씬 중대했다.

> **모든 스윕이 단 한 번도 완주한 적이 없다.** 3엔진 전수는 약 1.5시간인데 창립자는 그 전에 반드시 복귀하므로, 매 유휴 창마다 전체가 취소되고 다음 창은 **처음부터 다시** 시작했다. 커버리지는 영원히 0으로 수렴한다.

## 1. MISSION 1 — "준비"/Resume의 실체화 (프로젝트 단위 샤딩)

제13장이 명시한 "정지 → 그 지점 영구 저장 → 스스로 이어서 완결"을 **프로젝트 샤딩 + 체크포인트**로 구현했다.

- 스윕은 이제 `--project=<p>` 하나씩 실행된다. 한 샤드(약 15~25분)는 현실적인 유휴 창 안에 들어간다.
- 완주한 샤드는 `test-results/stage3/progress.json`에 `BUILD_ID@HEAD` 키로 체크포인트된다. 취소는 **진행 중이던 한 프로젝트만** 잃고, 다음 창이 나머지부터 이어간다.
- 모든 샤드가 모이면 `aggregateShards`가 기존과 **동일한 형태의** 단일 요약으로 접어 `latest.json`/`latest.md`에 쓴다 — READER 절차와 아침 브리핑은 변경 없이 그대로 동작한다.
- 빌드나 HEAD가 바뀌면 전 샤드를 폐기한다(서로 다른 산출물의 결과를 절대 섞지 않는다).
- 순수 함수(`shardState`·`nextShard`·`recordShard`·`shardsComplete`·`aggregateShards`)로 분리, vitest 18케이스로 증명. 프로젝트 목록은 코어와 Playwright 설정 간 **드리프트 게이트**로 고정.

## 2. MISSION 3 — 옴니-디바이스 커버리지 및 게이트 복원

### 2.1 태블릿 + 인앱 (감사 [high] 2건 소멸)
Playwright 프로젝트를 3 → **6개**로 확장했다.

| 프로젝트 | 커버 |
|---|---|
| `tablet` | 820×1180 + **터치**. `quantum-white.css`가 `max-width:767px`에서 분기하므로 768+는 미측정 경계였고, "넓은 폭 + 손가락" 조합은 존재한 적이 없었다. |
| `inapp-kakao` / `inapp-instagram` | KakaoTalk·Instagram WebView UA. 인앱 커버리지는 순수 단위 테스트에만 기대고 있었다. |

신규 스펙 `rev39-omni-device.spec.js` **7통과·2의도적 skip**: 가로 오버플로 0, U-Square 20테마 렌더, 레일이 뷰포트를 넘지 않음, 태블릿 손가락 드래그 동작.

**부수 발견·수정**: `IN_APP_HTML_ATTR`(`<html data-inapp="…">`)은 상수로 선언만 되고 **어디서도 기록되지 않았다** — 감사가 말한 "인앱 분기 부재"의 실체. 문서화된 계약을 실제로 구현해 CSS·React가 재탐지 없이 컨테이너를 읽을 수 있게 했고, 인앱 프로젝트가 이를 단언한다.

### 2.2 ⚠ CI가 지금까지 한 번도 실행된 적이 없었다
기존 워크플로 2개는 `index.html/.github/workflows/`에 있었다. **GitHub은 저장소 루트의 `.github/workflows/`만 읽는다** — git 루트는 `C:/dev/unitas`이므로 두 워크플로는 배선된 적이 없다. 신규 게이트를 **올바른 루트 위치**에 배치했다: `.github/workflows/quality-gates.yml`(typecheck → vitest → 프로덕션 빌드 → chromium E2E). 6프로젝트 전수는 제13장대로 로컬 유휴 데몬에 남긴다(러너는 유휴를 관측할 수 없고 WebKit 기준선도 이전되지 않으며 0원 독트린에 반한다).

### 2.3 [low] 2건 소거
- **루트 `npm test`가 죽은 표면 측정**: `file://index.html`(레거시 정적 사이트) 12테스트만 돌고 제품인 `web/`은 어디서도 검증되지 않았다. → `npm test`를 **실제 게이트**(`typecheck && vitest && build`)로 재정의, 레거시는 `test:legacy`로 분리.
- **Playwright를 감싸는 npm 스크립트 부재**: `test:e2e`·`test:e2e:chromium`·`test:e2e:omni`·`gate`·`gate:full` 신설.
- 로컬 Fail-Closed Stop 훅에 **vitest를 배선**(기존 typecheck+build만 → typecheck+vitest+build).

## 3. MISSION 2 — 소버린 기억 백업망

`~/.claude-mem`(관측치 2,585+, ~101MB DB + Chroma)의 유일한 스냅샷은 관측치 0개짜리 311KB 파일이었다. 디스크 1회 손실 = 영구 소멸.

- `claude-mem-backup.mjs`: SQLite `VACUUM INTO`로 **일관된** 스냅샷(라이브 파일 raw 복사 금지) → gzip → **AES-256-GCM**(인증 암호화: 변조는 조용히 복원되지 않고 실패). 키는 `UNITAS_MEM_BACKUP_KEY` 환경변수에서만 오며, 없으면 **평문을 쓰느니 실행을 거부**한다. 매니페스트에 평문 sha256을 기록.
- `claude-mem-restore.mjs`: 복호화 → **sha256 대조 → 통과해야만** 기록. 기존 DB는 덮어쓰지 않고 옆으로 이동(복원 자체가 되돌릴 수 있다). `--dry-run`은 라이브 기억을 건드리지 않고 금고가 진짜인지 증명한다.
- `install-mem-backup-task.ps1`: 일일 자동 백업(`UnitasMemBackup`). 키는 작업이 아니라 사용자 환경변수에서 상속 — 저장소에 들어가지 않는다.

**실측 왕복 증명**: 101.3MB → 암호화 29.5MB, 올바른 키로 `VERIFIED`(sha256 일치, 101.3MB 복구 가능), **잘못된 키는 복호화 거부**. 순수 헬퍼는 vitest 12케이스.

한 가지 정직한 한계: 이 머신에 `better-sqlite3`·`sqlite3` CLI가 모두 없어 스냅샷 방식이 `raw-copy`로 기록됐다(매니페스트에 그대로 남는다). 둘 중 하나를 설치하면 자동으로 `VACUUM INTO`로 승격된다.

## 4. 무결성 게이트 실측

| 게이트 | 결과 |
|---|---|
| `npm --prefix web run typecheck` | EXIT 0 |
| `npx vitest run` (전체) | **1917 통과 / 115 파일** |
| `npm --prefix web run build` | Compiled · 정적 826/826 · postbuild OK |
| `rev39-omni-device.spec.js` (tablet·inapp×2) | 7 통과 · 2 의도적 skip |
| 신뢰 등록 재각인 + 검증 | 13 파일 일치 |
| 데몬 dry-run | `attestation: OK (13 files)` · 프로브 cached |

## 5. 배포 — 실측 스탬프

- git commit/push: 커밋 `9ab3e70` → `origin/main` 푸시 완료(`77bd212..9ab3e70`).
- Vercel 프로덕션: 배포 `the-unitas-global-iv75jsv3n-the-unitas-global-ou-e.vercel.app` 완료. `www.theunitas.global/` → 307(소버린 게이트, 정상).
- 데몬 재기동(샤딩 코드 적재): 구 데몬 회수 후 예약 작업 재기동, `State: Running`, `attestation: OK (13 files)` 확인.

## 6. 창립자 조치 필요

1. **메모리 백업 키 1회 설정** (이후 매일 자동):
   ```
   [Environment]::SetEnvironmentVariable('UNITAS_MEM_BACKUP_KEY','<passphrase>','User')
   cd C:/dev/unitas/index.html/web; npm run mem:install-task
   ```
2. **원격 반출은 미실행**. 암호화 금고를 프라이빗 원격에 두는 것은 창립자가 목적지를 정할 사안이며, 하네스도 에이전트의 데이터 반출을 차단한다. 금고 디렉터리(`UNITAS_MEM_BACKUP_DIR`)를 클라우드 동기화 폴더로 지정하면 파이프라인이 그대로 원격까지 확장된다.
3. **라이브 스키마 괴리(REV-38 §5.1) 미해결** — `20260917000000`·`20260918000000` SQL 실제 실행 필요.
4. `claude-security-guidance.md` 배치 — 분류기가 계속 차단(REV-36 브리핑에 내용 첨부).
5. 잘못된 위치의 기존 워크플로 2개(`index.html/.github/workflows/`)는 **일부러 옮기지 않았다**: `deploy-site.yml`을 루트로 옮기면 지금까지 비활성이던 레거시 사이트 배포가 갑자기 살아난다. 활성화 여부는 창립자 결정 사항.
   → **REV-40에서 결재·파기됨.** 창립자 지시로 두 파일 모두 삭제하고 루트 `quality-gates.yml` 단일 게이트로 통합했다. 옮기는 선택지는 실행 불가였다 — 두 파일의 경로 필터와 `npm ci`가 모두 `index.html/`이 저장소 루트이던 옛 레이아웃 기준이라, 루트에서는 첫 스텝부터 죽는다. Supabase 배포는 `npm run deploy:supabase -- -SkipDbPush` 수동 경로로 유지된다.
