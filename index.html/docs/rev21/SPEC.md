# U-AI · 메인 에코시스템 Hyper-Evolution 블루프린트 (REV-21 · PHASE 1 설계 정본)

작성 2026-09-12 · 기준 커밋 `ed506b0` · Codex v18.0 제20장(2단계 분할 실행)에 따른 **PHASE 1 = 코드베이스 실측·근본 원인 규명·설계**.
이 문서는 PHASE 2 구현자의 작업 지시서다. **프로덕션 코드는 한 줄도 수정하지 않았다.**

증빙: 12개 서브시스템 리더(랭킹·뉴스·L1 스트립·동음이의·로케일 전환·새로고침·검색 입력·검색 결과·푸터·날씨/탐색·성능 CSS·테스트/게이트)의 파일 정독 보고 + curl 실호출(`공기`/`空気`/`空气`/`aire` 4로케일 en 크로스패스 재현, Wikidata QID·langlinks 해석, 무키 소스 22종 프로브) + vitest 실측(54파일 827건 통과, 20.1s). 라이브 Playwright 실측은 PHASE 2 첫 단계로 이월(이번 PHASE는 `next start` 금지 원칙).
직전 정본: `index.html/docs/rev20/SPEC.md`.

---

## §0. 진단 요약 — 창립자 지적 ↔ 실측된 근본 원인

| # | 지령 | 실측된 현재 상태 | 근본 원인 | 확신 |
|---|---|---|---|---|
| 1A | 숏컷/뉴스 타이틀 박스 좌우 드래그 없음 | 칩 레일 `.qw-hub-strip`은 `overflow-x:auto`뿐(터치 스와이프만, 마우스 드래그 없음). 활성 카드는 스와이프로 슬롯 전환 불가. 뉴스 행은 세로 grid. 마우스 드래그는 랭킹·뉴스 **칩**의 `DraggableCarouselRow`에만 존재 | REV-20이 레일을 단순 overflow 스크롤로 재구현하며 드래그 물리를 승계하지 않음 | 확정 |
| 1B | 세계/유니타스 랭킹을 숏컷 슬롯으로 흡수 | 두 랭킹은 캐러셀 밖 독립 위젯(칩→인라인 패널→행→Modal). 슬롯 계약(`SlotKind` weather/news/feed)에 '선택 가능한 하위 엔티티→상세 모달' 개념 없음 | 슬롯이 읽기 전용 정보 카드로만 설계됨 | 확정 |
| 1C | 1차 팝업 UI/UX·로직 통일 | 숏컷=화살표→Modal xl, 세계랭킹=인라인 패널→Modal xl, 유니타스=인라인→Modal md, 뉴스=행 `<a target=_blank>`. 칩 시각 언어도 2종(알약 vs 사각) | 세 위젯(REV-19)과 캐러셀(REV-20)이 다른 시기·다른 문법 | 확정 |
| 1D | 카드 전체가 히트박스여야 함 | 딥 모달 트리거는 우상단 9×9 `ArrowUpRight` 버튼과 URL 없는 헤드라인뿐. 카드 루트에 클릭 핸들러 없음 | REV-20 §3이 '칩=고정, 화살표=딥다이브'로 역할 분리 | 확정 |
| 2A | 글로벌 1순위·선택 국가 2순위 | 뉴스 3라우트(hot-news/axis-news/hub-news) 모두 자국어 레그 선두 라운드로빈. 슬롯 `ctx`는 `{locale}`뿐, 국가는 날씨 캐시→`DEFAULT_PLACE`로 암묵 유도 | §2A 개념이 REV-20 설계에 부재 | 확정 |
| 2A' | 언어 변경 시 즉시 재렌더 | **치명**: `DiscoveryCarousel.cardCache`가 `SlotKey`만으로 키잉 → 언어를 바꿔도 TTL(10~15분) 내 이전 로케일 카드 재사용 | 캐시 키에 로케일 차원 누락 | 확정 |
| 2B | '공기'→태국 영화 동음이의 변질 | `webSynthesisCore.ts:210-212`가 로케일 원문 '공기'를 **번역·엔티티 해석 없이** `en.wikipedia` 전문검색에 투입 → 실측 1~6위 = Gonggi(놀이)·이준호(가수)·Signal(드라마)·Knucklebones·궁중요리·Lyn(가수). ja `空気`→Air Doll(영화), zh→上海/巴南, es `aire`→면역 유전자. 반면 ko 위키 1위='공기(기체)', langlinks(en)='Air', QID=Q7391292. Wikidata 레그도 P31 필터 없음(MET 자수직물·삼국지 가공인물 편입). 오염 스냅샷은 localStorage 24h·Postgres 24h·CDN 1h+swr 24h **3중 영속** | 크로스패스가 '번역'이 아니라 '검색'. 엔티티 식별자(QID/langlinks)가 어디에도 없음 | 확정(재현) |
| 4A | 언어 드롭다운 즉시 전환 실패 | 드롭다운이 히스토리 레이어(`nav:language`)로 등록되는데 `selectLocale`이 `setOpen(false)`를 `router.replace`보다 **먼저** 호출 → 레이어 해제가 `history.go(-1)` 발사 → 그 popstate가 Next 14.2 `ACTION_RESTORE`가 되어 진행 중인 `ACTION_NAVIGATE`를 **폐기**(action-queue.js:121-124). F5 시 저장된 선호가 재적용되어 "새로고침해야 바뀐다" | 모달스택 release 가드가 'replace 이후'를 가정했으나 Next 히스토리 갱신은 비동기 | 유력(코드 경로 전구간 확인, 런타임 재현은 PHASE 2 초입 5분 실험) |
| 4B | 새로고침 깜빡임·광고 잔상·스크롤 초기화 | F5 첫 페인트는 phase 무관 SSR 'gate' 커튼(검정 void+언어 피커). 저장 phase는 하이드레이션 후 passive effect에서야 적용 → 게이트 0.9s exit 유령. 메인 홈 F5 = 흰→검정 void(verify RTT)→0.35s 페이드→흰. 검색창은 SSR `value=""` vs 클라이언트 저장 질의 **하이드레이션 불일치**. 스크롤 리셋의 확정적 코드 경로는 없음(조건부: 로케일 선호≠URL일 때 replace→scrollIntoView) | 커튼 phase 초기값 SSR 고정, 복원 void 색이 목적지(흰)와 다름, 입력창 sessionStorage useState 초기화 | 확정/유력 |
| 4C | 팝업 전개 렉 | L1 스트립 `height:0→auto` 인플로우 framer 애니메이션(매 프레임 전체 페이지 재레이아웃) × 전폭 `backdrop-blur-xl` × 동시 클러스터 `filter:blur(2px)`. backdrop-filter 6~8겹 중첩. 홈 idle에도 text-shadow/box-shadow/background-position 상시 keyframe 6종. `DraggableCarouselRow` 무한 rAF 4인스턴스 | 대면적 backdrop-filter 위에서 레이아웃·페인트 속성 애니메이션 | 확정 |
| 5A | 우측 3아이콘 통합 | Paperclip/Video/PenTool 독립 `<button>` 3개 + 숨은 `<input type=file>` 2개 + `CanvasDrawInput` Modal. Enter는 `.qw-enter-key`(E2E 계약) | — | 확정 |
| 5B | '이어서 탐색' 삭제·'사'→'임대' 연관성 파괴 | 로컬 인덱스 매처가 제목·영문 alias·**설명문 어디든** 부분 일치. 실측 `'사'`→사회(제목)·매칭("사람")·관계("살아")·영화("서사"); `'임'`/`'실'`/`'소'`→임대. `'사'` 단독으로 '임대'는 미재현 → 유력 경로 = 쿼리 변경 시 `webSuggestions` 미초기화로 **직전 쿼리의 위키 행이 잔존 병합**(스테일 병합) | 접두(prefix)가 아닌 substring 매칭 + 설명문 티어 + 웹 행 상태가 쿼리 키로 묶이지 않음 | 확정/유력 |
| 5C | 무한 스크롤 하이퍼 검색 결과 | 풀스크린은 정적 16블록 단일 리포트. 무한 스크롤·페이지네이션·데이터 사다리 코드 **전무**. `handleChange`가 한 글자만 쳐도 `uai.reset()` → 타워 통째로 닫힘. COGS 매트릭스는 코드에 어떤 표현도 없음 | REV-20 PHASE 2가 §5.3~5.5/§6.2~6.3 미착수 | 확정 |
| 6A | 푸터 링크가 레거시 페이지로 이동 | 확정 경로 = 모달 하단 "전체 페이지로 보기" → `/[locale]/legal/<slug>` 다크 라우트. 홈 언마운트 시 `data-unitas-surface` 삭제 → QW CSS 스코프 통째 소멸 → `SitePage.tsx`(REV-13 이전 다크 문법)가 다크 NavBar와 함께 렌더 = '구형 페이지'. 유력 2차 경로 = 프리하이드레이션 첫 탭(SSR 앵커 실제 href, onClick은 하이드레이션 후) | QW 스코프 속성이 홈 컴포넌트 수명에 묶여 있고 인스티튜셔널 라우트는 리디자인 범위 밖이었음 | 확정/유력 |
| 6B | 푸터 페이지 내용 확장 | 12페이지 × {title, lede, body[2]} 균일(en 261~455자, ko 138~233자). 면책은 legal 6 slug만. SitePages 패리티 테스트 0건. apply-rev19/20 파이프라인은 flat 문자열 전용(배열 불가 → `body.map` 크래시) | 2026-08-29 최소 구현 후 확장 없음 | 확정 |

### 0.1 실측의 한계 (정직 표기)
- 이번 PHASE는 `next start`·Playwright 미실행. 4A(F1)·4B 스크롤·5B 정확 키 시퀀스·6A 재현 경로·4C 프레임 수치는 **PHASE 2 첫 단계에서 실측 확정**한다(§8.4 프로브 목록).
- 창립자가 목격한 '태국 영화 공기'는 오늘 en 검색 랭킹엔 없었다(랭킹은 시간 가변). 동일 메커니즘의 영화급 변질은 ja `Air Doll`로 확인됐고, `shortcut_cache` 행이 남아 있다면 `SELECT payload->'web'->'sources' FROM shortcut_cache WHERE locale='ko' AND query='공기'`로 사후 확인 가능.

---

## §1. L1 팝업(Zero-Click Popup) 재설계

