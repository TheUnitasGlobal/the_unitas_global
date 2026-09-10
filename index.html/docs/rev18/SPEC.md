# REV-18 정밀 설계도 (PHASE 1 — 청사진 전용, 프로덕션 코드 미변경)

**작성일**: 2026-09-10
**선행 상태**: REV-17 PHASE 2 완료·배포 완료(`88a1fa9`, www.theunitas.global 라이브). 본 문서는 REV-17이 명시적으로 남긴 두 가지 잔여 과제를 다룬다.
**범위**: (1) 18개 로케일의 잠정 영어 대체 텍스트 → 전문 번역 전환 워크플로우, (2) `SOVEREIGN_AUTH_TOKEN` 보안 감사 및 토큰 회전 프로토콜.
**원칙**: 본 문서는 설계도이며 프로덕션 코드를 수정하지 않는다. PHASE 2 승인 후에만 구현에 착수한다.

---

## 0. 현황 진단 (실측)

### 0.1 i18n 격차
- 대상 네임스페이스는 단일: `QuantumWhite` (모든 REV-17 신규 컴포넌트 — `EntryGate.tsx`, `ClusterPopout.tsx`, `SingularityCoreGrid.tsx`, `UPayGateway.tsx` — 가 전부 `useTranslations('QuantumWhite')` + `tFull`(모듈별 `riddleKey`/`scenarioKey`/`enigmaKey` 동적 룩업)만 사용).
- 실측: `QuantumWhite` 네임스페이스 평면화 키 수 = **125개**. 표본 로케일(`de.json`) 대조 결과 en과 문자열이 동일한(=미번역) 키 **111개 / 125개(88.8%)**.
- 확정 정본 로케일: `en`(원문), `ko`(수기 확정 대조본). 나머지 18개(`de es et fr hi id it ja km nl pl pt ru th tl tr vi zh`)가 전환 대상.
- 구조적 특성: 각 로케일 JSON은 네임스페이스별 완전한 키 트리를 유지(next-intl은 병합 폴백을 하지 않음) — 따라서 "빠진 키"가 아니라 "값이 en과 동일한 키"를 찾아야 한다(REV-17에서 기존 스크립트가 실제로 채운 값이므로 구조적 결측은 없음).

### 0.2 보안 토큰 현황
- `web/lib/sovereignAuth.ts`: `SOVEREIGN_AUTH_TOKEN_DEFAULT = "unitas_master_dooyeong_2026_secure_key"`가 소스에 평문 하드코딩. `resolveSovereignToken()`은 `process.env.SOVEREIGN_AUTH_TOKEN`이 있으면 그것을 쓰고, 없으면 이 기본값으로 **조용히 폴백**한다.
- 서명 비밀키(`resolveSovereignSigningSecret`)는 `SOVEREIGN_AUTH_SIGNING_SECRET`이 없으면 `${토큰}::unitas-sovereign-hmac-v1` 파생 — 즉 토큰이 노출되면 세션 서명 위조까지 가능해지는 **이중 노출 경로**.
- `web/lib/security/uShieldServer.ts`(76행): `env.VERCEL_ENV === "production"`이고 `SOVEREIGN_AUTH_SIGNING_SECRET`도 `SOVEREIGN_AUTH_TOKEN`도 없으면 `null` 반환 — 이 경로는 이미 페일클로즈드로 설계되어 있음(참고 기준점).
- `sovereignAuth.ts`에는 그런 프로덕션 페일클로즈드 분기가 **없음** — Vercel 환경변수가 비어 있어도 하드코딩된 기본 토큰으로 조용히 작동 계속.
- Git 이력에 이 평문 토큰이 이미 커밋되어 있으므로(`unitas_master_dooyeong_2026_secure_key`), 환경변수 설정 여부와 무관하게 이 문자열 자체는 이미 공개된 것으로 간주해야 한다 — 회전은 "만약을 대비"가 아니라 "이미 유출된 시크릿의 정상 폐기 절차"이다.

---

## 1. 과제 A — i18n 전환 워크플로우

### 1.1 목표
18개 로케일의 `QuantumWhite.*` 125개 키를 en과 동일한 잠정값에서, en/ko 수준의 고유하고 신비로운(curiosity-inducing) 어조를 보존한 전문 번역으로 전환한다. 사람이 전량 검수하되, 초안 생성은 스크립트로 규모화한다.

