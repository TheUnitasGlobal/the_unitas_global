# REV-42 — 실시간 숏컷 3대 체제 재창조: 시공간·기상 / 거시 우주 텔레메트리 / 글로벌 미식 (창립자 지령 2026-09-18)

정본 위치: `index.html/docs/rev42/SPEC.md` · 기준: Codex v51.0 Absolute Infinite Paradigm Edition 제1장~제17장 + 1000대 초헌법(초신비적 8 · 초설계적 9 · 초실용적 13)
선행: REV-20(디스커버리 캐러셀) · REV-21(스코프 섹션·옴니-오픈) · REV-34(날씨 딥 팝업) · REV-41(원타깃 카드·위젯 렌더·서브 칩 레일)

## 0. 지령

| 미션 | 요지 |
|---|---|
| 0 | 기존 `air`("공기") 숏컷 **완전 삭제**. 실시간 숏컷 레일은 3대 플래그십(시공간·기상 → 거시 우주 → 미식)이 선두에 서는 체제로 재창조. |
| 1 | 숏컷 1 [시공간·기상] — 1단계(위젯) 양력/음력 병기 + 월령 픽셀 렌더링 · 2단계(팝업) 날씨에 자외선(UV)·대기질(AQI)·오존·미세먼지 등 공기 데이터 완전 융합 · 3단계(세부 뷰) 항성시·24절기·황도 12궁 기준 태양/달 정밀 위치(도수). |
| 2 | 숏컷 2 [거시 우주 텔레메트리] — 1·2단계 은하/심우주 관측 데이터 · 3단계 = 숏컷 1의 3단계를 **완전 동일하게 미러링** + 시간의 궤적(과거의 빛) · 별의 유산(원소 계보) · 중력 상대성 · 초은하단 거시 척도 텍스트 합성. |
| 3 | 숏컷 3 [글로벌 미식·식문화] 신설 — 동일 팝업 트리. 1단계 실시간 유행 음식 추천 · 2단계 국가별 전통 음식 기원·글로벌 식문화 트렌드·숨겨진 로컬 맛집 · 3단계 식재료의 태양계적 기원(광합성 에너지 역학)·미각 화학 분자 알고리즘·디지털 노마드 업무 효율 페어링. |
| 4 | API 종속성 배제 + 초지능 캐싱으로 렌더 지연 0 수렴 · `npm --prefix web run typecheck`·`build` EXIT 0 · 프로덕션 배포·Git 동기화 자율 완결. |

## 1. 정찰이 확정한 전제 (2026-09-18 실측)

1. "실시간 숏컷"(`OmniSynapse.shortcutsStripLabel`) = `HotShortcutMatrixStrip` → `DiscoveryCarousel`(`lib/live/discoverySlots.ts` 15슬롯 회전: weather + 14 feed). `air` 슬롯은 `airSlot`(Open-Meteo air-quality `current=pm10,pm2_5,european_aqi`, `oneTarget`, index 12)이며 i18n은 `Rev20.slots.air.{title,tag}` + `Rev20.slots.facts.{aqi.*,aqiValue,pm25,pm10}`. 후자 4종은 **REV-34 날씨 딥 패널(`WeatherDeepPanel`)의 AQI 행이 함께 읽는다** → 삭제 금지, `air.{title,tag}`만 삭제.
2. 팝업 트리는 현재 **2단**이다: 1단 = 회전 카드(`[data-slot-card]`, 원타깃 컨테이너 onClick 또는 `HubTitleRow`) → 2단 = 딥 모달(`SlotDeepModal` → kind별 `WeatherDeepModal`(`[data-slot-modal="weather"][data-weather-modal]`, `#slot-weather-title`) / `FeedDeepModal`(`[data-feed-modal=<key>]`, `#feed-deep-title`)). **3단(세부 뷰)은 존재하지 않는다** → 신설.
3. 모달은 `components/ui/Modal`(body 포털, `useHistoryLayer` 1층 push, ESC는 최상층만, 백드롭 클릭 close). 중첩 다이얼로그는 REV-19 백스택이 지원(legal notice over tower over hub) → 3단은 딥 모달 내부에서 여는 **중첩 `Modal size="xl"`** 로 구현하면 뒤로가기/ESC가 한 층씩 내려온다.
4. 위젯 렌더 경로(REV-41 D-8): `SlotCard.widget`(typed union) → `SlotWidgetView`(`slotWidgetKind(key)` 분기, `variant card|deep`). 캐러셀은 `widgetKind`가 있으면 카드 상단에 무조건 마운트(카드 미도착 시 위젯 자체 로딩 셸). `FeedDeepModal`도 동일. `WeatherDeepModal`은 위젯 경로를 쓰지 않으므로 날씨 딥에는 명시 마운트.
5. 날씨 스택: 얕은 `Forecast`(`unitas.weather.v1`, 10분) ≠ 딥 `DeepForecast`(`unitas.weather.deep.v1`, `wd-v1`, 10분, `lib/live/weatherDeep.ts` `fetchDeepForecast` = forecast + air-quality `allSettled`). 딥 AQI는 `DeepAir {eu, pm25, pm10}`. 형태를 바꾸면 **버전 범프**(`wd-v2`)로 구 캐시가 자연 무효화된다.
6. 캐시 키: 카드 `slotCacheKey(locale:country:slot[:tab])`(모듈 Map, TTL weather 10분 / feed 15분), 딥 `…:deep[:tab]`. 회전 클록은 요청을 쓰지 않는다(REV-24 M3 `decideRotationLoad`).
7. 레지스트리 락스텝(키 집합이 바뀌면 tsc가 전부 잡는다): `FeedSlotKey` · `SLOT_ONE_TARGET` · `DISCOVERY_ROTATION` · `SLOT_SOURCES`(→`SLOT_PROVIDER` 파생) · `SLOT_QID` · `slotSections.GLOBAL_ONLY/COUNTRY_ONLY` · `sourceRegistry.SLOT_FAMILY` · `SlotWidgetView.SLOT_WIDGET_KIND` · 테스트 `discoverySlots.test`(15/14/원타깃 일치) · `slotSections.test` · `omniFamilies.test` · `entityResolve.test` · `contextPriority.test` · `rev20Parity`(**Rev20 키 개수 76 고정 + 'air' 열거**).
8. E2E 좌석 단언: `rev29-verify`(칩 15 · nth(1)=newProducts · nth(12)=air) · `rev41-uai-popup` 1-F(칩 15 · nth(12)=air) · `rev34-weather-square` D-7 블록(칩 15). 퇴역 셀렉터 규약 = `_rev41Retired.js`(제로 스윕 목록 + `expectRetired…Gone`).
9. 소스 스캔 게이트: `__tests__/square/failOpenRegression.test.ts`가 `app/components/lib` 전수를 걷고(허브 파일 `Math.random(` 금지), `pulse.test`가 `lib/square`에서 `Date.now(` 금지. 캐러셀 계열은 `load()`/상태 초기화에서의 `Date.now()`만 허용(렌더 중 금지 — REV-36/40 독트린). **숫자 날조 금지**(REV-40 4상태 진실 계약): 트렌드 지수 같은 가짜 수치는 만들지 않는다.
10. i18n: 20로케일(`routing.locales`), `messages/*.json`은 **CRLF**. 직접 편집 금지 — 적용기(`apply-rev41` 패턴: SET 딥머지·DELETE·ICU 검증·`--check`·CRLF 보존)로만. 파리티 테스트는 키 집합 정확 일치 + ICU 토큰 + 빈 문자열 0 + `[MISSING` 0 + **en 동일 8% 상한**.
11. 이 저장소에 "은하/심우주 관측 데이터"를 정의한 선행 지시·코드·문서는 **없다**(docs·memory·claude-mem 전수 검색 0건). 따라서 숏컷 2의 1·2단계는 본 SPEC이 최초 정의한다(§2 D-6).

