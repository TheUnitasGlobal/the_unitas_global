# 미션 명세 — 앱 계층 자격 증명 가드 Fail-Closed 전수 교체

**미션 ID** `unitas.mission.credential-guards-app-layer` · **창** `idle-night` · **결재** 창립자 2026-09-17 직권
**절차** `@docs/missions/READER.md` · **큐** `config/missions/queue.json`

이 문서는 **착수 전에 전부 읽는다.** 이 미션이 큐로 밀려난 이유가 §1의 지뢰이며, 그것을 모르고 착수하면 프로덕션이 깨진다.

---

## 0. 배경

2026-09-17, 야간 아카이브 데몬이 `REST 401: Invalid API key`로 죽었다. 원인은 `vercel env pull`이 Secret 타입 변수를 복호화하지 않고 리터럴 `[SENSITIVE]`(11자)를 쓰는데, 저장소의 모든 자격 증명 가드가 **참거짓 검사**였다는 것이다. 비어있지 않은 문자열인 자리표시자는 전부 통과했다.

스크립트 계층은 커밋 `30f0c4d`에서 `web/scripts/credential-core.mjs`로 경화됐다. **앱 계층은 남았다** — 배포 직전 동시 변경의 회귀 위험이 이득을 넘었기 때문이다. 이 미션이 그 잔여분이다.

조사 규모: 2회 워크플로, 53에이전트, 반대 심문 전수. 원본 산출물은 세션 전사에 보존.

---

## 1. 착수 전 반드시 알아야 할 지뢰 3개

### 지뢰 ① `credential-core.mjs`를 브라우저·Edge로 import하면 **정상 키에서도** 터진다

`decodeJwtClaims`(credential-core.mjs:87)는 `Buffer.from(seg, 'base64url')`을 쓰고, `validateSupabaseKey`(:174)가 **모든 JWT 형태 키에 대해 무조건** 호출한다.

Next 14.2.35는 `isClient || isEdgeServer` 번들에 `Buffer`를 ProvidePlugin으로 폴리필하며(`next/dist/build/webpack-config.js:1406-1412`), 그 구현은 `buffer@6.0.3`이다. **`buffer@6.0.3`에는 `base64url` 인코딩이 없다** — `grep -c base64url node_modules/buffer/index.js` = 0. 실행 결과:

```
Buffer.from('eyJhIjoxfQ','base64url')
→ TypeError: Unknown encoding: base64url
```

즉 **올바른 키를 넣어도 happy path에서 던진다.** `web/middleware.ts`에는 `export const runtime` 선언이 없으므로 Edge다 — `middlewareClient.ts`도 해당된다. 덤으로 ~50KB buffer 폴리필이 클라이언트 번들에 끌려 들어온다.

**따라서 앱 계층은 `.mjs`를 import하지 않는다.** 새 동형(isomorphic) TS 모듈을 만든다:

- 경로 **`web/lib/security/credentialShape.ts`** (이 디렉터리는 이미 존재하며 `uShieldServer.ts`가 *"Web Crypto only … works in Node route handlers, the Edge runtime and vitest"*라는 동일 패턴을 쓴다)
- `atob` + `TextDecoder`만 사용. **`node:` import 금지, `Buffer` 금지, `fs`/`process.env` 금지**(호출자가 값을 넘긴다). 두 API 모두 tsconfig의 `dom` lib에 타입이 있다.
- 중복은 **패리티 테스트**로 안전하게 만든다: `web/__tests__/security/credentialShapeParity.test.ts`가 두 모듈을 모두 import해 공유 픽스처 표에 대해 `{ok, code, message}`가 동일함을 단언한다. 기존 `trustRegistryParity.test.ts`와 같은 기법이다. `isJwtShaped`가 payload를 base64url 알파벳으로 제한하므로 padded-atob와 Buffer의 결과는 정확히 일치한다.

