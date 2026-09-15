# REV-29 — 10대 UX/UI 혁신 지령: 입력 통제 · 뉴스 대공사 · 신상품 · UNITAS 허브 · 워드마크/단축키

**창립자 지령 2026-09-15 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0**
정본: `index.html/docs/rev29/SPEC.md` · 실측 보고: `index.html/docs/rev29/FINAL_REPORT.md`

이 문서는 **실측 뒤에 쓰였다.** 설계 의도가 아니라 실제로 코드에 들어간 것과, 측정이
설계를 뒤집은 지점을 기록한다(제25장).

---

## §0. 지령의 5대 미션과 구현 좌표

| 미션 | 지령 요지 | 구현 정본 |
|---|---|---|
| M1 | 키보드는 텍스트 박스 터치에만 · 포커스 링 미세 완화 · 돋보기/플레이스홀더 +20% | `components/home/OmniSynapseSearch.tsx`, `app/globals.css`, `app/quantum-white.css` |
| M2 | 뉴스 = 숏컷과 동일 롤링 · 1박스 1테마 · 팝업 단일화 · 더 깊이 탐색 클렌징 | `components/home/HotIssueNewsList.tsx`(전면 재작성), `lib/live/hotNews.ts`, `lib/live/axisNews.ts`, `lib/live/hotNewsAxes.ts`, `components/home/ExploreDeeper.tsx` |
| M3 | 글로벌 신상품 테마 신규 창조 | `lib/live/newProducts.ts`(신규), `lib/live/discoverySlots.ts`, `components/home/DiscoveryCarousel.tsx` |
| M4 | UNITAS 마스터 타일 1팩 + 중앙 팝업(지식 거래소·숏츠·랭킹·대화방·소셜) | `components/home/UnitasHubToggle.tsx`, `components/home/hub/*`(신규 7파일), `lib/hub/*`(신규 3파일), `lib/live/shortsSeed.ts`·`shortsPass.ts`(부활), `app/unitas-hub.css`(신규) |
| M5 | 워드마크 박스 파괴 · 3단축키 아이콘 동기화/1줄/모바일 롤링/활성 상태 | `app/unitas-wordmark.css`(재창조), `components/home/AttachMenu.tsx`, `app/globals.css`, `app/quantum-white-rev19.css` |

i18n: `scripts/apply-rev29-i18n.mjs` — 20로케일 × 127키(신규 91 + 숏츠 복원 36), 플레이스홀더 0.

---

## §1. MISSION 1 — 입력 폼 물리적 제어

### 1.1 키보드 통제 (터치 전용 경로)

지령: *"텍스트 박스를 직접 클릭하여 입력/수정할 때만 가상 키보드가 열리도록."*

원인 분석: 숏컷 스트립·카드·칩은 `onMouseDown preventDefault`로 검색창 포커스를 **지켜 왔다**
(데스크톱에서 드롭다운이 무너지지 않게 하는 REV-19 계약). 그 계약이 폰에서는 정반대로
작동한다 — 테마 박스를 눌러도 포커스가 검색창에 남아 **키보드가 계속 떠 있다.**

구현(`OmniSynapseSearch.tsx`):
- 루트 `onPointerDownCapture`: `pointerType !== 'mouse'`이고 타깃이 텍스트 입력 요소가
  아니며 검색 인풋이 활성 요소이면 `suppressBlurRef = true` 후 `input.blur()`.
- `handleRootBlur`: `suppressBlurRef`가 켜져 있으면 **팝업을 닫지 않는다**(우리가 만든
  blur). 키보드만 내려가고 허브는 열린 채 유지.
- 인풋이 비활성인 채 팝업이 열려 있는 동안엔 문서 레벨 `pointerdown`(캡처)이 외부 탭을
  감지해 닫는다 — 단 `[data-unitas-portal], [role="dialog"]` 내부(모달·타워)는 제외.
- `closeSearchTower`: `(pointer: coarse)`에서는 인풋을 재포커스하지 않는다(타워를 닫자마자
  키보드가 튀어오르던 경로).

