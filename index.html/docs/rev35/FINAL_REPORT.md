# REV-35 최종 완결 종합 보고서 — 옴니-랭킹 대통합 및 아키텍처 완전성 확보

창립자 지령 2026-09-16 · 정본 `index.html/docs/rev35/{SPEC,FINAL_REPORT}.md` · 독트린 **Codex v37.0 제1~14장 완결판(유일 기준, M0)**

---

## 1. 미션 결과

| 미션 | 결과 | 핵심 구현 |
|---|---|---|
| **M0 14장 규격화** | 완료 | 본 REV의 모든 참조·장 번호는 v37.0 14장 기준. 28장 체제 참조 0. |
| **M1 옴니-랭킹 대통합** | 완료 | 캐러셀 `DISCOVERY_ROTATION` 17 → **16**: 인덱스 12의 `worldRanking`을 `uRanking`으로 교체, `unitasRanking` 제거. 카드 본문은 `URankingsShorts variant="compact"`(유숏츠 레일·카드 클래스 바이트 동일, 12카드), 카드 클릭 → `URankingDeepModal`(풀 변형 + `initialOpenId`, OmniOpen family `unitas`, HubMetaLine) → 엔트리 팝업 2단 스택. U-AI 스트림의 레거시 유니타스 랭킹 패널도 `URankingsShorts`로 교체. **영구 삭제 7파일**: `GlobalThemeRankings.tsx`, `UnitasModuleRankings.tsx`, `lib/globalRankings.ts`, `lib/unitasRankings.ts`(`moduleTitleNamespace`는 `lib/module-registry.ts`로 이동), `lib/uai/rankingDetail.ts`, `lib/uai/rankingDetailClient.ts`, `app/api/u-ai/ranking-detail/route.ts` — 각 basename re-grep 임포터 0 증명. `SourceId unitasCurated`·`OmniFamily 'rankings'`(13→12)·`OmniOpenHost globalRankingDetail/unitasProfile` 삭제, `rankingDeep`→`uRankingDeep`. 소거 선택자 9종(`[data-slot=worldRanking]`, `#ranking-deep-title`, `#global-ranking-detail-title` 등) DOM 0 — E2E 스윕(`_rev35Retired.js`)으로 영구 고정. |
| **M1 i18n** | 완료 | `docs/rev21/i18n` 20 드래프트에서 랭킹 8키 동시 삭제 → `apply-rev21.mjs`(20/20 written ok, 영어 폴백 0) → `--check` 20/20 unchanged. `apply-rev35-i18n.mjs`: `Rev35.uRanking.tag` 20 실번역 + `GlobalRankings`(35키)·`UnitasRankings`(6키) 루트 네임스페이스 20로케일 DELETE. `rev35Parity` 신설, `rev21Parity` 갱신(잔여 63키). Rev20 76키 불변. |
| **M2 유휴 감지 데몬** | 완료 | `web/scripts/idle-sensor-core.mjs`(순수 판정: `computeIdle`·`shouldCancel`·`sweepKey/alreadySwept`·`classifyFailure`·`buildSummary`·`summaryToMarkdown`·`isLockStale`, vitest 31/31) + `idle-sensor-daemon.mjs`(60초 폴링, 신호 4종 ∧ 바쁜 프로세스 거부권, BUILD_ID+HEAD당 1회, Playwright 자식 IDLE 우선순위, 취소 시 자기 트리 `taskkill /T /F` + `:3123` 소유자 정리, 락 파일, `test-results/stage3/{<ts>.json,latest.json,latest.md,daemon.log}`) + `install-idle-sensor-task.ps1`(`UnitasIdleSensorStage3`, AtLogOn·Interactive·ExecutionTimeLimit 0·RestartCount 3·IgnoreNew·`-Uninstall`·`-Status`) + npm `idle:sensor`·`idle:sensor:once`·`idle:sensor:install-task`·`idle:sensor:uninstall-task`·`idle:sensor:status` + `docs/stage3/README.md`·`READER.md`(첫 줄: SONNET 5 / HIGH 강제 티어는 결과를 읽는 에이전트에 귀속, 데몬은 모델 무관·0원). GitHub Actions는 기각(유휴 개념 부재·Linux WebKit은 REV-26/28 Windows 기준선과 비교 불가·분 과금). |

