# REV-34 — 6대 하이퍼-UI 개편 (창립자 지령 2026-09-16)

정본 위치: `index.html/docs/rev34/SPEC.md`
대상: `index.html/web` (Next.js 14 App Router, 20 로케일)
독트린: Codex v37.0 (제1~14장). 지령의 "제1장~제28장"에 해당하는 문서는 저장소 어디에도 없다(전수 grep 0건) — v37.0 14장 정본을 적용한다.

---

## 0. 지령 6대 미션

| 미션 | 지령 |
|---|---|
| **M0** | 모든 UI/UX 변경은 PC·모바일·태블릿·인앱 브라우저에서 픽셀 단위로 완벽 렌더링 |
| **M1-A** | 실시간 날씨 위젯 클릭 시 시간대별·주간·기상 레이더 심층 팝업 창조 |
| **M1-B** | 숏컷·모든 테마 하단의 "갱신/시간/카드갱신/딥다이브" 표기 전면 삭제 → 실시간 뉴스 규격 "건 · 출처 ~ 갱신" 단일 포맷 |
| **M1-C** | 2회 클릭 폐기, 타이틀 호버=색상만, 타이틀·하위정보 우측 끝 ⏎ 엔터 박스, 텍스트/박스 어느 쪽이든 동일 라우팅, 타이틀 아래 큰 글씨 "하위 정보 1위" DOM 영구 삭제 |
| **M1-D** | 글로벌 신상품 세부 테마 5 → 15개 이상 |
| **M1-E** | 실시간 뉴스 위젯의 기호/그림 아이콘 폐기 → 숏컷과 동일한 미니멀 동그라미 기호·색상 동기화 |
| **M2** | "다른출처에서열기"·"다른플랫폼에서열기" 및 연동 팝업의 출처/플랫폼을 옴니-비즈니스 철학(제6장)으로 확장·재배치 |
| **M3** | ESC = 시스템 뒤로가기 100% 동일 (세부 팝업 → 메인 팝업 → 홈 → 종료 팝업, LIFO) |
| **M4-A** | 우측 끝 단축키 "UNITAS SQUARE (U-Square)", 20대 테마 고정 순서 |
| **M4-B** | 허브 lede "지식을 사고팔고…" 삭제 → 코스믹 다차원 넥서스 문장 |
| **M4-C** | 허브 내 '실시간 세계 랭킹' 영구 삭제, '실시간 유니타스 랭킹' → "유랭킹", 디자인·스크롤·카드 = 유숏츠 100% 동일, 에코시스템 지표로 재창조 |

---

## 1. 정찰(9 리더 병렬 판독)이 확정한 전제

