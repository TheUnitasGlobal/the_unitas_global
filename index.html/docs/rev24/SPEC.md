# REV-24 — 하이퍼-코어 최적화 및 UI 뼈대 초통합

**창립자 지령 2026-09-13 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0**
정본: `index.html/docs/rev24/SPEC.md` · 실측 보고: `index.html/docs/rev24/FINAL_REPORT.md`

이 문서는 **실측 뒤에 쓰였다.** 설계 의도가 아니라 실제로 코드에 들어간 것과, 측정이
설계를 뒤집은 지점을 기록한다(제25장: 측정하지 않은 상태를 완료로 보고하지 않는다).

---

## §0. 4대 미션 요약

| 미션 | 지령 | 결과 |
|---|---|---|
| M1 | 유료·U-COIN 전면 보류, 11개 기능의 코인 코드·UI·로직 100% 제거 + 주변 테마와 동일한 팝업 뼈대 | 완료 |
| M2 | 임시 우회 변수 제거, 영구 소버린 마스터 키를 미들웨어·백엔드 공식 아키텍처로 융합 | 완료 |
| M3 | 오토 롤링 전체를 클라이언트 캐시 순회로 격리, 네트워크 재호출 0원 + 유휴 CPU/GPU ≈ 0% | 완료 |
| M4 | `bigTechPulse`를 텍스트 칩에서 다차원 인터랙티브 스웜 네트워크 맵으로 재창조 | 완료 |

---

## §1. MISSION 1 — 유료 연동 전면 보류 및 팝업 뼈대 초통합

### 1.1 실측이 밝힌 출발점

정찰 결과 **11개 U-AI 카드 표면에 살아 있는 U-COIN 번(burn)·가격 칩·결제 유도는 이미
존재하지 않았다.** REV-23 커밋 `e1c25b1`이 유료 티어(`/api/u-ai/deep-insight`,
`DeepReport`, `UAI_DEEP_INSIGHT_COST`, `runDeep`, 자유/유료 리포터 스위치, The VOID)를
통째로 삭제했기 때문이다. 남아 있던 것은 **사체(死體)** 였다.

따라서 M1의 실제 작업은 (A) 사체 제거 (B) 뼈대 통합 두 가지다.

### 1.2 (A) 제거한 코인 배선 — 실측 검증 후 삭제

| 대상 | 상태 | 조치 |
|---|---|---|
| `lib/uai/types.ts` `UAI_MODULE` (`spend_coins`/`coin_ledger` 화이트리스트) | import 0건 | 삭제 |
| `OmniSynapseSearch.selectEcosystemByKey()` | 호출 0건 | 삭제 |
| `onSelectEcosystem` prop + 두 홈의 배선 | 위 함수 전용 | 삭제 |
| `QuantumWhiteHome`의 `EcosystemEntryModal` 마운트 | 위 배선이 유일한 개방 경로 → 도달 불가 | 삭제 |
| `OmniSynapseSearch`의 `useWallet()` | `session` 미사용 | 삭제 |
| `brainGrid` `depth: 'surface' \| 'deep'` | `'deep'` 생산자 없음 | `'surface'`로 축소 |
| `UaiWorkspace`의 `◆` 유료 마커 | 도달 불가 분기 | 삭제 |
| 죽은 유료 티어 CSS | **측정: `.qw-stream-*` 113개 중 62개 미참조** | 92개 규칙 삭제 (globals −509줄 / rev19 −32줄) |
| 고아 i18n 키 5종 × 20로케일 | 호출부 0건 | **100개 삭제** |

삭제한 i18n 키: `UAI.deepLabel`("Deep Insight · The VOID"), `UAI.openFullReport`,
`UAI.webSourcesLabel`, `HotShortcutModal.deepPending`, `HotShortcutModal.deepQueued`.

> **함정 (기록 필수):** `HotShortcutModal.deepLabel`은 **살아 있다**
> (`HotShortcutResultModal.tsx:551`, `AppDetailCard.tsx:156`). 무료 6축 야간 단조
> 리포트를 가리키며 `UAI.deepLabel`과 **다른 키다.** 로케일 파일당 `"deepLabel"`은
> 2회 나타난다 — grep 일괄 삭제 금지.

> **함정:** `/coin/i` 무차별 grep 삭제는 크립토 뉴스 테마를 파괴한다.
> `Rev20.slots.crypto.title = "Coin Pulse"`, `sourceRegistry.coinGecko`,
> `heuristics.ts`의 경제축 분류 정규식은 **콘텐츠**이지 결제 UI가 아니다.

