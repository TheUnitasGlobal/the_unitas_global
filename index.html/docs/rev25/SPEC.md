# REV-25 — 스웜 앵커 브릿지 및 크로스 플랫폼 무결성

**창립자 지령 2026-09-13 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0**
정본: `index.html/docs/rev25/SPEC.md` · 실측 보고: `index.html/docs/rev25/FINAL_REPORT.md`

이 문서는 **실측 뒤에 쓰였다.** 설계 의도가 아니라 실제로 코드에 들어간 것과, 측정이
설계를 뒤집은 지점을 기록한다(제25장: 측정하지 않은 상태를 완료로 보고하지 않는다).

---

## §0. 3대 미션 요약

| 미션 | 지령 | 결과 |
|---|---|---|
| M1 | U-AI 타워 앵커 ↔ `bigTechPulse` 스웜 필드 브릿지 결합 — 텍스트를 유효 엔티티 노드로 실시간 재앵커링 | 완료 |
| M2 | WebKit(Safari)·모바일 에뮬레이션 E2E 커버리지 확장, 반응형 타이포·픽셀 정렬 오차 증명 | 완료 |
| M3 | 소버린 마스터 키 라이브 진입 시나리오 E2E 정식 편입 — 위조 100% 차단, 승격·콘솔 개방 전 생명주기 | 완료 |

---

## §1. MISSION 1 — 앵커 브릿지

### 1.1 결함의 정확한 기전

REV-24가 스웜을 만들고도 도달하지 못한 이유는 한 줄이다.

```ts
// components/uai/UaiHyperStream.tsx
anchor = surface.web.anchor ? entityAnchor(surface.web.anchor, lang, surface.query)
                            : textAnchor(surface.query, lang);
```

`themesFor()`는 앵커가 먹일 수 없는 테마를 전부 떨어뜨린다(`lib/uai/deeperThemes.ts`).
15개 렌즈 중 **13개가 `needs: 'entity'`**, 즉 **Wikidata QID를 요구**한다.
`bigTechPulse`는 그중 첫 번째다. 라이브 웹 합성이 조직 엔티티를 해석하지 못하면 앵커는
텍스트가 되고, 렌즈는 **0개**가 되며, 스웜은 존재하되 도달 불가가 된다
(REV-24 실측: `data-anchor-kind="text"`, 타일 0, "아직 연결된 존재가 없습니다").

같은 구멍이 타워에만 있는 것이 아니다. 실측으로 확인한 텍스트 앵커 발생 지점:

| 호스트 | 앵커 출처 | 상태 |
|---|---|---|
| `tower` / `uaiPage` | `surface.web.anchor` 없으면 `textAnchor(query)` | 합성 실패 시 텍스트 |
| `unitasProfile` | `textAnchor(titleFor(module))` — **리터럴** | 항상 텍스트 |
| `rankingDeep`(유니타스 랭킹) | `textAnchor(activeModuleTitle ?? title)` — **리터럴** | 항상 텍스트 |
| `globalRankingDetail` | 폴백 `textAnchor(term)` | 해석 실패 시 텍스트 |
| `keywordTier` | `analysis.web.anchor` 없고 `tier.qid`도 없으면 텍스트 | 조건부 |

**로컬 프로덕션 빌드에서는 `NEXT_PUBLIC_UAI_WEB_SYNTHESIS`가 꺼져 있어
`surface.web.anchor`가 항상 `undefined`다.** 즉 결함은 확률이 아니라 상수였다.

### 1.2 브릿지 — 두 번째 해석기가 아니다

신설 `web/lib/uai/anchorBridge.ts`. 핵심 원칙: **정체성 파이프라인은 건드리지 않는다.**
REV-21 §2.2가 '공기 → Thai film' 드리프트를 닫으려고 굳힌 `resolveEntity()`
(방문자 자국어 위키 → Wikidata 라벨 폴백 → 제외 클래스 게이트)를 **그대로 재사용**한다.
병렬 해석 경로를 새로 만들면 그 드리프트가 다시 열린다.

이 모듈이 새로 결정하는 것은 세 가지뿐이다.

1. **언제 쓸 가치가 있는가** — `needsAnchorBridge()`는 **라벨이 아니라 능력**을 본다.
   `kind:'entity'`인데 QID가 없는 앵커도 `bigTechPulse`를 못 먹이는 건 텍스트와 동일하므로
   똑같이 수리 대상이다. `place`/`country`는 자기 식별자가 있으므로 제외하고,
   **다의어(`disambiguation`)는 절대 추측하지 않는다** — 그건 의미 선택기의 몫이고,
   추측이 곧 REV-21이 닫은 드리프트다.