1. **날씨 팝업은 이미 열린다**(`SlotDeepModal` → `LiveWeatherPanel`, 5일 격자·현재값만). Open-Meteo 요청이 `current`+`daily(5일)`뿐이라 시간대별·UV·강수확률·일출몰·레이더가 없다. 이번 미션은 "얕은 팝업 → 심층 팝업"이다. 실호출 검증(2026-09-16): Open-Meteo hourly/daily 7일, air-quality, RainViewer `weather-maps.json` + 레이더 타일, OSM/CARTO 베이스맵 타일 전부 200.
2. **CSP 헤더 없음**(`next.config.mjs:75-79`), `next/image remotePatterns` 미설정 → 타일은 `<img>`(`eslint-disable @next/next/no-img-element` + `referrerPolicy="no-referrer"`, `SlotThumb` 선례). Windy iframe은 기각(수 MB 외부 JS, 인앱 WebView 리스크, 외부 브랜딩).
3. **뉴스 메타 규격**: `HotNews.storyCount`('{count}건') + `HotNews.source`가 분리 렌더된다. 단일 포맷 키를 새로 만든다(§3.2).
4. **2회 클릭**은 `lib/uai/twoStepSelect.ts` + `TwoStepTitle`(`.qw-two-step-hit`, `data-selected`)로 스트립(DiscoveryCarousel·HotIssueNewsList)과 U-AI 스트림(`StreamCards`)에 쓰인다. 지령 범위는 **스트립**이다 — StreamCards는 유지.
5. **"하위 정보 1위" 중복**은 슬롯 로더가 `facts[]`에 items[0]를 큰 글씨 팩트(topRank/topStory/firstEvent/nearbyTitle/paperTitle/bookTitle/artTitle/rank1/topOperator)로 다시 넣어 생긴다 → 소스(`discoverySlots.ts`)에서 제거.
6. **유숏츠 레일은 수평**(`grid-auto-flow: column`, `overflow-x`), 스냅·자동재생·키프레임 없음, 유일한 모션은 카드 호버 리프트. "100% 동일"은 `.qw-shorts-rail/.qw-short-card/.qw-short-poster/.qw-short-title/.qw-short-meta`를 **그대로 재사용**한다는 뜻이다(새 CSS 금지).
7. **ESC 현재 상태**: `ExitGuard` 캡처 keydown이 `anotherOverlayOpen()`(role=dialog/menu/listbox 히트테스트)이면 물러나고, 각 팝업이 로컬 Escape로 스스로 닫는다. 검색 드롭다운의 `role="listbox"` 때문에 스트립 위에서 ESC가 죽어 있다. 뒤로가기는 `modalStack` popstate → 최상위 레이어 `onBack` → 스택 비면 ExitGuard 센티널 → `openConfirm()`.
8. **i18n 게이트**: `rev20Parity`는 Rev20을 76키로 고정, `rev29Copy`는 Rev29 전 키를 20로케일 정확 일치로 고정, `Rev21.*`은 `docs/rev21/i18n` 정본이 통째 덮어쓴다. `i18n:sync`는 `[MISSING:en]` 플레이스홀더를 써서 게이트를 깨뜨린다 → **REV-34 카피는 전부 새 `Rev34.*` 네임스페이스 + 전용 applicator(20 실번역)**.
9. **CSS 가드**: 선택자 허용목록은 없다. 실제 가드는 `rev15FixedLayerGuard`(html/body 규칙에 filter/transform 금지), `rev21OneLayer`(backdrop-filter 금지), 토큰 문자열 존재 검사. 새 클래스는 `html[data-unitas-surface='quantum-white']` 접두 규칙(화이트) + 비접두 다크 베이스로 추가한다. `quantum-white-rev19.css`·`unitas-hub.css`는 `SurfaceScope`가 화이트 홈 라우트에 로드한다.

---

## 2. 결정 사항 (제4장 제로 핸즈 — 되묻지 않고 확정)