## 2. 결정 사항 (제6장 제로 핸즈 · 자율 판단)

- **D-1 (좌석 체제)**: `FeedSlotKey`에서 `air` 삭제, `cosmos`·`gastronomy` 추가. `DISCOVERY_ROTATION` = `['weather','cosmos','gastronomy','newProducts','mostRead','awards','history','crypto','quake','paper','fx','art','devPulse','nation','library','nearby']` (**16석**, 3대 플래그십이 0·1·2번, REV-29의 신상품은 그 직후 3번). 다른 12슬롯은 보존(지령이 삭제를 명한 것은 `air`뿐). `SLOT_ONE_TARGET`: `air` 제거, `cosmos`·`gastronomy` 추가. `SLOT_SOURCES.cosmos=['wikipedia']`, `gastronomy=['wikipedia']`(아웃바운드 전용 — 카탈로그는 번들 내장). `SLOT_QID.cosmos='Q1'`(우주), `gastronomy='Q2095'`(음식). `SLOT_FAMILY.cosmos='science'`, `gastronomy='default'`. `slotSections`: `cosmos` GLOBAL_ONLY, `gastronomy` BOTH(global=트렌드, country=전통·로컬), `air` 삭제. 퇴역 셀렉터 `tests/web-cinema-e2e/_rev42Retired.js` = `[data-slot="air"] [data-slot-card="air"] [data-feed-modal="air"]`.
- **D-2 (천구 엔진, API 0)**: 신설 `lib/live/celestial.ts`(순수·vitest·`Date.now` 0 — 모든 함수가 `nowMs`를 인자로 받는다). Meeus 기반: `julianDay` · `gmstHours`/`lmstHours(ms, lonDeg)` · `sunPosition(ms)`{lon(시황경 apparent), ra, dec, distAu} · `moonPosition(ms)`{lon, lat, distKm, ra, dec}(주요 항 절단 급수, ±0.3°) · `moonPhase(ms)`{phaseAngle, illumination, ageDays, waxing, phaseKey(8)} · `altAz(ra, dec, ms, lat, lon)` · `zodiacOf(lon)`{key(12), deg, min} · `solarTermOf(ms)`{key(24), index, lon, startMs, nextKey, nextStartMs}(15° 배수에 대한 뉴턴 반복 근찾기) · `newMoonNear(ms)`/`newMoonsBetween` · `lunarDate(ms, meridianHours)`{year, month, day, isLeapMonth, animalKey} — 동지(황경 270°)를 포함하는 삭망월 = 11월, 다음 동지까지 13삭망월이면 윤년, 윤달 = 동지 이후 첫 **중기(30° 배수) 없는 달**, 일자 = 기준 자오선 자정 기준. `lunarMeridianFor(locale)`: ko·ja→9, zh→8, vi→7, 그 외→8. 검증 벡터(§5).
- **D-3 (숏컷 1 · 1단계 위젯)**: `SlotWidget` 유니언에 `MoonPhaseWidget {kind:'moonPhase'; nowMs; gregorian:{y,m,d}; lunar:{year,month,day,leap,animalKey}; phaseKey; illumination; ageDays; waxing; phaseAngle; termKey; nextTermKey; nextTermMs; sunLon; moonLon}` 추가. 날씨 어댑터가 `load()` 시점에 계산해 **항상**(EMPTY_CARD 포함) 첨부(달은 네트워크가 없어도 뜬다). `SLOT_WIDGET_KIND.weather='moonPhase'`. 신설 `components/home/widgets/MoonPhasePixel.tsx`: **픽셀 그리드 월령 렌더** — 단일 SVG, 지름 24셀 원반 안의 정수 격자, 셀 중심 (x,y)가 명암 경계선(위상각 기반 타원 종단선) 어느 쪽인지로 lit/dark 분류 → `<path>` 2개(`shape-rendering: crispEdges`, 조명면 = `--qw-hub-accent`), `[data-moon-pixel][data-phase][data-age]`. 옆에 양력(`Intl.DateTimeFormat` full) / 음력(`Rev42.sky.lunarLine|lunarLeapLine` ICU) / `Rev42.sky.moonAge` / 위상명 / 현재 절기 칩(`[data-moon-term]`). `variant='card'` 가로 압축(≤ 96px 높이), `variant='deep'` 확대 + 3단 CTA.
- **D-4 (숏컷 1 · 2단계 대기 융합)**: `weatherDeep.ts` air-quality 요청 `current=european_aqi,us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,dust,aerosol_optical_depth,uv_index,uv_index_clear_sky`(같은 무키 엔드포인트 — 신규 API 0). `DeepAir` = `{eu, us, pm25, pm10, o3, no2, so2, co, dust, aod, uv, uvClear}`(각 `number|null`, `eu` 필수). `WEATHER_DEEP_VERSION='wd-v2'`. 순수 헬퍼 `pollutantBand(kind, value)`(EU AQI 오염원별 구간: PM2.5 10/20/25/50/75 · PM10 20/40/50/100/150 · NO2 40/90/120/230/340 · O3 50/100/130/240/380 · SO2 100/200/350/500/750) · `dominantPollutant(air)` · `airAdviceKey(band)`. `WeatherDeepPanel`의 AQI 행을 **대기 융합 블록**으로 재창조: 루트 `<section data-weather-air data-weather-aqi data-aqi-band=…>`(구 `data-weather-aqi`·`data-aqi-band` 계약 보존), 히어로 = 밴드 단어(28px) + EU AQI + US AQI, 타일 `[data-air-cell=pm25|pm10|o3|no2|so2|co|dust|aod|uv]`(값·단위·오염원별 밴드 `data-band`), 지배 오염원 콜아웃, 밴드별 호흡 권고 1줄(`Rev42.air.advice.*`), UV 지금/최대(기존 stats의 UV 타일은 유지). air 응답 실패 시 정직한 `data-air-state="unreadable"` 1줄(빈 값 날조 금지).
- **D-5 (3단 세부 뷰 셸)**: 신설 `components/home/detail/SlotDetailModal.tsx` — `Modal size="xl" labelledBy="slot-detail-title"`, 루트 `[data-slot-detail=<key>]`, 헤더 = 슬롯 아이콘 + `Rev42.detail.title.<key>` + 태그. 여는 버튼 `components/home/detail/DetailOpenButton.tsx`(`.qw-detail-open` 글래스 칩, `[data-detail-open=<key>]`, 라벨 `Rev42.detail.open.<key>`, 아이콘 `Orbit`) — `WeatherDeepModal`(달 위젯 아래)·`FeedDeepModal`(`cosmos`·`gastronomy`일 때 위젯/섹션 아래, `OmniOpen` 위)에 마운트. 각 딥 모달이 `detailOpen` 상태를 소유하고 `SlotDetailModal`을 중첩 렌더(포털이라 DOM은 형제, 히스토리는 한 층 위). 닫기(X·ESC·백드롭·뒤로)는 3단만 닫고 2단은 그대로. 슬롯별 본문: weather → `SkyDetail`, cosmos → `CosmosDetail`(= `SkyDetail` 미러 + 4절), gastronomy → `GastronomyDetail`.
- **D-6 (숏컷 2 · 거시 우주)**: 신설 `lib/live/cosmos.ts`(순수): `COSMOS_OBJECTS` 24기(key, designation, typeKey, constellationKey, raHours, decDeg, distanceLy, magnitude) — 은하(M31 안드로메다·M51 소용돌이·M104 솜브레로·M87·NGC 1300·Centaurus A)·성운(M42 오리온·M1 게·M57 고리·NGC 7293 나선·Carina·Eagle M16)·성단(M45 플레이아데스·M13·Omega Centauri·Hyades)·블랙홀(Sgr A*·M87*·Cygnus X-1)·펄서(PSR B0531+21 게 펄서)·퀘이사(3C 273)·항성(Betelgeuse·Proxima Centauri·Vega·Sirius) 등 (정확 좌표·거리는 레인이 표준 카탈로그 값으로 기입, 검증 테스트가 범위를 단언). `objectOfDay(dayIndex)`(awardOfDay 패턴). `cosmosTelemetry(place, nowMs)`: 각 천체 alt/az(celestial `altAz`) · 태양 고도로 낮/밤 판정 · 가시 상태(`visible|belowHorizon|daylight`) · 은하 중심(Sgr A*) alt/az · 지구 공전 속도 29.78 km/s와 **자정 이후 이동 거리**(km, `nowMs` 기준) · 태양계 은하 공전 ~230 km/s · CMB 쌍극자 ~370 km/s · 빛의 출발 연대(`nowYear - distanceLy` → 서기/기원전/n년 전 포맷). `cosmosSlot`(kind feed, `oneTarget`, GLOBAL_ONLY): 카드 facts = 오늘의 천체(emphasis)·유형·별자리·거리(광년)·빛의 출발·현재 고도/가시성·관측 지점, items = 카드 4/딥 24(고도 내림차순, meta "고도 xx° · 방위 NE · n 광년", URL 없음), `widget = CosmosScopeWidget {kind:'cosmosScope'; nowMs; observer; objects:[{key, alt, az, visible}](전체) ; sun:{alt,az}; moon:{alt,az}; galacticCenter:{alt,az}; featuredKey}`. 신설 `components/home/widgets/CosmosScope.tsx`: 순수 SVG **지평선 다이얼**(반원 고도 눈금 0/30/60/90° + 방위 N·E·S·W, 마커 = 오늘의 천체(accent)·태양·달·은하 중심, 지평선 아래는 점선 반영, `[data-cosmos-scope][data-featured][data-visible]`, blur 0, `prefers-reduced-motion` 준수). 3단 `components/home/detail/CosmosDetail.tsx` = `<SkyDetail place … />`(**동일 컴포넌트·동일 데이터**) + `[data-cosmos-section=trajectory|lineage|relativity|scale]` 4절: 시간의 궤적(오늘의 천체 빛의 출발 시점 + 지질·인류사 시대 밴드 `epochOf(years)` 10단), 별의 유산(인체 8원소 질량비 표 + 기원 5종: 빅뱅·항성 핵융합·초신성·중성자별 병합·우주선 파쇄), 중력 상대성(위도 기반 중력가속도 WGS84 정규식 · 위도 자전 속도 465.1·cosφ m/s · GPS 시계 +38.6 μs/일 · 지표 중력 시간 지연 7×10⁻¹⁰ · 달/태양 빛 도달 1.28 s / 8 m 19 s), 초은하단 거시 척도(11단 사다리: 당신→지구→태양-지구→태양권계면→오르트 구름→프록시마→은하수→국부 은하군→처녀자리 초은하단→라니아케아→관측 가능한 우주, 수치는 코드 상수).
- **D-7 (숏컷 3 · 미식)**: 신설 `lib/live/gastronomy.ts`(순수): `TRENDING_POOL` 24품(key, originCc, mealSlots[], flavorKey, ingredientKey) · `mealSlotOf(localHour)`(morning 5–10 / noon 10–14 / afternoon 14–17 / evening 17–21 / night 21–5) · `trendingPick(dayIndex, slot)`(슬롯 필터 후 일 시드 회전) · `FOOD_TRENDS` 10건 · `COUNTRY_DISHES` 30개국 × 2품(20로케일 국가 + GB·MX·BR·AR·GR·EG·MA·ET·PE·AU) · `dishesFor(country, locale)`(선택국 → 로케일국 → 글로벌 3품 일 시드) · `FOOD_SCIENCE` 8재료(rice·wheat·coffee·cacao·chili·tomato·olive·cabbageFerment: 광합성 경로 C3/C4·kcal/100 g·`sunAreaDays(kcal)`(1 kWh/m²/일 × 효율 1% 가정, 상수 명시)·핵심 분자·노마드 페어링) · `isFoodPlace(title, description)`(다국어 키워드) . `gastronomySlot`(kind feed, `oneTarget`, BOTH): 카드 facts = 지금의 추천(emphasis)·식사 시간대·기원국(`Intl.DisplayNames`)·풍미, items = 트렌드 3(URL 없음); 딥 global = 트렌드 10, country = 전통 음식(meta "전통 · {origin}") + **숨겨진 로컬 맛집** = Wikipedia geosearch 1빔(10 km, `knownPlace`, 기존 `geoSearchBeamUrl`/`parseGeoSearchPages` 재사용 — 신규 API 0) → `isFoodPlace` 필터 → 근접순 6(URL = 위키 문서, meta = 실측 거리 `formatDistance`), 24h 디바이스 캐시 `unitas.gastronomy.local.v1`(`readDeviceEntry`/`writeDeviceEntry` 재사용, ~11 m 셀 키). 빔 실패·0건이면 `Rev42.gastronomy.sections.localEatsFallback` 1줄로 정직 표기(날조 금지). 3단 `components/home/detail/GastronomyDetail.tsx`: 오늘의 추천 품목의 `ingredientKey`로 `[data-gastro-section=solar|chemistry|pairing]` 3절 렌더(태양계적 기원 — 광합성 에너지 역학 수치 라인 ICU, 미각 화학 분자, 노마드 페어링).
- **D-8 (i18n)**: 신설 루트 네임스페이스 `Rev42`(§4 키 정본) + `Rev20.slots.cosmos.{title,tag}`·`Rev20.slots.gastronomy.{title,tag}` 추가 + `Rev20.slots.air` **삭제**(rev20Parity 76 → **78**, 열거 목록 갱신). 드래프트 = `docs/rev42/i18n/<locale>.json`(20파일, 각 `{ "Rev20": {"slots": {"cosmos":…, "gastronomy":…}}, "Rev42": {…} }`). 적용기 `scripts/apply-rev42-i18n.mjs`: 드래프트 로드 → en 기준 키 집합·ICU 동일성 fail-closed 검증 → `Rev20.slots.air` DELETE → 딥머지 SET → CRLF 보존 기록, `--check`. 파리티 `__tests__/i18n/`: en 키 집합 구조 단언(`sky.terms` 24 · `sky.zodiac` 12 · `sky.phases` 8 · `sky.animals` 12 · `cosmos.objects` 24×{name,note} · `gastronomy.trending` 24 · `gastronomy.dishes` 30국×2 · `gastronomy.science` 8 …) + 총 키 수 정확 + 20로케일 동일 + ICU + 빈 값 0 + `[MISSING` 0 + 8% 동일 상한(IDENTICAL_ALLOWED = 단위·기호 전용 키) + `Rev20.slots.air` 부재. 번역은 로케일별 **원어민 품질 실번역**(영어 폴백 금지).
- **D-9 (CSS)**: `app/quantum-white-rev19.css` 말미 §30 REV-42 — `.qw-moon-*`(픽셀 원반 = SVG rect/path, `shape-rendering: crispEdges`), `.qw-air-*`, `.qw-sky-*`(항성시 `font-variant-numeric: tabular-nums`, 24절기 링·황도 링 SVG), `.qw-cosmos-*`, `.qw-gastro-*`, `.qw-detail-open`. 다크 베이스 + `html[data-unitas-surface='quantum-white']` 재키. `backdrop-filter`/blur 0, `transition`은 `--qw-ease`/`--qw-dur` 토큰, `prefers-reduced-motion` 정지, 767px 이하 44px 타깃, 360px 가로 오버플로 0.
- **D-10 (테스트)**: 신설 `__tests__/live/{celestial,cosmos,gastronomy}.test.ts`, 갱신 `weatherDeep.test.ts`(air 파서·밴드), `discoverySlots.test.ts`(16/15·원타깃 일치·cosmos/gastronomy 카드 형태·weather 위젯 상시 첨부), `slotSections.test.ts`, `omniFamilies.test.ts`, `entityResolve.test.ts`, `contextPriority.test.ts`, `rev20Parity.test.ts`(78). 소스 스캔: 신규 파일 `Math.random(` 0, `lib/live/celestial.ts`·`cosmos.ts`·`gastronomy.ts` `Date.now(` 0(테스트가 단언).
- **D-11 (E2E)**: 갱신 `rev29-verify`(칩 16 · nth(1)=cosmos · nth(2)=gastronomy · nth(3)=newProducts · air 0), `rev41-uai-popup` 1-F(칩 16 · nth(12) 단언 → air 퇴역 스윕), `rev34-weather-square` D-7 블록(칩 16). 신설 `rev42-shortcuts.spec.js`: (a) 좌석 16·선두 3·퇴역 스윕 (b) 날씨 카드 `[data-moon-pixel]`+`[data-moon-term]` → 딥 `[data-weather-air]`(air 도달 시 `[data-air-cell]` ≥ 4, 미도달 시 `data-air-state=unreadable` 허용) → `[data-detail-open="weather"]` → `[data-slot-detail="weather"] [data-sky-detail] [data-sky-lst]` `/^\d{2}:\d{2}:\d{2}$/` + 1초 뒤 값 변화 → 뒤로가기 1회 = 3단만 닫힘(딥 모달 잔존) (c) cosmos 카드 `[data-cosmos-scope]` → 딥 행 ≥ 20 → 3단 `[data-sky-detail]` 1 + `[data-cosmos-section]` 4 (d) gastronomy 카드 → 딥 `[data-feed-modal="gastronomy"] [data-scope="global"]`·`[data-scope="country"]` → 3단 `[data-gastro-section]` 3. 세션 내 실행은 Chromium 변경 스펙만(제16장 1단계), 3엔진 전수는 데몬.
- **D-12 (실행 금지 — 레인 에이전트)**: `npm run build` 금지(통합 1회), `git commit/push` 금지, `messages/*.json` 직접 편집 금지(적용기로만), 전체 E2E 금지, 소유 레인 밖 파일 수정 금지, `Math.random`·렌더 `Date.now` 금지, 수치 날조 금지.

