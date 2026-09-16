# REV-35 — 옴니-랭킹 대통합 및 아키텍처 완전성 확보 (창립자 지령 2026-09-16)

정본 위치: `index.html/docs/rev35/SPEC.md`
대상: `index.html/web` + `index.html/tests` + `index.html/docs/stage3`
독트린: **Codex v37.0 제1~14장 완결판이 유일무이한 절대 기준**(M0). 28장 체제 참조 전면 폐기.

---

## 0. 지령

| 미션 | 지령 |
|---|---|
| **M0** | 모든 아키텍처 연산·정본 참조는 v37.0 제1~14장 완결판만 기준으로 구동 |
| **M1** | REV-20 캐러셀 계약 창립자 직권 파기. 캐러셀 '세계 랭킹' 기능을 코드베이스·DOM에서 영구 소거하고, 그 자리에 U-Square 숏츠형 '유랭킹' 모듈을 100% 동일 이식. 플랫폼 내 모든 랭킹 시스템을 '유랭킹' 단일 규격으로 대통합 |
| **M2** | 제13장 3단계(10분 유휴 3엔진 전수)가 창립자 활성 세션 중 절대 개입하지 않도록 유휴 감지기를 재검증하고, 데몬 스크립트로 확정·시스템 영구 각인 |

---

## 1. 정찰(2 리더)이 확정한 전제

1. `DISCOVERY_ROTATION`은 17키, `worldRanking`이 인덱스 12, `unitasRanking`이 마지막. 둘 다 `kind:'ranking'`, 카드 본문은 종류별 분기 없이 공통 해부(HubTitleRow → 서브탭 → 팩트/아이템 → HubMetaLine). 커스텀 패널은 딥 레이어에서만(`WeatherDeepModal`이 `LiveWeatherPanel compact`를 임베드 = 복제할 패턴).
2. **회전-언마운트 함정**: 캐러셀은 `deep !== null`일 때만 회전을 멈추고 카드 본문은 `activeKey`로 키잉된다. 컴팩트 레일이 자기 모달을 직접 열면 7초 후 회전이 열린 다이얼로그를 언마운트한다 → 컴팩트는 `onSelect`로 위임하고 딥 모달(풀 변형, `initialOpenId`)이 스택을 소유해야 한다.
3. `reserveHeight`는 단조 증가: 9:16 카드 레일(~263px)+헤더 ≈ 340px가 한 번 보이면 세션 내 모든 슬롯 최소 높이가 그만큼 커진다.
4. `lib/unitasRankings.ts`는 `URankingsShorts`가 `moduleTitleNamespace`를 임포트하므로 그대로 삭제 불가 → `lib/module-registry.ts`로 이동 후 삭제.
5. `omniFamilies.test.ts`의 `SLOT_KEYS`는 `Record<SlotKey,true>` 완전 열거(tsc 강제). `slotSections.GLOBAL_ONLY`, `SLOT_SOURCES`도 동일.
6. `Rev21.*`은 `docs/rev21/i18n/<locale>.json` 20 드래프트를 `scripts/i18n/apply-rev21.mjs`가 통째 치환. en만 지우면 19로케일이 영어 폴백으로 무너져 rev21Parity 5% 게이트가 깨진다 → 20 드래프트 동시 편집.
7. 3단계 실행체는 0. 활동 신호 실측: Claude 트랜스크립트(`~/.claude/projects/*/*.jsonl`) mtime은 창립자 메시지·툴 호출마다 전진(1차 신호), `.git/{index,logs/HEAD,HEAD,ORIG_HEAD,refs/heads/main}`(FETCH_HEAD 제외 — 백그라운드 fetch 노이즈), `web/` 워크트리 mtime(.next·node_modules·test-results 제외), Windows `GetLastInputInfo`는 세션 작업 중에도 85분 유휴로 읽힘 → **필요조건일 뿐 충분조건이 아님**.
8. GitHub Actions는 3단계의 집이 아니다: 창립자 유휴 개념 부재, 1.5h Linux WebKit 런은 REV-26/28 Windows WebKit 기준선(555~698ms/프레임)과 비교 불가, 분 단위 과금(한계 비용 0원 위반), 7GB 러너에서 826페이지 빌드 한계.

---

## 2. 결정 사항 (제4장 제로 핸즈)

