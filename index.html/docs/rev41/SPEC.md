# REV-41 — U-AI 검색창 1회 클릭(글자 미입력) 팝업 UI/UX 대통합 및 하이퍼-창조 (창립자 지령 2026-09-17)

정본 위치: `index.html/docs/rev41/SPEC.md` · 기준: Codex v41.0 Absolute Infinite Paradigm Edition 제1장~제16장 + 1000대 초헌법
선행: REV-34(스트립 ⏎ 박스·단일 메타 포맷) · REV-35(유랭킹 슬롯 이식) · REV-36/39/40(3단계 데몬·CI 단일 게이트)

## 0. 지령

| 미션 | 요지 |
|---|---|
| M0 | 모든 컴포넌트·팝업은 반응형 그리드 + 인앱 뷰포트 우회로 PC·모바일·태블릿·인앱에서 1픽셀 오차 0. |
| 1-A | 디폴트 팝업의 '실시간 뉴스' 위젯 **카드 아래**의 "다른출처에서열기 / 다른플랫폼에서열기" 영구 삭제. 뉴스 축 팝업·기사 팝업·딥다이브 모달의 것은 유지. |
| 1-B | 실시간 숏컷·실시간 뉴스의 **모든** ⏎ 박스: 우측 끝 고정(space-between) 폐기 → 마지막 글자 바로 우측에 꼬리표처럼 밀착(inline 래퍼). 1줄·2줄 무관. |
| 1-C | 정보 1개뿐인 단일 위젯(날씨·환율 나침반·내 주변 등): 카드 내 어디를 눌러도 같은 다음 팝업. 최상위 컨테이너 단일 onClick으로 힛박스 통합. |
| 1-D | 환율 나침반 하이퍼-창조: ① 접속 건수 0건 타파(메타 라인 `0건` 소거), 글로벌 매크로·크립토 패리티·환율 스파크라인 렌더 ② 유로 고정 폐기, i18n + Geo-IP 로컬라이제이션으로 접속 국가 통화쌍(한국 → KRW/USD)을 가장 거대한 타이포로 자동 포커스. |
| 1-E | 글로벌 신상품: ① 서브 타이틀 나열 설명글 폐기 → 철학적 한 문장 ② 서브 타이틀 박스(패밀리 탭)를 메인 타이틀 박스와 100% 동일한 글래스모피즘 칩으로 격상 + 자동 회전·색상 변환 + 클릭 시 회전/멈춤 토글(메인과 동일 동작). |
| 1-F | 글자 미입력 실시간 숏컷 타이틀 박스 목록에서 "유랭킹" 타일 완벽 소거. |
| 1-G | 내 주변 'Around Me' 옴니-레이더 창조: ① 거리 정합성(반경 표기 vs 실제 결과) 오차 0% ② 상단 [10km · 50km · 100km · Global] 반경 토글 ③ 1000대 초헌법 기반 정보(노마드 밋업 스팟·AI 팩토리 워크스페이스·영감 히든 스팟)를 탐지하는 옴니-레이더 시각화 UI. |
| 게이트 | `npm --prefix web run typecheck` · `test` · `build` EXIT 0 → 커밋 → `git push` → Vercel 프로덕션 → 최종 브리핑. |

## 1. 정찰이 확정한 전제 (2026-09-17 실측)