> 조사 중 두 레인이 서로 다른 이름을 제안했다(`credentialShape.ts` 동형 신설 vs `credentials.ts`가 `.mjs`를 직접 import). **후자는 채택하지 않는다** — 라우트(Node 런타임)에서는 동작하지만 두 모듈이 생기면 그게 바로 이 사고를 만든 드리프트다. 동형 모듈 하나를 브라우저·Edge·Node 전부가 쓴다.

### 지뢰 ② `credential-core.mjs`는 신뢰 등록부에 핀되어 있다

`config/security/trust-registry.json` 엔트리 `unitas.credential.core`, sha256 `2599c0de122a640f…`. 그 파일을 동형으로 만들겠다고 편집하면 핀이 깨지고 `npm run security:trust:write` 재각인이 강제된다 — 앱 빌드를 보안 등록부에 결합시키는 대가를 얻는 게 없다. **`.mjs`는 건드리지 않는다.**

### 지뢰 ③ 세 팩토리는 이미 degrade 중이라 로컬 변화량이 0이다

실측: `web/.env.local`에 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 **아예 없다**. 따라서 `client.ts`는 이미 던지고, `serverComponent.ts`는 이미 null을 반환하고, `middlewareClient.ts`는 이미 `{user:null}`을 반환한다. 이 셋의 변경은 현재 로컬 환경에서 **행동 변화가 0**이다 — 통과해도 아무것도 증명하지 못한다는 뜻이므로, 반드시 자리표시자를 **주입해서** 테스트하라.

또한 `web/__tests__` 어디에서도 이 네 모듈이나 기존 에러 문자열을 참조하지 않는다. 메시지 변경은 아무것도 깨뜨리지 않는다.

---

## 2. 최우선 — 지금 살아있는 결함 (`build-pages.mjs`)

**이 항목만은 최종 사용자에게 도달한다.** 나머지는 로컬 개발 경로다.

실측 확인:

| 소스 | 값 |
|---|---|
| `index.html/.env` 의 `SUPABASE_ANON_KEY` | `<paste-the-project-anon-key>` — **28자 자리표시자** |
| `config/public.json` 의 `supabaseAnonKey` | 208자 정상 anon JWT |
| `scripts/build-pages.mjs:45` | `process.env.SUPABASE_ANON_KEY \|\| publicConfig.supabaseAnonKey` |

**환경변수가 정상 커밋값을 이긴다.** `set -a; . ./.env`, CI env 블록, 소싱된 셸 프로파일 — 무엇이든 `.env`를 환경에 올리는 순간 자리표시자가 생성 페이지 11개에 구워지고, `scripts/build-site.mjs:10`이 그것을 배포 대상 `site-dist/`로 복사한다. 방문자가 보는 증상은 `"Please try again"` 한 줄뿐이다.

**교체 방침:** env 오버라이드는 계속 존중하되(그게 오버라이드의 존재 이유다), **자리표시자 오버라이드는 버리고 커밋값을 쓴다.** 그 뒤 이긴 값을 형식 검증한다. 실패 시 EXIT 78.

**회귀 위험 MEDIUM-HIGH, 의도적:** `npm run build:pages`와 `npm run test:legacy`가 앞으로는 resolved anon key가 해당 프로젝트의 `anon` 역할 JWT가 아닌 환경에서 **하드 스톱**한다. 지금까지 한 번도 실패한 적 없는 스크립트에 새 실패 경로를 넣는 것이다. 깨끗한 셸에서 `node scripts/build-pages.mjs`가 `Generated N revenue pages`를 찍는지 먼저 확인하라.

부수 권고: `.env`의 죽은 자리표시자 줄은 **삭제**하는 편이 낫다. 정본은 `config/public.json`이다.

---

## 3. 파일별 지시

우선순위 순. **①의 동형 모듈을 먼저 만들고**, 그다음 나머지를 적용한다.

### 3.1 `web/lib/security/credentialShape.ts` (신설) — 우선순위 **high**

앱 계층이 "무엇이 자격 증명인가"를 배우는 **유일한** 장소. 비밀값을 반환하거나 로깅하지 않는다. `atob`+`TextDecoder` 기반(지뢰 ①). `credential-core.mjs`와 동일한 `{ok, code, message}` 계약.

