# REV-19 마스터 아키텍처 · UX 개편 사양서 (SPEC.md) — PHASE 1 블루프린트

기준 커밋 `ee4651f` (REV-18). Codex v17.0 제20장(2단계 분할 실행)에 따라 **PHASE 1 = 설계·실측**, **PHASE 2 = 구현·검증·배포**. 이 문서는 PHASE 2의 작업 지시서이며, 실측 원본은 `docs/rev19/measure/`(하네스 3종 + JSON 3종 + 스크린샷 7장, `next start :3123`, chromium 1366×768 · Pixel 7, `ko`).

## 0. 실측 진단 요약 (13개 항목별 현재 상태)

| # | 항목 | 실측 사실 (`measure19/*.json`) | 결함 |
|---|---|---|---|
| 1 | 딥 모달 히스토리 | 클러스터 팝업·입장 게이트·랭킹 상세·내비 모달 모두 `history.length` 14 불변, `unitasExitDepth=12` 그대로 → **엔트리 0개**. 뒤로가기 1회 = 센티널 11 착지 → `ExitGuard`가 팝업 **위에** 종료 확인을 띄움(`popups.json afterBack1: dialogs 2, entryOpen 1, exitDialog 1`). 타워 2종만 자체 push(`unitasShortcutModal`, `unitasUaiSearchTower`), X로 닫으면 엔트리가 잔존해 다음 back 1회가 소모됨 | 팝업 역순 닫기 부재 |
| 2 | 타이포 광학 중심 | h1 박스가 텍스트보다 좁아(`clamp` 상한 8.5rem = max-w-3xl) start 정렬 상태. "IT" range 중심 708.5 vs 밑줄(::after, h1 콘텐츠 박스) 중심 683 → **+25.5px**(=0.25em, 오버플로 체제) · 글리프 런 중심 690.1 → IT−런 = **+0.18em**(Pixel 7도 0.182em) | 우측 편향 |
| 3 | 검색 back 라우팅 | 포커스/타이핑/타워 모두 히스토리 무관(타워만 1 엔트리) | 4단 라우팅 부재 |
| 4 | Enter 아이콘 | idle: `opacity 0.4` disabled, 1px 50% 테두리, 26×26 · 타이핑: 테두리만 진해짐, 글로우 0 | 저가시성 |
| 5 | 푸터 | `bg rgba(3,3,5,.6)`(다크 밴드), 링크 `rgb(42,44,51)`(QW 리맵된 잉크가 다크 위에 → 대비 붕괴), 헤더 금색 15px | 탁한 회색·가독성 붕괴 |
| 6 | 워터마크 | `rgba(10,10,12,.28)` multiply, 항상 동일 가시성, 인쇄/복사 반응 없음 | 정적 |
| 7 | 수직 대칭 | 데스크톱: 내비 하단→캡탑 **71.8px** vs 베이스라인→검색바 **53.8px**, Pixel 7: 56.8 vs 42.7 (Cinzel 700: 라인탑→캡탑 0.064em, 라인탑→베이스라인 0.77em, line-height 0.95) | 비대칭 |
| 8 | 날씨 위젯 | 단일 날씨 카드, 본문 11~13px, 갱신/출처 10px, 클릭 확장 없음, 테마 없음 | 정적·소형 |
| 9·10 | 랭킹 모달 | `Modal`(포털)은 `.dashboard-zoom` 밖 → QW §3 리맵 미적용 → `bg-quantum` 다크 패널 + `bg-void/80` 백드롭(`popup-ranking-detail.png`) | 레거시 다크 |
| 11 | 헤더/푸터 팝업 | 충전·잔액·로그인·설정·언어·앱설치 시트·타워 2종 전부 포털 다크(`popup-shortcut-tower.png`) | 비일관 |
| 12 | 약관 라우팅 | 푸터 링크 → `/ko/legal/terms` 풀 라우팅(`termsUrl`), 입장 게이트 `<a href="/legal/terms">`는 로케일 프리픽스도 없음. ko "고지" 6곳(`Footer.legal/patentNotice`, `SitePages.patent-notice.title/body`, `QuantumWhite.entry.eyebrowNotice/notice.n3`) | 이탈 + 용어 |
| 13 | 타이핑 팝업 | "실시간 검색 키워드" 라벨 **9px**, 사다리 섹션 + 숏컷 스트립(1400px)이 드롭다운 안에 중첩 | 잡동사니·소형 |

