**Codex 제13장 3단계 -- 강제 티어 "SONNET 5 / HIGH"는 `test-results/stage3/latest.json`을 읽는 이 에이전트에 귀속된다(세션을 `claude --model sonnet`, effort high로 연다). 데몬(`web/scripts/idle-sensor-daemon.mjs`)은 모델 무관·토큰 0이다.**

창립자 호출: `@docs/stage3/READER.md` (REV-35 M2, SPEC.md D-9)

## 절차

1. `index.html/test-results/stage3/latest.md`를 먼저 읽는다 -- 상태(통과/실패/취소), 프로젝트별 합계, REV-33 기준선(통과 587 · 스킵 33 · 총 621) 대비 증감, 3분류 실패 목록.
2. `latest.json`으로 내려간다 -- `failures[]`의 `project` · `file` · `title` · `error` · `kind`, 그리고 `buildId`/`head`가 현재 `web/.next/BUILD_ID`와 `git rev-parse HEAD`와 같은지 확인한다(다르면 옛 빌드의 결과다 -- 다음 유휴 창을 기다리거나 상황만 브리핑한다).
3. `status`가 `cancelled`면 부분 집계다. 취소 사유(`cancelReason`)만 확인하고 결함 판단은 하지 않는다.
4. 실패를 `kind`별로 처리한다.
   - `harness-flake` -- 제품 문제 아님. 해당 spec을 **그 프로젝트에서만** 재실행해 재현 여부만 적는다:
     `cd index.html && npx playwright test --config=tests/web-cinema.config.js --project=webkit <file>`
   - `contract-drift` -- spec 또는 i18n 키를 수정한다. 근거 없이 단언을 느슨하게 만들지 않는다. i18n 키 변경은 20로케일 동시(REV-19 함정) + parity 테스트.
   - `product-defect` -- **먼저 Chromium에서 재현**한 뒤 수정한다. 수정 후 1단계 게이트: `npm run typecheck` · 수정 모듈의 `npx vitest run <dir>` · `npm run build` 모두 EXIT 0. 핵심 UI 변경이면 2단계: 수정된 spec만 Chromium 단일 엔진으로.
5. **전경에서 3엔진 전수를 다시 돌리지 않는다**(제13장 1단계가 금지). 재검증은 데몬이 다음 유휴 창에 한다 -- 새 `BUILD_ID@HEAD`는 자동으로 스윕 대상이 된다.
6. 한 문단 브리핑으로 끝낸다: 스윕 시각·빌드·HEAD, 분류별 건수, 고친 것, 남긴 것. 되묻지 않는다(제4장 제로 핸즈).

## 참고

- 판정·취소·분류 규칙: `docs/stage3/README.md`
- 원본 리포터 출력: `test-results/stage3/<ts>.json`, list 로그 `<ts>.log`, 데몬 기록 `daemon.log`
- 작업 상태: `cd web && npm run idle:sensor:status`