| # | 결정 |
|---|---|
| D-1 | 코덱스 정본 = v37.0 14장. 문서 장 번호는 v37 기준(Fail-Closed=제11장, 3단계 검증=제13장). |
| D-2 | 세계 랭킹 삭제 범위 = **U-Square(허브)** 한정. 디스커버리 캐러셀의 `worldRanking` 슬롯(REV-20 22슬롯 계약, E2E 다수)은 유지. |
| D-3 | 2회 클릭 폐기 범위 = 스트립(DiscoveryCarousel + HotIssueNewsList). `twoStepSelect.ts`·`StreamCards`는 유지. |
| D-4 | 메타 단일 포맷 키 = `Rev34.meta.line` ICU `{count}건 · {source} ~ {updated} 갱신`(en `{count} items · {source} ~ updated {updated}`). 뉴스 행·카드·피드/랭킹/날씨 심층 모달·날씨 패널 전부 이 한 컴포넌트(`HubMetaLine`)로 렌더. `Rev19.hub.updated/cadence`, `Weather.updated`는 **렌더만 중단**(키 삭제 금지 — 삭제는 20로케일 패리티 리스크만 키운다). |
| D-5 | ⏎ 엔터 박스 = 새 클래스 `.qw-row-enter`(검색바 `.qw-enter-key` 토큰 복제: 1.5px rim, 반경 8px, 호버 블루). 타이틀 행 28px, 하위 행 24px, ≤767px에서 44px 히트 영역. **`title` + sr-only 텍스트만, `aria-label` 금지**(rev21-hub-card L143 계약). |
| D-6 | 뉴스 위젯 글리프 전부(축 칩 아이콘·StoryBadge·행 마커) → 공용 `HubDot`(8px 원, `--qw-hub-accent` 소비). 캐러셀 칩의 lucide 아이콘은 지령 밖(불변). |
| D-7 | 신상품 16 패밀리: cars, phones, mobility, gadgets, games + aiAgents, quantum, sovereignSaas, bioHealth, neurotech, space, xr(메타 디바이스), defiHardware, ecoEnergy, nomadGear, robots. 연도 카테고리가 얇은 패밀리는 정적 카테고리 트리와 짝(`static` 플래그, 연도-1 재요청 게이트). `cars`는 첫 항목 유지(junk-key 폴백). |
| D-8 | 출처/플랫폼: `OMNI_FAMILY_ROWS`(family → {sources, platforms}) + `OmniOpen`의 `family` prop(+`data-omni-family`), `omniFamilyForSlot()`. 모든 행은 `wikipedia, wikidata` / `googleSearch, bingSearch`로 시작(E2E·컴팩트 계약). 제6장 의무 엔진(Google·Naver·Yandex·Seznam·Bing·DuckDuckGo·Yahoo·Ecosia·Qwant·Apple) 기본 플랫폼 행에 상시. 상한: 출처 ≤10, 플랫폼 ≤16. 브랜드명은 Latin 유지. 키 없는 공개 검색 URL이 없는 앱(Telegram/Discord/Kakao/LINE/WeChat)은 행에 넣지 않는다. arxiv URL 버그(`/abs/?searchtype`) 수정. |
| D-9 | ESC 컨트롤러 판정 순서: ① `[data-escape-local]` 비-레이어 메뉴(AttachMenu·언어 피커·InfoHint) 열림 → 그 메뉴만 닫기 ② 종료 확인창 열림 → 취소(dismiss, 센티널 재충전 — 뒤로가기가 그 창에서 삼켜지는 유일한 의도적 비대칭) ③ 모달 스택 비어있지 않음 또는 검색 사다리(타워/텍스트/포커스) 레벨 → `history.back()` 1회(스택은 popstate로 최상위 레이어만 닫는다 = 뒤로가기와 바이트 동일) ④ 홈 released 페이즈·스택 비음 → `openConfirm()`(데스크톱 앱 창은 센티널이 없으므로 직접 호출) ⑤ 그 외(로고/게이트/광고/봉인 페이즈, 비홈 라우트) → 무시. 컨트롤러가 처리하면 `preventDefault()`로 로컬 Escape 핸들러의 이중 닫힘을 봉쇄. `EcosystemEntryModal`·`PwaInstallHost`에 `defaultPrevented` 가드 추가. |
| D-10 | U-Square 20테마 키(고정 순서): `uRanking, uShorts, uTalk, uExchange, uSocial, uAcademy, uVenture, uOracle, uFactory, uCoin, uGovernance, uNexus, uAkashic, uQuantum, uShield, uNomad, uChronos, uSpace, uVision, uMaster`. 기존 6면은 레거시 DOM 키 유지(`data-hub-tab-btn=rankings|shorts|rooms|exchange|social|swarm`)하되 순서는 20순서를 따른다(1·2·3·4·5·12번). 신규 14면은 `data-hub-tab-btn=<themeKey>`. 전 탭에 `data-square-tab=<1..20>` 추가. 기본 탭 = 1번 유랭킹. `Rev29.hub.tabs.*` 키는 삭제하지 않고(패리티) 사용만 중단, 20 라벨은 `Rev34.square.themes.<key>.tab`. |
| D-11 | 신규 14면 = `SquareThemePanel`(lede · 실측 시그널 타일 4개 · 특징 3 · CTA 딥링크). 시그널은 실제 로컬 상태(hubLedger·지갑·락인 활성·MODULE_REGISTRY·거버넌스 축·일자 시드 지수)만 — 난수 금지. `uMaster`는 공개에 잠금 상태로 노출, `SOVEREIGN_HINT_COOKIE`가 있을 때만 `/sovereign` CTA. 각 CTA는 기존 라우트/게이트 라우트로만 연결(새 라우트 폴더 금지 → prebuild 레지스트리 무변경). |
| D-12 | 유랭킹 = `lib/square/uRankings.ts`(일자 시드 결정론, `dayIndex` 인자, 12카드/일, 지표: microBurnEfficiency %, knowledgeSales, nomadContribution, sovereignIndex, 모듈 배정) + `URankingsShorts.tsx`(UnitasShorts 마크업·클래스 그대로, 좌상단 필=순위 배지, 우상단 필=모듈, 두 번째 meta=지표, Modal size=lg, `data-urank`/`#unitas-urank-title`). `HubRankings`는 `data-hub-rankings` 루트를 유지한 래퍼로 축소, `data-hub-ranking-tab` 삭제(어떤 스펙도 참조 안 함). |
| D-13 | U-Square lede(ko): "무한한 지성이 교차하고 영속적 가치가 팽창하는 코스믹 다차원 넥서스 — 스무 개의 하이퍼-테마가 하나의 광장에서 공명합니다." (en: "A cosmic multidimensional nexus where infinite intelligence intersects and perpetual value expands — twenty hyper-themes resonating in one square.") 20로케일 실번역. |
| D-14 | 창립자의 커밋·배포 사전 결재("통과된 코드만 자동 배포하고 최종 결과만 브리핑")를 제14장 결재로 간주 — 게이트 EXIT 0 후 즉시 커밋·푸시·Vercel 프로덕션. |