### 3.2 `web/lib/supabase/server.ts` — 우선순위 **high**

가장 나쁜 항목. `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` 폴백에서 **자리표시자 service key가 truthy라서 정상 anon key를 이긴다.** 폴백 선택 자체를 형식 검증 뒤로 옮겨, 무효한 service key는 폴백 후보에서 탈락시켜야 한다. 이 파일은 `spend_coins`/`credit_coins` 등 RLS 우회 쓰기 전부의 입구다.

### 3.3 `web/app/api/mail/handle/claim/route.ts` — 우선순위 **high**

**오늘 잘못된 상태 코드를 반환하는 유일한 대상.** 자리표시자가 `!process.env.SUPABASE_SERVICE_ROLE_KEY`를 통과 → 라이브 클라이언트 생성 → GoTrue 401 → `userError` → **401 "not authenticated"로 사용자의 토큰을 탓한다.** 이 라우트의 docblock은 이 경우를 이미 503(`ledger unreachable`)으로 약속하고 있다. 형식 검증이 그 약속을 실제로 지키게 만든다.

회귀 위험 **LOW**: 브라우저 소비자 `web/lib/auth/unitasHandleClient.ts:43-54`는 `res.status`를 읽지 않고 본문만 파싱하므로 UI 렌더링은 동일하다. 서버 측 진실만 바뀐다.

### 3.4 `web/app/api/mail/handle/route.ts` — 우선순위 **medium**

HTTP 상태는 이미 옳다(200 + `unchecked`). 결함은 **메커니즘**이다: 타입어헤드 탐색마다 실패가 예정된 왕복이 발생하고, 코드가 `null`이라고 문서화한 자리에 라이브 클라이언트가 들어앉으며, 깨진 로컬 설정에 대해 완전히 침묵한다. **503으로 올리지 말 것** — 상태 코드는 건드리지 않는다.

### 3.5 `web/lib/supabase/client.ts` · `serverComponent.ts` · `middlewareClient.ts` — 우선순위 **medium**

**네 팩토리는 서로 다른 계약을 문서화하고 있다. 수렴시키지 말고 각각을 지켜라:**

| 파일 | 문서화된 계약 | 자리표시자일 때도 이래야 한다 |
|---|---|---|
| `server.ts` | throw | throw |
| `client.ts` | throw | throw |
| `serverComponent.ts` | `null` 반환 → 호출자가 로그아웃으로 fail-closed | `null` |
| `middlewareClient.ts` | `{user:null}` 반환, **절대 throw 안 함** | `{user:null}` |

`serverComponent.ts`·`middlewareClient.ts`를 던지게 바꾸면 **전역 로그아웃이 아니라 전역 500**이 된다. 이것이 이 미션이 야간으로 밀려난 핵심 이유다.

### 3.6 `web/lib/hub/hubLedger.ts` · `hubChannel.ts` — 우선순위 **medium**

`isHubServerConfigured()`(:59)와 `isHubRealtimeConfigured()`(:37)는 둘 다 `Boolean(a && b)`. 자리표시자면 "설정됨"이라고 보고한 뒤 401이 난다 — **REV-40이 한 마일스톤을 들여 제거한 `empty` vs `unreadable` 혼동**이 정확히 이것이다. 두 파일이 **하나의** 함수를 호출하게 하라(현재는 같은 Boolean 두 벌).

`hubChannel.ts:41`은 이미 `if (!isHubRealtimeConfigured()) return null`이고 42-49가 try/catch라, `client.ts`가 고쳐지면 이미 degrade한다. 불리언을 고치는 것은 **Realtime 소켓을 열기 전에** 한 단계 먼저 degrade시키는 의미다.

### 3.7 `web/components/wallet/WalletProvider.tsx` — 우선순위 **low**

`configured` 플래그는 `getSupabaseBrowserClient()`가 던지는지 여부에서만 파생된다. **`client.ts`가 고쳐지면 이 파일은 변경 불필요** — 올바른 팩토리 아래에서 이미 옳다. 폭발 반경을 보이기 위해 목록에 남긴다.