## 1. [항목 1] 딥 모달 히스토리 스택 — 신규 `lib/history/modalStack.ts` (순수 코어 + DOM 어댑터)

### 1.1 계약
- `history.state[MODAL_STACK_KEY='unitasModalStack']: string[]` — 그 엔트리에서 열려 있는 레이어 id의 **누적 배열**(bottom→top). 센티널 키(`unitasExitGuard/Depth`)·Next 키(`__NA`, 트리)는 기존 `history.state`를 spread 해 그대로 상속(DialogTower가 이미 쓰던 형태). 키가 `unitas`로 시작하므로 ExitGuard `foreignEntryOnTop()`·부트스트랩 `foreign()`이 자동으로 양보(센티널 리필 금지).
- **push는 활성화 제스처 안에서만**(Chromium history-manipulation intervention). 제스처 밖(F5 복원, 프로그램적 열기)에서 등록된 레이어는 `deferred`로 보관하고 다음 활성화 이벤트(`EXIT_GUARD_ACTIVATION_EVENTS`, capture)에서 push — 그 사이의 back은 엔트리 없이도 **레이어 수 > 착지 깊이** 규칙으로 닫힘.
- popstate 규칙(순수 `resolvePop(open, landed)`): `landed = state[MODAL_STACK_KEY].length`. `open > landed` → 위에서부터 `open−landed`개 닫기(`onBack` 호출, 프로그램적 닫힘으로 예약된 레이어는 콜백 생략). `landed > open`(죽은 엔트리: 라우트 변경 잔존·forward 진입) → `history.back()` 1회 더(투명 스킵, 센티널까지 유한).
- 프로그램적 닫기(X·백드롭·ESC·게이트 강탈·언마운트): 레이어를 제거하고 그 레이어가 **현재 엔트리 이상**에 있으면 `history.go(-n)`(n = 그 레이어 포함 위쪽 엔트리 수) — 트래버설이 완료될 때까지 후속 push는 **큐잉**(popstate 도착 또는 400ms 타임아웃에 플러시). 검색 허브→모듈 모달 핸드오프처럼 같은 틱에 닫기+열기가 겹쳐도 순서가 보존된다.
- `claimPop(event)`: 이벤트 객체 단위 memo(WeakMap). 모달 모듈·ExitGuard 어느 쪽 리스너가 먼저 돌아도 같은 답. ExitGuard `onPop` 첫 줄에 `if (claimModalPop(e)) return;` 추가 — 데스크톱 App 창(센티널 0)에서도 모달 닫힘이 종료 확인으로 새지 않음.
- 종료 엔진 무변경: `executeAppExit`·`collapseHistoryStackNow`는 Navigation API 기준이라 모달 엔트리도 같은 문서 엔트리로 셈해 함께 붕괴됨.

### 1.2 React 바인딩 — 신규 `components/ui/useHistoryLayer.ts`
`useHistoryLayer(open: boolean, id: string, onBack: () => void)`: `open` true → `pushLayer`, false/언마운트 → `releaseLayer`(필요 시 프로그램적 back). `onBack`은 ref로 최신 유지.

### 1.3 편입 대상 (레벨은 열림 순서로 자동)
| 표면 | 파일 | 레이어 id |
|---|---|---|
| 공용 `Modal`(지갑·충전·로그인·설정·랭킹 상세·프로필·문의·퀘스트·락인·캔버스) | `components/ui/Modal.tsx` | `labelledBy ?? useId()` — **ExitGuard는 `historyLayer={false}`로 제외**(종료 확인은 back의 목적지이지 레이어가 아님) |
| 다이얼로그 타워 2종 | `components/ui/DialogTower.tsx` | 기존 `historyMarker`(자체 pushState/popstate 코드 삭제) |
| 클러스터 팝업(L1) + 입장 게이트(L2) | `ClusterPopout.tsx` | `qw:cluster`, `qw:entry` |
| 에코시스템 진입 모달 | `EcosystemEntryModal.tsx` | `home:ecosystem` |
| 언어 드롭다운 · PWA 설치 시트 | `LanguageSwitcher.tsx`, `PwaInstallHost.tsx` | `nav:language`, `pwa:install` |
| U-AI 검색 3단 | `OmniSynapseSearch.tsx` | `search:focus`, `search:typing`, `search:text` (§3) |
| 신규 리갈 모달 · 허브 딥 모달 · 쇼츠 | §8, §12 | `legal:<slug>`, `hub:<theme>`, `shorts:<id>` |