---

## 3. 미션별 설계

### 3.1 M1-A 날씨 심층 팝업
- `lib/live/weatherDeep.ts`: `DeepForecast` 타입, `fetchDeepForecast(place, signal)` = forecast(current·hourly·daily 7일, timezone=auto) + air-quality `Promise.allSettled`; 순수 파서(`parseDeepForecast`, `sliceHourlyFromNow` — 문자열 접두 비교, `new Date()` 파싱 금지: WebKit은 오프셋 없는 ISO를 UTC로 읽는다), `uvBand()`, `windDirLabel()`; 캐시 키 `unitas.weather.deep.v1`(10분), 기존 `Forecast`/`unitas.weather.v1` **불변**.
- `lib/live/rainviewer.ts`: `fetchRadarFrames()`(5분 캐시), `tileXY(lat, lon, z)`, `radarTileUrl(host, path, z, x, y)`, `basemapTileUrl(z, x, y)`(CARTO light_all; 다크 표면엔 dark_all), 3×3 격자 좌표 헬퍼, 저작권 문구.
- `components/home/WeatherRadar.tsx`: 3×3 `<img>` 격자(베이스맵 + 레이더 오버레이, `width:100%; aspect-ratio:1`), 프레임 스크러버(past+nowcast), 모달 열린 동안만 10분 폴링, 실패 시 `radarUnavailable` 페일클로즈드, 줌 z=7 기본 ±토글.
- `components/home/WeatherDeepPanel.tsx`: 확장 현재값(체감·습도·풍향/돌풍·UV 밴드·강수) → 24h 레일(`u-hscroll`) → 7일 리스트(일출몰·UV max·강수확률) → 레이더 → AQI 행(Rev20.slots.facts.aqi.* 재사용). 각 블록 `data-weather-hourly/daily/radar`, 루트 `data-weather-modal`.
- `DiscoveryCarousel.tsx`: `SlotDeepModal`(L617-651)을 `WeatherDeepModal`로 승격 — FeedDeepModal과 동일 헤더, `labelledBy="slot-weather-title"`, `data-slot-modal="weather"`, 앵커 attrs, `OmniOpen host="weather" family="place"` 유지, `LiveWeatherPanel`(compact prop으로 5일 격자 숨김) 아래 `WeatherDeepPanel`, `kind === 'weather'` 게이트, 4개 서브모달 상시 마운트 유지.
- i18n `Rev34.weather.*`: hourlyLabel, dailyLabel, radarLabel, radarPast, radarNow, radarNowcast, radarSource, radarUnavailable, uv, uvBand.{low,moderate,high,veryHigh,extreme}, windDir, gust, precip, precipProb, sunrise, sunset, aqiLabel, loading, now, zoomIn, zoomOut.