## 3. 공유 타입 계약 (`lib/live/discoverySlots.ts` — 레인 G 소유, 다른 레인은 이 시그니처에 맞춘다)

```ts
export type FeedSlotKey = 'awards'|'newProducts'|'history'|'quake'|'mostRead'|'fx'|'crypto'|'devPulse'|'paper'|'library'|'art'|'nation'|'nearby'|'cosmos'|'gastronomy';
export interface MoonPhaseWidget {
  kind: 'moonPhase'; nowMs: number;
  gregorian: { y: number; m: number; d: number };
  lunar: { year: number; month: number; day: number; leap: boolean; animalKey: string };
  phaseKey: MoonPhaseKey; illumination: number; ageDays: number; waxing: boolean; phaseAngle: number;
  termKey: SolarTermKey; nextTermKey: SolarTermKey; nextTermMs: number; sunLon: number; moonLon: number;
}
export interface CosmosScopeWidget {
  kind: 'cosmosScope'; nowMs: number; observer: { lat: number; lon: number; name: string };
  featuredKey: string; objects: Array<{ key: string; alt: number; az: number; visible: boolean }>;
  sun: { alt: number; az: number }; moon: { alt: number; az: number }; galacticCenter: { alt: number; az: number };
}
export type SlotWidget = OmniRadarWidget | FxCompassWidget | MoonPhaseWidget | CosmosScopeWidget;
// lib/live/cosmos.ts:      export function buildCosmosCard(ctx: SlotContext, cursor: DeepCursor|undefined, nowMs: number): SlotCard
// lib/live/gastronomy.ts: export async function buildGastronomyCard(ctx: SlotContext, cursor: DeepCursor|undefined, nowMs: number): Promise<SlotCard>
```