메인 홈 L0에서의 back = 기존 ExitGuard 계약(종료 확인) 그대로.

## 2. [항목 2] "UNITAS" 광학 중심 — `quantum-white.css` §4 + `Hero.tsx`
- h1을 `width: fit-content; margin-inline: auto; white-space: nowrap`으로 바꿔 박스 = `indent + 글리프 런 + 후행 자간` → 밑줄(::after, 박스 중심)이 항상 **런 중심**에 온다(오버플로/센터 두 체제 차이 소거).
- 단어를 `<span class="qw-title-word">`로 감싸 `display:inline-block; transform: translateX(var(--qw-title-optical-shift))`, `--qw-title-optical-shift: -0.18em`(실측 IT−런 = 0.180em/0.182em). 밑줄은 레이아웃 그대로(변환 영향 없음).
- 비가시 소유 마크(`SovereignWatermark`)는 bare 텍스트 노드 대신 `<span class="qw-title-mark" style="letter-spacing:0">`에 넣어 자간 폭 오염 원천 차단.
- 완료 조건: `|IT.cx − h1.cx| ≤ 0.5px` (1366 · Pixel 7).

## 3. [항목 3] U-AI 검색 back 라우팅 — 4단 상태기 (`lib/uai/searchLevels.ts` 순수)
```
L0 홈 ─focus→ L1 기본 팝업(숏컷 스트립) ─첫 글자→ L2 타이핑 세션 + L3 텍스트 (같은 제스처에 2 push)
back@L3: 텍스트 즉시 소거 → L2 (제안 팝업 유지, 빈 상태 디스커버리 위젯)
back@L2: 제안 팝업 닫힘 → L1 (기본 팝업 복귀)
back@L1: 포커스 해제 → L0 (메인 홈)
back@L0: 종료 확인 (ExitGuard)
```
- `typingSession` 상태 신설: 첫 글자에 true, **수동 삭제로 빈 문자열이 되면 false**(항목 13 "입력 소거 즉시 기본 위젯 복원"), back으로 비워지면 true 유지(L2). 텍스트 편집은 push 없음(L3는 ''↔non-empty 전이에서만 push/pop).
- blur(외부 클릭)·행 클릭 핸드오프 → 열린 검색 레이어 전부 프로그램적 pop(`go(-n)`), 타워 push는 큐잉으로 순서 보존.

## 4. [항목 4] Enter 키 — `#omni-synapse-search[data-typing='1'] button[type=submit]`
- 기본: 2px 퀀텀블루 테두리, `--qw-blue-soft` 채움, 아이콘 `strokeWidth 2.75`, 크기 30→34px(sm 36), 비활성 opacity 0.4→0.7.
- 타이핑 중(`data-typing` = value 비어있지 않음): `@keyframes qw-enter-flux` — 블루→골드→시안→블루 색상 순환 박스섀도(0 0 0 3px / 0 0 22px) 2.6s + 미세 스케일 펄스, `prefers-reduced-motion`이면 정적 글로우.

## 5. [항목 5] 푸터 글래스모피즘 — `quantum-white.css` 신규 §12 `#site-footer`
- 배경: `linear-gradient(180deg, rgba(255,255,255,.55), rgba(246,247,250,.72))` + `backdrop-filter: blur(22px) saturate(1.5)`, 상단 실버 하이라이트 `inset 0 1px 0 rgba(255,255,255,.95)` + 하단 `inset 0 -1px 0 rgba(10,10,12,.06)`, 3D 깊이 `0 -24px 60px -30px rgba(11,92,255,.22), 0 -1px 0 rgba(207,214,226,.9)`.
- 컬럼 헤더: `--qw-gold-deep` 14px/0.24em, `text-shadow 0 1px 0 #fff` (크리스프). 링크: `--qw-ink-2` 16px, hover `--qw-blue-deep` + 1px 언더라인. 브랜드 "UNITAS": `--qw-gold-deep` 20px. 저작권 줄 `--qw-ink-3`.
- 4컬럼을 개별 글래스 카드(`rgba(255,255,255,.5)`, 실버 헤어라인, 12px radius)로 승격해 "3D 층위".
- 회색 밴드(`bg-void/60`) 리맵으로 소거. 다크 라우트(모듈 페이지)는 무변경(QW 스코프).