1. 디폴트 팝업 = `HotShortcutMatrixStrip` → `DiscoveryCarousel`(실시간 숏컷, 16슬롯 회전) + `HotIssueNewsList`(실시간 뉴스, 22축 회전). 두 카드 모두 `.qw-hub-card` 인 컨테이너 + `HubTitleRow`(제목 텍스트 버튼 + ⏎ `HubRowEnter[data-row-enter=title]`) + `.qw-hub-row`(헤드라인 버튼 + 형제 ⏎ `[data-row-enter=row]`). 현재 CSS는 `.qw-hub-title-row{display:flex}` / `.qw-hub-row{display:flex}` 로 ⏎가 **행의 우측 끝**에 고정된다 → 1-B 위반.
2. `<button>`은 CSS `display:inline`을 줘도 브라우저가 원자적 인라인 블록으로 취급하므로 여러 줄 텍스트 뒤에 꼬리표를 붙일 수 없다. 행 텍스트는 `<span role="button" tabindex="0">`(인라인, 줄바꿈 가능)로, ⏎는 같은 인라인 서식 문맥의 형제 `<button>`(inline-flex)으로 둔다. 제목은 한 줄(nowrap·ellipsis)이므로 네이티브 `<button>`을 유지하고 `display:inline-block` + `max-width`로 ⏎를 뒤에 붙인다(E2E rev21은 `.qw-hub-title-hit`가 네이티브 버튼이며 `.focus()`+Enter로 열림을 단언).
3. 뉴스 위젯의 카드 아래 `OmniOpen host="newsRail"`(1-A 대상)은 `HotIssueNewsList.tsx` 본문에서 카드 컨테이너 형제로 렌더된다. E2E `rev29-verify.spec.js` 'M2.4 / REV-31' 테스트가 `[data-news-block] [data-omni-open]`의 가시성을 단언 → **계약 갱신 필수**(블록 직속 0, 축 팝업·기사 팝업 내부 1).
4. `fx` 슬롯: Frankfurter v2 1회 호출(`base=USD, quotes=EUR,JPY,GBP,KRW(+own)`), facts만 있고 `items: []` → `HubMetaLine count=0` → "0건". 첫 emphasis fact가 `EUR`(유로 고정 노출). `SLOT_SCOPES.fx = ['global','country']`.
5. 국가 결정: `resolveCountry(profile → 날씨 캐시 장소 → 로케일 기본)`. Geo-IP는 날씨 '내 위치'에만 사용(`get.geojs.io/v1/ip/geo.json`, `ipwho.is` 폴백). GeoJS·ipwhois는 소스 레지스트리에 이미 등록됨(개인정보 페이지 포함).
6. `nearby` 슬롯: Wikipedia `list=geosearch gsradius=10000 gslimit=10` 고정, 첫 항목 거리 `4874m` 등 **m 단위**, facts `nearbyCount = hits.length(≤10)`. 태그 문구 "반경 10km 이내의 이야기". Wikipedia/Wikidata geosearch는 `gsradius ≤ 10,000m`, `gsbbox`는 "too big"(실측). WDQS `wikibase:around`는 50km 단일 클래스는 응답하나 100km 다중 클래스는 30s 타임아웃(실측), 2026-09-13엔 429 1req/min. Overpass 3미러 전부 504/25s 타임아웃(실측). Photon은 위치 편향이 약해 서울 질의에 우즈베키스탄 반환(실측). → 50/100km는 **Wikipedia geosearch 멀티-빔 스윕**(10km 원을 방위각별로 배치, 병렬, 빔 단위 fail-open)만이 신뢰 가능한 무키 소스다.
7. `newProducts` 슬롯: `card.tabs`(16 패밀리, `Rev29.newProducts.families.*`, 색상 보유) → `.qw-hub-tabs > .qw-hub-tab`(11.5px 알약, 자동 회전 없음). 탭 클릭은 `intentRef`를 무장해 요청을 허용(REV-24 M3). 회전 클록은 `decideRotationLoad`로 캐시 없을 때만 첫 채움을 지출한다.
8. `uRanking` 슬롯(REV-35 M1): 레지스트리 kind `'uRanking'`, 회전 index 12, 카드 본문 = `URankingsShorts compact`, 딥모달 `URankingDeepModal`(`#uranking-deep-title`), `OmniOpenHost 'uRankingDeep'`, `SLOT_FAMILY.uRanking='unitas'`, i18n `Rev35.uRanking.tag`. U-Square 허브의 유랭킹(`HubRankings`, `UaiHyperStream`, `lib/square/uRankings.ts`)은 **별개**이며 유지. E2E 의존: `rev19-back-stack`(U-Ranking 2단 스택), `rev25-crossplatform`(xl 모달 뷰포트 적합), `rev29-verify`(칩 16개·nth(12)=uRanking), `rev34-weather-square`(REV-35 M1 블록). 단위: `discoverySlots.test`(16/14/uRanking), `slotSections.test`, `omniFamilies.test:205`, `rev35Parity.test`.
9. 카드 컨테이너는 REV-23 M2.3 이후 inert(`role=button` 없음). E2E `rev23-verify` 'M2.3'·`rev29-verify`가 첫 카드/뉴스 카드에 `role=button` 부재를 단언 → 1-C는 `role` 대신 `data-one-target="1"` + onClick 으로 구현(접근성은 제목 네이티브 버튼이 담당).
10. i18n 파리티: `rev20Parity`는 `Rev20` 키 **개수 76 고정**(값 변경은 자유). 신규 키는 `Rev41` 네임스페이스 + 적용기 스크립트 + 파리티 테스트(rev35/36 패턴). `messages/*.json` 직접 편집 금지(적용기로만).
11. CI(루트 `quality-gates.yml`): doctrine:verify → typecheck → vitest → build → **Playwright chromium 전수**. 로컬 데몬은 6프로젝트 전수. 따라서 E2E 스펙 갱신은 게이트의 일부다.

## 2. 결정 사항 (제6장 제로 핸즈)

