# REV-25 최종 완결 종합 보고서

**창립자 지령 2026-09-13 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0 제25장**
설계 정본: `index.html/docs/rev25/SPEC.md`

이 보고서는 **측정된 것만** 적는다. 측정하지 않은 상태를 완료로 적지 않는다(제25장).

---

## §1. 4대 게이트 실측

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 | `npm --prefix web run typecheck` | **EXIT 0** |
| 유닛 | `cd web && npx vitest run` | **1303 / 1303 passed · 83 files** (REV-24 1267/82 → **+36 / +1**) |
| 빌드 | `npm --prefix web run build` | **EXIT 0** (fingerprint `4af93cbd70f3aa44…`) |
| E2E | `npx playwright test --config=tests/web-cinema.config.js` | (§1.1) |

### 1.1 E2E — 3엔진

REV-24는 **chromium 142건**으로 끝났다. REV-25는 `chromium · webkit · mobile-chrome`
세 프로젝트를 전부 돌린다.

| 스코프 | 결과 |
|---|---|
| REV-25 신규 3개 스펙 × 3엔진 | **70 passed / 0 failed** (6.6분) |
| `rev23-verify` + `rev24-verify` × 3엔진 (하네스 수정 후) | **84 passed / 0 failed** |
| **전체 스위트 × 3엔진 (최종)** | **485 passed · 19 skipped · 0 failed · EXIT 0** (504건, 1.1시간) |

유휴 프레임 실측(최종 실행, 3엔진):

```
[REV-24 M3][chromium]      idle rAF p95 =  16.7ms · frames scheduled by the app in 3s = 0 · setTimeout(0) median = 4.6ms
[REV-24 M3][webkit]        idle rAF p95 = 381.0ms · frames scheduled by the app in 3s = 0 · setTimeout(0) median = 15.0ms
[REV-24 M3][mobile-chrome] idle rAF p95 =  16.7ms · frames scheduled by the app in 3s = 0 · setTimeout(0) median = 4.8ms
```

**`frames scheduled by the app = 0`이 세 엔진 전부에서 나온다** — REV-24 M3의 "유휴 CPU/GPU
≈ 0" 주장이 WebKit·모바일에서도 성립함을 엔진 독립적으로 증명한 값이다.

---

## §2. 측정이 뒤집은 것

각 항목은 **먼저 틀린 상태로 작성했고, 측정이 고쳤다.** 그대로 기록한다.

### 2.1 Playwright 라우트가 아무것도 잡지 못했다 (테스트 결함)

스텁 코퍼스를 `page.route('**/*.wikipedia.org/w/api.php*')`로 걸었는데 카운터가 **0**인데도
브릿지는 성공했다. 추적 결과 `page.on('request')`는 **바로 그 URL을 보고 있었다**.
원인: 설정에 `baseURL`이 있으면 Playwright는 **glob 패턴을 baseURL에 대해 해석**한다 —
크로스 오리진 호출은 `**/*` 로도 매치되지 않는다. 술어 함수도 실패. **RegExp**만 전체 URL에
그대로 매치된다. → 스텁 전부 RegExp로 교체.

### 2.2 서비스 워커가 매개한 fetch는 `page.route`로 잡히지 않는다

RegExp로 바꾼 뒤에도 카운터가 0이었다. 앱은 첫 페인트에 PWA 서비스 워커를 등록하고,
워커가 매개한 요청은 페이지 라우트의 사정권 밖이다. → 이 스펙 파일에
`test.use({ serviceWorkers: 'block' })`. 제품은 워커에 의존하지 않으므로 체인은 그대로다.

### 2.3 타일 클릭을 막은 것은 레이아웃 결함이 아니라 모달 2겹이었다

`[data-deeper-theme="bigTechPulse"]` 클릭이 계속 형제 요소(아웃바운드 링크, "+9 more")에
가로채였다. 레이아웃 버그를 의심했지만 실측:

```
unitasProfile 블록  y 324..568
rankingDeep 블록    y 505..749
```

랭킹 행을 누르면 **다이얼로그가 두 겹 주차된다**(REV-21 §1.3). 아래 다이얼로그의 타일을
겨냥한 클릭이 위 다이얼로그에 닿은 것이다. 제품 결함 아님 — 테스트가 최상단을 겨냥하도록 교정.