2. **무엇을 기억하는가** — 3중 캐시로 한계비용을 0으로 수렴시킨다(§1.3).
3. **어떻게 되돌리는가** — `applyAnchorBridge()`는 **방문자가 친 말을 `term`으로 유지**하고
   (아웃바운드 검색이 쓰는 값) 정체성(QID·정확 제목·좌표)만 밑에 태운다. 좌표가 있으면
   `entityAnchor`가 알아서 `place` 앵커로 만들므로 **그 판단을 두 번 하지 않는다**.

### 1.3 한계비용 0원 (제2장 #160·#309·#409)

| 계층 | 구현 | 왜 필요한가 |
|---|---|---|
| in-flight Map | `bridgeTerm`의 모듈 레벨 `Map<key, Promise>` | **타워는 같은 앵커로 ExploreDeeper를 페이지마다 마운트한다**(`STREAM_DOM_PAGES`=12). 없으면 키워드 하나가 12번 해석된다 |
| 메모리 Map | `AnchorBridgeCache` | 재요청을 마이크로초에 답한다 |
| localStorage | `unitas.anchor.bridge.v1` | 재방문 비용 0 |

**미스도 캐시한다.** 위키에 문서가 없는 말(모듈 가명 "NEXUS" 등)을 렌더마다 다시 묻지
않기 위해서다. 단 TTL은 짧다(6h vs 7d) — 미스는 정체성에 대한 진술이 아니라 오늘 코퍼스에
대한 진술이기 때문이다. **타임아웃은 캐시하지 않는다** — 침묵은 답이 아니다.

해석은 **호출자가 취소할 수 없다.** in-flight 프로미스를 12개 블록이 공유하는데 그중 하나가
언마운트하며 abort하면 나머지 11개의 작업을 죽인다. 대신 자체 컨트롤러 + 8초 타임아웃을
갖고, 호출자는 듣기만 그만둔다(`useAnchorBridge`의 `live` 플래그).

### 1.4 결선 지점 — 한 곳

`components/home/ExploreDeeper.tsx`, `effective = chosen ?? bridged ?? anchor`.
이 블록은 **모든 U-AI 팝업과 타워가 이미 렌더하는 단 하나의 블록**이므로, 여기를 고치면
타워·`/u-ai`·모듈 랭킹·글로벌 랭킹 폴백·키워드 티어가 **동시에** 고쳐진다.
방문자가 직접 고른 의미(`chosen`)는 여전히 브릿지를 이긴다.

신규 i18n 키 **0개** — 해석 중 표시는 기존 `Rev21.deeper.loading`("불러오는 중…")을 쓴다.
"아직 연결된 존재가 없습니다"를 먼저 보여주고 잠시 뒤 렌즈 13개로 바꾸는 것은
거짓말 다음의 깜빡임이므로, `data-anchor-bridging` 동안 그 문구를 **보류**한다.

### 1.5 브릿지를 걸지 않는 곳 — D-23 결정 보존

정찰 중 발견: `UnitasModuleRankings`의 `ExploreDeeper`에는 명시적 주석이 붙어 있다.

```tsx
{/* REV-21 SPEC §12.2 unitasProfile host (D-23): no entity behind a
    pseudonymous operator -- sources-only mode on the module title. */}
```

**이 호스트가 텍스트 앵커인 것은 결함이 아니라 결정이다.** 모듈명 "Echo"를 위키백과의
님프 에코로 해석하면, REV-21 §2.2가 닫은 '공기 → Thai film' 드리프트를 새 장소에서 다시
여는 셈이다. 창립자 지령의 범위도 "U-AI 검색창이나 타워에서 **키워드를 입력하거나 선택**할
때"이지 내부 모듈 가명이 아니다.

→ `ExploreDeeper`에 `bridge?: boolean`(기본 `true`) 추가. `false`를 넘기는 곳은 두 군데:

| 호스트 | 앵커 | 이유 |
|---|---|---|
| `unitasProfile` | `textAnchor(모듈 제목)` | D-23 sources-only |
| `rankingDeep` (`key === 'unitasRanking'`) | `textAnchor(모듈 제목 ?? 슬롯 제목)` | 같은 가명 |