### 3.8 `scripts/supabase-sql.mjs` · `scripts/deploy-supabase.ps1` — 우선순위 **low**

- `supabase-sql.mjs`: `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_REF`에 `^sbp_` 및 ref 형식 검사 추가.
- `deploy-supabase.ps1`: **저장소에서 유일하게 자리표시자를 검사하는 파일**이지만 `<`만 본다. `[SENSITIVE]`는 `<`가 없어 전부 통과한다. 패턴을 `'<|^\[SENSITIVE\]$|^YOUR_'`로 넓힌다.

---

## 4. 수용 게이트

`config/missions/queue.json`의 `acceptance` 배열이 정본이다. 요약:

1. `npm --prefix web run typecheck` EXIT 0
2. `npm --prefix web run test` EXIT 0 — **2060건 이상, 회귀 0**
3. `npm --prefix web run build` EXIT 0
4. `npm --prefix web run security:trust:verify` EXIT 0
5. `UnitasIdleSensorStage3` 3엔진 스윕이 새 `BUILD_ID@HEAD`로 완주 — **전경에서 돌리지 말 것**(제15장 1단계 금지)

추가 권고(게이트는 아님): 지뢰 ③ 때문에 로컬 통과는 증명력이 약하다. `NEXT_PUBLIC_SUPABASE_ANON_KEY=[SENSITIVE]` 등을 **실제로 주입해** 각 팩토리가 문서화된 방향으로 degrade하는지 확인하라.

## 5. 끝내는 법

`npm --prefix web run mission:set unitas.mission.credential-guards-app-layer done`

게이트 하나라도 EXIT 0이 아니면 `done`으로 옮기지 않는다(제13장). 중단이 필요하면 `blocked` + `notes`에 이유.

---

## 6. 완결 보고 (2026-09-17)

**결재** 창립자 직접 지령 2026-09-17 — 야간 창 대기를 파기하고 주간 세션에서 즉시 착수·완결하도록 하달. 큐 항목의 `authorizedBy`("주간 세션 중 착수 금지")는 이 지령으로 **대체**되었다.

### 6.1 게이트 실측

| 게이트 | 결과 |
|---|---|
| `npm --prefix web run typecheck` | **EXIT 0** |
| `npm --prefix web run test` | **EXIT 0 — 2243 passed / 127 files** (착수 기준선 2175, 회귀 0) |
| `npm --prefix web run build` | **EXIT 0** (postbuild ownership-fingerprint 13파일 기록) |
| `npm --prefix web run security:trust:verify` | **EXIT 0** — 핀 전량 OK |
| `UnitasIdleSensorStage3` 3엔진 스윕 | **미완주 — 조건 5는 충족되지 않았다.** 아래 §6.5 참조 |

기준선은 큐가 적은 "2060건 이상"이 아니라 착수 시점 실측 **2175건**이었다. 최종 2243건은 **+68건**이며 회귀 0이다.

### 6.2 지뢰 3개 처리

- **지뢰 ①(Buffer base64url)** — 명세대로 `.mjs`를 앱 계층으로 import하지 않았다. 신설 `web/lib/security/credentialShape.ts`는 `atob` + `TextDecoder`만 쓰며, `import` 문·`Buffer`·`process.env`가 **한 글자도 없음**을 패리티 테스트가 소스를 읽어 단언한다. `web/app`·`web/lib`·`web/components`의 `credential-core.mjs` import는 grep 0건.
  Node의 `Buffer`는 base64 디코딩에 관대하고 `atob`는 엄격하다(알파벳 밖 문자, 길이 %4===1 처리). 그 차이를 그대로 흉내 내어(알파벳 밖 문자 제거, 매달린 1문자 폐기, 패딩 보정) **임의 입력에서도** 판정이 갈리지 않게 했다.