### 1.1 용어 확정
- **타이틀 박스** = `DiscoveryCarousel`의 활성 카드 `.qw-hub-card`(칩 레일 `.qw-hub-strip`은 슬롯 선택). '실시간 뉴스' 타이틀 박스 = `HotIssueNewsList`의 뉴스 행.
- **숏컷 1차 팝업** = 슬롯 딥 모달(`SlotDeepModal` weather / `NewsDeepModal` / `FeedDeepModal` / 신규 `RankingDeepModal`). `HotShortcutResultModal`(`.qw-keyword-panel`)은 타이핑 드롭다운 키워드 칩 전용 '키워드 팝업'으로 별개이나 §3 컴포넌트는 양쪽 모두에 배치한다(해석 오류 리스크 0).

### 1.2 §1A 60fps 좌우 드래그
**설계 결정: 스냅 스크롤러(B안)**. CSS 마퀴(A안)는 실제 `scrollLeft`가 없어 포커스·`scrollIntoView` 경로가 깨지고, §1B 편입으로 인스턴스가 4→2로 줄어 B안이 단순·안전.

1. 신규 `web/components/ui/useDragScroll.ts` — `DraggableCarouselRow.tsx:86-130`의 pointer 드래그 로직 추출. 계약: `useDragScroll(ref, { threshold: 5, suppressClickMs: 200, onDragStart?, onDragEnd? })`. `pointermove`는 `{passive:true}` 등록 + rAF 1개 배칭(`QuantumVoid.requestFlush` 패턴). 드래그 중 `data-dragging="1"` 속성. 마우스 전용(터치는 네이티브 스크롤).
2. 공용 유틸 `.u-hscroll`(globals.css): `overflow-x:auto; overscroll-behavior-x:contain; touch-action:pan-x pan-y; -webkit-overflow-scrolling:touch; scroll-snap-type:x proximity; scrollbar-width:none; contain:content`. 적용: `.qw-hub-strip`, 뉴스 행 컨테이너, `DraggableCarouselRow` 루트.
3. 칩 레일: `useDragScroll(railRef)` 부착, 각 `.qw-hub-chip { scroll-snap-align:center }`. 자동 센터링은 `scrollIntoView` 대신 `railRef.current.scrollTo({ left: el.offsetLeft - (rail.clientWidth - el.offsetWidth)/2 })`(문서 스크롤 무영향, PERF-05) + 드래그 중/직후 700ms 억제.
4. 활성 카드 스와이프: `.qw-hub-card`에 pointer 수평 제스처(임계 40px, 수직 우세면 무시, `touch-action: pan-y`) → `setTick(n±1)` + hold 해제. 전환 애니메이션은 `motion.div key={activeKey}` opacity/`translateX` 크로스페이드 0.18s(transform/opacity 전용). 이웃 카드 프리렌더 없음(데이터 3배 비용 회피).
5. 뉴스 행(`HotIssueNewsList`): 세로 grid → 가로 스냅 레일(`.u-hscroll` + `useDragScroll`) 1행, 카드 폭 `clamp(240px, 70vw, 320px)`, 모바일 `flex: 0 0 82vw`. 클릭 억제(드래그 200ms 내 click 무시)는 훅이 담당.
6. `DraggableCarouselRow`: rAF idle drift 폐기(`IntersectionObserver`/`document.hidden` 정지 없이 4루프 상시), 2배 복제 제거, `useDragScroll` + `.u-hscroll`로 축소. 컴포넌트 이름·props 유지(호출처 4곳 무수정).
7. 순수 물리 모듈 `lib/interaction/railDrag.ts`(임계·클릭 억제·스냅 목표 계산) → vitest `__tests__/interaction/railDrag.test.ts`. 실제 60fps는 E2E `rev21-rail-drag.spec.js`(mouse.down/move/up + touchscreen, rAF 간격 p95 ≤ 16.7ms).

### 1.3 §1B 랭킹 2종의 슬롯 편입
**설계 결정: 슬롯 2개(`worldRanking`, `unitasRanking`) + 카드 내 서브탭**. 테마별 개별 슬롯(22→34+, 회전 주기 238s+)은 기각.

1. `lib/live/discoverySlots.ts` 계약 확장(모두 하위 호환):
   - `SlotKind`에 `'ranking'`, `SlotKey`에 `'worldRanking' | 'unitasRanking'`.
   - `SlotItem`에 `action?: { kind:'rankingDetail'; theme: GlobalRankingThemeKey; rank:number } | { kind:'unitasProfile'; moduleKey:string; rank:number }`, `rank?: number`, `color?: string`.
   - `SlotCard`에 `tabs?: { key:string; labelKey:string; color:string }[]`, `activeTab?: string`, `subject?: { term:string; wikiTitle?:string; qid?:string; lang?:string }`(§2B), `sections?: { scope:'global'|'country'; facts; items }[]`(§2A).
   - `SlotContext`에 `country: string`(ISO2), `scope?: 'global'|'country'`, `signal` 실제 전달.
   - `DiscoverySlot`에 `provider: { name:string; url:string }`(§3B 출처 실명, 정적).
   - `load(ctx, cursor)`의 `cursor`에 `{ tab, tier }` 수용(`DeepCursor`는 `Record<string,string|number>`라 무변경).
2. 어댑터 `worldRankingSlot`: `GLOBAL_RANKING_THEMES` 12테마를 tabs로, 활성 탭의 상위 `HUB_CARD_ITEMS`(4)를 items(action rankingDetail, rank≤20만 clickable). `LOAD_MORE_TIERS` 페이징은 딥 모달에서 cursor.tier로. `unitasRankingSlot`: `MODULE_REGISTRY` 모듈을 tabs, `unitasRankingFor(module)` 결정론 데이터. **`useRankingDetail`(서버 LLM 경로)은 카드에서 자동 호출 금지, 딥 모달 진입 시에만.**
3. `DISCOVERY_ROTATION` 22→**24**(weather 0번 유지, `worldRanking`은 `nation` 뒤, `unitasRanking`은 `nearby` 뒤). `slotTtlMs`에 ranking 분기(worldRanking 6h 정적, unitasRanking 24h 결정론). `SLOT_BY_KEY`/`feedSlots` 갱신(feed 12 불변).
4. `slotTitleKey/slotTagKey`: `Rev21.slots.worldRanking.title/tag`, `Rev21.slots.unitasRanking.title/tag`(**Rev20 네임스페이스 무접촉** — rev20Parity 74키 고정 회귀 방지).
5. 4번째 딥 모달 `RankingDeepModal`(상시 마운트, `slot.kind==='ranking'` 게이트): 세계랭킹은 기존 `GlobalThemeRankings`의 상세 Modal 본체를 `embedded`/`initialTheme` prop으로 재사용(labelledBy `global-ranking-detail-title` **유지** → E2E 정규식 보존), 유니타스는 `UnitasModuleRankings` 프로필 Modal(`unitas-ranking-profile-title` 유지). 상세는 서브탭 전환·LOAD_MORE 티어·행 클릭→랭킹 상세(`useRankingDetail`)·`ExploreDeeper` 하단.
6. `HotShortcutMatrixStrip.tsx:72-77` 랭킹 2종 SectionShield 제거. `GlobalThemeRankings`/`UnitasModuleRankings` 컴포넌트는 존치(`UnitasModuleRankings`는 `UaiDashboard.tsx:580`에서도 사용 → §5C에서 함께 정리).
7. 테스트: `discoverySlots.test.ts` 22→24, ranking kind 2, feed 12 불변, 회전 중복 없음. `rev19-back-stack.spec.js:84-109` 랭킹 경로를 `[data-slot="worldRanking"]` 칩 핀 → `[data-slot-card]` 클릭 → `#global-ranking-detail-title`로 재작성.

### 1.4 §1C 1차 팝업 통일
- 단일 `SlotDeepModal` → `DEEP_MODAL_BY_KIND` 맵(weather/news/feed/ranking). 각 모달은 자기 kind가 아니면 `open=false`(REV-20 ba1d33a kind 게이트 승계). Modal size **xl 통일**(유니타스 md→xl).
- 뉴스: 슬롯 항목 클릭 = `item.url`이 있으면 **바로 새 탭**(기사 페이지 직행, 1차 팝업 없음) — 현행 `SlotItem.url` 경로가 이미 만족. `HotIssueNewsList`는 캐러셀 아래 독립 행으로 **존치**하되 드래그·히트박스·칩 시각 언어를 `.qw-hub-chip`로 통일(21축 필터·무한 페이징 유지).
- 숏컷(피드/날씨/랭킹): 카드 클릭 = 1차 팝업(딥 모달) 전개.
- 칩: 랭킹·뉴스의 `chipBase`(사각 Tailwind) → `.qw-hub-chip` 클래스 공유.
- 회전 계약: `rotationPaused = held || openKey !== null || hovering || dragging` 단일 파생값. 모달 닫힘 시 `held = openKey`로 고정(다른 슬롯으로 튀지 않음). hold 해제 시 `setTick(DISCOVERY_ROTATION.indexOf(held))`로 현재 위치에서 이어 회전. 모바일은 `pointerdown`을 paused 트리거로, 700ms 후 재개. 진행바 `data-held`→`data-paused`.

### 1.5 §1D 카드 전체 히트박스
- `.qw-hub-card` 루트: `role="button" tabIndex=0 onClick={() => setOpenKey(activeKey)} onKeyDown(Enter/Space)`, `aria-label={tHub('openAria', {title})}`, `cursor:pointer`, `:hover/:focus-visible` 하이라이트(§19 CSS).
- 내부 헤드라인 버튼·서브탭·화살표·랭킹 행: `e.stopPropagation()` 필수(이중 발화 방지). 드래그/스와이프 후 200ms 내 click은 훅이 억제.
- 화살표 버튼은 시각 힌트로 존치(`aria-label` 유지 → E2E `[data-slot-card] button[aria-label]` 보존). E2E에 '카드 중앙 클릭·네 모서리 클릭' 케이스 추가.

### 1.6 GPU 전개(§4C 연계)
- `HotShortcutMatrixStrip.tsx:35-46` motion.div에서 `height` 키 삭제, `overflow-hidden` 제거 → `initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0}}`(exit 0.12s). 내부 패널 `.qw-strip-panel { transform-origin:top; animation: qw-strip-enter .22s both }` (`from { opacity:0; transform: translateY(-8px) scaleY(.97) }`). 아래 모듈 벽 밀림은 마운트 1회 레이아웃.
- `.qw-hub-card { min-height: var(--qw-hub-card-min-h, 240px); contain: layout paint }`(≤767px 200px) → 7초 회전 CLS 0. 빈 상태도 동일 높이.
- 패널 `backdrop-blur-xl` 삭제 → QW `--qw-glass-solid` 0.94 불투명(§4.3 한 겹 원칙).