> **함정:** `tier`는 5가지 의미로 과적재되어 있고 그중 **하나만** 돈이다.
> (1) `EngraveTier` spark/orbit/nexus/singularity = 무료 각인, (2) `ShortcutTier`
> seed/ladder = 캐시 티어, (3) suggestLadder 소스 티어, (4) `Wallet.packages.tier`
> = 실제 충전(유일한 유료), (5) `provider.ts`의 "paid engines" = LLM 벤더.
> 또한 `WIKIMEDIA_LEG_COST`의 `cost`는 **지연 예산**이지 돈이 아니다.

> **REV-40 각인 (계약 정정, 2026-09-16):** 위 두 함정을 **이 스펙의 수용 테스트
> 자신이 어겼다.** `tests/web-cinema-e2e/rev24-verify.spec.js`의 M1 단언은
> `['U-COIN','UCOIN','코인','Micro-Burn','Deep Insight · The VOID']` 맨
> substring 스윕이었고, REV-35 `33411bb`가 `.qw-stream-rankings`의 내용물을
> `UnitasModuleRankings`(네임스페이스 `UnitasRankings`, "Micro-Burn" 0건)에서
> `URankingsShorts`(`Rev34.uRankings`, lede·metrics에 "Micro-Burn" 포함)로
> 교체한 순간부터 실패해 왔다 — 33411bb가 재측정한 Playwright 레인 목록에
> rev24-verify가 없었고 전체 스위트가 한 번도 완주한 적이 없어 2026-09-16에야
> 드러났다. **Micro-Burn은 코덱스 제1장의 마진 아키텍처 명칭**이고 여기서는
> 리더보드 3대 지표 중 하나의 이름(`lib/square/uRankings.ts`, 42~100 퍼센트)이다.
> 아키텍처를 **부르는** 것은 파는 것이 아니다. 그래서 M1 계약은 **어휘가 아니라
> 결제 표면의 형태**를 금하도록 정밀화했다: 금액 칩(양방향 `숫자↔U-COIN/코인`),
> 삭제된 유료 티어 라벨, 충전·구매·잠금해제 CTA, 그리고 **코인을 제안하는 클릭
> 가능 요소**(숫자가 없어도 금지). `Micro-Burn`은 지운 것이 아니라 창립자가 결과창에
> 고정한 `.qw-stream-rankings` **안에만** 못 박았고, 그 밖의 어디에 나타나도 실패한다.
> 보호는 줄지 않고 늘었다 — 네거티브 컨트롤 11/11 실측에서 `Charge Coins`,
> `Unlock for 500`, `Pay with U-COIN`, 역순 `U-COIN 1,200`은 **옛 needle 목록이
> 놓치던 것들**이고, 리더보드 안의 `3 U-COIN`도 잡힌다(면제는 Micro-Burn 단어 하나뿐).

**건드리지 않은 것(의도적):** `app/[locale]/(gated)/layout.tsx`의 모듈 접근 게이트,
U-Pay(`lib/upay/*`), 지갑, `module-registry`의 `coinGated`. 추후 어떤 과금 모델이든
그대로 얹을 수 있도록 **무결점 프레임워크로 보존**한다.

### 1.3 (B) 하나의 카드 스킨 — THE ONE CARD SKIN

사이트는 "카드"를 **세 가지 문법**으로 그리고 있었다.

| 문법 | 사용처 | 화이트 표면 실측 (REV-24 이전) |
|---|---|---|
| `.qw-hub-card` | 테마 팝업(숏컷·뉴스·수상·랭킹) | radius 16px, 3중 그림자, 그라디언트 바탕 |
| `.qw-stream-card` | **U-AI 11 카드** | radius 14px, **그림자 없음**, 평평한 `rgba(255,255,255,.72)` |
| 손수 작성 Tailwind | 숏컷 사다리 티어 카드 | `border bg-void/40 p-4` |

같은 결과창 안에서 U-AI 카드만 더 싸구려로 읽혔다 — 창립자가 지적한 바로 그것이다.

**해결:** 스킨을 기술하는 장소를 **단 한 곳**으로 만든다.

```
--qw-card-line | --qw-card-radius | --qw-card-bg | --qw-card-shadow
```

다크 기본값은 `app/globals.css :root`, 화이트는 `quantum-white-rev19.css`의
`html[data-unitas-surface='quantum-white']`에 정의하고, 세 문법이 모두 이를 소비한다.
숏컷 티어 카드는 새 클래스 `.qw-tier-card`를 입되 **테두리 색상만** 인라인으로
티어 고유 액센트를 유지한다(프레임은 공용, 색상은 고유).

**실측 증명** (`rev24-verify.spec.js`, chromium, 빌드된 앱):