### 3.2 M1-B/1-C/1-E 카드 메타·인터랙션·글리프
- `components/home/hub/HubMetaLine.tsx`: `{count, source, updatedAt}` → `Rev34.meta.line`. 단 하나의 `Intl.DateTimeFormat`(HH:mm) 보유(카드·모달의 사본 3개 제거). `data-meta-line`.
- `components/home/hub/HubTitleRow.tsx`: 타이틀 텍스트 버튼(호버 색 → `--qw-blue-deep`, 배경 변화 없음) + 우측 `.qw-row-enter` 박스; 둘 다 같은 `onOpen`. `TwoStepTitle` 사용처(DiscoveryCarousel L449, HotIssueNewsList L452) 교체. 키보드: Enter/Space → open.
- 하위 행(`button.qw-hub-headline`, DiscoveryCarousel L544·HotIssueNewsList L473): 텍스트 호버 색 변화 추가 + 행 끝 24px `.qw-row-enter`. 기존 stopPropagation 유지, 클릭에 preventDefault 금지(검색창 포커스 로직).
- `components/home/hub/HubDot.tsx`: 8px 원, `style={{'--qw-hub-accent': color}}`. HotIssueNewsList의 축 칩 아이콘·StoryBadge·행 마커 전부 교체, `lib/live/hotNewsAxes.ts`의 lucide 의존 제거(`hotNews.ts` 서버 파일은 원래 lucide 없음).
- `discoverySlots.ts`: 타이틀 중복 팩트 9종 제거(i18n 키는 보존).
- 푸터 교체: DiscoveryCarousel L580(카드)·L863(랭킹 모달)·FeedDeepModal L738 부근, HotIssueNewsList L496·L632, LiveWeatherPanel L262 → `HubMetaLine`. 뉴스 `updated`는 `AxisFeed.at`/`cache.at`.
- CSS(`app/quantum-white-rev19.css`에만 추가; `globals.css`는 M4 레인 소유): `.qw-row-enter`(다크 베이스 + QW 재키), `.qw-hub-title-hit`, `.qw-hub-dot`, `.qw-hub-headline:hover .qw-hub-headline-text{color:var(--qw-blue-deep)}`, ≤767px 44px 히트.
- `.qw-two-step-hit`/`data-selected` 계약은 스트립에서 사라진다 → E2E 4종(rev21-hub-card, rev23-verify, rev29-verify, rev19-back-stack) 1클릭+엔터박스로 재작성(통합 단계).

### 3.3 M1-D 신상품 16 패밀리
- `newProducts.ts`: `ProductFamilyKey` 확장, `static?: true`, 검증된 카테고리(연도형: `${y} in spaceflight`, `${y} software`…; 정적형: AI 에이전트/양자 하드웨어/XR 헤드셋/하드웨어 월렛/뉴로테크/바이오/에너지/노마드 기어/로봇 등 실재 카테고리), `PRODUCT_MIN_FILL` 연도-1 재요청은 `!static`일 때만.
- 테스트 `__tests__/live/newProducts.test.ts` 재작성(패밀리 ≥15, 종류별 카테고리 단언, `familyOfDay` 모듈로 길이).
- i18n: `Rev29.newProducts.families.<key>` 11개 신규(rev29Copy가 en 키를 `PRODUCT_FAMILY_KEYS`로 검사) + `Rev20.slots.newProducts.tag` 값 갱신(키 추가 금지) → `scripts/apply-rev34-products-i18n.mjs`.

### 3.4 M2 출처/플랫폼 재배치
- `sourceRegistry.ts`: 신규 SourceId(naverSearch, yandex, seznam, duckduckgoSearch, yahooSearch, ecosia, qwant, brave, baidu, appleMaps, googleMaps, googleTrends, openAlex, crossref, googlePatents, secEdgar, worldBank, oecd, coinGecko, tradingView, yahooFinance, productHunt, crunchbase, huggingFace, kaggle, stackOverflow, devTo, hackerNews, medium, substack, bluesky, mastodon, pinterest, naverNews, naverCafe, naverBlog, theMet …) + `outboundSearchUrl` 케이스 전부 + `OMNI_FAMILY_ROWS` + `omniRowsFor(family)` + `omniFamilyForSlot(slotKey)`. 패밀리: default, place, news, rankings, products, fx, crypto, science, dev, library, art, shorts, unitas.
- `OmniOpen.tsx`: `family?` prop, `data-omni-family`, 기존 `data-omni-open/data-omni-row/data-omni-source/data-omni-platform` 계약 불변, 컴팩트 호스트 slice 규칙 유지.
- 호스트 배선: DiscoveryCarousel(피드 모달 slotKey→family, 랭킹 'rankings', 날씨 'place'), HotIssueNewsList('news'), 허브 패널(shorts/unitas), 스트림('default') — 스트립 파일은 레인 S 3단계에서 배선.
- 테스트 `__tests__/**/sourceRegistry*.test.ts` 확장(모든 신규 id가 검색어를 URL에 포함, 라벨 유일, side 규칙).