## 2. M2 활성 세션 비개입 재검증 실측 (SPEC D-10)

| 검증 | 실측 |
|---|---|
| (a) 순수 판정 테이블 | 31 케이스: 전 신호 11분·바쁨 0 → idle; 정확히 10분 → idle, 9분59초 → not; 한 신호 9분 → 차단 신호명 출력; **OS 입력만 유휴(1h50m)여도 12초 전 트랜스크립트가 차단**; `next build` 진행 중 → `busy:` 차단; 판독 불가 신호 → fail-closed |
| (b) 세션 중 `--once --dry-run` | `decision: NOT idle -- blockers: transcript (4s ago), worktree (12s ago)` (osInput은 1h50m 유휴로 읽혔으나 AND 조건이 스윕을 차단) |
| (c) 강제 스윕 취소 경로 | `--once --idle-min 0`: `sweep started` → 14초 후 `:3123 LISTENING` + Playwright 트리 확인 → 파일 터치/트랜스크립트 전진 → 22~23초 만에 `cancelled`, 트리 kill, `port 3123 is free`, `latest.json status 'cancelled'`(스윕으로 계수하지 않음) |
| 실행이 잡아낸 결함 | Playwright가 `tests/web-cinema.config.js`의 기본 `outputDir`를 `index.html/test-results`로 해석해 스윕 시작 시 `test-results/stage3/`(락·로그)를 통째로 지움 → 스윕을 `--output=test-results/stage3-artifacts`로 격리(설정 파일 무변경) |

## 3. 무결성 게이트 실측 (제11장 Fail-Closed, 제13장 1·2단계)

| 게이트 | 실측 | EXIT |
|---|---|---|
| `npx tsc --noEmit` | 오류 0 (삭제 라우트의 `.next/types` 스텁 재생성 후에도 0) | 0 |
| `npx vitest run` | 106 파일 / 1797 테스트 전부 통과 | 0 |
| `npm run build` | sync-codex drift=0(v37.0) · validate-module-registry 19/19(삭제 API 라우트 참조 0) · 정적 826/826(삭제 라우트는 동적 ƒ라 정적 수 불변, `app-paths-manifest`에서 부재 확인) | 0 |
| Playwright Chromium (통합 레인) | rev19-back-stack 4 · rev25-crossplatform 6(+2 skip) · rev29-verify 10(+1 skip) · rev21-hub-card 8 · rev34-weather-square 7 · rev34-escape-lifecycle 4 · rev23-verify 13 = **52 passed / 3 skipped(터치 전용) / 0 failed** | 0 |
| Playwright mobile-chrome | rev30-mobile-lifecycle 9/9 | 0 |
| 본 세션 재측정 | §5 참조 | — |

## 4. 정찰이 확정한 전제와 결정 (SPEC §1·§2 요약)
- 회전-언마운트 함정 → 컴팩트 레일은 `onSelect`로 위임, 딥 모달이 스택 소유. `initialOpenId`는 마운트 후 effect에서 적용(Modal의 히스토리 레이어 push가 effect라 같은 커밋에 열면 스택 순서가 뒤집힘) — E2E는 스택을 `expect.poll`.
- `reserveHeight` 단조 증가 완화용 `.qw-shorts-rail--compact` 한 줄만 신설(카드 규격 불변).
- OS 입력 유휴는 필요조건일 뿐(세션 작업 중 85분~1h50m 유휴로 읽힘) → 트랜스크립트가 1차 신호. claude-mem 옵저버 세션이 40~60초 뒤에 트랜스크립트를 써서 활성 세션 중 스윕은 한 폴 안에 취소된다(의도된 동작).
- `node.exe` 이름 kill 금지(claude-mem 워커·VS Code 테스트 서버 상주).

## 5. 프로덕션 배포 검증 (제11장)

(배포 후 스탬프)