- **지뢰 ②(신뢰 등록부 핀)** — `web/scripts/credential-core.mjs`는 **무변경**. `git status` 무출력으로 확인했고 `security:trust:verify` EXIT 0.
- **지뢰 ③(로컬 통과의 무증명성)** — 명세의 권고를 게이트로 승격했다. 신설 `web/__tests__/security/credentialGuardsAppLayer.test.ts`(35건)가 `vi.stubEnv` + `vi.resetModules()` + 동적 import로 **자리표시자를 실제 주입**해 네 팩토리가 각자의 문서화된 방향으로 degrade함을 단언한다. 세 자리표시자 계열(`[SENSITIVE]`, `<paste-…>`, `YOUR_…`) 전부.

### 6.3 네 팩토리의 서로 다른 계약 — 수렴시키지 않았다

| 파일 | 계약 | 자리표시자일 때 실측 |
|---|---|---|
| `web/lib/supabase/server.ts` | throw | throw |
| `web/lib/supabase/client.ts` | throw | throw (싱글턴 오염 없음 — 환경 복구 시 재평가) |
| `web/lib/supabase/serverComponent.ts` | `null` | `null` |
| `web/lib/supabase/middlewareClient.ts` | `{user:null}`·절대 throw 금지 | `{user:null}`, `createServerClient` 호출조차 안 함 |

`middlewareClient.ts`는 추가된 모든 줄을 **기존 try 안쪽**에 넣어 "throw가 새어나가지 않음"을 약속이 아니라 구조로 만들었다.

`web/components/wallet/WalletProvider.tsx`는 명세 예측대로 **무변경**이다. 두 호출부(`:94`, `:183`)가 모두 try/catch임을 읽어 확인했다.

### 6.4 명세 대비 달라진 판단 3가지

1. **`selectServerSupabaseKey`가 `warnings`를 판정에 싣는다.** 최초 구현은 "present-but-invalid service key가 valid anon에게 폴백을 내주는" 사유를 수집하고도 `ok:true` 경로에서 버렸다. 그래서 `server.ts`가 같은 검증을 **한 번 더** 수행해야 했고 — 그것이 바로 이 미션이 제거하려는 "두 벌" 구조다. 사유를 판정에 실어 재검증을 삭제했다. 결번 없는 구분: 키가 **부재**면 `warnings: []`(조용한 정상 degrade), **존재하나 무효**면 `warnings`에 사유(권한 강등이므로 시끄러워야 한다).
2. **메일 라우트 2개가 팩토리의 질문으로 수렴했다.** 레인 A는 `probeSupabaseServerCredentials()`를 export했고 레인 D는 라우트에서 `validateSupabaseKey`를 직접 호출했다 — HTTP 결과는 동일하지만 규칙의 두 번째 사본이었고, 라우트 쪽 검사는 URL을 보지 않아 팩토리와 **불일치할 수 있었다**. `probe.ok && probe.role === 'service_role'` 하나로 통일했다.
3. **`scripts/deploy-supabase.ps1`은 워크플로 레인에서 빼고 인라인 처리했다.** 오토모드 분류기가 배포 스크립트 쓰기를 어떻게 볼지 불확실했고, 관찰 0007의 교훈("분류기 거부는 그 턴에서 최종")을 감수할 이유가 없었다. 헬퍼 2개(`Test-UnitasPlaceholder`, `Get-UnitasCredentialShape`)를 넣고 세 지점의 `-match '<'`를 교체했으며, 파서 검사(`Parser::ParseFile`, 아무것도 실행하지 않음) + 진리표 11케이스로 검증했다.

### 6.5 조건 5(3엔진 스윕)는 충족되지 않았다 — 무엇이 남았는가

`UnitasIdleSensorStage3`는 등록돼 있고 `State=Ready`이나, **마지막 실행이 2026-09-17 01:31:30에 결과 코드 `0xC000013A`(취소)로 끝났고 `test-results/stage3/`에 완주 기록이 없다.** 이 저장소에서 3단계 스윕은 지금까지 단 한 번도 완주한 적이 없다(REV-39에서 이미 기록됨).