### 1.7 포털 생존 규칙(L1-11)
- L1은 검색바 포커스(`ouroboros`)가 생존 조건. 모든 하위 팝업(딥 모달 4종, §3 테마 모달)은 **반드시 `DiscoveryCarousel` React 서브트리 안의 `Modal`**로 렌더(React 합성 이벤트 버블로 `cancelPendingBlur`가 동작). 내부 입력 요소는 `onMouseDown={(e)=>e.stopPropagation()}`. 딥 모달에 포커스 트랩 추가(Tab으로 포털 밖 이탈 시 150ms 후 스트립 닫힘 방지).

---

## §2. 로케일·컨텍스트 타깃팅

### 2.1 §2A 글로벌 1순위 · 선택 국가 2순위
1. **컨텍스트 조립** — 신규 `lib/live/slotContext.ts` + `useSlotContext()` 훅: `{ locale, country, scope }`. `country` 우선순위: 로그인 `profiles.country` → 날씨 캐시 `place.countryCode`(사용자가 검색한 도시) → `DEFAULT_PLACE[locale].countryCode` → `GOOGLE_NEWS_EDITION[locale].gl`. 순수 함수 `resolveCountry(inputs)` + vitest.
2. **순서 정본** — 신규 `lib/live/contextPriority.ts`: `order(locale) => ['global','country']` 상수. 뉴스 병합 3곳 교체:
   - `app/api/live/hot-news/route.ts:85` → `mergeNewsFeeds(globalItems, localItems)`(en도 글로벌 우선 유지).
   - `app/api/live/axis-news/route.ts:129` → `mergeAxisWires([worldwide, bingGlobal, board, bing])`.
   - `app/api/live/hub-news/route.ts:73` → `mergeAxisWires([worldwide, bingGlobal, own, bing], 12)`. `hubNews.ts:58-60` en 로케일도 `edition.gl !== 'US'`면 국가 레그 생성.
   - 테스트 `hubThemes.test.ts:42-52`·`axisNews.test.ts:90,122-126` 글로벌 선두 계약으로 갱신 + 신규 `contextPriority.test.ts`(20로케일 전부 global 레그 non-null, 병합 첫 항목이 global 소스).
   - CDN 캐시 키는 `locale,theme` 그대로(order는 상수라 캐시 키 증가 없음).
3. **슬롯 섹션** — `SlotCard.sections`로 카드/딥 모달이 `data-scope="global"` → `data-scope="country"` 순 렌더. 글로벌 전용(quake·fx·crypto·devPulse·paper·library·art)은 country 섹션 없음(헤더 숨김). fx는 `country`→통화 강조(KR→KRW 2번째 섹션). nation·air·weather는 country 전용 선언.
4. **로케일 키 캐시(치명 결함 해소)** — `DiscoveryCarousel.cardCache` 키를 `cardCacheKey(ctx, key) = \`${locale}:${country}:${key}\`` 헬퍼 1곳으로(FeedDeepModal 381도 동일). `HotIssueNewsList`는 locale 변경 effect에서 `data` 즉시 리셋. `useLiveWeather.ts:570-606` mount-only `[]` → `[locale]`(DEFAULT_PLACE 재설정). 회귀 vitest: locale 'ko'→'en' 리렌더 시 `load` 2회.
5. **영문 하드코딩 검색어(H-10)** — `LIBRARY_SUBJECTS`/`ART_TERMS` 표시 라벨을 `Rev21.slots.library.subjects[]`/`art.terms[]`로 이관(쿼리는 en 유지, OpenLibrary `language:<lang>` 필터). `hubThemes.terms`에 et/km/tl 추가. `lifeLibrary.ts:64` en 폴백은 §2.2 `resolveEntity` 경유.

### 2.2 §2B 엔티티 컨텍스트 보존 — "검색어를 던지지 않는다"
**정답 참조 구현**: `useLiveWeather.geocodeViaWikipedia`(310-364)가 이미 '로케일 위키 검색 → 엔티티 타입 게이트 → langlinks(en) → 영문 정규화'를 쓴다. 이를 일반화한다.

1. 신규 `lib/uai/entityResolve.ts`(isomorphic, window 미참조):
   ```ts
   resolveEntity(query, lang, signal) => { localeTitle, enTitle?, qid?, disambiguation, coord? } | null
   ```
   - 로케일 위키 `generator=search&gsrlimit=3&prop=langlinks|pageprops|coordinates&lllang=en&lllimit=max&ppprop=wikibase_item|disambiguation&formatversion=2&origin=*` **1콜**(추가 왕복 0: 기존 `wikiGeneratorExtracts` 레그에 동승). 실측 ko '공기'→en 'Air', Q7391292, disambig=false; ja '空気'→'Atmosphere of Earth#Composition'(`#` 앵커 제거 필수).
   - `disambiguation`이면 다음 히트로. 로케일 히트 0건이면 Wikidata `wbsearchentities&type=item&language=<lang>` `match.type==='label'`만 + `wbgetentities props=claims|sitelinks&sitefilter=<lang>wiki|enwiki` 1콜로 P31 확인.
   - **'로케일 1위 QID 고정' 규칙이 배제 필터보다 우선**(사용자가 실제 영화명을 검색한 경우 보존). 배제 클래스(크로스 후보에만): 영화 Q11424·TV 시리즈 Q5398426·앨범 Q482994·노래 Q7366·인간 Q5·예술작품 Q838948·조각 Q860861·문학작품 Q7725634·가공인물 Q95074·P31 없음.
2. `webSynthesisCore.collectWebSynthesis` 2단계 재구성:
   - 210-212 `wikiSearch('en', trimmed, 6)` **삭제**. Batch 2에서 `enTitle`로 `en.wikipedia/api/rest_v1/page/summary/<enTitle>` **1건**(제목 정확일치, 리다이렉트 자동: Air→Atmosphere of Earth). 선택적 `wikiSearch('en', enTitle, 3)`(검색어 = en 제목).
   - 213-218 Wikidata: `type=item` + `match.type==='label'` + 로케일 1위 QID 일치 항목을 앵커로 승격, 나머지는 P31 배제.
   - 153-158 DDG: `ddgSearch(enTitle)`(CJK 원문 호출 폐기), `Type==='D'`(disambiguation) 응답은 abstract·topics 폐기.
   - `WebSource`에 `lang: string; qid?: string; origin: 'wiki'|'wiki-en'|'wikidata'|'ddg'|'searx'`(optional 처리로 fakeWeb 호환), `WebSynthesis`에 `anchor?: {qid, localeTitle, enTitle}`, `grounding?: string`(로케일 위키 + QID 확정 en 요약만).
3. 캐시 버전 범프(3중 영속 해소): `SHORTCUT_CACHE_VERSION 'sc-v1'→'sc-v2'`, `webSynthesis.ts CACHE_KEY 'v3'→'v4'`. 배포 직후 `GET /api/u-ai/shortcut-cache/refresh`(Bearer CRON_SECRET) 수동 워밍업 1회(PRIORITY_LOCALES en·ko). `genesis_memory` cr-v1은 **무효화하지 않음**(D-8).
4. 사다리 드리프트 증폭 차단(H-4): `KeywordChip`에 `qid?/lang?`, `deriveKeywords`는 `source.lang===lang`인 소스만 entity 칩, label은 괄호 제거하되 query는 원제목 유지. `nestKeyword(parent, query, qid?)` → 티어 디스크립터에 qid → `/api/u-ai/shortcut-cache?q=&qid=` 선택 파라미터. `UaiDashboard` followups도 `lang===locale` 소스만.
5. 크론 LLM 컨텍스트(H-6): `refresh/route.ts:301,338` `payload->web->>digest` → `grounding`.
6. 휴리스틱(H-5): `analyzeSurface` lexicon 대상을 `origin==='wiki-en'` snippet + 원문으로 한정.
7. 역방향 동음이의(H-9): `GlobalRankingEntry.qid?`(rank 1~20 240건 사전, Wikidata 라벨검색 반자동 생성 후 검수), `SLOT_QID` 상수(air→Q7391292, quake→Q7944, crypto→Q13479982 …), `discoveryLinks(subject, locale, qid?)`가 qid 있으면 sitelinks 기반 `/wiki/<로케일 제목>` 직링크.
8. 언어 전환 시 재검색 금지: `wbgetentities&ids=<qid>&props=sitelinks&sitefilter=<lang>wiki`로 새 로케일 제목 즉시 획득(§2A 즉시 렌더 + §2B 보존 동시 충족).
9. 테스트: 신규 `__tests__/uai/entityResolve.test.ts`(fetch 모킹: ko '공기' 픽스처 → en 소스 'Atmosphere of Earth' 1건뿐, disambiguation 스킵, `#` 앵커 제거, DDG Type='D' 폐기, 20로케일 wikiLangFor). `shortcutCache.test.ts` fakeWeb에 lang/origin 추가.

---

## §3. '더 깊이 탐색(Explore Deeper)' 공통 컴포넌트

### 3.1 앵커 계약
`ExploreDeeper`와 테마는 **문자열 검색어를 받지 않는다**. 오직 해석된 앵커만:
```ts
type DeeperAnchor =
  | { kind:'entity'; qid:string; localeTitle:string; enTitle?:string; lang:string; disambiguation?:boolean; coord?:{lat,lon} }
  | { kind:'place'; name:string; lat:number; lon:number; countryCode:string; qid?:string }
  | { kind:'both'; entity; place };
```
호스트별 앵커: 날씨 팝업 = `useLiveWeather().place`(+ `pageprops.wikibase_item`을 `place.qid`로 노출) / 뉴스 팝업 = `resolveEntity(hubThemeTerm(theme, locale))` + `knownPlace` / 피드 팝업 = `SLOT_QID[slotKey]` + `knownPlace` / 키워드 팝업 = 스냅샷 `web.anchor` / 랭킹 팝업 = `GlobalRankingEntry.qid`(유니타스 모듈은 앵커 없음 → 실명 링크만). `disambiguation===true`면 테마 그리드 대신 '의미 선택' 칩(`prop=links` 상위 8).

### 3.2 §3B 출처 실명
- `DiscoverySlot.provider` 정적(USGS · Frankfurter · CoinGecko · Hacker News (Algolia) · OpenAlex · Open Library · The Met · Open-Meteo Air Quality · World Bank · Wikipedia · Wikimedia Pageviews · Open-Meteo).
- 렌더 측 순수 함수 `sourceNameOf(url)`(hostname → Wikipedia (ko)/Wikipedia (en)/Wikidata/DuckDuckGo/Google News/Bing News/…; SearXNG 호스트는 '웹 검색'으로 일반화) → 파킹된 스냅샷 재합성 없이 즉시 적용. `HotShortcutResultModal` 소스 목록·`UaiHyperStream` 소스 카드에 origin 배지.
- 아웃바운드 라벨: 기존 `Rev19.discovery.news/search`('News'/'Search')는 무접촉, `Rev21.deeper.sources.*`에 "Google 검색"·"Google 뉴스"·"YouTube"·"Wikipedia ({lang})"·"Wikidata" 실명 신설. 위키 링크는 `search=` 대신 qid/exact title 직링크.
- 날씨 하단 `t('source')` 한 줄 → 실명 목록(Open-Meteo / Open-Meteo Geocoding / Wikipedia / Wikidata / BigDataCloud).