## 6. [항목 6] 안티 피러시 워터마크 — 신규 `lib/quantumWhite/antiPiracy.ts`(순수) + `SovereignWatermark.tsx`
- 기본 `opacity: .07`(거의 비가시). 노출 상태 `data-reveal='1'` → opacity 1, 확대(1.35×), 골드 글로우, 2.8s 후 복귀.
- 순수 분류기 `classifyCaptureGesture({type,key,code,ctrl,meta,shift})`: `PrintScreen` / `Meta+Shift+3|4|5|6`(mac) / `Meta+Shift+S`(Win Snip) / `Ctrl+P`·`Meta+P`(인쇄) / `copy`·`cut` 이벤트 / 이미지 `contextmenu`. 화면 캡처는 웹에서 직접 감지 불가 → 키 조합 + `visibilitychange`+`blur` 300ms 창(스니핑 툴 포커스 탈취) 휴리스틱.
- `@media print`: 워터마크 opacity 1 + 페이지 전체 대각선 반복 텍스트 레이어(`.qw-print-mark`, 회전 −24°, 12행) 표시.
- copy 이벤트: `e.clipboardData.setData('text/plain', 선택 텍스트 + '\n\n© THE UNITAS GLOBAL OÜ — ' + 소유 마크)` (기존 비가시 마크 유지).

## 7. [항목 7] 수직 대칭 — `--unitas-nav-bottom` + 폰트 상수
- `NavBar`가 ResizeObserver로 `documentElement.style.setProperty('--unitas-nav-bottom', <screen px>)`. `globals.css`에 `--unitas-zoom: 0.75`.
- `.qw-hero-wrap { padding-top: calc(var(--unitas-nav-bottom, 64px) / var(--unitas-zoom) + var(--qw-hero-gap) - var(--qw-title-size) * 0.064); padding-bottom: 0 }`, Hero 내부 `mt-[76px]` 무력화.
- 검색 래퍼 `margin-top: calc(var(--qw-hero-gap) - var(--qw-title-size) * 0.18 - 1.1rem - 1px)` (0.18 = line-height 0.95 − 베이스라인 0.77), 기존 `-mt-[19px]` 제거.
- `--qw-hero-gap: clamp(44px, 5.8vw, 80px)` (CSS px, 줌 내부). 정의: A = 내비 하단→캡탑, B = 베이스라인→검색바 상단(잉크 기준, 밑줄은 B 안에 떠 있음). 완료 조건 `|A−B| ≤ 1px` 두 뷰포트.

## 8. [항목 8] 라이브 허브 (Cognitive Addiction Engine)
- 신규 `lib/live/hubThemes.ts`: 9 테마 `game·sports·movie·bestseller·shopping·stock·webtoon·fashion·food` — 아이콘·컬러·로케일별 검색어(ko/en/ja/zh + en 폴백)·디스커버리 링크 빌더(Google 뉴스/YouTube/Wikipedia/Google, 외부 새 탭).
- 신규 API `app/api/live/hub-news/route.ts`: `?locale&theme` → Google 뉴스 RSS(로케일 에디션) + Bing 뉴스 RSS 2레그, `lib/live/axisNews.ts`의 `parseRss/foldGoogleNews/mergeAxisWires` 재사용, CDN 10분, 무키 0원.
- 신규 `components/home/LiveHubPanel.tsx`가 `weather` 탭을 대체: 상단 = 기존 `LiveWeatherPanel`(폰트 확대: 도시 15→17px, 온도 36→44px, 상태 13→15px, 상세 11→13px, 예보 라벨 10→12px, 갱신/출처 10→13px), 하단 = **회전 테마 스트립**(7s 자동 회전, 호버/터치 시 정지, 진행 바) + 활성 테마 카드(헤드라인 4개, 출처·시각, 60s 주기 갱신) → 카드/헤드라인 클릭 = **딥 모달**(`hub:<theme>`: 헤드라인 12개 + 출처 링크 + 디스커버리 링크 + 갱신 카운트다운, 열려 있는 동안 60s 갱신).
- **UNITAS Shorts** 신규 `components/home/UnitasShortsPanel.tsx` + `lib/live/shortsSeed.ts`(결정론 시드): 세로 카드 8개(그라데이션 포스터·제목·핸들·조회/좋아요/팔로우), 좋아요·팔로우 토글 localStorage `unitas.shorts.v1`, 상세 딥 모달(`shorts:<id>`: 큰 포스터·설명·"U-Messenger로 공유" 안내), "업로드" CTA는 `준비 중` 라벨(서버리스 영상 파이프라인 부재 — 정직 표기).
- **@theunitas.global 메일 예약**: `AuthModal` 가입 폼에 선택 필드 "UNITAS 메일 핸들"(순수 검증 `lib/auth/unitasHandle.ts`: 3~20자 `[a-z0-9._-]`, 예약어 차단) → `signUp({ options: { data: { unitas_mail_handle } } })`(Supabase user_metadata, **스키마 변경 0**). 게스트/오프라인은 `localStorage unitas.mail.reservation.v1`. 메일함 개통은 MX/메일 프로바이더가 필요해 서버리스 범위 밖 → UI는 "예약됨 · 메일함 개통 시 활성화"로 정직 표기.