마우스 경로는 무변경 — 데스크톱 계약(rev19-search-back)은 그대로 통과.

### 1.2 포커스 링

| | 이전 | 이후 |
|---|---|---|
| 화이트 표면 `--qw-search-glow-focus` | `0 0 0 6px rgba(11,92,255,.14), 0 0 36px …/.45, 0 22px 56px -14px …/.55` | `0 0 0 4px …/.10, 0 0 26px …/.30, 0 18px 48px -16px …/.42` |
| 다크 루트 `[data-state='focus']` | `0 0 70px rgba(212,175,55,.28)` | `0 0 56px …/.22` |

### 1.3 돋보기 + 플레이스홀더 20%

- 돋보기: 16/20px → **19.2/24px** (`.qw-search-glass`, 모바일/≥640px).
- 인풋 폰트: `clamp(10px, 1px + 2.8125vw, 19px)` → **`clamp(12px, 1.2px + 3.375vw, 22.8px)`**
  (세 항 모두 정확히 ×1.2; 플레이스홀더와 입력 글자는 같은 폰트 크기를 공유한다).

---

## §2. MISSION 2 — 실시간 뉴스 대공사

### 2.1 롤링 동기화

`HotIssueNewsList.tsx`를 **DiscoveryCarousel과 같은 기계**로 재작성했다:
- `.qw-hub-strip` 칩 레일 + `.qw-hub-chip` + 활성 칩의 `.qw-hub-progress`(테두리 색상 진행
  애니메이션) — 숏컷과 **같은 CSS 규칙**, 같은 `--qw-slot-rotate`.
- 회전 주기 `NEWS_ROTATE_MS = DISCOVERY_ROTATE_MS`(7,000ms). 이전엔 9,000ms였다.
- 일시정지 조건 동일: 고정(held)·팝업 열림·호버·드래그·터치 700ms·탭 숨김.
- **숫자 배지 삭제**: 칩 안의 `count` 스팬 제거(E2E: 칩 텍스트에 숫자 0건).
- 한계 비용 0원 유지: 시계는 피처드 보드가 이미 덮는 축만 걷고, 라이브 와이어는
  **고정(핀) 또는 팝업 열기**라는 의도 신호에서만 호출.

### 2.2 1박스 1테마 (20 → 22축)

`복지·보건` → `welfare` + `health`, `안보·분쟁` → `security` + `conflict`.
- `HotNewsCategory`/`HOT_NEWS_CATEGORIES`(22), `AXIS_QID`(health Q12147, conflict Q350604),
  `CATEGORY_RULES`(conflict → security → health → welfare 순, 날카로운 축 우선),
  `AXIS_NEWS_QUERY`(축별 7개 검색어), `GOOGLE_NEWS_TOPIC`(health=HEALTH, conflict=WORLD),
  `hotNewsAxes.ts`(HeartPulse/Swords).
- i18n: 20로케일의 기존 결합 라벨을 **각 로케일의 자기 구분자(`·`/`・`)에서 잘라** 두
  라벨로 보존(원어 번역 무손실). 예: `Wohlfahrt · Gesundheit` → `Wohlfahrt`, `Gesundheit`.

**측정이 설계를 고친 지점 ①**: 최초 분류기 패치가 Bash heredoc을 거치며 정규식의 `\b`가
백스페이스 문자(0x08) 9개로 깨져 들어갔다. 유닛 테스트가 즉시 잡았다("Pension reform" →
`institution`). 스크립트 파일로 재패치해 0건으로 복원. **heredoc에 백슬래시가 든 본문을
넣지 말 것**(기존 함정 메모의 재확인).

**측정이 설계를 고친 지점 ②**: 한국어 `공격`을 conflict 어간에 넣었더니 "사이버 공격 대응
안보 강화"가 conflict로 갔다. conflict 한국어 어간에서 `공격`을 제거(공습·침공·교전·포격·
인질·반군·전선·무장세력만) — security의 `사이버 공격`이 살아난다.