### 3.3 §3C 테마 레지스트리 — 심사 확정 12(확정 10 + 예비 2)
초안 3종(business 14 · cosmic 15 · data 14 = 43안)을 6기준(①소스 curl 검증·무한 페이지네이션 ②기존 4체계 중복 없음 ③헌법 근거 ④중독성 훅 ⑤엔티티 컨텍스트 ⑥출처 실명)으로 심사, 최종 라인업 소스는 심사관이 전부 재실호출(26+7건). 기각 사유 요지: `nation`/`fx`/`crypto`/`quake`/`library` 슬롯과 소스 중복(nomadEconomy·capitalTide·chainLiquidity·entropyFlow(USGS)·soulArchive·terraOscillator), 동음이의 재발 경로(npm·GitHub·Stack Exchange·Remotive는 `"Air"`→Airbnb/Go 라이브리로드 오염 + 비인증 쿼터 10/min·300/일), 라이브 폴링은 테마가 아님(cosmicClock → 날씨 헤더 위젯 후보), CORS 부재(Google News RSS 직접·Wayback·SEC EDGAR).

공통 규칙: 앵커 없이는 호출 0. 위키류는 **QID 또는 sitelink 정확 제목**만, 텍스트 검색 소스(HN·OpenAlex concepts·Commons)는 **`enTitle` 따옴표 구문**만. 모든 카드는 `scope: global → country` 순(§2A), 국가 섹션이 비면 헤더 생략. Wikimedia 호스트 직렬 1.2s, SPARQL abort 8s. 12키는 `web/` 전역 grep 0건.

| # | 키 | 이름 | 헌법 근거 | 훅 | 소스(실측) | 커서 | 출처 라벨 | 앵커 | TTL |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `dataTwin` | 삼라만상 데이터 트윈 | 68·208·557 | 이 존재를 데이터로 복제하면 몇 개의 속성이 필요할까? | Wikidata `wbgetentities`(63속성·sitelinks·P18/P373/P625) + 라벨 배치 50개 | `{chunk}` 6속성/페이지 | Wikidata | E | 24h |
| 2 | `causalHack` | 인과율 해킹 | 104·203·539 | 이것은 무엇 때문에 생겼고 무엇을 낳는가 — 원인의 원인까지 | SPARQL P828/P1542/P1536/P1537 정·역방향 → 2단계 구조 이웃 P279/P361/P527/P1269 inbound(공기는 인과 1건뿐이라 폴백 필수) | `{stage, hop≤3, offset}` | Wikidata | E | 24h |
| 3 | `valueCycle` | 탈희소성 가치 순환 | 121·561·659 | 이 지식은 어디서 흘러들고, 공짜로 되돌려주는 가치는 어디로 가는가? | Wikipedia `prop=linkshere`(상류)·`prop=links`(하류), en `redirects=1` | `{scope, lhcontinue, plcontinue}` 교대 | 위키피디아 ({lang}) | E | 24h |
| 4 | `omniWave` | 옴니웨이브 관심 파동 | 112·463·567 | 세계의 시선이 이 존재로 가속 중인가, 식는 중인가? | Wikimedia Pageviews per-article(글로벌 en + 국가 lang, 직렬) + top-per-country 교집합, 30점 스파크라인(scaleX) | `{end}` 30일씩 과거(2015-07 하한) | 위키미디어 페이지뷰 | E·P | 6h |
| 5 | `zeroPoint` | 제로베이스 진리 | 50·212·215·560 | 20개 언어가 한 문장으로 합의한 최소 진리, 그리고 이 낱말의 뿌리는? | Wikidata labels/descriptions/aliases(20로케일) + Wiktionary ko `extracts`(空氣/空器/公器 3어의)/en REST `definition`(품사 필터), QID-정렬 어의 첫 카드 | `{stage:'senses'\|'labels', offset}` | Wikidata · 윅셔너리 ({lang}) | E | 24h |
| 6 | `hologramField` | 초실감 홀로그램 시각장 | 18·132·564 | 글자 없이 이 존재를 본다면 — 누가 어떤 권리로 남겼는가 | Wikidata P18 → Commons `imageinfo`(라이선스·작가·해상도); 2페이지부터 Commons `generator=search "enTitle"` ns=6; P373 카테고리는 파일 있을 때만(실측 0건) | `{stage, gsroffset\|cmcontinue}` | 위키미디어 공용 + 라이선스 실명 | E·P | 24h |
| 7 | `evolutionArc` | 진화 가속 학술 궤적 | 20·230·551 | 이 주제의 연구는 언제 폭발했고 지금 어디로 가속 중인가? | OpenAlex `concepts?search`→`wikidata===QID` 정확일치 → `group_by=publication_year` 히스토그램 → `cursor=*`; `publication_year ≤ now+1` 필터 | `{conceptId, sort, cursor}` cited 4p → recent 무한 | OpenAlex | E | 24h |
| 8 | `ventureSignal` | 실시간 사업 발굴 | 162·243·369·438·578 | 지금 이 순간 누군가 이 주제로 무엇을 출시하고 있는가? | HN Algolia `search_by_date` tags=show_hn + `search` points>50, `"enTitle"` 구문(CJK 0건 실측); 블루오션 지수 = 출시/논의 | `{leg, page, nbPages}` | Hacker News (Algolia) | E(P31 ∉ 사람·작품) | 1h |
| 9 | `marketMoat` | 시장 해자 | 129·162·315·435 | 누가 이미 벽을 쌓았고 어느 나라가 비어 있는가? | SPARQL entity `(P452\|P1056)/P279*→QID` + GROUP BY 국가; place `P159=place.qid ; P452`(**`P31/P279*` 전이 금지** — 25s 타임아웃 실측); 선택 국가 0 → '공백 시장' 배지 | `{mode:'industry'\|'hq', offset}` | Wikidata | E·P | 24h |
| 10 | `timeFlux` | 타임플럭스 시공간 기후 | 4·66·136·227 | 오늘 이 하늘은 30년 전 같은 날과 얼마나 달랐고, 2050년 같은 날은? | Open-Meteo archive(1940~) + climate 7모델 **앙상블 중앙값**(EC_Earth3P_HR는 2050 null 실측) | `{mode:'past'\|'future', year}` 1·5·10년 → 10년씩 → 2030/40/50 | Open-Meteo Historical · Climate (CMIP6) | P | 24h/7d |
| R1 | `fractalDim` | 다차원 프랙탈 | 131·533·726 | 같은 분류의 형제 개념들 — 한 차원 위로, 다시 아래로 | Wikipedia `prop=categories` → `categorymembers`; 분류 0 → `morelike:<정확 제목>` | `{catIndex, cmcontinue, depth≤2}` | 위키피디아 ({lang}) | E | 24h |
| R2 | `chronosGate` | 크로노스 게이트 | 84·136·241 | 이 지식은 언제, 누구 손에서 바뀌어 왔는가? | Wikipedia `prop=revisions` 최초(rvdir=newer)·최근 20(편집 속도·봇 비율·성장 배수); 임시/IP 계정 마스킹 | `{lang, rvcontinue}` | 위키피디아 ({lang}) | E·P | 6h |

예비 승격 규칙: 확정 테마가 PHASE 2 실측에서 탈락(정책 변경·429 지속)하면 R1 → R2 순. 예비 2종도 어댑터·i18n은 함께 구현하되 `hostDefaults`에서만 제외.

호스트별 기본 순서(`hostDefaults`, `maxThemes` 초과분 `+N` 칩): entity 호스트(slot-feed·slot-news·keyword-tier·ranking) = ventureSignal → causalHack → dataTwin → valueCycle → omniWave → evolutionArc → marketMoat → hologramField → zeroPoint; slot-weather(place, 도시 QID 있으면 entity 테마도 활성) = timeFlux → omniWave → hologramField → marketMoat(hq) → dataTwin → valueCycle → evolutionArc → ventureSignal. `report.constitution` 6축 재정렬: economy↑ ventureSignal/marketMoat, future↑ evolutionArc/timeFlux, logic↑ causalHack/dataTwin, art↑ hologramField, sovereign↑ valueCycle, security↑ marketMoat. 배제 P31(ventureSignal·marketMoat industry): Q5·Q11424·Q5398426·Q482994·Q7366·Q838948·Q7725634·Q95074.

이관 확장안(기각 안의 유용 부분, D-18): `nation` 슬롯에 '노마드 마진 지수'(PPP/CPI/실업률), `quake` 슬롯에 반경·시간역행 딥 커서.