제15장 1단계가 전경 전수 E2E를 금지하므로 세션이 대신 돌릴 수 없다. 배포 후 데몬을 새 HEAD로 기동해 두었으나, **완주는 창립자가 10분 이상 유휴 상태가 되어야 일어난다.** 따라서 큐 상태를 `done`이 아니라 `in-progress`로 둔다(제13장: 미측정 항목을 완료로 보고하지 않는다). 스윕이 완주해 `test-results/stage3/latest.md`가 새 `BUILD_ID@HEAD`로 기록되면 그때 `done`으로 옮긴다.

### 6.6 명세 정정 2건

- §2가 "생성 페이지 **11개**"라 했으나 실측은 **5개**다(`config/modules.json` = arche/arena/score/fate/codex22). 결함의 성격은 그대로다.
- §2의 살아있는 트리거는 이미 소멸했다: `index.html/.env`의 `SUPABASE_ANON_KEY=<paste-…>` 줄은 **2026-09-17 오전에 이미 삭제됐다**(grep 0건). 우선순위 버그 자체(`process.env.X || committed`)는 잔존했고 이번에 제거했다 — 방어는 트리거가 없을 때 넣어야 의미가 있다.

### 6.7 실측한 결함 재현 (증거)

`scripts/build-pages.mjs` — 3경로 전부 직접 실행:

| 입력 | 결과 |
|---|---|
| 정상 셸 | `Generated 5 revenue pages` · EXIT 0 |
| `SUPABASE_ANON_KEY='[SENSITIVE]'` | 자리표시자 **폐기**, 커밋값으로 복구, 경고 1줄, EXIT 0 |
| `SUPABASE_ANON_KEY='<paste-the-project-anon-key>'` | 동일하게 복구, EXIT 0 |
| 형식은 맞으나 `role=service_role`인 키 | **EXIT 78** fail-closed, 페이지 생성 안 함 |

생성된 페이지의 자리표시자: **0건**(실제 anon JWT 각인 확인).

`scripts/supabase-sql.mjs` — 실자격 `--dry-run` EXIT 0(전송 0) / 자리표시자 토큰 **EXIT 2**.

**뮤테이션 테스트(빨강→초록).** 신설 `web/__tests__/api/mailHandleCredentialGuard.test.ts`(12건)가 실제로 결함을 잡는지 증명하기 위해 `claim/route.ts`의 옛 참거짓 가드를 **일시 복원**했다. 세 자리표시자 전부 `expected 401 to be 503`으로 실패 — 명세 §3.3이 서술한 "방문자의 토큰을 탓한다"가 그대로 재현됐다. 원복 후 12/12 초록.

### 6.8 남겨둔 것 (의도적)

- `sb_publishable_` / `sb_secret_` 신형 Supabase 키 형식은 **받지 않는다.** 이쪽만 넓히면 핀된 정본과 패리티가 깨진다. 키 형식을 이전하게 되면 **`credential-core.mjs`를 먼저 넓히고 → 재각인 → 그다음 미러링**하는 순서를 지킬 것.
- `validateSupabaseUrl`은 https 전용이고 경로 세그먼트를 거부한다. 로컬 `supabase start` 스택(`http://localhost:54321`)은 이제 throw한다. 저장소에 http Supabase URL은 현재 0건이다.
- `scripts/deploy-supabase.ps1`에는 자동 테스트가 없다(PowerShell 하네스 부재). 파서 검사와 헬퍼 진리표는 수동 실측이다.

### 6.9 창립자 결재

**2026-09-17 — 창립자 황두영, 최종 완결 종합 보고에 승인 키워드 `Ok` 하달(제16장 공식 오피셜 통제).**

이 결재는 §6.1의 게이트 4종(typecheck · test 2243 · build · trust:verify, 전부 EXIT 0)과 커밋 `e7a0e45`의 프로덕션 배포에 대한 승인이다.

**결재가 덮지 않는 것:** 수용 조건 5(3엔진 스윕 완주)는 여전히 미측정이다. 승인 키워드는 측정을 대체하지 않으므로(제13장) 큐 상태는 `in-progress`로 유지한다. `test-results/stage3/latest.md`에 새 `BUILD_ID@HEAD` 기록이 남은 뒤에만 `done`으로 옮긴다.