```
hub    radius 16px · shadow rgba(255,255,255,.9) 0 1px 0 inset,
                             rgba(10,10,12,.28) 0 14px 34px -20px,
                             rgba(207,214,226,.6) 0 0 0 1px
stream 동일 (byte-identical)
tier   동일 (byte-identical)
```

---

## §2. MISSION 2 — 소버린 마스터 키 (Sovereign Master Auth)

### 2.1 제거한 것

`UNITAS_GATE_BYPASS` 환경 변수를 **완전 삭제**했다 — `GATE_BYPASS_ENV`,
`isGateBypassed()`, `GateInput.bypass` 전부. 프로덕션에 켜면 전 지구에 퍼널이
열리는 전부-아니면-전무 스위치였고, 창립자의 직접 접근과 락아웃 사이에 서 있던
유일한 물건이었다. **이제 이 게이트를 끄는 환경 변수는 어디에도 없다.**

> **실측 (2026-09-13):** 이 변수는 **Vercel 프로덕션에 설정된 적이 없다.** 삭제는
> 라이브 동작을 바꾸지 않았고, 제거된 것은 **잠재 위험**이다. 반대로
> `SOVEREIGN_AUTH_TOKEN`·`SOVEREIGN_AUTH_SIGNING_SECRET`은 프로덕션에 설정되어
> 있어 마스터 키는 즉시 동작한다.

E2E 하네스는 원래부터 이 변수를 쓰지 않았다(`tests/web-cinema.config.js`는 설정하지
않으며, 스펙들은 `_sovereignToken.js`의 `?sovereign_auth=` 경로를 쓴다) — 따라서
삭제로 깨진 테스트는 없다.

### 2.2 융합한 것 — 3경로 Fail-Proof 권한 체계

`lib/sovereign/masterKey.ts` (엣지 안전, Web Crypto 전용).

| 경로 | 용도 |
|---|---|
| **헤더** `x-unitas-signature: <credential>` | 주 경로. curl·업타임 모니터·스모크 테스트·쿠키 없는 기기 |
| **쿠키** `unitas_sovereign` | 기존 HMAC HttpOnly 세션 (불변) |
| **파라미터** `?sovereign_auth=<token>` | 쿠키를 발행하는 부트스트랩 (불변) |

`credential`은 두 형태를 모두 받으며 둘 다 상수 시간 비교다.

* **서명 캡슐** `v1.<expiresAtSec>.<hmac-sha256 hex>` — 세션 쿠키와 **동일 포맷**이라
  서명 루틴이 하나다. 만료되고, 비밀을 담지 않아 제3자 모니터에 붙여도 안전하며,
  `SOVEREIGN_AUTH_TOKEN` 회전 한 번으로 전량 폐기된다.
  발행: `npm --prefix web run sovereign:key -- --days 365`
* **원시 마스터 토큰** — 셸에서 한 번 찔러보는 용도.

`Authorization: Bearer <credential>`도 별칭으로 받는다(헤더를 하나밖에 못 세우는
모니터 대응).

### 2.3 Fail-Proof의 양방향

* **공중에 대해 Fail-Closed:** 비밀 없음(프로덕션에서 `SOVEREIGN_AUTH_TOKEN` 미설정),
  형식 오류, 만료 캡슐, 서명 불일치 → 전부 "창립자 아님", 일반 방문자와 **동일한 응답**.
  타이밍 단서도 로그 줄도 없다.
* **창립자에 대해 Fail-Open:** 세 경로가 독립이라 쿠키 병(incognito, 새 기기, 쿠키를
  버리는 인앱 브라우저)을 잃어도 잠기지 않는다. 그리고 **키로 인증된 내비게이션은
  스스로 세션 쿠키로 승격**된다(`middleware.ts` §2b) — 이후 브라우저가 스스로 만드는
  요청(프리페치, 서비스 워커, 폼 POST)은 커스텀 헤더를 달 수 없으므로 이 승격이
  없으면 반쪽짜리가 된다.

### 2.4 숨겨진 제어판

`/[locale]/sovereign` (brand-kit · life-library · review-agent · second-brain)은
`isSovereignProtectedPath`로 이미 404 차폐되어 있었다. 마스터 키가 이 차폐도
만족하므로 **기계가 콘솔에 도달할 수 있다.** `/api/sovereign/verify`도 키를 받아
"내 키가 아직 유효한가, 언제 만료되는가"를 한 번의 요청으로 답한다(창립자 핑).