## 9·10·11. 포털 표면 글래스 통일 — `quantum-white.css` 신규 §11 `[data-unitas-portal]`
- `ModalPortal`이 자식을 `<div data-unitas-portal>`로 감싼다(DOM 1단 추가, 스타일 없음).
- 스코프 `html[data-unitas-surface='quantum-white'][data-cinema-phase='released'] [data-unitas-portal]`(커튼 위 종료 확인은 다크 유지)에서 §3와 같은 유틸 리맵(`bg-quantum`, `bg-void/*`, `text-white`, `text-gray-*`, `border-white/*`, `bg-white/5`, `hover:*`) + 모달 패널 토큰: `--qw-modal-backdrop: rgba(12,14,24,.34)` + blur 14px, `--qw-modal-panel: rgba(255,255,255,.82)` + blur 28px, 실버 에지 `inset 0 1px 0 rgba(255,255,255,.96)`, 3D 섀도 `0 30px 80px -24px rgba(11,92,255,.28), 0 18px 44px rgba(10,10,12,.16)`, radius 20px.
- DialogTower: 툴바·패널 글래스, 액센트는 테마 컬러 유지. 언어 드롭다운(`.z-[140]`) 기존 규칙과 정합.
- 랭킹 상세·프로필 모달: `디스커버리 링크` 행 추가(위키백과·Google 뉴스·YouTube·Google 검색, `lib/live/discoveryLinks.ts` 순수 빌더, 로케일 인지), 세계 랭킹 목록 행 14px→15px.

## 12. [항목 12] 리갈 인라인 모달 + 용어
- 신규 `components/layout/LegalModal.tsx` + 전역 호스트 `components/layout/SiteLinkModalHost.tsx`(`app/[locale]/layout.tsx`에 마운트): `window.dispatchEvent(new CustomEvent('unitas:site-page', {detail:{group,slug}}))`로 열림, `SitePages.<slug>.{title,lede,body}` 렌더(`useTranslations`), 레이어 `legal:<slug>`, 백드롭/ESC/back 닫힘, "전체 페이지로 보기" 보조 링크 유지.
- 푸터 12링크: `Link` → 버튼(모달), 라우트는 SEO·딥링크용으로 유지. `EntryGate` 리갈 링크 → 모달(레벨 3). `AuthModal` 내 약관/개인정보 참조 → 모달.
- ko 용어 치환표: `Footer.legal` 법적 고지→**법률 안내**, `Footer.patentNotice` 특허 고지→**특허 안내**, `SitePages.patent-notice.title` 특허 고지→**특허 안내**, 본문 "본 고지의"→"본 안내의", `QuantumWhite.entry.eyebrowNotice` 고지→**공지사항**, `notice.n3` "사전 고지 없이"→"사전 안내 없이". 회귀 가드: `__tests__/i18n/rev19KoTerms.test.ts` — ko.json 전체에 "고지" 0건.