### 3.4 컴포넌트·파일
- `components/home/ExploreDeeper.tsx`(client, 블록 + 테마 모달 호스트), `components/home/deeper/DeeperThemePage.tsx`(카드 렌더러·커서 페이지네이션), `lib/uai/deeperThemes.ts`(`DEEPER_THEMES` 15, `DeeperAnchor`, `themesFor`, `sourceNameOf`), `lib/uai/deeperAdapters/*.ts`(`load(anchor, ctx, cursor?) => DeeperPage`, `DiscoverySlot.load`와 동형), `lib/uai/useDeeperPage.ts`(큐 동시 2, Wikimedia 호스트 직렬 1.2s, LRU 120 + localStorage `unitas.deeper.v1` 6h(cosmicClock·entropyFlow 10분), AbortController, 지수 백오프 3회).
- props: `{ anchor: DeeperAnchor|null; host; locale; country; compact?; maxThemes?; parentLabelledBy; onThemeOpen? }`.
- DOM: `<section class="qw-deeper-block" data-explore-deeper data-anchor-kind data-host aria-labelledby>` → header(라벨 + 앵커 `공기 · Air`) → `<ul class="qw-deeper-themes" role="list">` 테마 버튼(`data-deeper-theme`, `--qw-deeper-accent`, 아이콘·제목·훅 2줄 클램프) → `<p class="qw-deeper-sources">` 실명 링크(`data-deeper-source`). 테마 페이지 = `Modal labelledBy="deeper-<key>-title" size="xl"` **부모 슬롯 Modal 서브트리 안**(L1-11) → `<article data-deeper-page>` → `data-deeper-scope="global"` → `"country"` → `[data-deeper-sentinel]`(IO) + `.qw-deeper-more` 폴백 버튼 → 테마 실명 출처.
- 히스토리: 테마 모달은 `modal:deeper-<key>-title` 1레이어 중첩(back 1회=테마, 2회=슬롯). 페이지네이션·fractalDim depth는 `history.push` 금지. `modalStack.ts` 코어 무변경.
- 배치(5곳): `DiscoveryCarousel.tsx:258` `</SectionShield>` 직후(날씨, **SectionShield 바깥 형제** + 자체 `SectionShield zone="explore-deeper"`) · `:355` NewsDeepModal DiscoveryLinks 교체(+`t('sources')` 정적 문구 삭제) · `:477` FeedDeepModal 교체(subject 폴백 `title`('공기') 경로 소멸 = L1-10 해소) · `HotShortcutResultModal.tsx:552` TierCard 키워드 블록 뒤(focused 티어, `compact`) · `RankingDeepModal` 하단.
- CSS(`quantum-white-rev19.css` §19 `.qw-discovery-link` 뒤, QW 스코프): `.qw-deeper-block { contain:content }`, 테마 그리드 3열(≤767px 1행 스냅 레일 156px), `.qw-deeper-theme` backdrop-filter 없음·transform/opacity만, `.qw-deeper-card { contain: layout paint; animation: qw-deeper-in .2s }`, `.qw-deeper-fact` dl 그리드 tabular-nums, 이미지 `aspect-ratio` 고정·lazy, reduced-motion 등록. 다크 라우트는 Tailwind 폴백.
- 실패 위계: 페이지 실패 → '다시 시도' 카드; 테마 첫 페이지 실패 → 실명 아웃바운드만; 앵커 null/disambiguation → 그리드 미노출.
- 계약 영속 원칙(WD-6): `deeper`는 스냅샷에 **영속하지 않고** 렌더 시 순수 함수 파생 → `SHORTCUT_CACHE_VERSION` 범프는 §2.2 사유로만.

### 3.5 i18n(`Rev21.deeper.*`, 약 131키)
공통 11(`label, anchorAria, sourcesLabel, scope.global, scope.country, more, end, retry, loading, chooseMeaning, noAnchor`) + 출처 14(실명, 번역 최소: `wikidata, wikipedia("Wikipedia ({lang})"), pageviews, commons, openalex, openlibrary, hn, usgs, worldbank, openMeteo, iss, googleSearch, googleNews, youtube`) + 테마 15 × `{title, hook, fields.f1..f6}`. 카피 금칙: ko '고지' 부재, '헌법/코덱스/특허' 영단어 회피, 주권→소버린·제국→네트워크.

### 3.6 테스트
`__tests__/uai/deeperThemes.test.ts`(15키 유일·전 체계 키 교집합 0·anchor 요구·`sourceNameOf`·커서 직렬화), `__tests__/uai/deeperAdapters.test.ts`(fetch 모킹 픽스처: Q7391292 claims/sitelinks, backlinks continue, pageviews 30일). E2E `rev21-explore-deeper.spec.js`: 날씨·피드·키워드 팝업 하단 `[data-explore-deeper]` 존재, 테마 클릭→`#deeper-dataTwin-title` + 스택 깊이 +1, 출처 텍스트 'Wikidata' 표시, `[data-deeper-scope="global"]`이 `country`보다 먼저.

---

## §4. 렌더링 무결성·성능(Low-Memory Armor)

### 4.1 §4A 언어 즉시 전환(무새로고침)
1. **F1 처방(1순위)** — `LanguageSwitcher.selectLocale`: `nextLocale===activeLocale`이면 `setOpen(false)`만; 아니면 `setOpen(false)`를 호출하지 않고 persist → `router.replace(pathname, { locale, scroll:false })`. `[locale]` 리마운트 언마운트 정리에서 레이어가 해제되며 그 시점엔 HistoryUpdater가 엔트리를 교체한 뒤라 `currentStack top !== token` → 무traverse. 하드닝: `modalStack.ts` `ModalLayerHandle.release({ traverse?: boolean })` + `useHistoryLayer(open, id, onBack, { traverseOnClose })` 옵션(코어 로직 무변경, 옵션 추가만) + 내비 락 `beginNavigation()/endNavigation()`(TRAVERSAL_TIMEOUT 600ms). 회귀 vitest `__tests__/history/releaseNoTraverse.test.ts`.
2. **F2 리마운트 착시** — `ComingSoonCinema` 초기 phase를 lazy initializer로: `documentElement.dataset.cinemaPhase==='released'`(이전 인스턴스 스탬프) **and** sessionStorage PHASE_KEY==='released'면 초기 `released`(커튼 무렌더, exit 없음), mount effect의 sealed 강등·persist 스탬프·이벤트를 그 경우 건너뜀(재검증은 백그라운드 유지). 힌트 없는 공개 방문자는 released 스탬프가 없어 fail-closed 유지. `WalletProvider`(next-intl 의존 없음)를 `app/layout.tsx` `SpatialAudioProvider` 내부로 승격(세션 재조회·코인뱃지 공백 제거).
3. **F3 스크롤 점프** — 5개 호출점(`LanguageSwitcher`·`GlobalLanguagePicker`·`LocaleAutoSwitch`·`ComingSoonCinema` 393/411) 모두 `{ scroll:false }` + 전환 마커 `sessionStorage 'unitas.localeSwitch.v1' = { scrollY, focused, typing, uaiQuery, towerOpen, at }` → `QuantumWhiteHome` `useLayoutEffect`에서 5s 이내 마커면 `scrollTo` 복원, `OmniSynapseSearch`/`useUai` 마운트에서 focused/typing/타워 복원(새 로케일로 재검색).
4. **F5 체감 지연** — 드롭다운 open 시 `router.prefetch(pathname, { locale })` 상위 5개; 'switching' 인디케이터(`Nav.switching` 20로케일); en 케이스 `forcePrefix` 회피 검토(장기).
5. **F6/F7 가설** — `LocaleAutoSwitch` 모듈 스코프 `appliedForUserId` + `readLocalePreference()===locale`이면 skip. F7은 F2로 흡수.
6. **F8 구조 위험** — `SingularityCoreGrid.tsx:78 replaceState(stripRouterKeys)`·`ClusterPopout` url 레이어는 내비 진행 중 실행 시 폐기 유발 → 내비 락 사용.
7. E2E `rev21-locale-switch.spec.js`: 내비 드롭다운 선택 후 popstate 미발생·`page.url()`=/ja·`html[lang]`=ja·scrollY 보존·L1 팝업 유지·`performance.getEntriesByType('navigation').length===1`·로케일 핀 'ko' 상태에서 'en' 선택 시 재바운스 없음.

### 4.2 §4B 새로고침 무결성
1. **R-1 선각인** — `installPrompt.ts` PWA_CAPTURE_BOOTSTRAP(ES5, `=>`/let/const 금지)에 `data-cinema-phase=<p>` 선각인(in-place phase) + `p==='released' && 힌트쿠키 && 홈경로(routing.locales 주입)`이면 `data-unitas-surface='quantum-white'` + `data-cinema-restore='released'`. CSS: `html[data-cinema-phase]:not([data-cinema-phase='gate']) .cs-gate { display:none }`, `html[data-cinema-phase='released'] .cs-picker { display:none }`(피커 래퍼에 `cs-picker` 클래스), `html[data-cinema-restore='released'] .cs-root { background: var(--qw-bg) }`(**불투명 유지 = fail-closed 불변**; sealed 강등 시 React가 `cinemaRestore` 삭제). **보안 불변식**: 선각인 값은 게이트/피커 억제·void 색만 제어하고 커튼 표시 여부는 계속 React+서버 검증이 결정 → vitest CSS 문자열 검사 + E2E(힌트 쿠키 없이 sessionStorage 'released' 주입 → `.cs-root` 불투명 유지).
2. **R-2 게이트 유령** — `restoredRef`(layout effect에서 saved phase 존재 시 true): 게이트 `exit={restoredRef.current ? undefined : {...}}`, cinema/sealed fade-in `initial={false}`. phase 복원 읽기를 `useIsomorphicLayoutEffect`로(AudioGate 패턴).
3. **R-3 void 색** — 위 CSS + `foundersGate.verify`를 부트스트랩에서 프리워밍(`window.__unitasVerify` 프로미스 채택, RTT를 하이드레이션과 병렬화).
4. **R-4 입력창 하이드레이션** — `OmniSynapseSearch.tsx:153-160` `useState('')` + `useIsomorphicLayoutEffect`에서 sessionStorage 복원(`SpatialAudioProvider` 패턴). 신규 컴포넌트 규칙: 초기 DOM에 Date/난수/스토리지 값 금지(R-5).
5. **R-6 스크롤** — `QuantumVoid` passive scroll 핸들러에서 `sessionStorage 'unitas.qw.scroll.v1'` 스로틀 기록 + pagehide; `QuantumWhiteHome` released layout effect에서 `|scrollY-saved|>1`이면 `scrollTo({top, behavior:'instant'})` 1회(해시 딥링크 우선). `scrollRestoration='manual'` 금지. 로케일 복원 replace는 `navigation.type==='reload'`면 scroll 재적용.
6. **R-7/R-8 광고** — `CINEMA_ELAPSED_STORAGE_KEY` 500ms 스로틀 기록 → 복원 시 경과 시간 우선(세그먼트 폴백 유지); 앰비언트 엔진 effect 첫 줄 `if (voidPlaceholder) return`.
7. E2E `rev21-refresh-integrity.spec.js`: reload `waitUntil:'commit'` 직후 `dataset.cinemaPhase/unitasSurface` 존재, `.cs-gate` display none, 1×1 픽셀 샘플 0/100/300ms 흰색, `.cs-root` 0건까지 ≤700ms, scrollY 900 보존, `input.value`=저장 질의, cinema F5 elapsed ±0.5s. vitest `installPromptBootstrap.test.ts` 스탬프 케이스(홈/다크 라우트/힌트 유무/4 phase).