- **D-1 (1-B 구조)**: 신설 `components/home/hub/HubRow.tsx` — 한 행 = `<li class="qw-hub-row" data-hub-row>` › `{marker}` › `<span class="qw-hub-row-body">` › `<span class="qw-hub-row-line">` › `<span role="button" tabindex="0" class="qw-hub-headline">` + `<HubRowEnter size="row"/>` › 그 아래 `.qw-hub-desc` / `.qw-hub-source`. `.qw-hub-headline{display:inline; box-decoration-break:clone}`(여러 줄 텍스트를 감싸는 인라인 하이라이트), `.qw-hub-row-line .qw-row-enter{display:inline-flex; vertical-align:middle; margin-left:6px}` → 박스가 항상 마지막 글자 우측 6px에 붙는다. 헤드라인 `line-clamp` 제거(잘린 줄 뒤에 박스가 사라지는 문제 원천 차단; 설명·출처 줄의 clamp는 유지). 제목행: `.qw-hub-title-row{display:block}`, `.qw-hub-title-hit{display:inline-block; max-width:calc(100% - 40px); vertical-align:middle}`, `.qw-row-enter[data-row-enter=title]{display:inline-flex; vertical-align:middle; margin-left:8px}`. 모바일 44px 터치 헤일로 유지. 키보드: 행 텍스트 Enter/Space → onOpen.
- **D-2 (1-C)**: `DiscoverySlot.oneTarget?: true` — `weather · fx · crypto · quake · paper · library · air · nation · nearby`(항목 URL 라우팅이 없는 슬롯 전부). 카드 컨테이너에 `data-one-target="1"` + `onClick → openDeep(activeKey)`(스와이프 후 클릭 억제는 기존 `swipe.onClickCapture`). 내부 컨트롤(제목·⏎·행·탭 칩·반경 칩)은 `stopPropagation` 유지. CSS `.qw-hub-card[data-one-target='1']{cursor:pointer}` + 기존 `[role=button]` 호버 규칙을 동일 적용. `role` 부여 금지(§1-9).
- **D-3 (1-D 데이터)**: 신설 `lib/live/fxCompass.ts`(순수·vitest) + `fx` 어댑터 재작성. 단 **1회** Frankfurter v2 요청 `rates?base=USD&quotes=<majors+index basket+home>&from=<30일 전>`로 최신가·전일·30일 시계열을 모두 얻는다(v2는 quote×date 평면 행). 바스켓: `EUR JPY GBP CAD SEK CHF`(DXY 가중 57.6/13.6/11.9/9.1/4.2/3.6 → 30일 전=100 기하 지수 = "달러 강도 지수(근사)") + 보드 `EUR JPY GBP CNY` + `home`. CoinGecko `simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=usd,<home>&include_24hr_change=true` 1회(fail-open) → 크립토 패리티(BTC·ETH 홈통화 환산) + 금 프록시(PAXG). `card.widget = FxCompassWidget`, `items` = 보드 통화쌍 + 패리티 행(URL 없음 → 딥모달), facts = `Rev41.fx.facts.home`(홈 통화, emphasis 없음)·`Rev41.fx.facts.pairs`(통화쌍 수). **emphasis fact 삭제** — 거대 타이포는 위젯이 담당. 히어로 쌍: `home = COUNTRY_CURRENCY[ctx.country]`; home이 USD이거나 ECB 미공표면 로케일 통화(`COUNTRY_CURRENCY[localeCountry(locale)]`), 그것도 USD면 EUR. 홈 통화는 `SLOT_SCOPES.fx` 유지(country 섹션은 items로 표기).
- **D-4 (Geo-IP)**: 신설 `lib/live/geoIp.ts` — `readGeoIpFix()`(localStorage `unitas.geo.ip.v1` `{country, lat, lon, city, at}`, TTL 24h, SSR null) / `refreshGeoIpFix(signal)`(GeoJS `geo.json` → `ipwho.is` 폴백, 4s 타임아웃, 실패 null) / `useGeoIpFix()`(캐시 초기값 + 세션당 1회 갱신). `resolveCountry` 입력에 `ipCountry` 추가: 순서 **profile → 날씨 캐시 장소 → Geo-IP → 로케일**. `useSlotContext`가 훅으로 주입. `discoverySlots.knownPlace(ctx)`: 날씨 캐시 장소 없으면 Geo-IP 좌표(도시명)로 → `nearby/air/nation` 모두 실제 접속 위치 기준.
- **D-5 (1-G 데이터)**: 신설 `lib/live/omniRadar.ts`(순수·vitest): `NEARBY_RADII = [{key:'r10',km:10},{key:'r50',km:50},{key:'r100',km:100},{key:'global',km:null}]`, `radarBeams(radiusKm)` — 10: 중심 1빔(limit 50); 50: 중심 + 32km 6빔(0°/60°…, limit 25); 100: 중심 + 40km 6빔 + 80km 6빔(30° 오프셋) = 13빔; `offsetPoint(lat,lon,bearing,km)`, `bearingDeg`, `distanceKm`(geoMatch 재사용), `classifyLens(title, description)`(다국어 키워드 → `nomad|factory|inspiration|signal`), `buildRadar(center, radiusKm, rawHits)` — 하버사인 실측 거리로 **`≤ radiusKm` 필터·정렬·중복 제거**(0% 오차의 정의), `formatDistance(km, locale)`(<1km → m, 그 외 소수 1자리 km), `NOMAD_NEXUS_HUBS`(Tallinn·Lisbon·Canggu·Chiang Mai·Medellín·Mexico City·Buenos Aires·Cape Town·Dubai·Singapore·Tokyo·Seoul·Taipei·Bangkok·Tbilisi·Austin — 실좌표 16허브, Global 티어 전용, 네트워크 0). `nearby` 어댑터: `cursor.tab`으로 반경 선택, Wikipedia `generator=geosearch&prop=description|coordinates`(locale wiki) 빔 병렬 `Promise.allSettled`, 빔 단위 fail-open, 전 빔 실패 시 `EMPTY_CARD`(unreadable은 위젯이 `blips.length===0 && failedBeams===beams`로 판정), `card.widget = OmniRadarWidget`, items = 근접순(카드 6·deep 24, meta = 실측 거리), facts = 탐지 반경·탐지 스팟(필터 후 실제 수)·최근접 실측. `tabs` = 4 반경(`Rev41.nearby.radius.*`, 색상 4종), `activeTab` 기본 `r10`. `tabAutoplay` 없음.
- **D-6 (1-E)**: `Rev20.slots.newProducts.tag` 20로케일 교체(ko "미래를 앞당기는 초혁신적 하드웨어와 퀀텀 디바이스의 다차원 넥서스"). `DiscoverySlot.tabAutoplay?: true`(newProducts만). 신설 `components/home/hub/SlotTabRail.tsx` — 메인 칩 레일과 **동일 마크업**(`.qw-hub-strip` › `.qw-hub-chip[data-active]` + 활성 칩의 `.qw-hub-progress[data-held][data-paused]`, `--qw-hub-accent: tab.color`, `--qw-slot-rotate`), 드래그 스크롤·터치 일시정지·활성 칩 중앙 정렬 동일. `autoplay` 시 `DISCOVERY_ROTATE_MS` 주기로 다음 탭(색상 변환은 칩 accent가 탭 색으로 바뀌며 자연 발생), 클릭 = 고정/해제 토글(메인 `toggleHold`와 동일 의미). 일시정지 조건 = 부모 카드가 활성 슬롯이 아님 · 부모 회전이 멈춤 · 탭 고정. **자동 전진은 클록**(`intentRef` 비무장) → 캐시 없으면 첫 채움 1회, 있으면 메모리(REV-24 M3 계약 유지). 딥모달의 탭도 같은 칩 디자인이되 autoplay 없음. `.qw-hub-tab` 규칙은 삭제(칩으로 통일).
- **D-7 (1-F)**: 레지스트리에서 `uRankingSlot` 삭제 — `SlotKind = 'weather' | 'feed'`, `URankingSlotKey`·`SlotItemAction`·`SlotItem.action` 삭제, `DISCOVERY_ROTATION` 16→15(index 12는 `air`), `SLOT_SOURCES/SLOT_PROVIDER`에서 제거, `slotTtlMs` uRanking 분기 삭제, `slotSections.GLOBAL_ONLY`에서 제거, `sourceRegistry.SLOT_FAMILY.uRanking` 삭제(`'unitas'` 패밀리 자체는 유지), `OmniOpenHost 'uRankingDeep'` 삭제. 캐러셀에서 `URankingDeepModal`·`URankingsShorts compact`·`isURankingKey`·`U_RANKINGS_COUNT`·`U_RANKING_META_SOURCE` 삭제. i18n `Rev35` 네임스페이스 삭제(적용기 DELETE) + `rev35Parity.test.ts`·`apply-rev35-i18n.mjs` 삭제, 퇴역 네임스페이스 가드(`GlobalRankings`,`UnitasRankings`,`Rev35`)는 `rev41Parity`로 이관. E2E: `_rev41Retired.js` 제로 스윕 목록 `[data-slot="uRanking"] [data-slot-card="uRanking"] [data-slot-kind="uRanking"] #uranking-deep-title [data-slot-modal="uRanking"]`.
- **D-8 (위젯 렌더)**: `SlotCard.widget?: SlotWidget`. 신설 `components/home/widgets/SlotWidgetView.tsx`(kind 분기) · `FxCompassHero.tsx` · `OmniRadar.tsx`. 카드에는 `variant="card"`(히어로·레이더 압축, 행 6), 딥모달 `FeedDeepModal`에는 `variant="deep"`(전폭). 레이더: 순수 SVG(고리 3·방위 십자·스윕 빔은 `transform: rotate` CSS 애니메이션만, `backdrop-filter`·blur 금지, `prefers-reduced-motion`에서 정지), 블립 = `[data-radar-blip data-lens data-dist-km]` 위치 = 방위각·(거리/반경) (Global은 sqrt 스케일, 외곽 20,000km), 렌즈 범례 4색(nomad 금 `#d4af37`, factory 청 `#0b5cff`, inspiration 자 `#7b2d8e`, signal 회 `#6b7a8f`), 상태 4종 정직 표기(loading · data · empty · unreadable). 히어로: `[data-fx-hero]` 환율 숫자 `font-size: clamp(40px, 9vw, 72px)` tabular-nums, 쌍 라벨·전일/30일 변동(부호·색)·30일 스파크라인 SVG(`[data-fx-spark]`), 보드 4쌍(각 미니 스파크라인)·달러 강도 지수·패리티 3행. 다크 베이스 + `html[data-unitas-surface='quantum-white']` 재키. 렌더 중 `Date.now()`·`Math.random()` 금지.
- **D-9 (i18n)**: `scripts/apply-rev41-i18n.mjs`(SET 20로케일 실번역, DELETE `Rev35`) + `__tests__/i18n/rev41Parity.test.ts`. 키 정본(§4). `Rev20.slots.nearby.tag` 교체(ko "당신을 중심으로 회전하는 소버린 옴니-레이더").
- **D-10 (E2E)**: 갱신 — `rev29-verify`(뉴스 블록 직속 omni-open 0 · 축 팝업 내 1 / 칩 15 · nth(12)=air), `rev19-back-stack`(U-Ranking 스택 테스트 → `newProducts` 제목 → `#feed-deep-title` 1단 + 퇴역 스윕), `rev25-crossplatform`(xl 모달 = `newProducts` 딥모달), `rev34-weather-square`(REV-35 M1 블록 → 퇴역 단언). 신설 `rev41-uai-popup.spec.js`: 1-A·1-B(⏎ 좌변이 제목 텍스트 마지막 줄 우변에서 4~12px, 같은 줄) ·1-C(fx 카드 여백 클릭 → dialog 1 / history 여백 → 0)·1-D(`[data-fx-hero]` 폰트 ≥ 40px, 메타 `0건` 아님)·1-E(서브 탭이 `.qw-hub-chip`, 활성 칩 `.qw-hub-progress`, 클릭 → `data-held=1`)·1-F(`[data-slot]` 15, 퇴역 스윕)·1-G(`[data-radius]` 4, `[data-omni-radar]`, 모든 `[data-radar-blip]` `data-dist-km ≤ data-radius-km`). 통합 단계에서 Chromium 단일 엔진으로 변경 스펙만 실행(제15장 2단계).
- **D-11 (실행 금지 — 레인 에이전트)**: `npm run build` 금지(통합 1회), `git commit/push` 금지, `messages/*.json` 직접 편집 금지(적용기로만), 전체 E2E 금지, 소유 레인 밖 파일 수정 금지(필요하면 보고서에 요청).