`rankingDeep`의 `worldRanking` 쪽은 실제 Wikidata 항목(`THEME_QID`)이므로 그대로 브릿지한다.

### 1.6 유휴 비용에 미치는 영향 — 확인함

REV-24 M3의 "유휴 페이지 요청 0건" 보증을 깨지 않는다. `ExploreDeeper`는 모달 안에서만
마운트되고(캐러셀 카드 자체에는 없다), 브릿지는 `needsAnchorBridge`가 참일 때만 움직인다.
전체 스위트 재실행으로 실측 확인(§FINAL_REPORT).

---

## §2. MISSION 2 — 크로스 플랫폼

### 2.1 REV-24의 한계

REV-24는 **chromium 142건**으로 끝났다. `tests/web-cinema.config.js`에는 webkit·
mobile-chrome 프로젝트가 **이미 정의되어 있었지만 돌지 않았다.** 측정하지 않은 표면은
통과한 표면이 아니다.

### 2.2 측정이 뒤집은 것 — 진입 경로

REV-24의 헬퍼는 크로미움-데스크톱 전용이었다. 실측:

- **Pixel 7(412px)에서 창립자 문은 커튼을 녹이지 않는다.** `#omni-synapse-search`가
  "visible"을 보고한 뒤 5초가 지나도 `.cs-root`는 `opacity:1`,
  `pointer-events:auto`, z-400, 412×839로 화면 전체를 덮고 있다. 데스크톱에서는 같은 URL로
  `.cs-root`가 아예 없다. 터치 뷰포트의 진입 제스처(오디오 언락)는 **설계**이며,
  프로젝트의 rev15/rev17 헬퍼가 이미 그 길을 걷는다: ENTER → SKIP → COMING SOON → ENTER.
- **소버린 디버그 콘솔**(`[data-sovereign-console]`, z-450, left 16 / 272px)이 412px에서
  검색바를 덮는다. 접힘 플래그는 sessionStorage 키다.
- **`page.evaluate(() => document.fonts.ready)`는 WebKit에서 직렬화 불가**(FontFaceSet).
  `.then(() => true)`가 해법.

→ 공용 진입 `tests/web-cinema-e2e/_rev25Home.js`. 커튼이 있으면 걷고 없으면 지나가는
**경계 루프**라 세 프로젝트가 한 호출을 공유한다. 로케일은 **핀**한다(`/` 는
Accept-Language로 협상되어 한국어 머신에서 `/ko`로 간다).

### 2.3 측정이 뒤집은 것 — 단언 자체

| 내가 처음 쓴 단언 | 실측 | 정정 |
|---|---|---|
| `h1.scrollWidth - clientWidth ≤ 1` (글리프 잘림) | **41px** (정상 타이틀에서) | 워드마크는 광학 `text-indent`와 비가시 워터마크 런을 갖는다. 잘림을 결정하는 건 `overflow` 모드 → `overflow: visible/visible` 단언으로 교체 |
| "모든 nav 컨트롤은 뷰포트 안에 있어야 한다" | `Account Settings`가 412px 중 x 403.5 (우측 밖 11px) | **메뉴 클러스터는 의도된 스와이프 스트립**(`NavBar.tsx`: "the only part that swipe-scrolls" + 엣지 힌트). 결함이 아니다 → **도달 가능성** 단언으로 교체: 접힌 컨트롤이 있으면 스트립이 실제로 스크롤 가능해야 한다(`overflow-x:auto`, `scrollWidth 382 > clientWidth 351` 실측) |
| 터치 컨트롤 높이 ≥ 32px | 24~33px | WCAG 2.5.8 AA 하한 **24px**로 교체(실측 최소 24.0) |

`#unitas-nav`는 좁은 뷰포트에서 **CSS `zoom` 0.75**로 축소된다(layout 549px → 화면 412px).
`--unitas-zoom` 변수가 정본이며, 이 때문에 `clientWidth`와 `getBoundingClientRect()`가
다르게 읽힌다 — 스케일을 모르고 화면 px만 보면 오판한다.

### 2.4 WebKit·모바일을 처음 돌려서 드러난 것 — 전부 하네스 결함