### 4.3 §4C GPU 전개 — "한 겹 원칙"
| 순위 | 항목 | 처방 |
|---|---|---|
| 1 | L1 `height:auto` × backdrop × 클러스터 blur | §1.6 + `QuantumWhiteHome.tsx:179-187` Ouroboros dim에서 `filter` 키 제거(opacity .35 + scale .985만, CSS `.qw-core-dim[data-dim='1']`), `SingularityCoreGrid` 카드 `backdrop-blur-md` 삭제 |
| 2 | backdrop-filter 6~8겹 | `--qw-modal-blur`를 백드롭 전용으로 격하: `.glow-box`(403-410)·타워 패널(502-508)·`.qw-search-dropdown`·`.qw-keyword-panel`·`.qw-footer`·클러스터 카드에서 `backdrop-filter` 삭제 → 배경 0.94~0.97 불투명 + box-shadow 유지. `DialogTower` 외부 motion.div opacity 애니메이션 제거(백드롭 div에만), `UaiDashboard/UaiHyperStream` 루트 `backdrop-blur-xl` 삭제. 남는 레이어: 내비 18px + 뷰포트 고정 백드롭 1개. 모바일 `--qw-modal-blur: blur(14px)`, `--qw-nav-blur: blur(10px)`. 다크 루트 Tailwind 클래스는 유지, QW 스코프 `backdrop-filter:none` 오버라이드 |
| 3 | 상시 keyframe 6종 | 전부 '두 레이어 opacity 크로스페이드'로: 타이틀 `.qw-title-glow` 복제 span(absolute, pointer-events none) opacity 6s; 밑줄 sheen `h1::before` translateX; 검색바 ring `::before` translateX(focus 시만 4s); CTA `::after` 링 opacity; enter-flux `filter: hue-rotate` + scale; `.logo-hologram::before` will-change 상시 삭제. 전역 정지 게이트 `html[data-ouroboros='1']`·`data-page-hidden`에서 `animation-play-state: paused` |
| 4 | `DraggableCarouselRow` 4 rAF | §1.2 스냅 스크롤러로 교체(rAF 루프·2배 복제 삭제) |
| 5 | 캐러셀 7초 회전 | `scrollTo` 교체·`min-height`·`document.hidden` 가드·`memo(SlotChip)`·크로스페이드 |
| 6 | Modal/Tower 스프링 | 패널 backdrop 제거로 순수 transform, `onAnimationStart/Complete` will-change 토글, `.qw-popout-panel max-width` 트랜지션 삭제, `DialogTower` body overflow 잠금 → 백드롭 `overscroll-behavior:none; overflow:hidden` |
| 7 | QuantumVoid pool blur(60px) | radial-gradient 스톱(0/35%/70%)으로 필터 제거, `.qw-void { contain:paint }`, 워터마크 mix-blend normal |
| 8 | 모바일 | `app/layout.tsx viewport`에 `viewportFit:'cover'`(+`width:'device-width', initialScale:1`), `.u-hscroll` 유틸, `@supports not (backdrop-filter)` 폴백 확장, popout `100dvh`→`100svh` |

검증(PHASE 2 게이트): E2E `rev21-perf.spec.js` — `page.tracing`/CDP `Performance.getMetrics`로 (a) 포커스→스트립 전개 long task(>16ms) 수 (b) Enter→타워 스프링 (c) idle 5초 `LayoutCount/RecalcStyleCount` 증가율 0 수렴. 합격 기준: 프레임 간격 p95 ≤ 16.7ms(모바일 에뮬 CPU 4x throttle에서 p95 ≤ 33ms), CLS 0. REV-20 hero 대칭 0.02px·키워드 폭 0px 회귀 스펙 재실행.

---

## §5. 입력창 · 인피니티 검색엔진

### 5.1 §5A 통합 액션 박스(스플릿 버튼 + 메뉴)
**설계 결정**: '클릭마다 아이콘 순환' 방식은 예측 불가·스크린리더 비호환으로 기각. 롤링은 **표시 전용**.
```html
<div class="qw-omni-key" role="group" aria-label={t('omniKeyAria')}>
  <button type="submit" class="qw-enter-key …">⏎</button>                       <!-- 클래스·disabled 조건·CornerDownLeft 그대로 = E2E 무수정 -->
  <button type="button" class="qw-attach-toggle" aria-haspopup="menu" aria-expanded aria-controls="omni-attach-menu" aria-label={t('attachMenuAria')}>
    <span class="qw-attach-roll" aria-hidden><!-- Paperclip/Video/PenTool 3개를 1아이콘 높이로 클립, translateY 2.4s 순환(reduced-motion 정지) --></span>
    <span class="qw-attach-badge" aria-live="polite" data-attach-badge>{n}</span>  <!-- 0이면 hidden -->
  </button>
  <div id="omni-attach-menu" role="menu" hidden={!attachOpen}>
    <button role="menuitem">파일</button>   <!-- fileInputRef.current?.click() 동기 호출(iOS 제스처 스택) -->
    <button role="menuitem">동영상</button> <!-- videoInputRef -->
    <button role="menuitem">스케치</button> <!-- setDrawOpen(true) -->
  </div>
</div>
```
- 숨은 `<input type=file>` 2개(668-683)·드래그앤드롭·attachError·첨부 칩 무변경. 라벨은 기존 `attachImageAria/attachVideoAria/attachCanvasAria` 재사용, 신규 키 `OmniSynapse.omniKeyAria`, `OmniSynapse.attachMenuAria`(20로케일).
- 팝오버는 `.qw-search-wrap` 내부 absolute(`right: var(--qw-search-inset)`), `onMouseDown preventDefault`(포커스 유지), Escape/외부 클릭/`handleRootBlur`로 닫힘, ↑↓ 포커스, 모바일 44px 히트. 히스토리 레이어 불필요(비모달).
- CSS: `quantum-white-rev19.css` §14 옆 `.qw-omni-key/.qw-attach-toggle/.qw-attach-roll/.qw-attach-badge/#omni-attach-menu` 전용 규칙(클래스명 리맵 `.text-gray-600/.hover:text-neon` 의존 제거). E2E `rev19-search-back.spec.js:102-121` 계약 보존 + 신규 `rev21-composer-button.spec.js`.

### 5.2 §5B '이어서 탐색' 영구 삭제 + 문맥 일치 무한 키워드
**삭제 체크리스트(의존 테스트 0건 확인)**: `OmniSynapseSearch.tsx:883-911` 섹션, `:168/:203-218/:553` 상태·호출, `:29 History`·`:47-50` import; `lib/uai/discovery.ts:9-10, 51-80`(`risingSeeds/pickCuriosityCards` 유지); 마운트 1회 `localStorage.removeItem('unitas.search.recent.v1')`(프라이버시 정리); i18n `Rev19.search.recent/clearRecent`를 messages 20파일 + `docs/rev19/i18n` 20드래프트에서 **동시 삭제**(B안) 후 `node scripts/i18n/apply-rev19.mjs --check` DRIFT 0; `docs/rev20/SPEC.md:297` 각주 갱신. L2 빈 상태 'Rising now'는 최근 검색어가 아니므로 유지.

**매처 처방(SI-1)**:
- `lib/hangul.ts` `progressiveMatch(query, target, { mode: 'prefix'|'word'|'anywhere' })`(기본 anywhere → 타 호출처·하이라이트 무영향), lone 초성은 쿼리 길이 ≤2일 때 접두 위치만. `hangul.test.ts:39`('사'→'부동산 사기'@2)는 anywhere 케이스로 유지 + prefix 케이스 추가.
- `lib/uai/liveSearchIndex.ts searchLiveIndex`: (a) 제목 = `start===0` 또는 단어 경계(공백/·/괄호 뒤)만; (b) **설명문 티어 삭제**; (c) alias는 영문 key 대신 로케일 명시 동의어(`messages RealEstate.axes.rental.aliases "월세|전세|임차"` 등 필요 축만)로 접두 일치; (d) 점수 접두 > 단어경계 > 동의어. 신규 `__tests__/uai/liveSearchIndex.test.ts`: `'사'`→매칭·관계·영화 미포함, `'임'`→임대 포함, 문맥 일치만.
- **스테일 병합(SI-2)**: 웹 서제스트 상태를 `{ query, list }`로 저장, 병합 시 `webSuggestions.query===query`일 때만; effect 진입 즉시 초기화. 스켈레톤 1행.

**무한 연관 키워드(SI-5)** — 신규 `lib/uai/suggestLadder.ts`(순수): `SuggestCursor { gps?; wd?; morelike?: { title; sroffset } }`, `recipeFor(page)`: p0 = 로컬 접두 + prefixsearch(0..7); p1 = prefixsearch `gpsoffset=8` + `wbsearchentities type=item`(`match.type==='label'` && 접두, description 동반); p2 = `morelike:<p0 1위 제목>` + wd continue 8; p3+ 라운드로빈, 3레그 연속 빈 결과면 종료 배지. 정규화 제목 Set dedupe, 동음이의어 문서 제외, 순위 = 접두 일치 길이 → 소스(로컬>prefixsearch>wikidata>morelike). 깊은 페이지는 '연관 주제' 라벨로 구분. UI: `<ul role="listbox">` 끝 `<li data-sentinel>` + IO(root=드롭다운, rootMargin 120px), 동시 요청 1, 쿼리 변경 시 abort+리셋. 캐시 `liveSuggest.ts` LRU 키 `${lang}::${q}::p${n}`(120→240) + localStorage `unitas.uai.suggest.v1` 24h. 실측: prefixsearch continue=16, wbsearchentities search-continue=16, morelike 6건 OK; opensearch는 오프셋 없음(미사용).

### 5.3 §5C 인피니티 스트림(최종 검색 결과 팝업) — 완전 신규
**보존 앵커(불변)**: `DialogTower variant="fullscreen"` 호출부(941-961) 무변경 — `title 'U-AI SEARCH RESULT'`, `titleId 'uai-search-result-title'`, `historyMarker 'unitasUaiSearchTower'`, `data-fullscreen-tower-open`. E2E `rev20-fullscreen-nav.spec.js` 그대로 통과.