### 2-A. 통합 단계 교정 (3렌즈 적대 리뷰 8건 → 전부 수정, 2026-09-17)

| # | 리뷰 지적 | 교정 |
|---|---|---|
| R-1 (블로커) | `__tests__/uai/anchorDictionaries.test.ts:40`이 삭제된 `SlotKey`로 `SLOT_QID`를 색인 → tsc EXIT 1 (어느 레인도 소유하지 않은 파일) | `Object.keys(SLOT_QID)` 문자열 가드로 교체. 교훈: 심볼을 삭제하는 레인은 소비자를 grep으로 전수 배정해야 한다(관찰 #8 기록). |
| R-2 (메이저) | 캐시 미스 탭 픽 시 `card.tabs`가 null이 되어 `SlotTabRail`이 fetch 동안 언마운트 | `DiscoverySlot.tabs?: readonly SlotTab[]`(정적 탭 집합: `PRODUCT_TABS`·`NEARBY_TABS`)을 슬롯에 선언, 캐러셀·딥모달은 `slot.tabs ?? card.tabs`를 렌더. |
| R-3 (메이저) | 패밀리 자동 회전이 관측 불가: `paused={rotationPaused}`가 `held`를 포함해 고정 즉시 정지, 미고정 시 메인과 같은 7s라 먼저 떠남 | D-6 개정: 탭 클록의 정지 조건에서 `held` 제외(`tabPaused = deep·hover·drag·touch·hidden`) — 고정한 카드에서 패밀리가 7s마다 회전. 로더는 `tabClockRef`로 자동 전진을 클록으로 읽어 REV-24 M3(고정 카드의 stale 패밀리 refresh 금지) 유지. |
| R-4 (메이저) | ⏎ 꼬리가 마지막 줄이 꽉 차면 혼자 다음 줄로 떨어짐(inline-flex 앞 줄바꿈 기회) | `HubRow`: 텍스트와 ⏎ 사이에 U+00A0 글루(UAX#14 LB12 no-break) 1개 → 마지막 글자(들)가 박스와 함께 내려간다. CSS margin 6→2px(글루 ≈0.25em과 합쳐 ≈6px). |
| R-5 (메이저) | 서브 칩이 메인 칩보다 한 단계 작음(7px 12px/12.5px) — 1-E "100% 동일" 위반 | §29 `.qw-hub-chip[data-tab]` 메트릭을 메인과 동일(9px 14px/14px/gap 8px)로, 백색 재키 크기 오버라이드 삭제. |
| R-6 (마이너) | `Rev41.nearby.radiusAria`·`Rev41.fx.source` 미소비(20로케일 죽은 문자열), 메타 라인이 뉴스 레일 문구 사용 | 내 주변 레일 aria = `Rev41.nearby.radiusAria`; 메타 라인 source = fx는 `Rev41.fx.source`, 그 외 슬롯은 `SLOT_PROVIDER[key].name`(실제 공급자; ch.16 정직성). |
| R-7 (마이너) | 클록 전진 첫 프레임에 이전 슬롯의 카드가 남아 fx/nearby가 'unreadable' 섬광 | 카드 상태에 `cardKey` 동반 저장, 렌더 시 `cardKey === activeCacheKey`면 상태 카드, 아니면 모듈 캐시 동기 조회(없으면 loading). |
| R-8 (마이너) | 서브 탭 터치가 메인 회전을 멈추지 않음(레일이 pointerdown 전파 중단) / nearby 딥모달 앵커가 Geo-IP 중심 무시 | 카드 컨테이너 `onPointerDownCapture`로 터치 일시정지; `useFeedAnchor('nearby')`가 어댑터와 같은 `knownPlace(ctx)` 사용. |
| R-9 (실측 발견) | Chromium E2E 실측: 하네스 IP(미국 조지아) + ko 로케일에서 레이더 블립이 r10=1·r50=3 — ko.wikipedia의 해당 지역 지오태그가 희소 | D-5 개정 "희소 지역 보강": 로케일 스윕이 `RADAR_SPARSE_FLOOR`(8) 미만이고 로컬 빔이 1개 이상 응답했으며 로케일이 en이 아니면, 같은 빔 집합을 en.wikipedia에 1회 더 스윕해 `mergeRadarLegs`(50m 위치 중복 제거, 로케일 히트 우선)로 합친다. 밀집 도시·en 독자·네트워크 단절 시엔 추가 요청 0. 빔 수 fact는 두 스윕의 합으로 정직 표기. |

## 3. 공유 타입 계약 (`lib/live/discoverySlots.ts`, 레인 A 소유 · 레인 B/C는 이 시그니처에 맞춰 작성)

```ts
export type SlotKind = 'weather' | 'feed';
export type SlotKey = 'weather' | FeedSlotKey;              // FeedSlotKey에서 변화 없음(14종)
export interface SlotItem { id; title; domain?; url?; meta?; description?; image?; rank?; color?; scope? }  // action 삭제
export type RadarLens = 'nomad' | 'factory' | 'inspiration' | 'signal';
export interface RadarBlip { id: string; title: string; url?: string; distKm: number; bearing: number; lens: RadarLens }
export type NearbyRadiusKey = 'r10' | 'r50' | 'r100' | 'global';
export interface OmniRadarWidget {
  kind: 'omniRadar'; radiusKey: NearbyRadiusKey; radiusKm: number | null;
  center: { lat: number; lon: number; name: string }; blips: RadarBlip[];
  beams: number; failedBeams: number;
}
export interface FxSeriesPoint { date: string; rate: number }
export interface FxPairQuote { code: string; rate: number; change24h: number | null; change30d: number | null; series: FxSeriesPoint[] }
export interface FxParityRow { id: string; symbol: string; name: string; usd: number; home: number | null; change24h: number | null }
export interface FxCompassWidget {
  kind: 'fxCompass'; base: string; home: string; date: string;
  hero: FxPairQuote; majors: FxPairQuote[];
  dollarIndex: { value: number; series: FxSeriesPoint[] } | null;
  parity: FxParityRow[];
}
export type SlotWidget = OmniRadarWidget | FxCompassWidget;
export interface SlotCard { …기존…; widget?: SlotWidget }
export interface DiscoverySlot { …기존…; oneTarget?: true; tabAutoplay?: true }
export const SLOT_ONE_TARGET: readonly SlotKey[];
```

`lib/live/omniRadar.ts` 내보내기: `NEARBY_RADII`, `radiusByKey`, `radarBeams`, `offsetPoint`, `bearingDeg`, `classifyLens`, `buildRadar`, `formatDistance`, `NOMAD_NEXUS_HUBS`, `globalRadar`.
`lib/live/fxCompass.ts` 내보내기: `FX_MAJORS`, `DXY_BASKET`, `pickHomeCurrency`, `parseFrankfurterWindow`, `pairQuoteFrom`, `dollarIndexFrom`, `parityRowsFrom`, `coinGeckoPriceUrl`, `frankfurterWindowUrl`.
`lib/live/geoIp.ts` 내보내기: `GEO_IP_STORAGE_KEY`, `GEO_IP_TTL_MS`, `readGeoIpFix`, `writeGeoIpFix`, `refreshGeoIpFix`, `useGeoIpFix`(별도 `useGeoIp.ts`, 'use client').

`components/home/hub/HubRow.tsx`(레인 B1) 계약:
```tsx
export interface HubRowProps extends Omit<LiHTMLAttributes<HTMLLIElement>, 'title' | 'onClick'> {
  onOpen: () => void;          // 텍스트와 ⏎ 둘 다 호출
  title: string;
  marker?: ReactNode;          // HubDot / 랭크 박스 / 썸네일
  description?: string;
  source?: string;
  titleAriaLabel?: string;     // 뉴스 행만(detailAria)
  onHover?: () => void;
}
export function HubRow(props: HubRowProps): JSX.Element   // <li className="qw-hub-row" data-hub-row ...rest>
```
`components/home/hub/SlotTabRail.tsx`(레인 B1) 계약:
```tsx
export interface SlotTabRailProps {
  tabs: readonly SlotTab[]; activeKey: string | undefined;
  onPick: (key: string, source: 'intent' | 'clock') => void;   // intent = 클릭, clock = 자동 전진
  autoplay?: boolean; paused?: boolean;                          // paused = 부모 카드 비활성/정지
  held?: boolean; onToggleHold?: (key: string) => void;          // 고정 상태는 부모 소유
  ariaLabel: string; rotateMs?: number; className?: string; 'data-testid'?: string;
}
```
칩 DOM: `<div class="qw-hub-strip qw-hub-tabs" role="tablist" data-tab-rail data-autoplay="1|0">` › `<button role="tab" class="qw-hub-chip" data-tab=key data-active data-radius?=key>` › 활성 시 `<span class="qw-hub-progress" data-held data-paused>`.

## 4. i18n 키 정본 (`Rev41`, 20로케일 · 적용기 SET)

| 키 | ko | 비고 |
|---|---|---|
| `Rev20.slots.newProducts.tag` | 미래를 앞당기는 초혁신적 하드웨어와 퀀텀 디바이스의 다차원 넥서스 | 값 교체 |
| `Rev20.slots.nearby.tag` | 당신을 중심으로 회전하는 소버린 옴니-레이더 | 값 교체 |
| `Rev41.fx.homeLabel` | 접속 통화 | 히어로 위 라벨 |
| `Rev41.fx.perUnit` | 1 {base} = {value} {quote} | ICU 3 |
| `Rev41.fx.change24h` | 전일 대비 | |
| `Rev41.fx.change30d` | 30일 대비 | |
| `Rev41.fx.sparkAria` | {quote} 30일 추이 | ICU 1 |
| `Rev41.fx.majors` | 글로벌 매크로 보드 | |
| `Rev41.fx.parity` | 크립토 패리티 | |
| `Rev41.fx.dollarIndex` | 달러 강도 지수 | |
| `Rev41.fx.dollarIndexNote` | ECB 기준환율 6통화 DXY 가중 근사 · 30일 전 = 100 | |
| `Rev41.fx.gold` | 금 (PAXG) | |
| `Rev41.fx.unreadable` | 환율 신호를 읽을 수 없습니다 · 잠시 후 다시 시도해 주세요 | |
| `Rev41.fx.facts.home` | 홈 통화 | |
| `Rev41.fx.facts.pairs` | 통화쌍 | |
| `Rev41.fx.source` | Frankfurter (ECB) · CoinGecko · GeoJS | 고유명사(IDENTICAL 허용) |
| `Rev41.nearby.radius.r10` | 10km | IDENTICAL 허용 |
| `Rev41.nearby.radius.r50` | 50km | IDENTICAL 허용 |
| `Rev41.nearby.radius.r100` | 100km | IDENTICAL 허용 |
| `Rev41.nearby.radius.global` | 글로벌 | |
| `Rev41.nearby.radiusAria` | 탐지 반경 | |
| `Rev41.nearby.facts.radius` | 탐지 반경 | |
| `Rev41.nearby.facts.detected` | 탐지 스팟 | |
| `Rev41.nearby.facts.nearest` | 최근접 | |
| `Rev41.nearby.facts.beams` | 스윕 빔 | |
| `Rev41.nearby.lens.nomad` | 노마드 밋업 스팟 | |
| `Rev41.nearby.lens.factory` | AI 팩토리 워크스페이스 | |
| `Rev41.nearby.lens.inspiration` | 영감 히든 스팟 | |
| `Rev41.nearby.lens.signal` | 시그널 | |
| `Rev41.nearby.radarAria` | {center} 중심 옴니-레이더 · 반경 {radius} | ICU 2 |
| `Rev41.nearby.center` | 중심 | |
| `Rev41.nearby.constellation` | UNITAS 노마드 넥서스 16허브 | |
| `Rev41.nearby.constellationNote` | 전 세계 소버린 디지털 노마드 허브 16곳 · 당신으로부터의 실측 거리 | |
| `Rev41.nearby.empty` | 이 반경에서 탐지된 스팟이 없습니다 | |
| `Rev41.nearby.unreadable` | 레이더 신호를 읽을 수 없습니다 · 잠시 후 다시 시도해 주세요 | |
| `Rev41.nearby.exact` | 실측 거리 · 반경 오차 0% | |
| `Rev41.tabs.rotating` | 서브 테마 자동 회전 · 누르면 고정됩니다 | title/sr-only |
| `Rev41.tabs.held` | 고정됨 · 다시 누르면 회전합니다 | |

퇴역: `Rev35`(전체 네임스페이스 DELETE).

## 5. 파일 소유권 레인

| 레인 | 소유 파일 |
|---|---|
| A 데이터 | `lib/live/discoverySlots.ts` · `lib/live/slotSections.ts` · `lib/live/slotContext.ts` · `lib/live/useSlotContext.ts` · `lib/live/contextPriority.ts` · `lib/uai/sourceRegistry.ts`(SLOT_FAMILY만) · `components/home/OmniOpen.tsx`(host 타입만) · 신설 `lib/live/fxCompass.ts` `lib/live/omniRadar.ts` `lib/live/geoIp.ts` `lib/live/useGeoIp.ts` · `__tests__/live/*`(discoverySlots·slotSections·rotationBudget 주석·신규 3) · `__tests__/uai/omniFamilies.test.ts` |
| B1 프리미티브 | 신설 `components/home/hub/HubRow.tsx` `components/home/hub/SlotTabRail.tsx` · `components/home/hub/HubTitleRow.tsx` · `app/quantum-white-rev19.css`(§27 재작성 + 신설 §29 위젯/탭칩) |
| B2 캐러셀 | `components/home/DiscoveryCarousel.tsx` · 신설 `components/home/widgets/SlotWidgetView.tsx` `FxCompassHero.tsx` `OmniRadar.tsx` · `app/quantum-white-rev19.css` §29 위젯 세부(B1 이후) |
| C 뉴스 | `components/home/HotIssueNewsList.tsx` |
| D i18n | 신설 `scripts/apply-rev41-i18n.mjs` · `__tests__/i18n/rev41Parity.test.ts` · 삭제 `__tests__/i18n/rev35Parity.test.ts` `scripts/apply-rev35-i18n.mjs` · `messages/*.json`(적용기 실행 결과만) |
| E E2E | `tests/web-cinema-e2e/_rev41Retired.js` 신설 · `rev41-uai-popup.spec.js` 신설 · `rev19-back-stack.spec.js` `rev25-crossplatform.spec.js` `rev29-verify.spec.js` `rev34-weather-square.spec.js` 갱신 |
| 통합(본 세션) | typecheck · vitest · build · Chromium 변경 스펙 · 커밋 · 푸시 · Vercel · `FINAL_REPORT.md` · 기억 각인 |
