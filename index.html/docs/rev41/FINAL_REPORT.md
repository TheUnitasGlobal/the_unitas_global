# [최종 완결 종합 보고서] REV-41 — U-AI 검색창 1회 클릭 UI/UX 대통합 및 하이퍼-창조 완결

작성: 2026-09-17 · 기준: Codex v41.0 제1장~제16장 + 1000대 초헌법 · 정본: `index.html/docs/rev41/SPEC.md`(설계·결정 D-1~D-11·통합 교정 R-1~R-9)

## 1. 미션별 결과

| 미션 | 결과 | 증거 |
|---|---|---|
| M0 옴니-디바이스 | 새 표면 전부 다크 베이스 + 백색 재키, `backdrop-filter`/blur 0, 레이더 `aspect-ratio 1/1 · max 320/420px`, 히어로 `clamp(40px, 9vw, 72px)`, 보드 `auto-fit minmax(150px,1fr)` → 360px에서 가로 오버플로 0(리뷰 렌즈 실증) | 3렌즈 리뷰 doctrine 렌즈 "compliant" |
| 1-A 뉴스 아웃링크 제거 | 디폴트 팝업 뉴스 **카드 아래** 옴니-오픈 쌍 삭제. 축 팝업·기사 팝업·딥다이브의 것은 유지 | E2E rev29 'M2.4/REV-31/REV-41 1-A' + rev41 1-A 통과 |
| 1-B ⏎ 제로-프릭션 밀착 | `HubRow`(인라인 `span[role=button]` + U+00A0 글루 + inline-flex ⏎) · 제목행 `display:block` + inline-block 제목 · CSS §27 재작성 | 실측(Chromium 0.75 zoom): 제목 gap 6px·수직 겹침 19px, 행 gap 8.7px·2줄 헤드라인의 마지막 줄 안에 박스 중심 |
| 1-C 원클릭 유니버셜 라우팅 | `DiscoverySlot.oneTarget`(weather·fx·crypto·quake·paper·library·air·nation·nearby) → `data-one-target="1"` + 컨테이너 onClick(role 없음, REV-23 계약 보존) | E2E rev41 1-C: fx 여백 클릭 → dialog 1 / history 여백 → 0 |
| 1-D 환율 나침반 | Frankfurter v2 **1회** 윈도 요청(30일·8통화) + CoinGecko 1회(fail-open) → 히어로 쌍(Geo-IP→로케일 통화, USD면 로케일→EUR) 72px 타이포·전일/30일 변동·30일 스파크라인·매크로 보드 4쌍·달러 강도 지수(DXY 가중 기하, 30일 전=100)·크립토 패리티(BTC/ETH 홈통화, PAXG 금 프록시) | E2E 실측: 히어로 72px, 메타 "8건 · Frankfurter (ECB) · CoinGecko · GeoJS ~ 갱신"(0건 소거) |
| 1-E 신상품 | 태그 20로케일 교체("미래를 앞당기는 초혁신적 하드웨어와 퀀텀 디바이스의 다차원 넥서스") · `SlotTabRail`: 메인 칩과 **100% 동일** 마크업·메트릭·진행바·드래그·터치·중앙정렬, 자동 회전(고정 중에도)·색상 변환·클릭 고정/해제 토글 | E2E rev41 1-E: `[data-tab-rail][data-autoplay=1]`, 진행바 1, 클릭 → held 1 → 0 |
| 1-F 유랭킹 소거 | 레지스트리·회전(16→15, index 12=air)·kind·action·딥모달·호스트·i18n(`Rev35`) 전부 삭제. U-Square 허브의 유랭킹은 유지 | 단위 15/14/퇴역 가드, E2E rev41 1-F + rev34 D-7 + `_rev41Retired.js` 제로 스윕 |
| 1-G 내 주변 옴니-레이더 | 반경 토글 4종(10/50/100/Global) = 슬롯 정적 탭 · 멀티-빔 Wikipedia geosearch(1/7/13빔) · 하버사인 실측 `≤ 반경` 필터(0% 오차) · 거리 단위 단일 규칙(m/km) · 희소 지역 en.wikipedia 보강 레그 · Global = 16 노마드 허브 성좌(0 네트워크) · SVG 옴니-레이더(고리·스윕·렌즈 4색 블립·범례·4상태 정직) | E2E 실측: r10 18블립·r50 69블립·반경 위반 0, `data-state=data` |