## 13. [항목 13] 디스커버리 엔진 정제
- 타이핑 드롭다운 = 섹션 1(실시간 검색 키워드, 라벨 9→15px 볼드 + 잉크) + 신규 디스커버리 위젯 3종: ① `지금 뜨는 탐색`(허브 헤드라인 + 로컬 인덱스 인기 축, 60s 순환) ② `호기심 카드`(로케일 큐레이션 12문 중 결정론 3장, 클릭=후속 쿼리) ③ `이어서 탐색`(localStorage 최근 쿼리 6개). 사다리 섹션·숏컷 스트립 섹션 **삭제**(`LiveLadderExplorer`는 타워 내부 사용처가 없으면 파일 유지·미사용, 삭제하지 않음).
- L2(빈 타이핑 세션)에서는 ①②③만 표시. 기본 위젯(스트립)은 L1에서만.
- 드롭다운 패널을 §11 글래스 토큰으로 재키잉(패널 96% 화이트 → 글래스 + 실버 에지 + 블루 글로우), 행 15px/설명 13px.

## 14. i18n 인벤토리
신규 네임스페이스 `Rev19`(≈70키: 허브 테마 9×{title,tag}, 허브 UI 12, 쇼츠 12, 메일 예약 8, 리갈 모달 4, 디스커버리 6, 호기심 카드 12문). en/ko 정본은 PHASE 2에서 직접 집필, 18로케일은 병렬 번역 에이전트 → `docs/rev19/i18n/<locale>.json` → `scripts/i18n/apply-rev19.mjs`(키 집합·ICU 토큰 검증 후 병합). `Footer`/`QuantumWhite`/`SitePages` ko 6곳은 §12 치환.

## 15. 검증 계획 (PHASE 2 완료 조건)
1. vitest 신규: `history/modalStack.test.ts`(push/pop/deferred/queue/dead-skip/claim), `uai/searchLevels.test.ts`, `quantumWhite/antiPiracy.test.ts`, `live/hubThemes.test.ts`, `auth/unitasHandle.test.ts`, `i18n/rev19KoTerms.test.ts`, `i18n/rev19Parity.test.ts`(20로케일 키 패리티) — 기존 717 유지.
2. Playwright(`tests/web-cinema-e2e/`): `rev19-back-stack.spec.js`(클러스터→게이트→back→back→back=종료확인, 랭킹 상세 2단), `rev19-search-back.spec.js`(4단 시퀀스), `rev19-hero-geometry.spec.js`(IT 중심·A=B), `rev19-legal-modal.spec.js`(URL 불변), 기존 rev15/rev17/omni-exit/app-exit 회귀.
3. `cd index.html && npm --prefix web run typecheck && npm --prefix web run build` EXIT 0 → `git push origin main` → `cd web && npx vercel --prod --yes --scope the-unitas-global-ou-e`(로그인 상태 선확인).

## 16. 편집 경계 · 금지
- `lib/exit/appExit.ts` 센티널 계약·`EXIT_GUARD_BOOTSTRAP` 무변경(ExitGuard는 `claimModalPop` 1행만). `sealHistoryEntryNow`·`terminateInPlace` 무변경.
- 미들웨어·DB·마이그레이션·Supabase 스키마 0건. 외부 유료 API 0건.
- 다크 라우트(모듈 페이지·커밍순·게이트)의 시각 무변경: 모든 신규 CSS는 QW 스코프.
- 로케일 20개 키 패리티 유지, `QuantumWhite` drift 테스트 임계 유지.

---

## 17. PHASE 2 실행 결과 (2026-09-10)