### 2.4 `h1.scrollWidth - clientWidth = 41px`는 글리프 잘림이 아니다

"워드마크가 잘리지 않는다"를 `scrollWidth - clientWidth ≤ 1`로 썼는데 **정상 타이틀에서
41px**(모바일 18px)이 나왔다. 워드마크는 광학 `text-indent`와 비가시 워터마크 런을 갖는다.
잘림을 결정하는 건 `overflow` 모드다 → `overflow: visible/visible` + 좌우 가장자리 이탈 0
단언으로 교체.

### 2.5 nav 우측 밖 컨트롤은 결함이 아니라 의도된 스와이프 스트립이다

Pixel 7(412px)에서 `Account Settings`가 x 403.5, 즉 **우측 밖 11px**. 결함으로 보고하려다
`NavBar.tsx`를 읽었다: *"Menu cluster: the only part that swipe-scrolls"* + 전용 엣지 힌트.
설계다. 실측으로 도달 가능성 확인 — 스트립 `overflow-x: auto`, `scrollWidth 382 > clientWidth 351`.
→ 단언을 "뷰포트 안에 있어야 한다"에서 **"접혀 있으면 스트립이 실제로 스크롤 가능해야 한다"**로 교체.

덧붙여: `#unitas-nav`는 좁은 뷰포트에서 **CSS `zoom` 0.75**로 축소된다(layout 549px → 화면
412px). `clientWidth`와 `getBoundingClientRect()`가 다르게 읽히는 이유이며, 스케일을 모르고
화면 px만 보면 오판한다.

### 2.6 전체 스위트 1회차가 드러낸 것 — 실패 10건 전부 하네스 결함

**475 pass · 19 skip · 10 fail.** 실패 10건이 전부 `rev23-verify`·`rev24-verify`
두 파일이었고(두 파일은 같은 `founderHome`을 공유), chromium 168건은 0 실패,
나머지 17개 스펙 파일은 3엔진 전부 통과. 원인 4가지를 분리했다 — SPEC §2.4의 표가 정본이다.
요지: ① `document.fonts.ready`가 WebKit에서 대기하지 않음, ② 화이트 표면 각인 전 스킨 측정,
③ 모바일에서 디버그 콘솔이 검색바를 덮음, ④ 모바일에 진입 커튼이 남음(설계).

**정착 후 두 엔진의 제품 값은 동일하다** — 히어로 A/B `74.22 / 74.20`, 카드 스킨 3클래스 ×
4속성 문자열 완전 일치. 수정 후 두 파일 **84/84**(3엔진).

### 2.7 유휴 프레임 예산 — 추정량을 교체했다 (예산은 넓히지 않았다)

`rAF p95 < 120ms`가 WebKit에서 444ms. 대조군 실측:

| 측정 | webkit | chromium |
|---|---|---|
| `about:blank` p95 / median | 17.0 / 16.0 | 16.7 / 16.7 |
| 릴리스 홈 | **425.0 / 363.0** | 33.4 / 16.7 |
| 홈, `body` 숨김 (median) | **15.0** | 16.7 |
| `setTimeout(0)` 중앙 지연 | 15 ms | 4.8 ms |
| **앱이 3초간 예약한 프레임** | **0** | **0** |

rAF는 스로틀되지 않았고, 메인 스레드는 비어 있고, 앱은 프레임을 요청하지 않는다. 350ms를
먹는 것은 **GPU 없는 헤드리스 WebKit의 전체 페이지 소프트웨어 래스터화**이며 한 곳에 몰려
있지 않다(링·nav·히어로·검색바 전부 숨겨도 375→292ms). → 런어웨이 루프 주장을 직접·엔진
독립적으로 하는 두 단언으로 교체하고, p95 120ms 천장은 **그것이 제품을 재는 chromium에서
예산 그대로** 유지. **실제 GPU Safari는 이 하네스로 측정되지 않으며, 측정했다고 적지 않는다.**

### 2.8 CTA 호버 — 고정 대기가 짧았을 뿐