### 1.2 4단계 파이프라인

**1단계 — 추출 (`scripts/i18n/extract-drift.mjs`, 신규)**
- en.json을 기준으로 `QuantumWhite` 네임스페이스를 평면화(dot-path).
- 각 로케일에 대해 "값이 en과 바이트 단위로 동일한 키"만 골라 `docs/rev18/drift/<locale>.json`으로 출력(`{ "path.to.key": "<en 원문>" }` 형태).
- ko.json은 기준 비교 대상에서 제외(이미 확정 정본) — 단, ko를 톤 레퍼런스로 함께 첨부하여 번역자/모델이 en 직역이 아닌 en+ko 둘 다를 참고하게 한다.
- 순수 함수 + Node 스크립트로 작성, 부작용 없음(읽기 전용) — 기존 `sync-codex.mjs` 스타일의 `--write`/dry-run 이원화를 따르지 않고 애초에 항상 읽기 전용(산출물은 `docs/rev18/drift/`뿐, `web/messages/*.json`은 이 단계에서 절대 건드리지 않음).

**2단계 — 초안 생성 (에이전트 위임, 로케일별 병렬)**
- 코드가 아니라 작업 방식: 1단계 산출물을 입력으로, 언어별 전문 번역 에이전트(Task/Agent 위임, 20개 로케일 중 18개 각각 1개 태스크)를 병렬 기동.
- 각 에이전트에게 주는 고정 브리핑:
  - en 원문 + ko 정본 톤(신비롭고 절제된 초대장 어조, 가격·수치·기술 용어 노출 금지, 호기심 유발형 — REV-17 SPEC §4 카피 가이드 인용)
  - 대상 로케일의 UI 제약: 카드/타일 타이틀은 2줄 클램프, CTA 버튼 라벨은 1줄 강제(`.qw-tile-title`, `entry.enter` 등) — 로케일별 문자 폭 특성(독일어 복합어 장문화, 태국어/크메르어 결합문자, 중국어/일본어 표의문자 밀도) 고려해 원문보다 지나치게 길어지지 않게.
  - 플레이스홀더/보간 토큰(`{count}`, `{name}` 등 next-intl ICU 문법)이 있는 키는 토큰을 절대 번역하거나 삭제하지 말 것 — 정확히 보존.
  - 산출 형식: `docs/rev18/drafts/<locale>.json`(1단계와 동일한 평면 dot-path 키 → 번역값).
- 병렬화 근거: 로케일 간 상호 의존성 없음(순수 번역 태스크), Agent 도구로 18개를 동시 기동해 벽시계 시간 단축.

**3단계 — 병합 + 무결성 검증 (`scripts/i18n/merge-drift.mjs`, 신규)**
- `docs/rev18/drafts/<locale>.json`을 읽어 해당 `web/messages/<locale>.json`의 `QuantumWhite` 서브트리에 정확히 그 경로만 덮어쓰기(다른 네임스페이스는 절대 건드리지 않음) — REV-17에서 이미 검증된 JSON 딥머지 + `JSON.stringify(obj, null, 2) + "\n"` 패턴 재사용.
- 자동 검증 게이트(머지 전에 실패하면 해당 로케일 전체를 스킵하고 리포트에 기록):
  1. **키 집합 일치**: 초안의 키 집합이 1단계 드리프트 키 집합과 정확히 일치(누락/추가 금지).
  2. **ICU 토큰 보존**: `{...}` 패턴 개수·내용이 en 원문과 정확히 일치하는 정규식 대조.
  3. **미번역 잔존 감지**: 병합 후 값이 여전히 en과 동일하면 경고(고유명사·브랜드명 등 의도적 동일 값은 허용 목록으로 예외 처리 — 예: UNITAS, U-COIN, U-Pay).
  4. **길이 이상치**: en 원문 대비 3배 초과(로케일별 임계값, 문자수 기준, CJK/태국어/크메르어는 별도 계수)를 넘는 키를 리포트에 표시(자동 실패는 아님, 수동 검토 플래그).
- 출력: `docs/rev18/merge-report.md` — 로케일×키 단위로 통과/경고/실패 요약.