전체 스위트 1회차(504건 / 3엔진): **475 pass · 19 skip · 10 fail.**
**실패 10건이 전부 `rev23-verify.spec.js`·`rev24-verify.spec.js` 두 파일**이었고, 두 파일은
같은 `founderHome` 헬퍼를 공유한다. chromium 168건은 0 실패, 나머지 17개 스펙 파일은
3엔진 전부 통과. 원인 4가지를 실측으로 분리했다.

| # | 증상 | 실측 | 원인 |
|---|---|---|---|
| 1 | webkit 히어로 대칭 A=-83.6 / B=11.7 | 정착 후 **두 엔진 모두 A=74.22 · B=74.20** | `page.evaluate(() => document.fonts.ready)`가 FontFaceSet을 직렬화 못 해 **대기하지 않음** → 폴백 폰트 메트릭으로 측정 |
| 2 | webkit 카드 스킨 radius 불일치 | 정착 후 `qw-hub/stream/tier-card` **3클래스 × 4속성 문자열 완전 일치**(radius 16px) | `data-unitas-surface="quantum-white"` 각인 전 측정 — 화이트 토큰 레이어가 그 아래에 걸려 있다 |
| 3 | mobile 클릭 5건 타임아웃 | 소버린 디버그 콘솔 z-450, x 16..288 · y 96..428 / 검색바 x 18..394 · y 168..218 | 콘솔 패널이 **검색바를 덮는다** → 첫 페인트 전 접기(sessionStorage 플래그) |
| 4 | mobile 진입 실패 | `dev=skip` 후에도 `.cs-root` opacity 1 · pointer-events auto · 전 화면 | 터치 뷰포트는 오디오 언락 제스처가 필요 — **설계** → 커튼 워크 |

→ `_rev25Home.js`가 `collapseSovereignPanel` / `walkCurtain` / `settleSurface`를 내보내고
rev23·rev24 헬퍼가 그것을 쓴다. 수정 후 두 파일 **84/84**(3엔진).

### 2.5 유휴 프레임 예산 — 추정량 교체 (REV-24 rail-drag와 같은 처방)

`rAF p95 < 120ms`를 WebKit에서 처음 돌리자 **444ms**가 나왔다. 대조군이 이를 갈랐다.

| 측정 | webkit | chromium |
|---|---|---|
| `about:blank` rAF p95 / med | 17.0 / 16.0 | 16.7 / 16.7 |
| `/robots.txt` | 17.0 / 16.0 | 16.8 / 16.7 |
| **릴리스 홈** | **425.0 / 363.0** | 33.4 / 16.7 |
| 홈, `body` 숨김 | — / **15.0** | — / 16.7 |
| `setTimeout(0)` 중앙 지연 | **15 ms** | 4.8 ms |
| 살아 있는 인터벌 | 1개(600000ms) | — |
| **앱이 3초간 예약한 프레임** | **0** | **0** |

즉 **rAF는 스로틀되지 않았고, 메인 스레드는 비어 있고, 앱은 프레임을 요청하지 않는다.**
`body`를 숨기면 366 → 15ms. 350ms를 먹는 것은 **GPU 없는 헤드리스 WebKit에서 릴리스 홈
전체를 소프트웨어 래스터화하는 비용**이며, 한 곳에 몰려 있지 않다(링·nav·히어로·검색바를
모두 숨겨도 375 → 292ms에 그친다). Chromium은 모든 은닉 단계에서 16.7ms로 평탄하다.

REV-24가 rail-drag에서 내린 처방과 동일하게 적용한다 — **추정량이 주장과 다른 것을 재고
있으면 예산을 넓히지 말고 추정량을 바꾼다.** 런어웨이 루프 주장은 이제 직접·엔진 독립적으로
한다: ① 유휴 3초 동안 앱이 예약한 애니메이션 프레임 수 ≤ 2(실측 **3엔진 전부 0**),
② `setTimeout(0)` 중앙 지연 < 50ms(실측 4.5~15ms). p95 120ms 천장은 **그것이 제품을 재는
엔진(chromium)에서 예산 그대로** 유지한다.

**측정되지 않은 것:** GPU 합성이 되는 실제 Safari. 이 하네스에는 GPU 경로가 없으므로
"Safari 사용자가 3fps를 본다"는 결론은 **성립하지 않으며, 성립한다고 적지도 않는다.**
실기기 확인은 후속 과제로 남긴다.

### 2.6 CTA 호버 — 고정 대기 → 폴링