1. **상태 분리(SR-2)** — `useUai`에 `submittedQuery: string|null` + `openStream(q)/closeStream()` 추가(반환 객체 노출). `runSurface`에서 `setSubmittedQuery(trimmed)`. `handleChange:547`의 `uai.reset()` **제거**(타워 닫힘/홈 버튼에서만 reset). 스트림은 `key={submittedQuery}`. `runFollowupQuery`는 reset 없이 새 submittedQuery로 스트림 교체(스택 push 없음). `browsing/suggestActive`의 `phase==='idle'` 조건은 유지. `submittedQuery`는 sessionStorage 영속(로케일 리마운트 복원).
2. **스크롤 루트(SR-3)** — `OmniSynapseSearch.tsx:962` div에 `ref={streamScrollRef}` → `UaiHyperStream scrollRoot`. 센티널 `[data-stream-sentinel]`은 그 div 마지막 자식, `IntersectionObserver(cb, { root: scrollRootEl, rootMargin: '0px 0px 600px 0px' })`. 페이지 전진 시 scrollTop 유지(재마운트 금지).
3. **컴포넌트** — `components/uai/UaiHyperStream.tsx`(+ `components/uai/stream/*Card.tsx`)가 `963-1041`(UaiDashboard split + 시그널/호기심)을 대체. `<SovereignShield zone="uai-stream" resetKeys={[submittedQuery]}>` + 카드 단위 `SectionShield zone="uai-stream:<kind>"`(1장 실패 → '다시 시도' 카드).
4. **데이터 사다리** — `lib/uai/dataLadder.ts`(순수): `LadderCursor { wikiExtract(gsroffset), wikiLinks(plcontinue), wikidata(continue), hn(page), openAlex(page), openLibrary(page), news(axis page 0..13) }`, `recipeFor(page)`, `foldPage`, `isThin`, `shuffleForPage(hash(query,page))`. 모든 레그는 **§2.2 앵커(qid/enTitle)** 를 커서에 실어 호출(원문 CJK를 영문 엔진에 던지는 경로 0). `webSynthesisCore` 레그 함수 export(`wikiSearch/wikiGeneratorExtracts(+gsroffset)/ddgSearch` + 신규 `wikiLinks/wikidataSearch`). 뉴스 레그 = `/api/live/axis-news?axis=<classifyNews(query)>&page=n`(유일한 실동작 페이지네이션 소스). `useHyperStream.ts`: 페이지 큐 직렬(동시 2), Wikimedia ≤2/페이지, 백오프 1.2·2.4·4.8s 3회, localStorage `unitas.uai.ladder.v1` LRU 120(**DB 무변경**, D-9).
5. **카드 순서(페이지 레시피)** — p1(0원, `loadShortcutAnalysis` CDN 스냅샷 즉시): ① 본질 의미(로케일 위키 요약 + zeroPoint 정의 + 앵커 `공기 · Air · Q7391292`) ② 6축 헌법 해체(`GET /api/u-ai/trend` cr-v1 읽기 전용, **POST 금지**) ③ 실명 출처(`sourceNameOf`) ④ 질문 사슬(`deriveKeywords` + followups) ⑤ COGS 매트릭스 카드 1장. p2+: 연관 사이트(위키 links/backlinks, DDG A-type) · 파생 정보(HN·OpenAlex·OpenLibrary 구문검색) · 숫자 하나(pageviews/World Bank) · 반대 관점(backlinks 상위) · 시간선(revisions) · 뉴스(axis page) · COGS 카드(군 회전) · 유료 딥 리포트 CTA(쿼리당 1장, p1 하단 고정) · 종료 없음(3연속 thin이면 '다시 시도'/'주제 확장' 카드).
6. **COGS 매트릭스(SR-8)** — 신규 `lib/uai/cogsMatrix.ts`(순수·결정론): 7군(근원적기반 40/원소역할 45/지성문명 70/우주 아키텍처 40/시공간 활률 45/의식진화 40/넥서스확장 50) 키 배열 각인(라벨 `Rev21.cogs.*`), `cogsCardsFor(query, page, constitution: ConstitutionScore[])`가 `hash(query,page)`로 군별 1항목을 뽑아 6축 점수와 교차한 '다차원 테마 카드' 반환. LLM 레그 없음(초절대마진, D-8).
7. **CSS** — `quantum-white-rev19.css` §19 `.qw-stream-card/.qw-stream-spine/.qw-stream-sentinel`(QW 스코프, 라이트 토큰) + 다크 폴백(이미 리맵된 `.glow-box + bg-void/50` 조합). 진입 애니메이션 transform/opacity만, `contain: layout paint`, 이미지 `aspect-ratio`.
8. **/u-ai 페이지(D-10)** — `UaiWorkspace`도 `UaiHyperStream`으로 교체(두 결과 화면 분기 방지). `UnitasModuleRankings` 타워 내 마운트는 '유니타스 랭킹 스냅샷' 카드 1장으로 흡수.
9. **플래그** — `NEXT_PUBLIC_UAI_WEB_SYNTHESIS` off면 SPEC §6.4 폴백(로컬 인덱스→cr-v1→호기심→네트워크 없음 카드) 필수 렌더. PHASE 2 착수 전 `vercel env ls`로 프로덕션 값 확인.
10. 테스트: `__tests__/uai/dataLadder.test.ts`(recipe·fold·dedupe·thin·shuffle 결정론), `cogsMatrix.test.ts`(7군 항목 수·해시 결정론·키 유일), E2E `rev21-hyper-stream.spec.js`(Enter 후 섹션 존재, 바닥 스크롤 시 카드 수 증가, 입력 편집 시 타워 생존, 출처 실명 라벨, `#uai-search-result-title` 유지).

---

## §6. 푸터

### 6.1 §6A 라우팅 결함
1. **F-1(확정)** — 신규 `components/layout/SurfaceScope.tsx`(client, `useLayoutEffect`로 `data-unitas-surface` 스탬프, `QuantumWhiteHome.tsx:88-93` 로직 추출·공유) + 신규 `components/layout/SiteArticle.tsx`(모달·라우트 공용 QW 글래스 아티클: eyebrow/title/lede/sections/highlights/sources/disclaimer/updated). `renderSitePage.tsx:29-37`이 `<SurfaceScope><SiteArticle/></SurfaceScope>` 렌더, `SitePage.tsx` **폐기**. 라우트 본문은 포털이 아니므로 `.qw-site-article*` 전용 규칙을 §15 옆 신설. `rev15FixedLayerGuard.test.ts` 통과 확인(body filter 함정). `openFull` 링크 유지(QW 라우트, D-11).
2. **F-2(유력)** — `app/layout.tsx` head `SITE_LINK_BOOTSTRAP`(ES5 인라인 + TS 이중 유지): capture click 리스너가 `a[data-site-link]`(수정키/중클릭 제외) preventDefault → `window.__unitasPendingSitePage={group,slug}` 큐 → `SiteLinkModalHost` 마운트 시 소비(`parseSitePageHref` 재사용). ExitGuard 활성화 제스처 카운팅과 충돌 검증.
3. **F-7** — `SiteLinkModalHost` `unitas.sitePage.open.v1` sessionStorage 영속(로케일 전환 시 모달 생존).
4. **F-6** — `X-Unitas-License` 헤더 `/legal#license` → `/legal/terms` 정정(인덱스 허브 신설은 보류).
5. **F-11 읽기 창(D-12: 안A)** — Modal xl 유지, 본문 `max-h: min(72dvh, …)`, 섹션 목차 스티키 헤더, 모바일 16px 거터·본문 15px/1.7. `#site-page-title`·`data-site-page`·`data-site-link` 셀렉터 유지(E2E 계약).
6. E2E `rev21-footer-links.spec.js`: 12링크 전부 순회 → URL 불변·`#site-page-title` 가시·`#exit-guard-title` 0; 프리하이드레이션 케이스(`page.route`로 JS 지연 후 첫 클릭) → 모달 또는 QW 라우트(다크 아님: `html[data-unitas-surface]` 존재). `rev19-hero-geometry.spec.js:94-106` 푸터 색 리터럴 재디자인 시 갱신.

### 6.2 §6B 콘텐츠 확장
- **스키마**: `SitePages.<slug> = { title, lede, sections: [{ heading, paragraphs: string[] }], highlights?: string[], updated: string }`(기존 `body[]`는 `sections[0]`으로 승격). 12 slug × 5~8섹션. `DISCLAIMER_SLUGS` legal 6 유지 + company/support에 `common.corporateNotice`(비법적 안내).
- **집필 원칙**: 경영지침 제1장(소버린 SaaS 철학·자율 팩토리 임대·Micro-Burn 마진 게이트)·제3장(연산 매트릭스)·제4장(로우메모리 아머·VibeSec)·제7장(옴니채널·인스턴트 싱크)·제11장(Wise/Xolo 재정)·제13/14장(인앱 무결성·오프라인 결정론)을 **대외 표현으로 번안**. 금칙: 기밀(토큰·키·내부 경로·수치 마진), 'patent pending' 유지 + 등록번호·주소·인증 주장 금지(sitePages.ts:12-15), ko '고지' 0건(rev19Parity 파일 전체 스캔), 'constitution/codex/doctrine/USPTO' 영단어 회피, 주권→소버린·제국→네트워크·"바로 입장"→"시작", `Footer.legal='법률 안내'` 고정. 준거법 에스토니아, 코인='선불 접근 크레딧, 증권·저장가치 아님', 'as is', 전화 지원 없음 유지.
- **페이지별 골자**(en·ko 정본 직접 집필 → 18로케일 병렬 번역 에이전트, '배열 길이 보존' 지시): about(사명·소버린 SaaS·1인 창립·자율 팩토리·글로벌 노마드·에스토니아 법인) · careers(에이전트 협업 문화·원격·기여 경로) · press(브랜드 사용 원칙·연락 채널) · patent-notice(가출원 상태·보호 대상 아키텍처 개요·침해 신고) · compliance(GDPR/에스토니아 준거·데이터 최소화·감사 로그) · security(제로 트러스트·양자 내성 설계 방향·취약점 신고·오토 쿼런틴) · privacy(수집 항목·목적·보관·권리·쿠키 연계) · cookies(필수/선호/분석 분류·제어) · terms(계정·U-COIN 크레딧 성격·환불·금지 행위·책임 제한·준거법) · help-center(시작하기·검색/숏컷 사용법·언어·PWA 설치·문제 해결) · contact(이메일 채널·응답 시간·법인 정보 표기 범위) · system-status(가동 원칙·장애 공지 방식·오프라인 결정론 동기화).
- **파이프라인(F-10)**: 신규 `scripts/i18n/apply-rev21.mjs`는 중첩 JSON(배열 포함) 수용 + en과 '구조 서명'(키 집합 + 배열 길이 + ICU 토큰) 비교, 불일치 시 en 폴백 + `FALLBACK` 노트, `--check` 모드. 대상 네임스페이스: `Rev21`, `SitePages`, `Footer`(변경분), `OmniSynapse`(신규 2키), `Nav`(switching). 신규 `__tests__/i18n/rev21SitePagesParity.test.ts`(20로케일 slug 12 + sections/paragraphs 길이 동일 + 빈 문자열 0 + ko '고지' 0 + 금지어 정규식). SEO: `sitePageMetadata`에 description/OG.

---

## §7. i18n 파이프라인(REV-21)
- 드래프트 `docs/rev21/i18n/{en,ko,et,ja,zh,es,km,fr,de,pt,vi,id,ru,hi,it,tr,th,pl,nl,tl}.json`. `Rev21` 네임스페이스(플랫 dot-path): `deeper.*`(~131) + `slots.worldRanking/unitasRanking.{title,tag}` + `slots.library.subjects[]`/`art.terms[]` + `stream.*`(카드 라벨·재시도·종료·유료 CTA) + `cogs.*`(7군 라벨) + `sourceOrigin.*`. `SitePages`는 중첩 구조 별도 섹션.
- 절차: write → 콘솔 `FALLBACK(en)` 0 확인 → `--check` 0 DRIFT → `cd web; npx vitest run` → typecheck → build. **Rev20 네임스페이스 무접촉**(74키 고정).
- 테스트: `rev21Parity.test.ts`(it.each(routing.locales) 정확 키셋·ICU·비공백, 대상 네임스페이스 배열), `rev21TranslationDrift.test.ts`(en 제외 19로케일 동일 비율 <5%, apply의 en 폴백 검출), `rev21SitePagesParity.test.ts`.
- 함정: PowerShell `Out-File`/`>` BOM → JSON.parse 실패(Write 툴 또는 `WriteAllText` no-BOM), 드래프트 한 키 누락 시 로케일 전체 en 폴백(콘솔 노트만).