## 4. i18n 키 정본 (`Rev42` + `Rev20.slots.{cosmos,gastronomy}`)

- `Rev20.slots.cosmos.{title,tag}` (ko "거시 우주" / "당신의 하늘 위 심우주 텔레메트리"), `Rev20.slots.gastronomy.{title,tag}` (ko "글로벌 미식" / "지금 이 시간, 세계의 식탁이 권하는 한 접시").
- `Rev42.sky`: `lunarLine`("음력 {month}월 {day}일") · `lunarLeapLine`("음력 윤{month}월 {day}일") · `animalYear`("{animal}띠 해") · `moonAge`("월령 {age}일") · `illumination`("밝기 {pct}%") · `phases.{newMoon,waxingCrescent,firstQuarter,waxingGibbous,fullMoon,waningGibbous,lastQuarter,waningCrescent}` · `animals.{rat,ox,tiger,rabbit,dragon,snake,horse,goat,monkey,rooster,dog,pig}` · `zodiac.{aries,taurus,gemini,cancer,leo,virgo,libra,scorpio,sagittarius,capricorn,aquarius,pisces}` · `terms.{lichun,yushui,jingzhe,chunfen,qingming,guyu,lixia,xiaoman,mangzhong,xiazhi,xiaoshu,dashu,liqiu,chushu,bailu,qiufen,hanlu,shuangjiang,lidong,xiaoxue,daxue,dongzhi,xiaohan,dahan}` · `termNow` · `termNext` · `termIn`("{days}일 {hours}시간 후") · `lst` · `gmst` · `jd` · `observer` · `sun` · `moon` · `eclipticLon` · `eclipticLat` · `ra` · `dec` · `altitude` · `azimuth` · `distance` · `aboveHorizon` · `belowHorizon` · `zodiacPos`("{sign} {deg}° {min}′") · `ringAria` · `dialAria` · `pixelAria`("{phase} · 월령 {age}일") · `sectionSidereal` · `sectionTerms` · `sectionSun` · `sectionMoon` · `sectionZodiac` · `live`("실시간 · 1초 갱신").
- `Rev42.air`: `title` · `euAqi` · `usAqi` · `pm25` · `pm10` · `o3` · `no2` · `so2` · `co` · `dust` · `aod` · `uvNow` · `uvMax` · `dominant` · `advice.{good,fair,moderate,poor,veryPoor,extreme}` · `unreadable` · `unit.ugm3`("μg/m³", IDENTICAL 허용) · `unit.index`.
- `Rev42.detail`: `open.{weather,cosmos,gastronomy}` · `title.{weather,cosmos,gastronomy}` · `mirrorNote`("숏컷 1의 정밀 천구 뷰를 그대로 투영합니다").
- `Rev42.cosmos`: `facts.{objectOfDay,type,constellation,distance,lightLeft,altitude,visibility,observer,earthOrbit,travelledToday,galacticOrbit,cmbDipole,galacticCenter}` · `visibility.{visible,belowHorizon,daylight}` · `lightYears`("{n} 광년") · `lightLeft.{ago("{n}년 전 출발"),bce("기원전 {year}년 출발"),ce("서기 {year}년 출발")}` · `kmPerSec`("{v} km/s") · `types.{galaxy,nebula,openCluster,globularCluster,blackHole,pulsar,quasar,star,supernovaRemnant,planetaryNebula}` · `constellations.<key>`(카탈로그가 쓰는 별자리 전부, 레인 D가 확정) · `objects.<key>.{name,note}` × 24 · `scopeAria` · `sections.{trajectory,lineage,relativity,scale}` · `trajectory.line`("{object}의 빛은 {years}년 전, {epoch}에 출발했습니다") · `epochs.{thisLife,writtenHistory,agriculture,homoSapiens,earlyHumans,greatApes,dinosaursEnd,dinosaurs,complexLife,earlyEarth}` · `lineage.intro` · `lineage.origins.{bigBang,stellarFusion,supernova,neutronMerger,cosmicRay}` · `lineage.elements.{oxygen,carbon,hydrogen,nitrogen,calcium,phosphorus,iron,gold}` · `lineage.bodyShare`("인체 질량의 {pct}%") · `relativity.{gLocal,rotation,gps,dilation,lightMoon,lightSun}` · `relativity.gLine`("위도 {lat}°의 중력가속도 {g} m/s²") · `relativity.rotLine`("자전 선속도 {v} m/s") · `scale.{you,earth,sunEarth,heliopause,oort,proxima,milkyWay,localGroup,virgo,laniakea,observable}`.
- `Rev42.gastronomy`: `mealSlots.{morning,noon,afternoon,evening,night}` · `facts.{trending,mealSlot,origin,flavor,localTime}` · `flavors.{umami,spicy,sweet,sour,bitter,smoky,fresh,rich,fermented,herbal}` · `sections.{trends,traditional,localEats,localEatsFallback}` · `traditionMeta`("전통 · {origin}") · `localMeta`("{dist} · Wikipedia") · `trending.<key>.{name,why}` × 24 · `trends.<key>.{title,line}` × 10 · `dishes.<cc>.<key>.{name,origin}` × 30국 × 2 · `sections3.{solar,chemistry,pairing}` · `science.<key>.{ingredient,solar,chemistry,pairing}` × 8 · `energyLine`("100 g = {kcal} kcal · 광합성 효율 1% 가정 시 약 {area} m²·일의 햇빛") · `pathway.{c3,c4,cam}`.