webkit 160ms에서는 at-rest 그림자, 400ms에서는 **두 엔진 동일 값**
(`rgba(184,150,46,.14) 0 0 0 0` → `rgba(11,92,255,.14) 0 0 0 3px`). → `expect.poll`.

### 2.9 WebKit·모바일 진입은 REV-24 헬퍼로 불가능했다

- **Pixel 7에서 창립자 문은 커튼을 녹이지 않는다.** `#omni-synapse-search`가 "visible"을
  보고한 뒤 5초가 지나도 `.cs-root`는 `opacity:1`, `pointer-events:auto`, z-400,
  412×839로 전 화면을 덮는다(데스크톱에서는 `.cs-root` 자체가 없다). 터치 뷰포트의 진입
  제스처는 오디오 언락 요건이며 **설계**다.
- **소버린 디버그 콘솔**(z-450, 272px)이 412px에서 검색바를 덮는다 — 접힘 플래그는
  sessionStorage 키.
- **`page.evaluate(() => document.fonts.ready)`는 WebKit에서 직렬화 불가**(FontFaceSet).
- `/`는 Accept-Language로 협상된다 — 한국어 머신에서 `/ko`로 간다.

→ 공용 진입 `tests/web-cinema-e2e/_rev25Home.js`(경계 루프 + 로케일 핀 + 패널 접기).

### 2.10 브릿지를 전역 적용하면 REV-21이 닫은 드리프트가 다시 열린다 (설계 충돌)

`UnitasModuleRankings`에 명시 주석이 있었다: *"REV-21 SPEC §12.2 unitasProfile host (D-23):
no entity behind a pseudonymous operator -- sources-only mode on the module title."*
**이 호스트가 텍스트 앵커인 것은 결함이 아니라 결정이다.** 모듈명 "Echo"를 위키백과의 님프
에코로 해석하면 '공기 → Thai film' 드리프트를 새 장소에서 여는 셈이다.
→ `ExploreDeeper`에 `bridge?: boolean`(기본 `true`) 추가, `unitasProfile`과
`rankingDeep(unitasRanking)` 두 곳만 `false`. **그 결정이 유지되는지 검증하는 회귀 테스트도
같이 넣었다**(스텁 코퍼스가 답할 수 있는 상태에서 블록이 묻지 않는 것을 확인).

---

## §3. MISSION 1 — 앵커 브릿지: 실측

타워 실측(로컬 프로덕션 빌드, 스텁 코퍼스):

```
submitted "Samsung Electronics"
  [wiki] Samsung Electronics          <- 요청 1건
0 {"stream":1,"depth":"1","pages":2,
   "deeper":[{"host":"tower","kind":"entity","bridged":true,
              "bridging":false,"tiles":8,"bigTech":1}]}
>>> TOWER REACHED THE SWARM TILE
```

- **before**: `kind:"text"`, 타일 **0**, "아직 연결된 존재가 없습니다"
- **after**: `kind:"entity"`, 타일 **8**, `bigTechPulse` 존재, 렌즈가 **브릿지된 QID
  `Q20718`** 위에서 실행(`data-deeper-anchor`), 스웜 노드 6→15개, 엣지 = 노드 수,
  노드 클릭 시 렌즈가 그 엔티티로 **흡수(재앵커)**
- **비용**: 주제당 요청 **1건**, 재방문(리로드 후) **0건** — localStorage 계층 실증

신규 의존성 0 · 신규 i18n 키 0(기존 `Rev21.deeper.loading` 재사용, 20/20 로케일 보유 확인).

---

## §4. MISSION 2 — 크로스 플랫폼: 실측 수치

| 측정 | chromium 1280 | webkit 1280 | mobile-chrome 412 |
|---|---|---|---|
| 문서 가로 오버플로 | 0 | 0 | 0 |
| 히어로 폰트 | 136px / lh 129.2 | 136px / lh 129.2 | 52px / lh 49.4 |
| 히어로 광학 중심 오차 | **0.00px** | **0.00px** | **0.00px** |
| 히어로 `overflow` | visible/visible | visible/visible | visible/visible |
| 검색바 폭 · 좌우 거터 | 924px · 178.0/178.0 | 924px · 178.0/178.0 | 376px · 18.0/18.0 |
| 히어로↔검색바 축 델타 | **0.00px** | **0.00px** | **0.00px** |
| 다이얼로그 거터 | 317.9/317.9 | 320.8/320.8 | 31.9/31.9 |
| 스웜 필드(320px 프레임) | 320×220 | 320×220 | 320×305 |
| nav | — | — | layout 549 → zoom 0.75 → 412, 스트립 382/351 auto |