---

## §8. 테스트·게이트 계획

### 8.1 갱신되는 기존 단언
| 파일 | 변경 |
|---|---|
| `__tests__/live/discoverySlots.test.ts` | 22→24, ranking kind 2, feed 12 불변 |
| `__tests__/live/hubThemes.test.ts:42-60` | 글로벌 선두 레그, discoveryLinks kinds 확장 |
| `__tests__/live/axisNews.test.ts:90,122-126` | 병합 순서 글로벌 선두 |
| `__tests__/search/hangul.test.ts` | prefix 모드 케이스 추가(anywhere 케이스 유지) |
| `__tests__/i18n/rev19Parity.test.ts` | `search.recent/clearRecent` 삭제 반영(20로케일 동시) |
| `__tests__/uai/shortcutCache.test.ts` | fakeWeb lang/origin, version `sc-v2` |
| `tests/web-cinema-e2e/rev19-back-stack.spec.js:84-157` | 랭킹 슬롯 경로·카드 전체 히트박스·뉴스 직행 |
| `rev19-search-back.spec.js:53-64,102-121` | recent 0건, `.qw-enter-key` 계약 유지 |
| `rev19-hero-geometry.spec.js:94-106` | 푸터 색(재디자인 시) |
| `rev19-legal-modal.spec.js` | 유지(앵커 보존) |

### 8.2 신규 vitest
`interaction/railDrag` · `live/contextPriority` · `live/slotContext` · `uai/entityResolve` · `uai/liveSearchIndex` · `uai/suggestLadder` · `uai/dataLadder` · `uai/cogsMatrix` · `uai/deeperThemes` · `uai/deeperAdapters` · `history/releaseNoTraverse` · `i18n/rev21Parity` · `i18n/rev21TranslationDrift` · `i18n/rev21SitePagesParity` · `pwa/installPromptBootstrap`(스탬프 케이스).

### 8.3 신규 E2E(`tests/web-cinema-e2e/`)
`rev21-rail-drag` · `rev21-unified-slots` · `rev21-composer-button` · `rev21-hyper-stream` · `rev21-explore-deeper` · `rev21-locale-switch` · `rev21-refresh-integrity` · `rev21-footer-links` · `rev21-perf`. 보일러플레이트는 `rev19-search-back.spec.js:9-41`(reachHome·TOKEN·webkit slow). 규칙: 스택 깊이 이내 goBack, 각 단계 `#exit-guard-title` 0, `.event-horizon-btn` `.last()`, 캐러셀은 `[data-slot=…]` 칩으로 핀.

### 8.4 PHASE 2 착수 직후 실측 프로브(5건, `next start :3123`)
1. F1 확정: DevTools `history.go` 무력화 후 언어 선택 → 즉시 전환되면 확정; 게이트 `GlobalLanguagePicker` vs 내비 드롭다운 차등.
2. 스크롤: reachHome → `scrollTo(0,900)` → reload → load 직후·릴리즈 직후 scrollY(데스크톱/모바일).
3. L1-11: 날씨 모달 도시 입력 클릭 후 300ms `[data-live-hub]` 가시성.
4. L1-10: ko air 딥 모달 위키 링크 URL.
5. 성능 baseline: 스트립 전개·타워 스프링 trace(모바일 에뮬 4x throttle) → §4.3 합격선 보정.

### 8.5 게이트 순서·함정
① `npm --prefix web run typecheck`(~30s) → ② `node scripts/i18n/apply-rev21.mjs`(write) → `--check` → ③ `cd web; npx vitest run`(~70s) → ④ `npm --prefix web run build`(~3.5~4분, prebuild sync-codex/validate-module-registry/pwa-cache-bust, postbuild ownership-manifest 2줄) → ⑤ E2E chromium → mobile-chrome → webkit(플레이크 이력). 함정: 고아 `next dev`/3123 점유(`reuseExistingServer:true` 구버전 서빙), 루트 `npx playwright test`는 레거시 config(반드시 `--config=tests/web-cinema.config.js`), `app/[locale]` 최상위 폴더 추가 시 `INFRA_ROUTES` 등록, vitest는 `cd web` 후 실행.

---

## §9. 구현 순서(모듈별 브리핑 포인트)
| 단계 | 모듈 | 산출물 | 브리핑 |
|---|---|---|---|
| M1 | §5B 매처·스테일 병합·'이어서 탐색' 삭제 | hangul/liveSearchIndex/OmniSynapseSearch/discovery + i18n 40파일 + 테스트 | 설계 |
| M2 | §2A 순서·컨텍스트·로케일 키 캐시 | slotContext/contextPriority + 라우트 3곳 + cardCache | API |
| M3 | §2B entityResolve + webSynthesisCore 재구성 + 캐시 버전 범프 | entityResolve/webSynthesisCore/shortcutCore/types + 크론 grounding | API·캐시(범프 = 재합성 비용) |
| M4 | §1 슬롯 계약 확장·랭킹 슬롯·카드 히트박스·드래그·1차 팝업 통일·GPU 전개 | discoverySlots/DiscoveryCarousel/HotShortcutMatrixStrip/useDragScroll/HotIssueNewsList/DraggableCarouselRow + CSS §19 | 디자인 |
| M5 | §3 ExploreDeeper 15테마 + Rev21 i18n 1차 | deeperThemes/adapters/ExploreDeeper + apply-rev21 + parity | 디자인·API |
| M6 | §4A 로케일 전환 + §4B 새로고침 + §4C 한 겹 원칙 | LanguageSwitcher/modalStack 옵션/ComingSoonCinema/installPrompt/CSS 전면 | 디자인(void 흰색·글래스 정책) |
| M7 | §5A 액션 박스 + §5B 무한 키워드 사다리 | OmniSynapseSearch/suggestLadder/liveSuggest + CSS §14 | 디자인 |
| M8 | §5C UaiHyperStream + dataLadder + cogsMatrix | useUai/UaiHyperStream/dataLadder/cogsMatrix/UaiWorkspace | 디자인·API |
| M9 | §6 SurfaceScope/SiteArticle/부트스트랩 + 12페이지 en·ko 집필 + 18로케일 번역 | layout/*, messages SitePages, apply-rev21 중첩 | 디자인·콘텐츠 |
| M10 | 게이트 전수 + E2E + 실측 보정 | typecheck·vitest·build EXIT 0·Playwright | 완결 보고 |

DB 변경: **없음**(D-9). 마이그레이션 0건.

---

## §10. 창립자 결정 사항(권장안으로 즉시 진행, 이의 시 되돌림)
| # | 사안 | 권장(적용) |
|---|---|---|
| D-1 | 랭킹 편입 단위 | 슬롯 2개 + 카드 내 서브탭 |
| D-2 | '실시간 뉴스' 처리 | 캐러셀 아래 독립 행 존치, 드래그·히트박스·칩 통일(기사 클릭 = 직행) |
| D-3 | 통합 버튼 형태 | 스플릿 버튼(⏎ + 첨부 토글 메뉴), 롤링 아이콘 표시 전용 |
| D-4 | '이어서 탐색' i18n 키 | 20로케일 + 20드래프트 동시 삭제(B안) |
| D-5 | 복원 void 색 | 흰색(`--qw-bg`), 불투명·fail-closed 유지 |
| D-6 | 글래스모피즘 정책 | backdrop-filter 한 겹(내비 + 뷰포트 백드롭 1개), 패널은 불투명 0.94~0.97 + box-shadow |
| D-7 | 캐시 버전 범프 | `sc-v2`·websynth `v4` 즉시, 배포 후 수동 refresh 워밍업 1회 |
| D-8 | genesis_memory cr-v1 무효화 | 하지 않음(COGS 카드는 결정론, LLM 레그 없음) |
| D-9 | 스트림 페이지 캐시 DB 영속 | 하지 않음(CDN + localStorage), 마이그레이션 0 |
| D-10 | /u-ai 페이지 | 동일 `UaiHyperStream` 사용 |
| D-11 | openFull 링크 | 유지(QW 라우트) |
| D-12 | 푸터 읽기 표면 | Modal xl 확장(안A) |
| D-13 | viewportFit cover | 포함(REV-14/15 svh E2E 재실행) |
| D-14 | 캐러셀 물리 | 스냅 스크롤러(B안), 자동 드리프트 폐기 |
| D-15 | Wayback(시간역행) | 보류(CORS 부재·429), Wikipedia 최초 판본만 |
| D-16 | 15테마 노출 상한 | desktop 8 / mobile 6, 호스트별 우선순위 표 |
| D-17 | ISS 15초 폴링 | 모달 열림 중 허용(0.3KB/15s, hidden 시 정지) |

---

## §11. 리스크
- **캐시 범프 재합성 비용**: 시드 600 + 사다리 200건이 크론 예산(50s/런, 동시 6)으로 며칠 소요 → 미스 티어는 방문 시 인라인 합성(~5s). 수동 워밍업으로 en·ko 우선 회복.
- **F1 미재현 가능성**: 런타임 재현 전이라 '유력'. 재현 실패 시에도 처방(닫기 순서 역전·traverse 옵션·scroll:false)은 무해한 하드닝.
- **§1B 카드 높이**: 서브탭 12테마가 min-height 예산과 충돌 → 서브탭은 1행 스냅 레일, 항목 4개 고정.
- **backdrop 한 겹 전환의 시각 차**: 투명감 소폭 감소 → 배경 알파 0.92→0.94 미세 조정, PHASE 2 스크린샷 비교.
- **Rev19 키 삭제**: 40파일 동시 누락 시 rev19Parity 실패(게이트가 잡음).
- **COGS 7군 표기**: CLAUDE.md §3 목록에 중복 항목(예: 앱솔루트싱귤래리티 2회) 존재 → 코드 각인 시 dedupe하고 군별 실제 유일 항목 수를 테스트로 고정.
- **QID 사전(랭킹 240건·슬롯 22건)**: 반자동 생성 후 검수 필요 — PHASE 2에서 rank 1~10 우선, 나머지는 후속.