## 5. 천구 엔진 검증 벡터 (레인 A 테스트 필수)

| 항목 | 기대값 | 허용 오차 |
|---|---|---|
| GMST @ J2000.0 (2000-01-01 12:00 UT) | 18.697374558 h | 1 s |
| 춘분 2026 | 2026-03-20 14:46 UTC (황경 0°) | ±20분 |
| 하지 2026 | 2026-06-21 08:24 UTC (90°) | ±20분 |
| 동지 2026 | 2026-12-21 20:50 UTC (270°) | ±20분 |
| 삭(신월) 2026-02-17 | 12:01 UTC | ±20분 |
| 삭 2026-08-12 | 17:37 UTC | ±20분 |
| 망 2026-09-26 | 16:49 UTC | ±30분 |
| 음력(KST +9) 2026-02-17 | 2026년 1월 1일 (병오년 · 말) | 정확 |
| 음력 2026-09-25 | 8월 15일 (추석) | 정확 |
| 음력 2025-01-29 | 2025년 1월 1일 | 정확 |
| 음력 2025-10-06 | 8월 15일 | 정확 |
| 2025 윤달 | 윤6월(시작 2025-07-25) | 정확 |
| 음력 2024-02-10 | 2024년 1월 1일 | 정확 |
| 2023 윤달 | 윤2월(시작 2023-03-22) | 정확 |
| 황도 12궁 | lon 0→aries 0°, 29.99→aries 29°59′, 30→taurus | 정확 |
| 24절기 | 2026-09-18 = 백로(bailu, 165°), 다음 = 추분(qiufen) 2026-09-23 00:05 UTC | ±20분 |