> **함정 (실측으로 교정):** `/en/sovereign`은 200이 아니라 **307**이다.
> `routing.localePrefix: 'as-needed'`라 영어의 정본 경로는 `/sovereign`이고,
> `/en/*`는 게이트가 판정되기 **전에** next-intl이 리다이렉트한다
> (그 응답에는 `x-unitas-gate` 헤더 자체가 없다). 최초 E2E 단언이 틀렸던 지점.

---

## §3. MISSION 3 — 프레임 예산 및 한계 비용 제로화

### 3.1 결함: 시계가 돈을 썼다

`DiscoveryCarousel`은 7초마다 슬롯을 넘기고, 착지한 슬롯의 캐시가 TTL(피드 15분 /
날씨 10분 / 랭킹 6시간)을 넘겼으면 **재호출**했다. 16슬롯 한 바퀴가 112초이므로
**검색창에 포커스를 둔 채 아무것도 하지 않는 방문자를 위해, 시계가 네트워크 기반
13개 슬롯 전부를 TTL마다 영원히 다시 불렀다.** 그중 13개 중 대부분은 브라우저에서
제3자 오리진으로 직행하므로 **우리 로그에는 보이지도 않았다.**

### 3.2 규칙: 회전은 메모리를 읽고, 방문자만 요청을 산다

정본은 `lib/live/rotationBudget.ts` (순수, 시계 주입 가능, 단위 테스트됨).

| 캐시 상태 | 시계(clock) | 의도(intent) |
|---|---|---|
| **cold** (항목 없음) | `fetch` — 최초 충전, 세션당 키마다 1회 (재호출 아님) | `fetch` |
| **fresh** | `memory` | `memory` |
| **stale** | **`memory`** ← 이 칸이 미션 전부 | `refresh` |

의도 신호는 `held !== null`(핀 고정 칩·스와이프·방향키·딥 모달 닫기가 전부 이 경로)
또는 `intentRef`(서브탭 선택). **시계는 둘 다 건드리지 않는다.**

**실측:** 16슬롯 전부 채워진 뒤 **24시간 유휴 순회 요청 비용 = 0**. 동일 stale 집합을
`intent`로 돌리면 16 — 이것이 예전에 TTL마다 지불하던 수치다.

### 3.3 상시 가동 페인트-티어 애니메이션 제거

REV-23이 워드마크 sheen에서 실측한 선례(유휴 rAF p95 50.1ms → 83.2ms)를 적용했다.
**정지 상태에서 0% 키프레임을 한 번만 칠하고, 관여(hover/focus)할 때 살아난다.**

| 대상 | 속성 | 위치 |
|---|---|---|
| `#omni-synapse-search` 링 플로우 | `background-position` (300% 그라디언트) | quantum-white.css |
| `.qw-hero-wrap h1::after` 룰 스윕 | `background-position` | quantum-white-rev19.css |
| `.app-download-pulse` | `text-shadow`+`box-shadow`+`border-color` | globals.css |
| **`qw-cta-breathe`** | `box-shadow`+`border-color` | quantum-white.css |
| `.event-horizon-btn` hue/pulse | `filter: hue-rotate`, `box-shadow` | globals.css |
| `.qw-attach-roll-track` | transform (검색바 관여 시에만) | globals.css |

> **실측이 잡아낸 결함:** `.app-download-pulse`만 좁히고 배포했다면 **릴리스된 화이트
> 홈은 아무것도 나아지지 않았다.** 화이트 표면은 `qw-cta-breathe`라는 **표면 전용
> 대체 키프레임**으로 같은 요소를 덮어쓰고 있었고, hover는 그것을 *일시정지*할 뿐이었다.
> E2E가 `animationName === 'qw-cta-breathe'`를 뱉어서 발견했다.

**남긴 것(의도적):** `.qw-void-ring`(30~52s)·`.qw-sigil-spin`(90s)·
`.nav-edge-hint-pulse`(1.6s)·`.logo-hologram`은 **transform/opacity 전용**이라
컴포지터에서 처리되며, `will-change`로 승격된 로고 헤일로는 블러를 1회만
래스터화한다. 이들은 살아 있는 디자인이고 프레임 예산을 먹지 않는다.

### 3.4 JS 유휴 비용

* `SovereignWatermark`의 devtools 도킹 폴링(1000ms, `outerWidth/innerWidth` 등
  레이아웃 인접 읽기)을 **완전히 이벤트 구동으로 전환**했다 — `resize` +
  `visibilitychange` + `focus`. 패널을 **도킹하는 행위 자체가 resize**이므로 커버리지
  손실이 없고, 유휴 비용은 0이 된다. `DEVTOOLS_POLL_MS` 상수 삭제.
* `useShortcutFeed`의 30초 카운트다운은 탭이 숨겨지면 멈추고 복귀 시 보정 후 재개한다.