## 2. 게이트 (Fail-Closed, 전부 EXIT 0)

| 게이트 | 결과 |
|---|---|
| `npm --prefix web run typecheck` | EXIT 0 |
| `npm --prefix web run test` (vitest) | 124 파일 / **2175** 테스트 통과 (기준선 2060 → +115, 회귀 0) |
| `npm --prefix web run build` | EXIT 0 · BUILD_ID `iIyW6s5ALgt6fcxA1DOdP` · 소유권 지문 `eb09b6b8bab1d401…` |
| `npm run security:trust:verify` | 20/20 핀 OK |
| Playwright Chromium(제15장 2단계, 변경 스펙만) | 1차: rev41·rev29·rev19·rev25·rev34·rev21·rev23 = 56 통과 / 3 스킵(기존) · 2차(보강 후): rev41·rev21 = 16 통과 |
| 3엔진 전수(제15장 3단계) | 본 세션 실행 금지 — `UnitasIdleSensorStage3` 데몬이 새 BUILD_ID@HEAD로 유휴 창에서 완주 |

## 3. 워크플로 실행 기록

- 9에이전트: Phase 1(레인 A 데이터·B1 프리미티브·D i18n·E E2E) → Phase 2(B2 캐러셀+위젯·C 뉴스) → 3렌즈 적대 리뷰(계약 드리프트·정확성·독트린/픽셀). 2,150k 토큰 · 390 툴 호출 · 55분.
- 리뷰 8건(블로커 1·메이저 3·마이너 4) 전부 통합 단계에서 수정(SPEC §2-A R-1~R-8) + 실측 발견 1건(R-9 희소 보강).
- 실측으로 기각한 대체 소스: Wikipedia/Wikidata `gsradius`>10km(outofrange)·`gsbbox` 100km(toobig)·WDQS 100km 다중 클래스(30s 타임아웃)·Overpass 3미러(504/25s)·Photon(위치 편향 실패).

## 4. 변경 파일 요약

- 신설: `lib/live/{fxCompass,omniRadar,geoIp,useGeoIp}.ts`, `components/home/hub/{HubRow,SlotTabRail}.tsx`, `components/home/widgets/{SlotWidgetView,FxCompassHero,OmniRadar}.tsx`, `scripts/apply-rev41-i18n.mjs`, `__tests__/i18n/rev41Parity.test.ts`, `__tests__/live/{fxCompass,omniRadar,geoIp}.test.ts`, `tests/web-cinema-e2e/{_rev41Retired.js,rev41-uai-popup.spec.js}`, `docs/rev41/{SPEC,FINAL_REPORT}.md`
- 수정: `DiscoveryCarousel.tsx`, `HotIssueNewsList.tsx`, `HubTitleRow.tsx`, `OmniOpen.tsx`, `quantum-white-rev19.css`(§27 재작성·§29 신설), `discoverySlots.ts`, `slotSections.ts`, `slotContext.ts`, `useSlotContext.ts`, `contextPriority.ts`, `sourceRegistry.ts`, `messages/*.json`(20), 단위 5·E2E 4
- 삭제: `__tests__/i18n/rev35Parity.test.ts`, `scripts/apply-rev35-i18n.mjs`

## 5. 후속(창립자 결정 불요, 정보)

- 3단계 데몬 스윕 결과는 다음 세션 첫 줄 브리핑으로 도착한다(READER.md 절차).
- 야간 미션 큐의 앱 계층 자격 증명 가드 미션은 본 REV와 무관하게 대기 중(승인 키워드 필요).

## 6. 창립자 결재

- 2026-09-17 창립자 승인 키워드 `ok` 접수 (제16장 Official OK Approval Doctrine) — REV-41 최종 공사 완결 결재. 대상 커밋 `3c0f043`, 프로덕션 배포 `81wLyHhc975sEGmTNUR4cn8FK5N6`.
