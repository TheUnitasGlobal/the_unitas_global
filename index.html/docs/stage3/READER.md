**Codex 제15장 3단계 -- 강제 티어 "SONNET 5 / HIGH"는 `test-results/stage3/latest.json`을 읽는 이 에이전트에 귀속된다(세션을 `claude --model sonnet`, effort high로 연다). 데몬(`web/scripts/idle-sensor-daemon.mjs`)은 모델 무관·토큰 0이다.**

창립자 호출: `@docs/stage3/READER.md` (REV-35 M2, SPEC.md D-9)

## 0. 자율 브리핑 (REV-36 M2)

창립자가 이 결과를 수동으로 찾아보지 않도록, 세션이 새로 기동·재개(`startup`/`resume`/`clear`/`compact`)될 때 `SessionStart` 훅이 `node index.html/web/scripts/stage3-brief.mjs --hook`을 돌려 그 출력을 세션 컨텍스트에 주입한다(두 `.claude/settings.json`에 등록됨, 20초 상한, 항상 EXIT 0). 순수 판정은 `web/scripts/stage3-brief-core.mjs`.

- **에이전트는 창립자에게 보내는 첫 응답의 첫 줄에 그 브리핑 한 줄을 그대로 선제 보고한다.** 되묻지 않는다(제6장 초제로핸즈).
- 한 줄 형식(요지): 통과=`에러 0건 통과 (통과 N · 스킵 S · 총 T · 빌드 … · HEAD … · <KST>)` / 실패=`실패 F건(제품 결함 a · 계약 드리프트 b · 하네스 플레이크 c) … → @docs/stage3/READER.md 절차 필요` / 취소=`완주 없음 — 마지막 스윕 취소(<사유>, <KST>) · 다음 유휴 창에서 재시도` / 기록 없음=`기록 없음 … (데몬 실행 중|정지|미설치)`. 스윕 빌드·HEAD가 현재와 다르면 `[옛 빌드]` 접두. 신뢰 증명 실패 시 `⚠ 신뢰 증명 실패…` 접미.
- **브리핑이 실패(fail)를 말하면** 아래 4단계로 kind별 분류만 보고하고, **창립자 지시 없이 전경에서 전수 E2E를 재실행하지 않는다**(제15장 1단계). 재검증은 데몬이 다음 유휴 창에 한다.
- 수동 확인: `cd web && npm run stage3:brief`(한 줄+상세), `npm run stage3:brief -- --json`.

## 절차

1. `index.html/test-results/stage3/latest.md`를 먼저 읽는다 -- 상태(통과/실패/취소), 프로젝트별 합계, REV-33 기준선(통과 587 · 스킵 33 · 총 621) 대비 증감, 3분류 실패 목록.
2. `latest.json`으로 내려간다 -- `failures[]`의 `project` · `file` · `title` · `error` · `kind`, 그리고 `buildId`/`head`가 현재 `web/.next/BUILD_ID`와 `git rev-parse HEAD`와 같은지 확인한다(다르면 옛 빌드의 결과다 -- 다음 유휴 창을 기다리거나 상황만 브리핑한다).
3. `status`가 `cancelled`면 부분 집계다. 취소 사유(`cancelReason`)만 확인하고 결함 판단은 하지 않는다.
4. 실패를 `kind`별로 처리한다.
   - `harness-flake` -- 제품 문제 아님. 해당 spec을 **그 프로젝트에서만** 재실행해 재현 여부만 적는다:
     `cd index.html && npx playwright test --config=tests/web-cinema.config.js --project=webkit --output=test-results/stage3-artifacts <file>`
     **⚠ `--output` 을 빼지 마라.** Playwright 는 실행 시작 시 `outputDir` 을 **비운다**. 기본값은 `test-results/` 이고 그 아래에 `test-results/stage3/` 가 있으므로, 플래그 없이 수동 재실행하면 `progress.json` · `latest.json` · 샤드 로그가 통째로 지워져 **적립된 샤드 실적이 전부 증발하고 스윕이 1/6 부터 다시 시작한다.** 데몬은 이 때문에 항상 `--output` 을 넘긴다(`idle-sensor-daemon.mjs` 헤더). 2026-09-18 이 문서의 예시에 플래그가 없어 4샤드(chromium 228 · webkit 211 · mobile-chrome 238 · tablet)를 실제로 잃었다.
     또한 재실행 중에는 데몬이 스윕을 시작하지 않도록(busy 프로세스 감지) 두고, 끝나면 `test-results/stage3/` 가 살아 있는지 확인한다.
   - `contract-drift` -- spec 또는 i18n 키를 수정한다. 근거 없이 단언을 느슨하게 만들지 않는다. i18n 키 변경은 20로케일 동시(REV-19 함정) + parity 테스트.
   - `product-defect` -- **먼저 Chromium에서 재현**한 뒤 수정한다. 수정 후 1단계 게이트: `npm run typecheck` · 수정 모듈의 `npx vitest run <dir>` · `npm run build` 모두 EXIT 0. 핵심 UI 변경이면 2단계: 수정된 spec만 Chromium 단일 엔진으로.
5. **전경에서 3엔진 전수를 다시 돌리지 않는다**(제15장 1단계가 금지). 재검증은 데몬이 다음 유휴 창에 한다 -- 새 `BUILD_ID@HEAD`는 자동으로 스윕 대상이 된다.
6. 한 문단 브리핑으로 끝낸다: 스윕 시각·빌드·HEAD, 분류별 건수, 고친 것, 남긴 것. 되묻지 않는다(제6장 제로 핸즈).

## 참고

- 판정·취소·분류 규칙: `docs/stage3/README.md`
- 원본 리포터 출력: `test-results/stage3/<ts>.json`, list 로그 `<ts>.log`, 데몬 기록 `daemon.log`
- 작업 상태: `cd web && npm run idle:sensor:status`