webkit에서 호버 후 160ms에 아직 전이가 끝나지 않아 at-rest 그림자를 읽었다. 400ms에서는
**두 엔진이 동일 값**을 보고한다(`rgba(184,150,46,.14) 0 0 0 0` →
`rgba(11,92,255,.14) 0 0 0 3px`, 테두리 `rgba(10,10,12,.45)` → `rgb(8,71,201)`).
제품이 아니라 시계 차이 → `expect.poll`로 교체.

### 2.7 증명된 불변량 (3엔진 공통)

- 가로 스크롤 0 (`document.scrollWidth ≤ clientWidth + 1`)
- 히어로 광학 중심 오차 **0.00px** — chromium·webkit·mobile-chrome 전부
- 히어로↔검색바 축 델타 **0.00px**, 검색바 좌우 거터 대칭 (178/178 데스크톱, 18/18 모바일)
- 다이얼로그 좌우 거터 대칭, 다이얼로그 개방이 가로 스크롤을 만들지 않음
- 스웜 필드: 애니메이션 없음, 노드는 `transform`으로 배치, 전부 프레임 안

---

## §3. MISSION 3 — 마스터 키 생명주기

### 3.1 REV-24가 증명하지 않은 절반

REV-24는 키가 **연다**는 것을 증명했다. 증명하지 않은 것은 "Fail-Proof"의 나머지 절반이다:
캡슐이 **자기 주장(만료·서명)을 덮는 진짜 암호 객체**인지, 어떤 모양의 위조든 무자격 요청과
**구별 불가**한지, 창립자가 실제로 사는 승격 사슬이 닫히는지.

### 3.2 편입한 시나리오

`tests/web-cinema-e2e/rev25-sovereign-lifecycle.spec.js` — 캡슐을 **테스트 안에서 민팅**한다
(`_sovereignToken.js` + `lib/sovereignAuth.ts`에 문서화된 파생식, 로컬 127.0.0.1 대상).
프로덕션 시크릿은 읽지도 쓰지도 출력하지도 않는다 — 검증 대상은 알고리즘이고, 알고리즘은
프로덕션이 돌리는 것과 같다.

| 케이스 | 주장 |
|---|---|
| 신규 캡슐 | 퍼널 통과 + 숨은 콘솔 404 → 200 |
| 만료 캡슐 | 무자격자와 동일하게 봉인 |
| **만료 시각 손수 연장** | 봉인 — 만료가 서명에 덮여 있음 |
| 한 글자 뒤집기 | 봉인 |
| 다른 시크릿으로 민팅 | 봉인 |
| 위조 14종 표 | 전부 307 + `x-unitas-gate: seal`, **리다이렉트 타깃까지 무자격 응답과 동일** |
| 전 생명주기 | 봉인 → 헤더 → HttpOnly 세션 민팅 → **쿠키만으로 콘솔** → `/api/sovereign/verify` founder=true → revoke → 다시 봉인 + 콘솔 404 |
| 두 자격 형태 | 캡슐 / 원시 토큰 / `Authorization: Bearer` 모두 같은 문 |
| 실제 브라우저 내비게이션 | 게이트웨이가 아니라 콘솔이 렌더 |
| 상시 가드 | `middleware.ts`·`funnelGate.ts`의 **코드**(주석 제외)에 bypass env 읽기가 없음 |

주석은 `UNITAS_GATE_BYPASS`를 **기억해도 된다** — 두 파일 모두 왜 사라졌는지 기록하고 있고
그 기록은 지킬 값어치가 있다. 금지되는 건 그걸 **읽는 코드**다. 첫 실행에서 이 구분을
못 한 단언이 실패했고, 제품이 아니라 단언을 고쳤다.

---

## §4. 남은 것

- `NEXT_PUBLIC_UAI_WEB_SYNTHESIS`는 프로덕션에만 설정돼 있다. 로컬 빌드에서 타워 앵커가
  항상 텍스트인 것은 그 때문이며, 브릿지는 그 조건에서 동작하도록 만들어졌다.
- nav의 좁은 뷰포트 좌우 여백: `Charge Coins` 버튼이 화면 12×24px(레이아웃 16×32px)로
  WCAG 2.5.8 AA의 24×24 **너비** 기준 아래다. 높이는 전부 24px 이상. 스와이프 스트립을
  넓히면 `zoom`이 더 내려가 전체가 작아지므로 단순 확대는 순손실 — 창립자 디자인 결정이
  필요한 항목으로 기록만 한다.