### 2.3 팝업 단일화

- 활성 축은 **1개의 `.qw-hub-card`**(비활성 컨테이너, 두-단계 타이틀). 카드는 상위 4건만.
- 타이틀 → `NewsAxisModal`(Modal xl): 세로 `<ol>`(순번·제목·요약·출처·시간), 끝에
  `더 불러오기`(무한 페이징), 바닥에 다이렉트 블록.
- 항목 클릭(카드/팝업 어디서든) → `NewsStoryModal`(Modal lg): 테마·배지·제목·요약·메타·
  **원문 보기**·헤드라인 기반 다이렉트 바로가기. 팝업 닫기는 열었던 축을 고정한다.
- 이전의 가로 헤드라인 레일(`data-news-rail`)·`더 깊이 탐색 · 정치` 토글은 삭제.

### 2.4 더 깊이 탐색 클렌징

`ExploreDeeper`에 `directOnly` 모드 신설:
- 렌즈 타일(옴니테크펄스·실시간사업발굴 등) 0개, 브릿지·동의어 해석 없음.
- 한 줄: **`다른 곳에서 열기` 라벨 + 위키백과 · 위키데이터 · Google · Bing · Scholar ·
  Wolfram · arXiv · GitHub · YouTube · Reddit · X · LinkedIn · Facebook · Instagram · Threads ·
  TikTok** — 로고 없음·페치 없음(§12.4 계약 유지).
- `다른 곳에서 열기` 라벨은 **`더 깊이 탐색` 라벨과 같은 클래스(`qw-deeper-label`)·크기·색·
  아이콘 굵기** — 전역 통일(뉴스 밖 호스트도 동일하게 적용).
- 뉴스 카드 아래·메인 팝업·스토리 팝업 세 곳에 인플로우로 배치 — 스크롤만으로 도달.
- 다른 호스트(타워·피드·랭킹)의 렌즈 타일은 **무변경**(REV-24/25 스웜 계약 보존, E2E
  rev24/rev25 통과로 증명).

---

## §3. MISSION 3 — 글로벌 신상품 (새롭게 창조)

**배치 결정**: 숏컷 레일 **2번째**(날씨 바로 다음). 숏컷은 "데이터", 뉴스는 "헤드라인"이라는
REV-23 분리 원칙상 신상품(출시 레코드)은 숏컷에 속하고, 최대 노출 위치가 2번이다.

**소스(0원, 무키)**: 영어 위키백과 출시 연도 카테고리 트리 — 세계에서 가장 완전한 개방형
출시 레지스트리다.
1. `list=categorymembers&cmsort=timestamp&cmdir=desc` — 최신 문서 우선("방금 출시").
2. `prop=extracts|pageimages|langlinks` — 한 문장 소개 + 썸네일(240px) + 방문자 언어판 제목.

| 패밀리 | 카테고리(연도 Y) | 앵커 |
|---|---|---|
| cars | `Cars introduced in Y` | Q1420 |
| phones | `Mobile phones introduced in Y` | Q22645 |
| mobility | `Motorcycles introduced in Y` + `Aircraft first flown in Y` | Q42889 |
| gadgets | `Products introduced in Y` + `Computer-related introductions in Y` | Q2424752 |
| games | `Y video games` | Q7889 |

- 하루 1패밀리(결정론적 `familyOfDay`, SSR/CSR 첫 프레임 일치), 딥 모달에서는 **5패밀리
  탭**(`SlotCard.tabs`, 커서 `{tab, deep:1}`). 현재 연도가 4건 미만이면 전년도 병합.
- `SlotItem`에 `image`/`description` 신설 → 카드·딥 모달 공통 썸네일 렌더(`SlotThumb`).
  `FeedDeepModal`에 탭 레일 신설(피드 슬롯 공통 인프라).
- 레지스트리: 17슬롯(16→17), 피드 14, `SLOT_SOURCES.newProducts=['wikipedia']`,
  `SLOT_QID.newProducts=Q2424752`, `GLOBAL_ONLY`.