## 6. 게이트 (Fail-Closed)

`npm --prefix web run typecheck` → `npm --prefix web run test`(기준선 2309, 회귀 0) → `npm --prefix web run build` → `npm --prefix web run security:trust:verify` → Playwright Chromium 변경 스펙 → 커밋(명시 경로) → `git push origin main` → `cd index.html/web && npx vercel --prod --yes --scope the-unitas-global-ou-e` → `docs/rev42/FINAL_REPORT.md`.

## 1-A. 정찰 지도 6장(리더 에이전트, 2026-09-18)이 추가 확정한 함정 — 전 레인 구속

1. **`food` 키 금지**: `discoverySlots.test.ts:71-77`·`slotSections.test.ts:50-52`가 REV-23 퇴역 뉴스 테마 `'food'`의 부재를 단언한다 → 미식 슬롯 키는 **`gastronomy`**(본 SPEC 전체 적용). `Rev19.hub.themes.food.*`(뉴스 허브)는 별개이며 보존.
2. **날씨 카드 `[data-scope]`는 정확히 1개·`country`**(`rev21-hub-card` E2E). 달 위젯은 `SlotWidgetView`로 facts 행 **위**(스코프 그룹 밖)에 마운트되므로 계약 유지. 날씨에 global 섹션을 추가하지 말 것.
3. **날씨 슬롯 제목 `Weather`(en) 불변**(`rev34-weather-square:139` 정확 텍스트) — `Rev20.slots.weather.{title,tag}`는 손대지 않는다.
4. **날씨 딥 모달 내부 `[data-meta-line]`은 1개**(`rev34:164`) — 3단 모달은 포털 형제라 무관하지만, 3단 본문에는 `HubMetaLine`을 두지 않는다.
5. **`[data-weather-aqi]`는 E2E 픽스처 `{european_aqi:35, pm2_5:8.2, pm10:14.1}`만으로도 렌더되어야 한다**(`rev34:151`) → D-4의 신규 필드 전부 `number|null` 옵션, `eu`만 필수. `weatherDeep.test.ts:117/140/229`(aqi toEqual · current 파라미터 문자열)는 신규 형태로 갱신하고 `wd-v1` stale 케이스를 추가.
6. **3단 모달은 절대 자동 오픈 금지**(`rev23-verify:160-167`이 활성 카드 제목 클릭 → `[role=dialog]` 정확히 1개 단언). 3단 상태는 `slotKey` 변경·2단 close 시 반드시 리셋(유령 히스토리 층 방지). `labelledBy` 고유 id `slot-detail-title`(`#feed-deep-title` 토큰 정확히 1개 계약 보존).
7. **원타깃 카드 우상단 6px 패딩은 컨트롤 금지**(`rev41:83-101 paddingSpot`) — 카드 변형 위젯에는 버튼·링크·role을 두지 않는다. 3단 CTA는 딥 모달에만.
8. **카드 높이는 세션 내 단조 증가**(`reserved`) — 카드 변형 위젯 ≤ 96px.
9. **CSS 클래스 충돌 금지**: `.qw-radar-*`(강우 레이더·옴니레이더)·`.qw-fx-*`·`.qw-hub-tab`·`.qw-discovery-*` 재사용 금지. 새 접두 `.qw-moon-* .qw-air-* .qw-sky-* .qw-cosmos-* .qw-gastro-* .qw-detail-*`. **새 CSS 파일 금지**(`componentSkillStaging.test`가 시트 7개를 카운트) — 각 레인은 CSS 조각을 `docs/rev42/css/<lane>.css`에 쓰고 통합 단계가 `app/quantum-white-rev19.css` 말미 §30에 순서대로 이어붙인다.
10. **`SlotWidgetView`는 exhaustive switch가 아니다**(fxCompass 외 전부 OmniRadar) → `moonPhase`·`cosmosScope` 분기를 명시 추가.
11. **`SLOT_QID`의 잔존 `air` 키는 tsc 초과 속성 오류**, `omniFamilies.test.ts:36-52 SLOT_KEYS: Record<SlotKey,true>`는 tsc 강제 — `air` 삭제·`cosmos`/`gastronomy` 추가. `omniFamilies.test:192`의 `air→'place'` 단언은 `cosmos→'science'`·`gastronomy→'default'`로 교체. `slotSections.ts:35 COUNTRY_ONLY`의 `'air'` 제거. `discoverySlots.test:101-111` 퇴역 키 루프에 `air` 추가. `lucide Wind` 미사용 import 제거.
12. **`SLOT_SOURCES`는 exhaustive + `sourceById` 모듈 로드 시 throw** → `cosmos`/`gastronomy` 행 필수(`['wikipedia']`). 메타 라인 소스 문구는 fx 선례처럼 특수 처리: `cosmos` → `t('Rev42.cosmos.source')`("UNITAS 천구 엔진 · Wikipedia"), `gastronomy` → `t('Rev42.gastronomy.source')`("UNITAS 미식 아카이브 · Wikipedia") — 로컬 연산이 실제 공급자라는 정직성(제17장).
13. **새 localStorage 키는 `sourceRegistry.ts BROWSER_STORAGE_LEDGER`에 등재**(`sourceRegistry.test:158-169`, 개인정보 페이지 렌더): `unitas.gastronomy.local.v1`. 날씨 딥은 기존 키 유지(버전만 `wd-v2`).
14. **일 시드 단일화**: `dayIndex = Math.floor(nowMs / 86_400_000)`(UTC 에포크 일수)를 `load()`에서 한 번 계산해 순수 모듈에 인자로 넘긴다(`dayOfYear()`의 연초 리셋 회피). `Math.random` 0, 순수 모듈(`celestial.ts`·`skyAlmanac.ts`·`cosmos.ts`·`gastronomy.ts`) `Date.now(` 0 — 신규 소스 스캔 테스트가 단언.
15. **`discoverySlotsFacts.test`**: `discoverySlots.ts` 안의 `emphasis: true` 리터럴은 항목 제목 파생 금지, `tempNow` 등 4개 fact는 한 줄 유지 → 날씨 어댑터의 fact 배열 서식을 바꾸지 말 것(위젯 첨부만 추가).
16. **음력 교차 검증**: Node 22 full-ICU의 `Intl.DateTimeFormat('ko-KR-u-ca-dangi', {timeZone:'Asia/Seoul'})`·`zh-CN-u-ca-chinese`로 2024-01-01~2027-12-31 전일(1461일)의 월·일을 `lunarDate()`와 대조하는 테스트를 둔다(ICU 미지원 환경이면 `it.skip`). 윤달 표기는 ICU 파트에서 프로빙(2025-07-25 = 윤6월 1일)해 매핑.
17. **i18n 드리프트 상한**: `rev20Parity`에는 en 동일 상한이 없다 → `rev42Parity`가 `Rev20.slots.{cosmos,gastronomy}` 4키도 비-en 로케일에서 en과 달라야 함을 단언. `Rev41`·`Rev34` 네임스페이스에는 아무것도 추가하지 않는다.
18. **Playwright 수동 실행은 `--output=test-results/stage3-artifacts` 필수**(없으면 stage3 진행 파일 소거). 커밋·리빌드 1회가 데몬 적립 샤드(4/6)를 폐기하므로 커밋은 1회(매니페스트 동봉)로 압축.
19. **Vercel 배포는 오토모드 분류기 차단 가능성**(2026-09-18 실측 `[Production Deploy]`) — 1회 시도 후 차단 시 우회 금지, 푸시까지 완료하고 창립자 1줄 명령을 FINAL_REPORT §6에 기록.
20. 코덱스 장 번호는 **v51.0(17장)** 기준: 제로 핸즈 제6장 · Fail-Closed·자율 승인 제14장 · 3단계 검증 제16장 · 공식 OK 결재 제17장.