**4단계 — 검증 + 회귀**
- `npx vitest run web/__tests__/quantumWhite/rev17Copy.test.ts`(REV-17에서 이미 만든 "모든 로케일에 모든 키가 존재하는지" 패리티 테스트) 재실행 — 구조 무결성 확인.
- 신규 테스트 1건 추가 설계: `__tests__/i18n/rev18TranslationDrift.test.ts` — 머지 후 "18개 로케일의 QuantumWhite 값 중 en과 동일한 비율"이 임계값(예: 브랜드 고유명사 허용 목록 제외 시 5% 미만) 이하인지 정적 검사. 이 테스트 자체가 "미래에 새 REV가 또 영어 폴백을 남기고 지나가는 것"을 막는 회귀 가드 역할.
- Playwright 스모크: 기존 `rev15-cluster-popout.spec.js`류에 이미 있는 로케일 순회 패턴을 재사용해 대표 로케일(예: `ja`, `ru`, `th` — 문자 폭/결합문자 극단 사례) 3개에 대해서만 타일 텍스트 오버플로우 관련 `scrollWidth <= clientWidth` 류의 레이아웃 안전 어서션 1~2건 추가(전수 20로케일 E2E는 실행 시간 비용 대비 낮은 한계효용 — 정적 길이 검사로 충분히 커버).

### 1.3 이번 PHASE에서 하지 않는 것
- 실시간/자동 기계번역 API 연동(Google/DeepL 등) — 이 저장소는 현재 어떤 외부 번역 API 키도 보유하지 않음, 그리고 REV-17 카피는 어조가 중요해 순수 MT보다 가이드라인 기반 에이전트 번역 + 정적 검증이 이 코드베이스의 기존 관례(스크립트+검증 게이트)에 더 부합.
- 20개 로케일의 다른 네임스페이스(`Nav`, `Footer` 등)는 REV-17이 건드리지 않았으므로 스코프 밖.

---

## 2. 과제 B — 소버린 토큰 감사 및 회전 프로토콜

### 2.1 원칙
회전은 기본값을 다른 문자열로 바꿔치기하는 것이 아니라, 하드코딩된 폴백 자체를 프로덕션에서 무력화하는 것이 목표다. 기본값 문자열을 다른 문자열로 바꿔치기해봐야 그 새 문자열도 다시 커밋되어 다시 유출되므로 근본 해결이 아니다.

### 2.2 검증 프로토콜 (구현 전 확인 절차 — 창립자 수행)
1. `npx vercel env ls production --scope the-unitas-global-ou-e` 로 `SOVEREIGN_AUTH_TOKEN`, `SOVEREIGN_AUTH_SIGNING_SECRET` 두 키가 이미 존재하는지 확인.
2. 존재하지 않으면: 둘 다 미설정 상태 = 현재 프로덕션이 소스에 박제된 `unitas_master_dooyeong_2026_secure_key`로 운영 중이라는 뜻(이미 Git 이력에 공개된 값).
3. 존재하면: 값 자체는 CLI로 노출되지 않음(Vercel 정책) — `npx vercel env pull .env.production.local --environment production`으로 로컬에 끌어와 `resolveSovereignToken` 단위 테스트에 값을 주입해 기본값과 다른지만 확인하고, 확인 즉시 `.env.production.local` 파일 삭제(리포지토리에 남기지 않음).