- 로케일 언어판에 문서가 있으면 제목·링크가 그 언어판으로 간다(소개문은 영어 원문).

---

## §4. MISSION 4 — UNITAS 마스터 허브 (새롭게 창조)

### 4.1 마스터 타일

`UnitasHubToggle` — ⏎ 키·첨부 토글과 **같은 클래스(`qw-attach-toggle`)**, 같은 32/38px,
같은 1.5px 림·10px 반경, 같은 정지/활성 규칙. 롤은 **5아이콘 × 2.4s = 12s 루프**, 첨부
롤과 같은 이징(`cubic-bezier(0.2,0.8,0.2,1)`), 같은 관여 조건(호버/포커스/드래그)에서만
구동. 클릭 즉시 중앙 팝업(`Modal size="hub"`, `max-w-5xl`) — 드롭다운 없음.

### 4.2 다섯 표면

| 탭 | 구현 | 실시간 |
|---|---|---|
| 지식 거래소 | `KnowledgeExchange` + `lib/hub/knowledgeExchange.ts`(순수): 24팩 시드 카탈로그(22축 태그·4종류·3티어), 베타 크레딧 1,200/기기, 구매·서재·**내 지식 올리기**(검증: 제목 3~60·가격 10~5,000 정수·요약 ≤200)·심사 10분 후 판매·**수익 배분 70/30**·예상 수익(시뮬레이션 라벨)·톱 크리에이터 보드 | 거래 티커: 구매가 `hub:exchange` 채널로 브로드캐스트 → 다른 방문자 화면에 즉시 |
| UNITAS 숏츠 | REV-19 원본 부활·이관(`shortsSeed.ts` 14클립·22축 태그, `shortsPass.ts` v2 키, `ShortsCreatorPass` 3D 글래스 복원) | — (씨드 클립, 정직 라벨 유지) |
| UNITAS 랭킹 | `GlobalThemeRankings embedded` + `UnitasModuleRankings embedded`(랭킹 딥 모달과 byte-identical 패널) | — |
| 테마별 대화방 | `ThemeChatRooms` + `lib/hub/themeChat.ts`(순수): 22방(=뉴스 22축), 280자·플러드 가드 900ms·기기당 방별 60개 보관·신원 우선순위(핸들 > 이름 > 게스트 번호 > nomad-태그) | `hub:chat:<room>` 브로드캐스트 + 프레즌스(접속 인원) |
| 소셜 미디어 | `SocialHub`: 네이티브 공유 시트·링크 복사·7종 무로그인 인텐트(X·Facebook·LinkedIn·Threads·Telegram·WhatsApp·Reddit)·소셜 13 + 웹메일 4 런처(`lib/appShortcuts.ts` 재사용) | — |

### 4.3 스키마 0 원칙

`lib/hub/hubChannel.ts` — Supabase Realtime **broadcast + presence만**(Postgres 무접촉).
테이블·RPC·마이그레이션 0. 공개 env가 없으면 `null` → 모든 표면이 "이 기기 전용" 모드로
정직하게 표시. 그래서 **DB 변경 승인 없이** 진짜 멀티유저 채팅·티커가 가능했다.

### 4.4 정직 자세 (REV-19 숏츠 계약 계승)

- 크레딧은 **베타 크레딧 · 이 기기**로 라벨링, U-COIN 정산은 원장 연동과 함께 열린다고 명시.
- 등록 수익은 **"예상 수익(시뮬레이션)"** — 정산 소득으로 표시하지 않는다.
- `ShortsOrphanCleanup`(REV-20 D-3) 삭제 — 부활한 표면의 데이터를 지우는 코드는 함정이다.
  로컬 키는 `v2`로 승격해 옛 번들과의 이름 충돌을 원천 차단.

---

## §5. MISSION 5 — 워드마크 · 3-단축키

### 5.1 워드마크 (박스 파괴)