## 4-A. 카탈로그 키 정본 (코드 레인과 콘텐츠 레인이 동시에 따르는 단일 키 목록)

### 우주 24기 (`cosmos.objects.<key>`) — designation · typeKey · constellationKey · RA(h) · Dec(°) · 거리(ly) · 등급
| key | designation | type | constellation | RA | Dec | ly | mag |
|---|---|---|---|---|---|---|---|
| m31 | M31 | galaxy | andromeda | 0.712 | +41.27 | 2537000 | 3.4 |
| m51 | M51 | galaxy | canesVenatici | 13.498 | +47.20 | 23000000 | 8.4 |
| m104 | M104 | galaxy | virgo | 12.667 | −11.62 | 29300000 | 8.0 |
| m87 | M87 | galaxy | virgo | 12.514 | +12.39 | 53500000 | 8.6 |
| lmc | LMC | galaxy | dorado | 5.393 | −69.76 | 163000 | 0.9 |
| centaurusA | NGC 5128 | galaxy | centaurus | 13.425 | −43.02 | 12000000 | 6.8 |
| m42 | M42 | nebula | orion | 5.588 | −5.39 | 1344 | 4.0 |
| m1 | M1 | supernovaRemnant | taurus | 5.575 | +22.02 | 6500 | 8.4 |
| m57 | M57 | planetaryNebula | lyra | 18.893 | +33.03 | 2570 | 8.8 |
| ngc7293 | NGC 7293 | planetaryNebula | aquarius | 22.493 | −20.84 | 655 | 7.6 |
| carina | NGC 3372 | nebula | carina | 10.752 | −59.87 | 8500 | 1.0 |
| m16 | M16 | nebula | serpens | 18.313 | −13.82 | 7000 | 6.0 |
| m45 | M45 | openCluster | taurus | 3.790 | +24.12 | 444 | 1.6 |
| m13 | M13 | globularCluster | hercules | 16.695 | +36.46 | 22200 | 5.8 |
| omegaCentauri | NGC 5139 | globularCluster | centaurus | 13.447 | −47.48 | 15800 | 3.9 |
| hyades | Mel 25 | openCluster | taurus | 4.450 | +15.87 | 153 | 0.5 |
| sgrA | Sgr A* | blackHole | sagittarius | 17.761 | −29.01 | 26670 | null |
| cygnusX1 | Cyg X-1 | blackHole | cygnus | 19.973 | +35.20 | 7200 | 8.9 |
| velaPulsar | PSR B0833−45 | pulsar | vela | 8.588 | −45.18 | 959 | 23.6 |
| quasar3c273 | 3C 273 | quasar | virgo | 12.485 | +2.05 | 2443000000 | 12.9 |
| betelgeuse | α Ori | star | orion | 5.919 | +7.41 | 548 | 0.5 |
| proxima | α Cen C | star | centaurus | 14.495 | −62.68 | 4.246 | 11.1 |
| vega | α Lyr | star | lyra | 18.616 | +38.78 | 25.04 | 0.03 |
| sirius | α CMa | star | canisMajor | 6.752 | −16.72 | 8.6 | −1.46 |

