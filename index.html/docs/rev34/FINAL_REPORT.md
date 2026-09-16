# REV-34 최종 완결 종합 보고서 — 6대 하이퍼-UI 개편

창립자 지령 2026-09-16 · 정본 `index.html/docs/rev34/{SPEC,FINAL_REPORT}.md` · 대상 `index.html/web` (Next.js 14, 20 로케일) · 독트린 Codex v37.0

---

## 1. 6대 미션 결과

| 미션 | 결과 | 핵심 구현 |
|---|---|---|
| **M1-A 날씨 심층 팝업** | 완료 | `lib/live/weatherDeep.ts`(Open-Meteo current·hourly·daily 7일 + 대기질, 순수 파서, `unitas.weather.deep.v1` 10분 캐시), `lib/live/rainviewer.ts`(RainViewer 프레임 5분 캐시, 슬리피 타일 수학, CARTO 베이스맵), `WeatherRadar.tsx`(3×3 타일 격자 + 레이더 오버레이, 과거/나우캐스트 스크러버·재생, 줌 6/7/8), `WeatherDeepPanel.tsx`(확장 현재값·24h 레일·7일·레이더·AQI), `DiscoveryCarousel`의 `SlotDeepModal` → `WeatherDeepModal` 승격. 닫힌 팝업의 네트워크 호출 0(마이크로번 0원). 기존 `Forecast`/`unitas.weather.v1` 불변 |
| **M1-B 메타 단일 포맷** | 완료 | `HubMetaLine` + 순수 포매터 `lib/live/metaLine.ts`, 단일 키 `Rev34.meta.line` = "{count}건 · {source} ~ {updated} 갱신". 카드·피드/랭킹/날씨 모달·뉴스 행·날씨 패널 전부 이 한 줄. `Rev19.hub.updated/cadence`·`Weather.updated`는 렌더 0(키는 패리티 보호를 위해 보존) |
| **M1-C 1클릭 + ⏎ 엔터 박스** | 완료 | `HubTitleRow`(타이틀 텍스트 호버=색상만 + 우측 `.qw-row-enter` 28px), 하위 행 우측 24px 박스, 텍스트/박스 동일 `onOpen`. 스트립에서 `TwoStepTitle/.qw-two-step-hit/data-selected` 소멸(StreamCards는 유지). 슬롯 로더의 타이틀 중복 팩트 9종 소스 제거. ⏎은 `title`+sr-only만(aria-label 0) |
| **M1-D 신상품 16 패밀리** | 완료 | cars·phones·mobility·gadgets·games + aiAgents·quantum·sovereignSaas·bioHealth·neurotech·space·xr·defiHardware·ecoEnergy·nomadGear·robots. 47개 위키피디아 카테고리 트리 실존 검증(45개 5/5 멤버), 16개 Wikidata QID 검증. `static` 플래그 + `previousYearCategories()`로 연도-1 재요청 게이트 |
| **M1-E 뉴스 동그라미** | 완료 | `HubDot`(8px, `--qw-hub-accent`)로 축 칩·StoryBadge·행 마커·모달 헤더 전부 교체, `hotNewsAxes.ts` lucide 의존 제거. 허브 3파일(지식거래소·대화방·숏츠)의 축 아이콘도 동일 글리프로 동기화 |
| **M2 출처/플랫폼 재배치** | 완료 | 아웃바운드 SourceId 31종 신설(Naver 4·Yandex·Seznam·DuckDuckGo 검색·Yahoo·Ecosia·Qwant·Brave·Baidu·Apple 지도·Google 지도/트렌드/특허·SEC EDGAR·OECD·TradingView·Yahoo Finance·Product Hunt·Crunchbase·Hugging Face·Kaggle·Stack Overflow·Dev.to·Medium·Substack·Bluesky·Mastodon·Pinterest), 13 패밀리 행(`OMNI_FAMILY_ROWS`), `OmniOpen family` prop + 12개 호스트 전부 배선, 제6장 10대 엔진 기본 행 상시, 상한 10/16, arxiv 죽은 링크 수정, 개인정보 페이지 아웃바운드 14→45행 자동 반영 |
| **M3 ESC = 뒤로가기** | 완료 | `lib/history/escapeController.ts` 순수 판정(close-local → dismiss-confirm → history-back → open-confirm → ignore) + `ExitGuard` 판정 스위치. `history.back()` 1회 = USER traversal(모달 스택 popstate가 최상위 레이어만 닫음 = 모바일 뒤로가기와 동일). 검색 드롭다운 `role=listbox` 오인이 ESC를 죽이던 `anotherOverlayOpen()` 제거, `[data-escape-local]` 메뉴 3종만 로컬 닫힘 |
| **M4-A U-Square 20테마** | 완료 | 명칭 "UNITAS SQUARE (U-Square)", `lib/square/themes.ts` 20 디스크립터(고정 순서, 레거시 6면 매핑, 딥링크는 기존 라우트만), `SquareThemePanel`(실측 시그널 4타일·특징 3·CTA, 유마스터는 공개 잠금+소버린 힌트 쿠키 시 `/sovereign`), 모달 20탭(`data-square-tab` 1..20, 모바일 2행 스냅 그리드 44px), 토글 아이콘 21개 48s 롤 |
| **M4-B 코스믹 lede** | 완료 | "무한한 지성이 교차하고 영속적 가치가 팽창하는 코스믹 다차원 넥서스 — 스무 개의 하이퍼-테마가 하나의 광장에서 공명합니다." 20로케일 |
| **M4-C 유랭킹** | 완료 | 허브에서 세계 랭킹 영구 삭제(`data-hub-ranking-tab` 소멸), `lib/square/uRankings.ts`(FNV-1a+fmix32 일자 시드, 12카드/일, 마이크로번 효율·지식 판매·노마드 기여·소버린 지수, 모듈별 자체 사다리), `URankingsShorts`가 유숏츠 마크업·클래스 100% 재사용(새 CSS 0) |