세 엔진 모두에서 퍼널도 동일하게 동작한다: 무자격자는 봉인 → `/gateway` 착지, 창립자는
`quantum-white` 홈 진입.

---

## §5. MISSION 3 — 마스터 키 생명주기: 실측

`tests/web-cinema-e2e/rev25-sovereign-lifecycle.spec.js` — 3엔진 각 10건, 전부 통과.

- 신규 캡슐 → 퍼널 통과 + 숨은 콘솔 404→200
- **만료 캡슐 / 손수 연장한 만료 / 한 글자 뒤집기 / 다른 시크릿** → 전부 봉인
- **위조 14종** → 전부 307 + `x-unitas-gate: seal`, **리다이렉트 타깃까지 무자격 응답과 동일**
- **전 생명주기**: 봉인 → 헤더 → HttpOnly 세션(`v1.<exp>.<hmac>`) 민팅 → **쿠키만으로 콘솔
  200** → `/api/sovereign/verify` founder=true → revoke → 다시 봉인 + 콘솔 404
- 캡슐 / 원시 토큰 / `Authorization: Bearer` 세 형태가 같은 문을 연다
- 실제 브라우저 내비게이션에서 게이트웨이가 아니라 콘솔이 렌더
- 상시 가드: `middleware.ts`·`funnelGate.ts`의 **코드**(주석 제외)에 bypass env 읽기 0

프로덕션 시크릿은 읽지도 쓰지도 출력하지도 않았다 — 캡슐은 문서화된 파생식으로 테스트
안에서 로컬 127.0.0.1 대상으로만 민팅했다.

---

## §6. REV-24가 남긴 스킵이 사라졌다 — 라이브로 실측

REV-24는 `rev24-verify.spec.js`의 M4 라이브 스웜 케이스를 **스킵**할 수밖에 없었다.
이유는 그 파일에 그대로 적혀 있다: `bigTechPulse`는 `needs:'entity'`인데 타워 앵커가
텍스트라 "there is nothing here to click".

REV-25 이후, **스텁 없이 라이브 위키백과·위키데이터 상대로** 그 테스트를 그대로 돌렸다:

```
ok 1 [chromium] › rev24-verify.spec.js:398:3 › REV-24 M4 -- the Omni-Tech swarm
     › when the live field renders, every node is a real focusable control (12.7s)
  1 passed
```

**skip이 아니라 pass다.** 브릿지가 텍스트 앵커를 실제 엔티티로 올려 타일이 생겼고,
클릭 → 스웜 → 노드 포커스까지 라이브 데이터로 완주했다.

## §7. 배포

---

## §8. 남은 것 — 숨기지 않는다

1. **nav 좁은 뷰포트 너비**: `Charge Coins` 버튼이 화면 12×24px(레이아웃 16×32px)로
   WCAG 2.5.8 AA의 24×24 중 **너비 기준 아래**다. 높이는 전부 24px 이상. 스와이프 스트립을
   넓히면 `zoom`이 더 내려가 전체가 작아지므로 단순 확대는 순손실 — **창립자 디자인 결정이
   필요한 항목**으로 기록만 한다(REV-25 3대 미션 범위 밖).
2. **로컬 빌드의 웹 합성**: `NEXT_PUBLIC_UAI_WEB_SYNTHESIS`는 프로덕션에만 설정돼 있다.
   로컬에서 타워 앵커가 항상 텍스트인 것은 그 때문이며, 브릿지는 그 조건에서 동작하도록
   만들어졌다. 프로덕션에서는 합성이 앵커를 주면 브릿지가 **무동작(no-op)** 이다.
3. **`sovereign:key` 실행**은 REV-24와 마찬가지로 자동 승인 분류기가 자격증명 실체화로
   차단한다(올바른 동작). 암호 경로는 유닛 20건 + 본 revision의 E2E 30건으로 증명했다.