### 3.5 M3 ESC 생명주기
- `lib/history/escapeController.ts`: 순수 `resolveEscape(ctx) → 'close-local' | 'dismiss-confirm' | 'history-back' | 'open-confirm' | 'ignore'` + `ESCAPE_LOCAL_ATTR='data-escape-local'`; vitest 판정 테이블.
- `ExitGuard.tsx` L533-555 교체: 판정 스위치. `anotherOverlayOpen()`은 `[data-escape-local]`만 본다(listbox 히트테스트 제거). `history.back()`은 스택 소유 traversal이 아니므로 USER traversal로 귀속 = 모바일 뒤로가기 경로와 동일; `getModalStack().push/release` 호출 금지.
- `AttachMenu`(role=menu 루트), `GlobalLanguagePicker` 패널, `InfoHint` 카드에 `data-escape-local`.
- 새 E2E `rev34-escape-lifecycle.spec.js`: rev19-search-back 사다리를 Escape로 재현(카드 → 타워 → 텍스트 → 바 이탈 → `#exit-guard-title`), 허브 열림 → Escape 1회 = 허브만 닫힘, 종료창에서 Escape = 취소. WebKit 비동기 popstate → 폴링 expect.

### 3.6 M4-A/B U-Square
- `lib/square/themes.ts`: 20 디스크립터 `{key, order, legacyTab?, icon(lucide), deepLink, signals[], gated?, founderOnly?}` + 테스트(20개·순서·키 유일·레거시 매핑 6개).
- `components/home/hub/SquareThemePanel.tsx`: lede·시그널 4타일·특징 3·CTA(`Link`), `data-square-panel/data-square-signals/data-square-cta`.
- `UnitasHubModal.tsx`: `SQUARE_THEMES` 순회, 레거시 6키 → 기존 패널, 나머지 → SquareThemePanel; 헤더 `Rev34.square.title/lede`; 탭 스트립 `useDragScroll` + ≤767px 2행 스냅 그리드(`grid-auto-flow: column`, 44px 최소 높이), sr-only swipeHint; `data-unitas-square` 루트 attr 추가(기존 `data-unitas-hub` 유지); 마지막 테마 localStorage 기억(initialTab prop 우선).
- `UnitasHubToggle.tsx`: 20 아이콘 + 1번 랩 복제(총 21 `.qw-attach-roll-icon`), `globals.css` 롤 키프레임 48s/20스톱(`[data-stop=1]`·reduced-motion 유지).
- `unitas-hub.css`: `.qw-square-nav`, 시그널 타일 그리드, QW 재키 블록, backdrop-filter 금지.
- i18n `Rev34.square.*`: title, lede, toggleAria, swipeHint, lastTheme, founderOnly, locked, signals.{online,packs,coins,lockins,modules,axes,nodes,uptime,burn,sales,nomad,index}, themes.<key>.{tab,lede,features.0..2,cta}(20×6) → `scripts/apply-rev34-square-i18n.mjs`. `Rev29.hub.title/lede/toggleAria` 값도 갱신(키 유지).

### 3.7 M4-C 유랭킹
- §2 D-12. `lib/square/uRankings.ts` + `__tests__/hub/uRankings.test.ts`(결정론·핸들 `/^[a-z0-9.]+$/`·12카드·지표 범위). `URankingsShorts.tsx`(posterStyle 3줄 복제, 모듈 필터 칩 `.qw-hub-strip`, OmniOpen family 'unitas'). `HubRankings.tsx` 래퍼. i18n `Rev34.uRankings.*` → `scripts/apply-rev34-uranking-i18n.mjs`.

---

## 4. 병렬 안전 파일 소유권 레인