i18n: `Rev34.*` 186 리프 키 × 20 로케일(uRankings 16 · meta 1 · row 1 · weather 27 · square 141) + `Rev29.newProducts.families` 11키 + `Rev29.hub.title/lede/toggleAria`·`Rev20.slots.newProducts.tag` 값 갱신. 플레이스홀더 0, 빈 문자열 0, 신규 `rev34Parity.test.ts` 40/40.

---

## 2. 무결성 게이트 실측 (제11장 Fail-Closed, 제13장 1·2단계)

| 게이트 | 실측 | EXIT |
|---|---|---|
| `npx tsc --noEmit` | 오류 0 | 0 |
| `npx vitest run` (web/) | 104 파일 / 1705 테스트 전부 통과 (19.3s) | 0 |
| `npm run build` | prebuild sync-codex drift=0(canon `e88bdb4d…` v37.0) · validate-module-registry 19/19 · pwa-cache-bust · Next "Compiled successfully" · 정적 826/826 페이지 · postbuild 소유권 지문 | 0 |
| Playwright Chromium (통합 레인 실측) | rev34-escape-lifecycle 4 · rev34-weather-square 6 · rev29-verify 10(+1 skip) · rev21-hub-card 8 · rev23-verify 13 · rev19-back-stack 4 · rev19-search-back 3 · rev20-fullscreen-nav 1 · rev21-rail-drag 4 · rev25-crossplatform 6(+2 skip) · rev32-swarm 6 · rev17-refresh-persistence 전부 통과 | 0 |
| Playwright mobile-chrome | rev30-mobile-lifecycle 9 · rev34-escape-lifecycle 통과 | 0 |
| 배포 후 재확인 | §6 참조 | — |

위 tsc·vitest·build 수치는 통합 레인 보고 후 본 세션이 **직접 재측정**한 값이다(제11장 미측정 보고 금지).

---

## 3. 정찰이 먼저 뒤집은 전제 (docs/rev34/SPEC.md §1 요약)

1. 지령의 "제1장~제28장" 코덱스는 저장소에 없다 → v37.0 14장이 정본(D-1).
2. 날씨 팝업은 원래 열렸다(얕은 5일 패널) — "창조"의 실체는 심층화였다.
3. 유숏츠 레일은 수평이며 스냅·자동재생·키프레임이 없다 — "100% 동일"은 기존 클래스 재사용이다.
4. ESC가 스트립 위에서 죽어 있던 원인은 ExitGuard의 오버레이 히트테스트가 검색 드롭다운 `role=listbox`를 오인한 것.
5. 선택자 허용목록은 없고 실제 CSS 가드는 3종(fixed-layer·one-layer·토큰 존재)이다.