- `cosmos.types` 10키: galaxy·nebula·openCluster·globularCluster·blackHole·pulsar·quasar·star·supernovaRemnant·planetaryNebula. `cosmos.constellations` 16키: andromeda·canesVenatici·virgo·dorado·centaurus·orion·taurus·lyra·aquarius·carina·serpens·hercules·sagittarius·cygnus·vela·canisMajor. `cosmos.epochs` 10키(연 단위 경계, 이하): thisLife ≤120 · writtenHistory ≤5500 · agriculture ≤12000 · homoSapiens ≤300000 · earlyHumans ≤2800000 · greatApes ≤25000000 · dinosaursEnd ≤66000000 · dinosaurs ≤230000000 · complexLife ≤600000000 · earlyEarth(그 이상).

### 미식 (`gastronomy.*`)
- `trending` 24키 (key · originCc · mealSlots · flavor · ingredient): bibimbap KR noon,evening umami rice · kimchiJjigae KR noon,evening,night fermented cabbageFerment · tteokbokki KR afternoon,night spicy rice · ramen JP noon,night umami wheat · sushi JP noon,evening fresh rice · onigiri JP morning,afternoon fresh rice · dimSum CN morning,noon umami wheat · mapoTofu CN noon,evening spicy chili · pho VN morning,noon herbal rice · banhMi VN morning,noon fresh wheat · padThai TH noon,evening sweet rice · tomYum TH evening,night sour chili · nasiGoreng ID morning,noon smoky rice · tacosAlPastor MX evening,night smoky maize · neapolitanPizza IT evening,night rich wheat · cacioEPepe IT evening rich wheat · croissant FR morning rich wheat · shakshuka TN morning,noon sour tomato · avocadoToast AU morning fresh wheat · flatWhite AU morning,afternoon bitter coffee · pourOverCoffee ET afternoon bitter coffee · darkChocolate EC afternoon bitter cacao · greekSalad GR noon,evening fresh tomato · birria MX noon,night rich chili.
- `trends` 10키: fermentation · plantForward · hyperLocal · zeroWaste · koreanWave · regenerative · functionalDrinks · fireCooking · thirdWaveCoffee · nightMarkets.
- `dishes.<cc>.<key>` 30국 × 2: KR kimchi,samgyetang · JP okonomiyaki,tempura · CN pekingDuck,xiaolongbao · US hamburger,gumbo · EE mulgikapsad,kama · ES paella,gazpacho · KH fishAmok,numBanhChok · FR coqAuVin,ratatouille · DE sauerbraten,spaetzle · PT bacalhauABras,pastelDeNata · VN bunCha,banhXeo · ID rendang,satay · RU borscht,pelmeni · IN biryani,masalaDosa · IT risottoAllaMilanese,lasagna · TR kebap,baklava · TH greenCurry,somTam · PL pierogi,bigos · NL stamppot,stroopwafel · PH adobo,sinigang · GB fishAndChips,sundayRoast · MX moleNegro,pozole · BR feijoada,moqueca · AR asado,empanadas · GR moussaka,souvlaki · EG koshari,fulMedames · MA tagine,couscous · ET injera,doroWat · PE ceviche,lomoSaltado · AU meatPie,lamington.
- `science` 8키(재료 · 광합성 경로 · kcal/100 g 기준값): rice C3 130 · wheat C3 265 · maize C4 218 · coffee C3 2(추출액; 원두 환산 주석) · cacao C3 598(다크 70%) · chili C3 40 · tomato C3 18 · cabbageFerment C3 15(김치). `sunAreaDays(kcal) = kcal × 4.184 kJ ÷ (3600 kJ/m²/일 × 0.01)`(일사 1 kWh/m²/일, 광합성 효율 1% 가정 — 상수·가정을 코드 주석과 UI 문구에 명시).
- `flavors` 10키: umami·spicy·sweet·sour·bitter·smoky·fresh·rich·fermented·herbal. `mealSlots` 5키: morning·noon·afternoon·evening·night.

## 7. 파일 소유권 레인

| 레인 | 소유 파일 | 비고 |
|---|---|---|
| A 천구 | `lib/live/celestial.ts` · `lib/live/skyAlmanac.ts`(`moonPhaseWidgetFor(nowMs, locale)`·`skySnapshot(nowMs, lat, lon, locale)`) · `__tests__/live/celestial.test.ts` | 순수·`Date.now` 0 |
| G 레지스트리 | `lib/live/discoverySlots.ts` · `lib/live/slotSections.ts` · `lib/uai/sourceRegistry.ts`(SLOT_FAMILY·원장) · `components/home/widgets/SlotWidgetView.tsx` · 스텁 생성(`lib/live/cosmos.ts`·`lib/live/gastronomy.ts`·`components/home/widgets/{MoonPhasePixel,CosmosScope}.tsx`·`components/home/detail/*.tsx`) · 단위 테스트 갱신 · `scripts/apply-rev42-i18n.mjs` · `__tests__/i18n/{rev20Parity,rev42Parity}.test.ts` · E2E 3스펙 갱신 + `_rev42Retired.js` + `rev42-shortcuts.spec.js` | 스텁은 컴파일만 되는 최소 형태 |
| C 날씨 | `lib/live/weatherDeep.ts` · `components/home/WeatherDeepPanel.tsx` · `components/home/widgets/MoonPhasePixel.tsx` · `__tests__/live/weatherDeep.test.ts` · `docs/rev42/css/c-weather.css` | |
| D 우주 | `lib/live/cosmos.ts` · `components/home/widgets/CosmosScope.tsx` · `components/home/detail/CosmosDetail.tsx` · `__tests__/live/cosmos.test.ts` · `docs/rev42/css/d-cosmos.css` | |
| E 미식 | `lib/live/gastronomy.ts` · `components/home/detail/GastronomyDetail.tsx` · `__tests__/live/gastronomy.test.ts` · `docs/rev42/css/e-gastro.css` | |
| F 3단 셸 | `components/home/detail/{SlotDetailModal,DetailOpenButton,SkyDetail}.tsx` · `components/home/DiscoveryCarousel.tsx` · `docs/rev42/css/f-detail.css` | |
| H 콘텐츠·번역 | `docs/rev42/i18n/parts/*.{en,ko}.json` → `docs/rev42/i18n/<locale>.json` 20파일 | 적용은 통합 단계 |
| 통합(본 세션) | CSS 병합 · 적용기 실행 · typecheck · vitest · build · Chromium 변경 스펙 · 커밋 · 푸시 · Vercel · FINAL_REPORT · 기억 각인 | |