`app/unitas-wordmark.css` 재창조. **DOM·지오메트리 무변경**(REV-20 0.02px 대칭 계약):
- `h1::before { content: none }` — 플레이트 소멸.
- 글리프 필: 2층 그라디언트 — **상단 빛 반사 밴드**(`rgba(255,255,255,.82)` → 투명 30%) +
  **심연 사파이어 → 로열 블루(#0b5cff) → 나이트** 본체. 흰 바탕과 보이드 양쪽에서 대비 확보.
- 림: 프리즘 골드 `-webkit-text-stroke 0.45/0.7px rgba(212,175,55,.58)`.
- 드롭 섀도 3겹(화이트 리프트·블루 글로우·딥 그라운드). 유휴 애니메이션 0(호버 시만 시인).
- 다크 루트: 플래티넘 → 골드 본체로 패리티.
- E2E: `::before content none`, 두 층 모두 `background-clip: text`, 히어로 대칭 |A−B| 유지
  (rev19-hero-geometry·rev23 대칭 테스트 통과).

### 5.2 3-단축키 크기·1줄

- 메뉴 아이콘을 **20×20 고정 박스**에 넣고 Video 글리프만 `scale(1.22)`(롤·메뉴 공통) →
  세 아이콘 시각 무게 동일.
- 라벨은 **짧은 1줄 키**(`Rev29.attach.file/video/sketch`)로 교체, `white-space: nowrap`,
  메뉴 `width: max-content` — 어느 로케일도 2줄로 넘어가지 않는다. 긴 설명은 `title`/
  `aria-label`로 보존. 텍스트 13px 불변(축소 없음).

### 5.3 모바일 롤링 + 활성 상태

- `(hover: none)` 2×2 정지 스택 **삭제** → 폰도 PC처럼 1아이콘 창에서 회전. 감소 모션은
  첫 아이콘(또는 선택 아이콘)에 정지.
- 선택 상태 기계: `onPick(kind)` → `attachPick`; 트랙 `data-stop='1'` + `--qw-roll-index`로
  **해당 아이콘에 즉시 정지**; 토글 `data-active='1'`은 ⏎ 키의 타이핑 활성 규칙과 **같은
  파란 채움**. 해제 조건: 첨부가 0으로 돌아갈 때, 파일/동영상 대화상자 취소(`cancel` 이벤트,
  네이티브 바인딩)·스케치 캔버스 무첨부 닫기.

**측정이 설계를 고친 지점 ③**: 첫 E2E는 Escape로 캔버스를 닫은 **뒤** 활성 채움을 읽어
휴지 색을 받았다 — 해제 규칙이 의도대로 작동한 것. 단언 순서를 바꿔 "캔버스 열린 동안
활성, 무첨부 닫기 후 해제"를 둘 다 증명한다.

---

## §6. 계약 갱신(REV-23 → REV-29)

- `rev23-verify` "글래스 플레이트 존재" 단언은 창립자 지령으로 **반전**(플레이트 없음).
- `rev20Parity` `Rev20.slots` 키 74 → 76(newProducts title/tag).
- `axisNews` 20 → 22, 분류 케이스 8건, `discoverySlots` 16 → 17·피드 14, `rotationBudget`
  TTL 17, `anchorDictionaries` health/conflict QID.

---

## §7. 미해결·후속

- 지식 거래소·대화방의 **서버 원장/영속 저장**은 스키마 변경(테이블·RPC·RLS)이 필요하므로
  이번 구간에서 만들지 않았다(제6장 안전장치: DB 파괴/비가역 조작은 승인 대상). 현재는
  기기 원장 + 실시간 브로드캐스트.
- 실기기 키보드 동작(iOS Safari 가상 키보드 내려감)은 헤드리스 모바일 크로미움의
  `activeElement` 전이로 증명했고, 실기기 관측은 창립자 손에 남는다(REV-28과 동일 유예).
- 위키백과 출시 카테고리는 문서화 지연이 있어 연초에는 전년도 병합이 대부분을 채운다.