| 레인 | 소유 파일(편집 허용) | 금지 |
|---|---|---|
| **S1** (M1-B/C/E) | DiscoveryCarousel.tsx, HotIssueNewsList.tsx, LiveWeatherPanel.tsx, discoverySlots.ts(팩트 삭제만), hotNewsAxes.ts, hub/HubMetaLine·HubTitleRow·HubDot.tsx, quantum-white-rev19.css, __tests__/live/*, apply-rev34-strip-i18n.mjs | globals.css, tests/web-cinema-e2e/**, newProducts.ts |
| **S2** (M1-A, S1 완료 후) | weatherDeep.ts, rainviewer.ts, WeatherRadar.tsx, WeatherDeepPanel.tsx, DiscoveryCarousel.tsx(날씨 모달만), LiveWeatherPanel.tsx(compact prop), quantum-white-rev19.css(추가만), apply-rev34-weather-i18n.mjs, __tests__/live/weatherDeep*.test.ts | globals.css, E2E |
| **S3** (M2 배선, S2·M2 완료 후) | DiscoveryCarousel.tsx·HotIssueNewsList.tsx·hub 패널·스트림의 `OmniOpen family` 배선만 | 그 외 |
| **P** (M1-D) | newProducts.ts, __tests__/live/newProducts.test.ts, apply-rev34-products-i18n.mjs | discoverySlots.ts(주석도 금지), DiscoveryCarousel.tsx |
| **R** (M2 레지스트리) | sourceRegistry.ts, OmniOpen.tsx, sourceName.ts, deeperAnchor.ts, sitePagesRegistry.ts(필요 시), __tests__/**/sourceRegistry*·omniOpen* | 호스트 파일(S3가 배선) |
| **E** (M3) | escapeController.ts, ExitGuard.tsx, AttachMenu.tsx, GlobalLanguagePicker.tsx, InfoHint.tsx, EcosystemEntryModal.tsx, PwaInstallHost.tsx, __tests__/history/*, __tests__/exit/* | E2E(통합 단계에 신규 스펙 위임), 모달 컴포넌트 |
| **Q1** (M4-A/B) | lib/square/themes.ts, SquareThemePanel.tsx, UnitasHubModal.tsx, UnitasHubToggle.tsx, unitas-hub.css, globals.css(롤 키프레임만), __tests__/hub/squareThemes.test.ts, apply-rev34-square-i18n.mjs, __tests__/i18n/rev29Copy.test.ts(값 검사 갱신 시) | HubRankings.tsx, UnitasShorts.tsx, rev19.css |
| **Q2** (M4-C) | lib/square/uRankings.ts, URankingsShorts.tsx, HubRankings.tsx, __tests__/hub/uRankings.test.ts, apply-rev34-uranking-i18n.mjs | UnitasHubModal.tsx, UnitasShorts.tsx, unitas-hub.css |
| **I** (통합) | 모든 applicator 순차 재실행 + `--check`, `__tests__/i18n/rev34Parity.test.ts`, tests/web-cinema-e2e/** 전체(재작성·신규), 게이트 전수, 결함 수정 | — |

applicator 규약: 자기 서브 네임스페이스만 deep-merge SET(전체 `Rev34` 객체 치환 금지), 삭제 없음, `--check` 지원, 20 실번역, 병렬 레인이 같은 messages/*.json을 쓰므로 자기 키가 사라지면 재실행.

---

## 5. 검증 계약 (제11장·제13장)

- 1단계(레인마다): `cd web && npx tsc --noEmit`, 수정 모듈 vitest, 통합에서 `npx vitest run` 전수 + `npm run build` EXIT 0(postbuild가 `public/ownership-manifest.json` 2줄을 바꾸므로 커밋 전 확인).
- 2단계(통합, Chromium 단일 + mobile-chrome 1종): rev21-hub-card, rev23-verify, rev29-verify, rev19-back-stack, rev19-search-back, rev20-fullscreen-nav, rev30-mobile-lifecycle(mobile-chrome), 신규 rev34-escape-lifecycle · rev34-weather-square. 설정·스펙 절대 경로, `next build` 후 `next start -p 3123` 고아 확인.
- 3단계: 배포 후 10분 유휴 시 3엔진 전수(SONNET 5/HIGH) — 본 세션 범위 밖.
- 바뀌는 E2E 계약: `.qw-two-step-hit/data-selected`(삭제), `[data-hub-tab-btn]` 6→20, 기본 허브 패널 exchange→uRanking, `[data-hub-ranking-tab]`(삭제), 뉴스 축 칩 아이콘(→`.qw-hub-dot`), `.qw-attach-roll-icon` in toggle 7→21, `[data-slot-modal="weather"]`에 `data-weather-*` 추가.

## 6. 배포
게이트 EXIT 0 → `git commit` → `git push origin main` → `cd web && npx vercel --prod --yes --scope the-unitas-global-ou-e` → `docs/rev34/FINAL_REPORT.md` 스탬프 커밋·푸시.