| # | 결정 |
|---|---|
| D-1 | `DISCOVERY_ROTATION` 17 → **16**: `uRanking`이 인덱스 12에서 `worldRanking`을 대체, `unitasRanking` 제거(유랭킹이 모듈별 사다리를 이미 포함). `SlotKind = 'weather'|'feed'|'uRanking'`, `SlotItemAction = {kind:'uRankEntry'; id}`. |
| D-2 | 영구 삭제 7파일: `GlobalThemeRankings.tsx`, `UnitasModuleRankings.tsx`, `lib/globalRankings.ts`, `lib/unitasRankings.ts`(함수 이동 후), `lib/uai/rankingDetail.ts`, `lib/uai/rankingDetailClient.ts`, `app/api/u-ai/ranking-detail/route.ts`. 각 basename을 re-grep해 임포터 0 증명. `SourceId 'unitasCurated'`·`OmniFamily 'rankings'` 삭제(`OMNI_FAMILIES` 13→12), `unitasIndex`는 유지. `OmniOpenHost`: `rankingDeep`→`uRankingDeep`, `globalRankingDetail`·`unitasProfile` 삭제. |
| D-3 | `URankingsShorts` props 신설: `variant: 'full'|'compact'`, `initialOpenId?`, `onSelect?`. 컴팩트 = 레일만(라벨·lede·필터 칩·seedNote 생략, `data-urank-variant="compact"`), 카드 클릭은 `onSelect`로 위임. 레일 폭 완화를 위해 `unitas-hub.css`에 `.qw-shorts-rail--compact{grid-auto-columns:minmax(112px,1fr)}` 한 줄만 허용(카드 클래스·비율·애니메이션은 바이트 동일 — "100% 동일"은 카드 규격이며 컬럼 폭은 컨테이너 사정). |
| D-4 | 캐러셀 카드 본문에 `kind==='uRanking'` 분기(로딩/빈 상태 삼항 앞): `<URankingsShorts variant="compact" onSelect={e=>openDeep({kind:'uRankEntry', id:e.id})}/>`. 딥 모달 `URankingDeepModal`(Modal xl, `labelledBy="uranking-deep-title"`, `data-slot-modal="uRanking"`)이 `RankingDeepModal`을 대체: 풀 변형 + `initialOpenId` + `OmniOpen host="uRankingDeep" family="unitas"` + HubMetaLine(count 12, source "UNITAS Ledger"). 타이틀 클릭 → 딥 모달만. |
| D-5 | U-AI 스트림(`UaiHyperStream` L224-228)은 `.qw-stream-rankings` 래퍼 유지 + `<URankingsShorts/>` 풀 변형. 허브 `HubRankings`는 불변(주석만). |
| D-6 | `slotTtlMs('uRanking')` = 기존 ranking 값 유지. `slotSections.GLOBAL_ONLY`에 `uRanking`. `SLOT_FAMILY.uRanking='unitas'`, `SLOT_SOURCES.uRanking=['unitasIndex']`. 슬롯 타이틀 = `Rev34.uRankings.label`, 태그 = 신규 `Rev35.uRanking.tag`. |
| D-7 | i18n: 20 드래프트(`docs/rev21/i18n/*.json`)에서 `slots.worldRanking.*`·`slots.unitasRanking.*`·`slots.facts.{topRank,rankedEntries,topOperator,moduleCount}` 8키 삭제 → `node scripts/i18n/apply-rev21.mjs`(index.html에서) → `--check`. 신규 `web/scripts/apply-rev35-i18n.mjs`: `Rev35.uRanking.tag` 20 실번역 SET + `GlobalRankings`·`UnitasRankings` 루트 네임스페이스 DELETE(고아 확인 완료). `rev35Parity.test.ts` 신설, `rev21Parity` 갱신(`slots.facts.moduleCount` IDENTICAL_ALLOWED 제거, 삭제 키 undefined 단언). Rev20 76키 불변. |
| D-8 | E2E: rev19-back-stack L84-135(2단 스택: 카드 → `#uranking-deep-title` + `#unitas-urank-title`, 뒤로가기 1단씩) · rev25-crossplatform L118-124 · rev29-verify L210(17→16) 재작성 + 소거 선택자 `toHaveCount(0)` 스윕(`[data-slot=worldRanking]`, `[data-slot=unitasRanking]`, `#ranking-deep-title`, `#global-ranking-detail-title`, `#unitas-ranking-profile-title`, `[data-global-rankings]`, `[data-unitas-rankings]`, `[data-ranking-modal]`). |
| D-9 | **M2 = 로컬 데몬(0원)**: `web/scripts/idle-sensor-core.mjs`(순수: `computeIdle`, `shouldCancel`, `classifyFailure`, `buildSummary`, `summaryToMarkdown`, `isLockStale`) + `web/scripts/idle-sensor-daemon.mjs`(60초 폴링, 신호 = 모든 Claude 프로젝트 트랜스크립트 mtime ∪ git 5파일 ∪ web 워크트리 mtime ∪ OS 마지막 입력, **바쁜 프로세스 거부권**(`next build`·`tsc --noEmit`·`sync-codex`·`playwright`), 유휴 = 모든 신호 ≥10분 ∧ 바쁜 프로세스 0; BUILD_ID+HEAD당 1회 스윕; `PLAYWRIGHT_JSON_OUTPUT_FILE`로 JSON 산출; 자식 IDLE 우선순위; 활동 감지 즉시 자기 트리 `taskkill /T /F` + `:3123` 소유자 정리(cancel-in-progress, 취소는 스윕으로 세지 않음); 락 파일 `test-results/stage3/daemon.lock`(pid+procStart); 산출 `test-results/stage3/{<ts>.json,latest.json,latest.md,daemon.log}`; 데몬은 절대 빌드하지 않음) + `web/scripts/install-idle-sensor-task.ps1`(`UnitasIdleSensorStage3`, AtLogOn, Interactive principal, ExecutionTimeLimit 0, RestartCount 3, IgnoreNew, `-Uninstall`) + npm `idle:sensor`, `idle:sensor:once`, `idle:sensor:install-task`, `idle:sensor:uninstall-task`, `idle:sensor:status` + `docs/stage3/README.md`·`READER.md`(첫 줄: SONNET 5 / HIGH 강제 티어는 결과를 읽는 에이전트에 귀속, 데몬은 모델 무관) + vitest `__tests__/stage3/idleSensorCore.test.ts`. |
| D-10 | 활성 세션 재검증 = (a) 순수 판정 테이블 테스트, (b) 세션 중 `--once --dry-run` 실측이 NOT idle + 차단 신호명을 출력, (c) 강제 스윕 중 파일 터치 → 'cancelled' + `:3123` 비어 있음 실측. 결과를 FINAL_REPORT에 기록. |
| D-11 | 예약 작업 등록은 창립자 지령("영구 각인")이 곧 opt-in → 게이트 통과·커밋 후 본 세션이 직접 등록·기동한다. 배터리 시 중단은 Task Scheduler 기본값 유지. 다른 Claude 프로젝트 세션도 활동으로 간주. |
| D-12 | 커밋·배포 사전 결재(지령 문구)로 제14장 결재 갈음. |