| 항목 | 구현 | 검증 |
|---|---|---|
| 1 딥 모달 스택 | `lib/history/modalStack.ts` + `components/ui/useHistoryLayer.ts`; Modal·DialogTower·ClusterPopout(2단)·EcosystemEntryModal·LanguageSwitcher·PwaInstallHost·검색 3단 편입; ExitGuard `claimModalPop` 1행 | vitest 16 · E2E `rev19-back-stack` 4종(클러스터→게이트→back×3=종료확인, X 닫기 후 dead press 없음, 랭킹 상세 레벨, 허브/쇼츠 레벨) |
| 2 광학 중심 | h1 `fit-content`+`text-indent:0`, `.qw-title-word` −0.18em (**실측: 상속 text-indent가 inline-block에 2중 적용되던 것을 0으로 소거**) | IT 중심 − 밑줄 중심 = 0.05px(1366) |
| 3 검색 back | `lib/uai/searchLevels.ts` + OmniSynapseSearch 3레이어 | vitest 5 · E2E `rev19-search-back` 3종 |
| 4 Enter 키 | `.qw-enter-key` + `data-typing` + `qw-enter-flux` | E2E(애니메이션명·2px 링) |
| 5 푸터 | `.qw-footer*` 글래스 카드 4열 | E2E(gradient·blur·금색 헤더) |
| 6 워터마크 | `lib/quantumWhite/antiPiracy.ts` + 노출/인쇄/복사 트레일러 | vitest 4 · E2E copy 노출→복귀 |
| 7 대칭 | `--unitas-nav-bottom`·`--qw-hero-gap` | A=B=59.4px(1366), 33px(Pixel 7) |
| 8 허브·쇼츠·메일 | `hubThemes/hubNews/hubNewsClient/shortsSeed/unitasHandle`, `LiveHubPanel`·`UnitasShortsPanel`·`DiscoveryLinks`, `/api/live/hub-news`, AuthModal 핸들 필드 | vitest 10 · API 실호출 ko/game 12건 |
| 9·10·11 | `ModalPortal` `[data-unitas-portal]` + CSS §17 리맵, 랭킹 모달 디스커버리 링크·15px | 스크린샷 `verify19/*modal*.png` |
| 12 리갈 | `SiteLinkModalHost` + `openSitePage`, 푸터·EntryGate 연결, ko 6곳 치환 | E2E `rev19-legal-modal` 2종 · vitest 고지 0건 |
| 13 디스커버리 | 사다리·중첩 스트립 삭제, 라벨 15px, 위젯 3종, 드롭다운 글래스 | E2E(레벨 속성·위젯 존재·라벨 크기) |

- i18n: `Rev19` 88키 × 20로케일(`docs/rev19/i18n/`, `scripts/i18n/apply-rev19.mjs --check` 드리프트 0), `__tests__/i18n/rev19Parity.test.ts`.
- 게이트: `tsc --noEmit` EXIT 0, `next build` EXIT 0(3회), vitest 775/775, Playwright 신규 12종 chromium 12/12 · mobile-chrome 12/12 · webkit은 `test.slow`(헤드리스 소프트웨어 WebGL rAF 350~700ms) 하에 재실행.

### 17.1 PHASE 2에서 실측으로 추가된 규칙 (SPEC §1 보강)
- **레이어 엔트리가 URL을 소유한다**: `useHistoryLayer(open, id, onBack, url)` — 클러스터/입장 게이트 레이어는 `#core/<cluster>[/<moduleId>]`를 자기 엔트리에 싣고(Next 라우터 키를 벗겨 push → 라우터가 canonical로 등록), `SingularityCoreGrid`는 열 때 미러·원장만 기록(`writeSurfaceRecord`)하고 닫을 때만 `commitSurface`로 현재 엔트리 URL을 정리한다. 이유: 열 때 `replaceState`로 아래 엔트리의 URL을 덮어쓰면 back으로 착지한 엔트리가 옛 해시를 보인다(REV-17 `rev17-entry-checkout` "hash reverts" 회귀로 발견).
- **null-state popstate 무시**: 같은 URL로의 fragment 내비게이션(`location.assign(현재 URL)`, 주소창 재입력)은 엔트리를 null state로 교체하고 popstate를 발화한다. 이 사이트의 모든 엔트리는 최소 `__NA`를 가지므로 null-state pop은 우리 것이 아님 → 레이어 유지, claim 안 함. (REV-17 `rev17-refresh-persistence` R2 테스트의 `page.goto(같은 URL)`가 실제로는 문서를 다시 로드하지 않는 fragment 내비게이션이었음이 이때 드러남.)
- **ESC는 최상위 레이어만**: DOM 순서는 기준이 못 된다(레이아웃에 상주하는 포털 컨테이너가 `<body>` 앞쪽에 있음) → `HistoryLayer.isTop()`(스택 순서)로 `Modal`·`DialogTower`·`ClusterPopout`이 자기 차례일 때만 닫힌다.
- **REV-17 E2E 보정**: 입장 게이트 헬퍼는 고정 400ms 대신 max-width 640 도달을 대기(소프트웨어 렌더 프레임 지연 300~450ms 실측), 리갈 링크 단언은 버튼(인라인 모달)도 허용.