---

## §4. MISSION 4 — 옴니-테크 다차원 인터랙티브 스웜

### 4.1 결함

`bigTechPulse`는 조직을 6개 위키데이터 차원(업종·모회사·자회사·제품·창업자·CEO)으로
해체하고 **각 항목이 그 자체로 재정박 가능한 엔티티**다. 그런데 텍스트 칩 6장으로
출고됐다 — 발견한 관계가 화면에 하나도 없었다. 게다가 **재정박 루프가 죽어 있었다:**
`list` 렌더러만 재정박 버튼을 그렸고 `chips` 렌더러는 그리지 않았으므로, 모듈을
누르면 흡수 대신 위키데이터로 나갔다.

### 4.2 창조한 것

하나의 **장(field)**. 앵커가 중심에서 타오르고, 각 차원이 각도 섹터를 점유하며,
모든 엔티티가 3개 깊이 셸 중 하나에 놓여 코어로 배선된다. 포인터가 지나가면 셸이
서로 어긋나 시차(parallax)를 만들어 원반이 아니라 **부피**로 읽힌다. 노드를 활성화하면
테마 전체가 그 엔티티로 재정박된다 — **모듈러 흡수 루프가 마침내 연결됐다.**

* 레이아웃 정본: `lib/uai/swarmLayout.ts` (순수, 백분율 좌표, 결정론적)
* 뷰: `components/home/deeper/OmniTechSwarm.tsx`
* 칠: `app/globals.css` §REV-24 M4 + `quantum-white-rev19.css` §24

### 4.3 이 프로젝트가 이미 값을 치른 3대 제약을 따랐다

1. **WebGL 불가.** `Scene.tsx`가 앱의 유일한 `<Canvas>`이고 lazy·`ssr:false`·
   SovereignShield 뒤에 있는 이유는 **헤드리스 WebKit이 마운트에서 WebGL 컨텍스트를
   잃고 루트 에러 바운더리를 터뜨리기** 때문이다. 모달 안의 두 번째 R3F 캔버스는 그
   노출을 배가하고 three.js 그래프를 팝업 임계 경로에 올린다. → **절대 위치 HTML
   버튼 + SVG 엣지 레이어 1장.** 번들 증가 0, 잃을 컨텍스트 없음.
2. **렌더 루프 불가.** 포인터가 CSS 커스텀 프로퍼티 `--sx`/`--sy`를 ref로 쓰고
   (프레임당 최대 1 rAF, **움직이는 동안에만**), CSS가 셸 깊이 `--d`와 곱해
   `translate3d`로 바꾼다. **React 상태 변화 없음 → 리렌더 없음. 유휴 비용 0.**
   M3와 같은 독트린.
3. **진짜 버튼.** 이 장은 Tab을 가두는 `Modal` 안에 산다. `<g tabindex>` SVG 그래프는
   엔진마다 동전 던지기다. 모든 노드는 평범한 `<button>`이고 SVG는 `aria-hidden`
   장식이다 — 키보드·스크린리더·터치가 특수 처리 없이 동작한다.

`prefers-reduced-motion`과 `pointer: coarse`는 **동일한 장을 정지 상태로** 받는다
(노드 위치는 한 픽셀도 다르지 않다).

### 4.4 측정이 설계를 고친 지점

`hashUnit`의 최초 구현은 평범한 FNV-1a였다. 노드 id가 `<PID>-Q<번호>` 형태라 마지막
글자만 다른데, FNV-1a는 그럴 때 **상위 비트가 거의 움직이지 않는다** —
`P452-Q1`과 `P452-Q2`가 0.0039 차이로 나와서 각 섹터의 노드가 **부채꼴이 아니라
직선 램프**로 깔렸다. MurmurHash3의 `fmix32` 애벌런치 꼬리를 붙여 고쳤고, 단위
테스트가 이를 고정한다.

---

## §5. 무결성 게이트 (제25장)

| 게이트 | 결과 |
|---|---|
| `npm --prefix web run typecheck` | **EXIT 0** |
| `npm --prefix web test` (vitest) | **1267 / 1267 pass** |
| `npm --prefix web run build` | **EXIT 0** |
| Playwright `rev24-verify` (chromium) | **14 pass · 1 skip** |

신규 테스트 파일 4종 / 신규 단위 테스트 +21:
`__tests__/gate/masterKey.test.ts`, `__tests__/live/rotationBudget.test.ts`,
`__tests__/uai/swarmLayout.test.ts`, `__tests__/uai/omniTechSwarm.test.ts`.

마지막 스킵 1건의 정확한 이유는 FINAL_REPORT §잔여 참조.