---

## 3. 파일 소유권 레인

| 레인 | 소유 |
|---|---|
| **M1a 코드** | discoverySlots.ts, DiscoveryCarousel.tsx, URankingsShorts.tsx, HubRankings.tsx(주석), UaiHyperStream.tsx, slotSections.ts, sourceRegistry.ts, OmniOpen.tsx, module-registry.ts, unitas-hub.css(한 줄), 삭제 7파일, 주석 5곳(quantum-white.css L270, rev19.css L889, HotShortcutMatrixStrip L16-19, tokenPack L13, marketingAssets.test L6), __tests__/live/discoverySlots.test.ts, __tests__/uai/{omniFamilies,anchorDictionaries,sourceRegistry}.test.ts |
| **M1b i18n** | docs/rev21/i18n/*.json(20), scripts/i18n/apply-rev21.mjs 실행, web/scripts/apply-rev35-i18n.mjs, messages/*.json(applicator 경유만), __tests__/i18n/{rev21Parity,rev35Parity}.test.ts |
| **M2 데몬** | web/scripts/idle-sensor-*.mjs, install-idle-sensor-task.ps1, package.json(scripts만), __tests__/stage3/*, docs/stage3/* |
| **I1 통합** | applicator --check, tsc, 전수 vitest, build, 교차 결함 |
| **I2 E2E** | tests/web-cinema-e2e/** 재작성·실행(Chromium + mobile-chrome) |

## 4. 검증 계약
1단계: tsc·타겟 vitest(레인) → 통합에서 전수 vitest·`npm run build`(validate-module-registry가 삭제 API 라우트를 참조하지 않는지 prebuild 확인) EXIT 0. 2단계: Chromium rev19-back-stack·rev25-crossplatform·rev29-verify·rev21-hub-card·rev34-weather-square + mobile-chrome rev30. 3단계: M2 데몬이 유휴 시 자율 수행.

## 5. 배포
게이트 EXIT 0 → commit → push → `cd web && npx vercel --prod --yes --scope the-unitas-global-ou-e` → 예약 작업 등록·기동 → FINAL_REPORT 스탬프.