### 2.3 회전 절차 (설계, 구현은 PHASE 2)
1. **새 시크릿 생성**: `openssl rand -hex 32`(또는 Node `crypto.randomBytes(32).toString("hex")`)로 64자 16진수 무작위 토큰 생성 — 사람이 기억하는 구문형 토큰(`unitas_master_...`) 폐기, 추측 불가능한 난수로 교체.
2. **`SOVEREIGN_AUTH_TOKEN`과 `SOVEREIGN_AUTH_SIGNING_SECRET`을 별도로 발급**해 Vercel Production 환경변수에 등록(현재는 서명 비밀키가 토큰에서 파생되는 구조라 토큰 하나 유출 시 세션 위조까지 가능 — 두 시크릿 분리가 이번 회전의 핵심 보안 개선).
3. **코드 변경(PHASE 2 대상, 지금은 설계만)**: `sovereignAuth.ts`의 `resolveSovereignToken`/`resolveSovereignSigningSecret`에 `uShieldServer.ts`(76행)와 동일한 프로덕션 페일클로즈드 분기 추가 — `env.VERCEL_ENV === "production"`이고 환경변수가 비어 있으면 하드코딩 기본값으로 조용히 폴백하는 대신 미들웨어가 소버린 우회 경로 전체를 비활성화(404 유지, 하드코딩 시크릿 자체는 코드에서 완전 삭제하거나 최소한 `NODE_ENV !== "production"`에서만 유효한 로컬 개발용 값으로 격하).
4. **배포 순서(다운타임/락아웃 방지)**: (a) 새 환경변수를 Vercel에 먼저 추가·배포 → (b) 창립자가 새 토큰으로 `?sovereign_auth=<new>` 방문해 새 세션 쿠키 발급 확인 → (c) 그 다음 배포에서 하드코딩 기본값 제거 코드를 반영. 순서를 바꾸면 재배포 사이 창에서 창립자가 스스로 잠길 위험이 있다.
5. **기존 세션 무효화 확인**: 서명 비밀키가 바뀌므로 회전 시점에 발급되어 있던 기존 HttpOnly 세션 쿠키는 자동으로 검증 실패 처리(`verifySovereignSession`이 새 비밀키로 HMAC 재계산하므로) — 이것이 의도된 동작이다(회전의 목적 자체가 구 토큰 기반 세션 무력화).
6. **회귀 테스트**: `__tests__/gate/sovereignAuth.test.ts`에 "환경변수 부재 + `VERCEL_ENV=production`이면 grant 대신 reject/미들웨어 404"를 검증하는 케이스 추가 설계(현재 이 테스트 파일은 로직 자체만 다루고 프로덕션 페일클로즈드 분기는 아직 테스트되지 않음 — `uShieldServer.test.ts`에는 이미 유사 패턴이 있으므로 그 패턴을 이식).

### 2.4 노출 범위 확인 (감사 전용, 조치 아님)
- `git log -p -- web/lib/sovereignAuth.ts | grep -c SOVEREIGN_AUTH_TOKEN_DEFAULT` 류의 명령으로 이 문자열이 몇 개 커밋에 걸쳐 있는지 집계(회전 필요성의 정량적 근거로 최종 보고에 포함).
- 이 토큰이 URL 쿼리 파라미터(`?sovereign_auth=`)로도 전달되는 구조이므로, Vercel Analytics/로그·브라우저 히스토리·Referrer 헤더 등 2차 노출 경로도 별도 문서화(코드 수정 대상 아님, 인지 목적).

---

## 3. PHASE 2 실행 시 예상 산출물 (참고용, 지금 만들지 않음)
- `scripts/i18n/extract-drift.mjs`, `scripts/i18n/merge-drift.mjs`
- `docs/rev18/drift/*.json`(18개), `docs/rev18/drafts/*.json`(18개, 임시 산출물 — 머지 후 삭제 여부는 PHASE 2에서 결정), `docs/rev18/merge-report.md`
- `web/messages/{de,es,et,fr,hi,id,it,ja,km,nl,pl,pt,ru,th,tl,tr,vi,zh}.json`의 `QuantumWhite` 서브트리 갱신
- `web/__tests__/i18n/rev18TranslationDrift.test.ts`(신규)
- `web/lib/sovereignAuth.ts`(프로덕션 페일클로즈드 분기), `web/__tests__/gate/sovereignAuth.test.ts`(신규 케이스)
- Vercel Production 환경변수 `SOVEREIGN_AUTH_TOKEN`/`SOVEREIGN_AUTH_SIGNING_SECRET` 신규 등록(창립자 액션 필요 — CLI로 자동화 불가한 유일한 단계)

## 4. 리스크 및 확인 필요 사항
- **로케일 톤 검수자 부재**: 에이전트 초안을 최종 승인할 원어민 검수자가 없다는 전제 하에, 본 설계는 정적 무결성 검증(키/토큰/길이)까지만 자동화하고 어조 품질은 에이전트 브리핑 품질에 의존한다 — 원어민 검수 단계를 추가할지는 창립자 판단이 필요하다.
- **토큰 회전 타이밍**: 회전은 창립자만 수행 가능한 Vercel 대시보드/CLI 조작을 포함하므로, PHASE 2 코드 배포와 환경변수 등록의 순서를 반드시 위 2.3-4 절차대로 지켜야 한다(자동화 스크립트가 실수로 두 단계를 한 번에 배포하지 않도록 별도 PR/커밋으로 분리 권장).