---

## 4. 실행이 잡아낸 결함 5건

| # | 결함 | 원인 | 조치 |
|---|---|---|---|
| 1 | `discoverySlots.ts` `top is not defined` 런타임 오류 | 세션 한도 중단 직전 팩트 삭제가 `const top` 선언만 지움 | 복구, `discoverySlotsFacts.test.ts` 신설 |
| 2 | 허브 3파일 tsc 오류 8건 | `hotNewsAxes.ts`에서 lucide `icon` 제거(D-6) 후 소유 레인 없는 파일이 `.icon` 참조 | 스트립 레인 소유권 확장, `HubDot`으로 동기화 |
| 3 | **첨부 메뉴에서 ESC 시 검색 팝업까지 붕괴** (D-9 위반, 신규 E2E가 검출) | 메뉴가 첫 항목에 포커스를 두고 닫히면 포커스가 `<body>`로 떨어져 `handleRootBlur`가 "바를 떠났다"로 판정 | WAI-ARIA 메뉴 버튼 패턴: 닫힘 직후 토글로 포커스 복귀(`AttachMenu.tsx`) |
| 4 | rev29-verify strict-mode 로케이터 충돌 | 20탭 확장으로 동일 라벨 중복 매치 | 스펙 로케이터 정밀화 |
| 5 | `HubMetaLine` 타입 오류 | next-intl values 레코드 인덱스 시그니처 부재 | 타입 교정 |

---

## 5. 세션 한도 중단과 재개

첫 구현 워크플로우(10 에이전트)가 세션 한도로 8개 레인 중단(R·Q2만 완료). 재개 워크플로우는 각 레인이 자기 소유 파일을 먼저 감사한 뒤 미완 부분만 마무리하도록 지시받았고, 10/10 완료·오류 0으로 종료했다. 병렬 안전은 SPEC §4 파일 소유권 레인과 레인별 i18n applicator(deep-merge, 삭제 금지)로 확보했다.

---

## 6. 프로덕션 배포 검증 (제11장)

| 항목 | 실측 |
|---|---|
| 커밋 | `16497a6` feat(rev34) — 추가 32 · 수정 58 파일 (`18e20f8..16497a6`) |
| 푸시 | `git push origin main` → `18e20f8..16497a6 main -> main` |
| Vercel | `npx vercel --prod --yes --scope the-unitas-global-ou-e` EXIT 0 · `dpl_J2asPtsK3bqxRnoGcLKw4XHjfams` · 원격 빌드 iad1 2분 · sync-codex drift=0 · 정적 826/826 · Aliased `https://www.theunitas.global` |
| 라이브 검증 | `https://www.theunitas.global/ownership-manifest.json` → `gitCommit 16497a6c65…`, `generatedAt 2026-09-16T12:19:04Z`; `/` 308 → `www`; `/ko` 200, HTML에 "UNITAS SQUARE (U-Square)" 라벨 각인 확인 |
| 로컬 재확인 | 배포 직전 고아 `next start -p 3123`(서브에이전트 잔류) 정리 후 Chromium 4스펙 28 passed / 1 skipped / 0 failed |

3단계(10분 유휴 3엔진 전수, SONNET 5/HIGH)는 제13장에 따라 배포 후 유휴 시 백그라운드 구동 대상이다.

---

## 7. 창립자 후속 판단 후보 (지령 범위 밖, 자율 제안 — 제12장)

1. **캐러셀의 `unitasRanking` 슬롯·U-AI 스트림의 유니타스 랭킹 패널도 유랭킹(숏츠형)으로 승격**할지 — 이번 D-2는 허브 한정이었다.
2. **U-Square 14개 신규 테마의 실데이터 연결**: 현재 시그널 타일은 로컬 원장·지갑·락인·모듈 레지스트리·일자 지수(결정론)로 채워진다. 허브 서버 원장(REV-30 RPC)과 연결하면 접속자 수·판매량이 실시간이 된다.
3. **날씨 레이더 줌 기본값**(z=7)과 CARTO 베이스맵의 다크 라우트 변형은 실기기 실측 후 미세 조정 여지.
