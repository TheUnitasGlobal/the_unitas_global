# U-AI UX/UI 마스터 블루프린트 (REV-20 · PHASE 1 설계 정본)

작성 2026-09-11 · 기준 커밋 `9c20975` · Codex v17.0 제20장(2단계 분할 실행)에 따른 **PHASE 1 = 설계·실측**.
이 문서는 PHASE 2 구현자의 작업 지시서다. **프로덕션 코드는 한 줄도 수정하지 않았다.**

증빙: `index.html/docs/rev20/measure/` — `sources.md`(무키 소스 27종 실호출 검증), `hero-geometry.json`·`l1-geometry.json`·`tower-geometry.json`(Playwright 실측, `next start :3124`, chromium 1366×768 · 390×844, 로케일 ko), 스크린샷 10장.
직전 정본: `index.html/docs/rev19/SPEC.md`.

---

## §0. 실측 진단 요약

모든 수치는 `docs/rev20/measure/*.json`의 **실측값**이다(2026-09-11T04:05Z). 화면 px 기준이며 `.dashboard-zoom`의 `zoom: 0.75`가 반영돼 있다.

| # | 창립자 지적 | 실측된 현재 상태 | 근본 원인 |
|---|---|---|---|
| 1 | "UNITAS가 약간 왼쪽으로 치우침" | **어드밴스 런** 중심이 뷰포트 중심에서 −18.4px(1366) / −7.0px(390) = −0.180em. 자간을 걷어낸 **잉크 런** 중심은 −25.5px / −9.8px = **−0.25em**(런 폭의 5.3%). "IT" 중심은 뷰포트 중심과 **정확히 0.0px** | 두 오프셋 합산. ① 의도된 광학 시프트 `--qw-title-optical-shift: -0.18em`(REV-19가 "IT"를 밑줄에 맞추려 넣음) ② `fit-content` 박스가 마지막 글자 뒤 자간 0.14em을 포함해 잉크가 박스 중심보다 −0.07em |
| 2 | "밑줄이 너무 짧고 존재감 없음" | `h1::after` **고정 112 CSS px = 화면 84px**, 두 뷰포트 동일. 타이틀 폭 대비 1366px에서 **17.31%**, 390px에서 45.28%. 두께 0.8px, 애니메이션 없음 | 타이틀은 `clamp(3.25rem, 11.5vw, 8.5rem)`으로 반응하는데 밑줄만 고정 px |
| 3 | "회전 타이틀 박스 삭제 / 쇼츠 삭제 / 날씨를 테마와 통합 회전" | 포커스 팝업 총 높이 **1200.6px**(뷰포트 768의 **1.56배**) · 모바일 **3069.3px**(뷰포트 844의 **3.64배**). 내부: 라이브 허브 748.7 / 1083.1, 날씨 패널 204.4 / 312.9, 허브 카드 123.1 / 349.1. 날씨는 **고정 타일**, 그 우측 캐러셀 행 14항목(핫이슈 7 + 탭 7), 9테마 회전 스트립은 날씨 탭 *안쪽* 별도 계층, 쇼츠는 그 아래 | 세 개의 서로 다른 회전/고정 계층이 한 팝업에 중첩되어 높이가 뷰포트의 1.5~3.6배로 폭주 |
| 4 | "키워드 팝업이 풀스크린, 기본 콘텐츠뿐" | 모바일 실측: 팝업 rect **x=0, w=390 (뷰포트 전폭), h=769.5**, `body overflow: hidden`. 같은 화면의 검색바는 x=18, w=354 → **좌우로 각각 18px 넘침**. 키워드 실데이터는 리드 스니펫 1개·소스 8건·칩 7개뿐 | 검색바와 무관한 `DialogTower` 오버레이 셸을 쓰고, 데이터 상한이 `MAX_SOURCES 8`·`MAX_SNIPPET 260`으로 묶임 |
| 5 | "Enter 후 풀스크린 하이퍼 검색엔진" | 모바일 실측: 타워 rect **y=74.5, h=769.5 / 844 = 뷰포트의 91.2%** → **100vh가 아니다**(내비 아래에서 시작). `UaiDashboard` 16블록 중 쿼리 고유 텍스트는 **웹 소스 8건과 유료 리포트뿐** | 무한 스크롤·페이지네이션 개념 자체가 없음(매 검색마다 `setSurface(null)` 초기화) |

### 0.1 실측의 한계 (정직 표기)
- **성공**: 히어로 기하(두 뷰포트), L1 스트립 기하(두 뷰포트), 모바일 키워드 팝업·Enter 타워.
- **실패**: 데스크톱의 키워드·타이핑 단계. 하네스가 뒤로가기를 쓰는 과정에서 `ExitGuard` 종료 확인 팝업이 열려 클릭이 30초 타임아웃(`run-log.json`). `tower-geometry.json`의 `desktop1366.enter.dialogs[0]`(448×235, 제목 "종료하시겠습니까?")은 **U-AI 타워가 아니라 그 종료 확인 팝업**이므로 인용하지 말 것.
- PHASE 2 첫 단계에서 데스크톱 타워 실측을 보강한다(하네스에 `ExitGuard` 회피 경로 추가).

**가장 중요한 발견**: 데이터 빈약은 소스의 한계가 아니라 **우리가 건 상한**이다. Wikipedia Action API 한 번(`generator=search&prop=extracts&gsrlimit=10`)이면 10개 문서의 도입부 전문을 받고 `gsroffset`으로 무한히 넘긴다. 새 유료 API 0건으로 볼륨을 10배 이상 올릴 수 있다.

---

## §1. [요구 1] "UNITAS" 절대 진중앙 잠금

### 1.1 창립자 지시의 해석 (중요)
REV-19 §2는 **"IT"의 중심을 밑줄에 맞추려고** 단어 전체를 0.18em 왼쪽으로 밀었다. 창립자의 이번 지시("단어를 약간 오른쪽으로 옮겨 진중앙에 잠그라")는 그 목표를 **명시적으로 뒤집는다**. 두 목표는 수학적으로 양립 불가하므로, REV-20은 **단어 잉크 중심 = 뷰포트 중심**을 정본으로 삼고 "IT 정렬"을 폐기한다.

### 1.2 최종 CSS (`app/quantum-white-rev19.css` §13 교체)

```css
html[data-unitas-surface='quantum-white'] {
  /* REV-20 §1: 광학 시프트 폐기. 잔여 사이드베어링 보정만 남긴다.
     PHASE 2에서 실측 후 확정(예상 |값| < 0.01em). */
  --qw-title-optical-shift: 0em;
}

html[data-unitas-surface='quantum-white'] .qw-hero-wrap h1 {
  width: fit-content;
  max-width: 100%;
  margin-inline: auto;
  white-space: nowrap;
  text-indent: 0;
}

html[data-unitas-surface='quantum-white'] .qw-hero-wrap h1 .qw-title-word {
  display: inline-block;
  text-indent: 0;
  /* 마지막 글자 뒤에만 붙는 자간을 상쇄해 fit-content 박스를 잉크 런과 일치시킨다.
     이 한 줄이 −0.07em 편향을 제거하고, 밑줄(::after, 박스 중심 정렬)을 자동으로
     잉크 런 중심에 올린다. */
  margin-inline-end: calc(-1 * var(--qw-title-track));
  transform: translateX(var(--qw-title-optical-shift));
}
```

**왜 Flexbox가 아니라 이 방식인가**: `h1`은 `globals.css`의 `.title-breathe { display:inline-block }`을 상속한다. `display:flex`로 바꾸면 그 규칙과 충돌하고, `::after` 밑줄이 flex 아이템이 되어 `margin: 1.1rem auto 0` 센터링이 깨지며, REV-19 §7의 수직 대칭 계산(`.qw-search-wrap`의 `- 1.1rem - 1px` 항)까지 재보정해야 한다. 위 2줄은 레이아웃 체계를 건드리지 않고 박스 정의만 고친다. 바깥 센터링은 이미 `.qw-hero-title-wrap`의 `text-center`와 `.qw-hero-wrap`의 `items-center`가 담당하므로 추가 컨테이너가 필요 없다.

> **후속 정정 (2026-09-11, PHASE 2 E2E 실행 검증)**: 위 문단이 근거로 삼은 `display:inline-block` 상속은 **수평**으로는 무해하지만 **수직**으로는 유해했다. 인라인 레벨 박스인 h1 아래에 부모 `.qw-hero-title-wrap`의 16px/24px strut 디센더(1280 기준 6.64px)가 유령 밴드로 깔려 REV-19 §7의 B 구간에 그대로 섞여 들어간다. h1 자신의 rect에는 잡히지 않아 그동안 미검출. 또한 §2가 밑줄을 1px→3px로 키우면서 `.qw-search-wrap`의 `- 1px` 항이 2px 부족해졌다. 합계 8.64px(CSS) = 6.48px(화면) 초과로 `rev19-hero-geometry` 수직 대칭 단언이 실패했다.
>
> 확정 처방(플렉스 전환 없음, 박스 정의만 유지):
> - `.qw-hero-wrap h1`에 `display: block`을 **명시**(센터링은 그대로 `width:fit-content` + `margin-inline:auto`가 담당 — 라인박스 자체를 없애 유령 밴드 소멸).
> - `--qw-title-rule-h: 3px` 변수를 신설해 `::after`의 `height`와 `.qw-search-wrap` 보정식이 **같은 값**을 참조(밑줄 두께를 다시 바꿔도 대칭이 자동 추종).
>
> 실측 결과 `|A−B|` = 0.02px (1280 Chromium/WebKit, 412 모바일 전부).

### 1.3 완료 조건과 측정 규약
기존 E2E는 `Range`로 잰 "IT" 중심을 쓰는데, 이 값은 **T 뒤 자간을 포함**하므로 잉크 기준이 아니다. REV-20은 측정 규약을 잉크로 바꾼다.

```js
// 잉크 런 중심 = 첫 글자 좌변 ~ (마지막 글자 우변 − 자간)
const node = document.querySelector('.qw-title-word').firstChild;
const track = parseFloat(getComputedStyle(h1).letterSpacing) * zoom;
const first = rangeRect(node, 0, 1);
const last  = rangeRect(node, 5, 6);
const inkCx = (first.left + (last.right - track)) / 2;
const viewportCx = document.documentElement.clientWidth / 2;
```

- `|inkCx − viewportCx| ≤ 1px` — 1366×768, 390×844 두 뷰포트
- `|underlineCx − viewportCx| ≤ 1px` (밑줄 중심 = `h1` 콘텐츠 박스 중심)
- REV-19 §7 수직 대칭 `|A − B| ≤ 1.5px`는 **불변**이어야 한다(이 변경은 수평 전용)

---

## §2. [요구 2] 언더라인 존재감 — 3안

공통 규칙(3안 모두 적용):
- 길이는 고정 px를 버리고 **타이틀 폭에 비례**: `width: 100%`(= `h1` fit-content 박스 = 잉크 런). 1366px에서 84px → **485px(5.8배)**. `min-width: 220px`, `max-width: 92vw`.
- 중심은 `margin-inline: auto` 유지 → §1의 박스 수정 덕에 자동으로 잉크 런 중심.
- `@media (prefers-reduced-motion: reduce)`에서 모든 애니메이션 정지, 정적 글로우로 대체.
- 색은 기존 토큰만 사용: `--qw-gold`, `--qw-gold-deep`, `--qw-blue`, `--qw-silver`.

### 안 A — 브랜드 킬 라인 (애니메이션 글로잉 그라디언트) · **권장**
```css
html[data-unitas-surface='quantum-white'] .qw-hero-wrap h1::after {
  content: '';
  display: block;
  width: 100%;
  min-width: 220px;
  height: 3px;
  margin: 1.1rem auto 0;
  border-radius: 2px;
  background:
    linear-gradient(90deg,
      transparent 0%,
      var(--qw-gold) 18%,
      var(--qw-gold-deep) 38%,
      var(--qw-blue) 50%,
      var(--qw-gold-deep) 62%,
      var(--qw-gold) 82%,
      transparent 100%);
  box-shadow:
    0 0 18px rgba(184, 150, 46, 0.45),
    0 1px 0 rgba(255, 255, 255, 0.9),
    0 6px 22px -8px rgba(11, 92, 255, 0.35);
  position: relative;
  overflow: hidden;
}
/* 경면 스윕: 4.5s 주기로 좌→우 광택이 지나간다 */
html[data-unitas-surface='quantum-white'] .qw-hero-wrap h1::after {
  background-size: 100% 100%, 38% 100%;
  background-image:
    linear-gradient(90deg, transparent, var(--qw-gold) 18%, var(--qw-gold-deep) 38%, var(--qw-blue) 50%, var(--qw-gold-deep) 62%, var(--qw-gold) 82%, transparent),
    linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.95) 50%, transparent 100%);
  background-repeat: no-repeat;
  background-position: 0 0, -40% 0;
  animation: qw-rule-sweep 4.5s ease-in-out infinite;
}
@keyframes qw-rule-sweep {
  0%, 12%  { background-position: 0 0, -45% 0; }
  70%, 100% { background-position: 0 0, 145% 0; }
}
```
보조 실버 서브라인(깊이감): `h1` 뒤에 `.qw-title-subrule`을 두지 않고 `::before`를 재활용하지 않는다 — 대신 `box-shadow`의 3번째 레이어가 블루 블룸을 담당한다. **DOM 추가 0, Hero.tsx 무변경.**

### 안 B — 프리즘 레일 (3D 액센트 라인, SVG)
`Hero.tsx`에 `<svg class="qw-title-rule" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden>` 1개 추가. 3개 스트로크를 원근으로 겹친다.
- 스트로크 1: `y=6`, 길이 100%, 두께 3, 골드→블루 그라디언트, `stroke-linecap="round"`
- 스트로크 2: `y=12`, 길이 62%, 두께 1.5, 실버 40%
- 스트로크 3: `y=17`, 길이 38%, 두께 1, 골드 22%
- `<feGaussianBlur>` 기반 글로우 필터 1개, `<animate>` 로 스트로크 1의 `gradientTransform` 을 5s 순환
- 장점: 진짜 3D 깊이, 반응형 완전 무결(`preserveAspectRatio="none"`). 단점: DOM·필터 추가, 저사양에서 필터 비용.

### 안 C — 글래스 플린스 (구조적 글래스모피즘)
밑줄을 **받침대**로 승격. `::after`를 `height: 10px; width: 108%; border-radius: 999px;` + `backdrop-filter: blur(10px) saturate(1.4)` + 상단 1px 골드 헤어라인(`inset 0 1px 0 var(--qw-gold)`) + 하단 블루 블룸. 타이틀이 유리 단 위에 놓인 인상.
- 장점: 가장 강한 존재감, QW 글래스 언어와 정확히 일치. 단점: 화이트 배경에서 `backdrop-filter` 대비가 약해 골드 헤어라인 의존도가 큼, 108% 폭이 좁은 화면에서 컨테이너를 넘칠 수 있어 `max-width: 92vw` 필수.

**권장: 안 A.** DOM 추가 0, `Hero.tsx` 무변경, 길이가 타이틀과 함께 스케일, reduced-motion 안전, 저사양 비용 최소. 창립자가 더 강한 드라마를 원하면 **안 B**로 승격(그때 `Hero.tsx` 1요소 추가).

---

## §3. [요구 3] 초기 클릭 상태 — 단일 디스커버리 캐러셀

### 3.1 삭제 (창립자 지시 그대로)
1. **실시간 숏컷 우측 회전 타이틀 박스 행 전부** — `HotShortcutMatrixStrip.tsx:184-223`의 `DraggableCarouselRow`(핫이슈 서브숏컷 7 + 탭 7 = 14항목)와 탭 개념 자체.
2. **UNITAS Shorts 전부** — 컴포넌트·라이브러리·CSS·i18n·테스트(§7 체크리스트).

### 3.2 새 L1 구조
현재 팝업은 뷰포트의 1.56배(데스크톱) · 3.64배(모바일) 높이로 폭주해 있다. 회전 계층 3개를 하나로 접고 쇼츠를 들어내면 세 덩어리(날씨 204/313 + 허브 카드 123/349 + 쇼츠)가 **카드 1장**으로 줄어 목표 높이는 데스크톱 700px 이하, 모바일 1200px 이하다.

```
검색 포커스 팝업 (L1)
└ <DiscoveryCarousel>                     ← 유일한 회전 계층
   ├ 칩 레일 (22 슬롯, 가로 스크롤, 활성 칩 자동 센터링, 진행 바)
   └ 활성 카드 1장 (날씨 · 뉴스테마 · 피드테마가 전부 같은 셸)
└ 실시간 세계 랭킹 / 실시간 유니타스 랭킹 / 실시간 뉴스   (기존 유지)
```

### 3.3 날씨의 테마화 — "정확히 같은 UI"
창립자 요구의 핵심은 **날씨가 다른 테마와 구별되지 않아야 한다**는 것이다. 그래서 날씨를 테마 카드 셸에 넣는 것이 아니라, **모든 슬롯이 하나의 카드 계약을 구현**하게 한다.

```ts
// lib/live/discoverySlots.ts (신규)
export type SlotKind = 'weather' | 'news' | 'feed';

export interface SlotFact {
  labelKey: string;        // Rev20.slots.facts.*
  value: string;           // 이미 포맷된 값
  unit?: string;
  emphasis?: boolean;      // 카드에서 크게 표시 (슬롯당 최대 1)
}

export interface SlotItem { id: string; title: string; domain?: string; url?: string }

export interface SlotCard {
  facts: SlotFact[];       // 4~6개 — 회전 진입 시 갱신되는 하위 정보
  items: SlotItem[];       // 0~4행
  updatedAt: number;
  cursor: DeepCursor | null;  // 딥 모달 페이지네이션 기술자
}

export interface DiscoverySlot {
  key: SlotKey;            // 'weather' | HubThemeKey | Rev20SlotKey
  kind: SlotKind;
  icon: LucideIcon;
  color: string;
  load(ctx: SlotContext): Promise<SlotCard>;   // 어댑터
}
```
- **날씨 어댑터**: `LiveWeatherPanel`의 상태를 `lib/live/useLiveWeather.ts` 훅으로 추출(순수 리팩터, UI 무변경)해 재사용. `facts = [도시(emphasis 아님), 온도(emphasis), 상태, 최고/최저, 체감, 갱신]`. **네트워크 추가 0** — 현재 훅이 이미 5일 예보를 받는다. 도시 검색·내 위치·5일 예보 전체·상세는 **딥 모달 `slot:weather`로 이관**.
- **뉴스 어댑터**: 기존 `/api/live/hub-news`(9테마) 그대로.
- **피드 어댑터**: §3.5의 신규 12테마. 각자 `load()`에서 무키 소스를 호출.

**"회전으로 진입할 때 하위 정보가 동적으로 갱신"**: 슬롯이 활성화되는 순간 `load()`가 호출되고, 어댑터별 캐시 TTL(날씨 10분 · 뉴스 10분 · 피드 15~60분)을 지나면 새 값으로 교체된다. 날씨도 다른 테마와 **똑같이** 이 규칙을 따른다.

### 3.4 회전·레일 사양
- 슬롯 수 **22** = 날씨 1 + 기존 9 + 신규 12. 주기 7s → 전체 154s.
- **날씨 우선 진입**: `slotAt(i) = SLOTS[(i) % N]`에서 `SLOTS[0] = weather`, 회전 카운터는 마운트 시 0에서 시작한다. 현재의 절대시각 `rotateIndex`는 22슬롯에서 날씨가 첫 화면일 확률이 1/22이라 폐기. SSR·CSR 모두 항상 슬롯 0을 렌더하므로 **하이드레이션 불일치가 오히려 사라진다**.
- 정지: 호버/터치(`paused`) 또는 칩 클릭(`held`, 재클릭 해제). 기존 `held` 계약 유지.
- **활성 칩 자동 센터링**(22개는 반드시 가로 스크롤을 넘김): 슬롯 변경 시 `chipRef.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })`.
- **진행 바 이중 정의 제거**: 현재 CSS `579행의 7s`와 TS `HUB_ROTATE_MS`가 따로 있다. 칩에 `style={{ '--qw-slot-rotate': ROTATE_MS + 'ms' }}`를 주고 CSS는 `animation-duration: var(--qw-slot-rotate, 7s)`로 받는다.
- DOM·CSS는 기존 `.qw-hub-strip / .qw-hub-chip / .qw-hub-progress / .qw-hub-card / .qw-hub-headline / .qw-hub-meta` 계약을 **그대로 승계**(클래스명만 `qw-slot-*`로 별칭 추가, 기존 규칙은 삭제하지 않고 셀렉터 목록에 추가).

### 3.5 신규 12테마 정본 라인업 (AI 위임 창작)

데이터 소스는 전부 `docs/rev20/measure/sources.md`에서 **실호출로 검증**됐다. 색상은 PHASE 2에서 대비 패스를 거치되 **규칙: 회전 순서상 인접한 두 슬롯의 색상 색상환 거리 ≥ 40°**.

| # | 키 | 한국어 | 영문 | 헌법 근거 | 아이콘 | 색 | 데이터 소스(검증됨) | 하위 정보 4~6 | 딥 모달 페이지네이션 | 호기심 훅 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `history` | 오늘의 역사 | Today in History | 제3장 시공간 활률(과거·운명) · 104.초인과율적 | `Hourglass` | #a1785a | 로케일 위키 **날짜 문서** `prop=extracts`(20로케일 200 확인) + en/zh/de/pt 는 onthisday 피드 보강 | 오늘 날짜 · 대표 사건 연도 · 사건 한 줄 · 수록 사건 수 · 오늘 태어난 인물 · 갱신 | 연도순 타임라인, 날짜 문서 섹션 단위 무한 | "오늘, 역사에서는 무슨 일이 있었나" |
| 2 | `quake` | 지구 맥박 | Earth Pulse | 213.초자연재해정류적 · 제3장 원소역할(땅) | `Activity` | #b4452e | USGS GeoJSON `all_day`(263건/일) · `2.5_week`(243KB) | 최근 지진 규모(emphasis) · 지역 · 깊이 · 경과 시간 · 24시간 건수 · 최대 규모 | 주간 피드 시간순 무한(수백 건) | "지금 지구는 몇 번 흔들렸나" |
| 3 | `mostRead` | 최다 열람 | Most Read | 96.초위키피디아융합적 · 463.초체류시간폭발적 | `Eye` | #4b5bbf | Wikimedia pageviews top `<locale>.wikipedia` (상위 1000) | 1위 문서(emphasis) · 조회수 · 2~4위 · 기준일 · 전일 대비 | 1000위까지 20개씩 **50페이지** | "어제 이 나라가 가장 많이 찾아본 것" |
| 4 | `fx` | 환율 나침반 | FX Compass | 22.초경제적 · 167.초디지털노마드적 · 377.초재무관리적 | `ArrowLeftRight` | #6b7a8f | Frankfurter(ECB 공식, 무키) | 기준 통화 · 주요 4통화 환율 · 전일 대비 · 기준일 | 30/90/365일 시계열 + 전 통화 목록 | "오늘 내 돈의 무게" |
| 5 | `crypto` | 코인 맥박 | Coin Pulse | 65.초비트코인분석적 · 108.초탈중앙금융적 · 531.초UCOIN마이크로버른적 | `Bitcoin` | #3fa34d | CoinGecko `coins/markets` (`page` 확인) | BTC 가격(emphasis) · 24h 변동 · ETH · 시총 1~3위 · 갱신 | 시총 250위까지 페이지 | "탈중앙 시장의 맥박" |
| 6 | `devPulse` | 개발자 맥박 | Dev Pulse | 170.초빅테크독립적 · 481.초오픈소스에이전트적 | `Terminal` | #2f3640 | HN Algolia(`page` 0~19, 50/page = **1000건**) | 상위 스토리 제목(emphasis) · 포인트 · 댓글 수 · 도메인 · 갱신 | 20페이지 무한 | "지금 기술자들이 논쟁 중인 것" |
| 7 | `paper` | 오늘의 논문 | Paper of the Day | 20.초과학적 · 232.초지성문명적 · 551.초초지능자율학습적 | `FlaskConical` | #8a6d14 | OpenAlex(`page`, count 112,933 확인) | 논문 제목(emphasis) · 저자 · 연도 · 인용 수 · 오픈액세스 여부 | `page` 무한(수천 페이지) | "인류가 어제 새로 알아낸 것" |
| 8 | `library` | 서가 한 칸 | The Shelf | 221.초교육복지적 · 96.초위키피디아융합적 | `Library` | #7b4f2e | OpenLibrary `search.json`(`page`) | 도서명(emphasis) · 저자 · 초판 연도 · 판본 수 · 표지 | `numFound` 기반 페이지 | "이 주제로 쓰인 책들" |
| 9 | `art` | 예술 한 점 | One Artwork | 18.초예술적 · 218.초예술표현적 | `Palette` | #7b2d8e | Met Museum(`search` → `objects/<id>`, "moon" total 2,355) | 작품명(emphasis) · 작가 · 제작 연도 · 소장부서 · 이미지 | objectIDs 배열 20개씩(수천) | "오늘 당신 눈에 걸린 한 점" |
| 10 | `air` | 숨쉬는 공기 | The Air | 214.초환경기운적 · 제3장 원소역할(바람) | `Wind` | #63b3ed | Open-Meteo Air Quality. **위치는 날씨 슬롯의 `geoCache` 재사용** | AQI 등급(emphasis) · PM2.5 · PM10 · 도시 · 갱신 | 시간별 예보 + 도시 비교 | "지금 내가 마시는 공기" |
| 11 | `nation` | 국가 지표 | Nation Metrics | 217.초사회구조적 · 238.초사회거버넌스적 · 168.초글로벌확장적 | `Landmark` | #2d6a4f | World Bank(`per_page`/`page`/`date`) | 국가 · GDP(emphasis) · 인구 · 기대수명 · 인터넷 보급률 | 지표별 시계열 + 국가 랭킹 | "숫자로 본 내 나라" |
| 12 | `nearby` | 가까운 문서 | Nearby | 135.초공간도약적 · 제3장 우주 아키텍처 | `MapPinned` | #c05621 | 로케일 위키 `list=geosearch`(반경 10km, 7.7KB 확인). 위치는 날씨 `geoCache` 재사용 | 가장 가까운 문서(emphasis) · 거리 · 2~3번째 문서 · 반경 내 총 수 | `gsradius` 확대 + `gscontinue` | "내 반경 10km 안의 이야기" |

**총 22슬롯** = 날씨 1 + 기존 9(게임·스포츠·영화·베스트셀러·쇼핑·주식·웹툰·패션·맛집) + 신규 12. 창립자 요구 "20개 이상" 충족.

회전 순서(날씨 우선, 성격이 붙지 않게 교차 배치):
`weather → mostRead → stock → history → sports → crypto → movie → quake → shopping → paper → game → fx → food → art → webtoon → devPulse → fashion → nation → bestseller → air → library → nearby` → (순환)

### 3.6 캐러셀 행 삭제의 대가와 권장 보완
행을 없애면 L1에서 **46개 진입점**(축 29 + 앱 런처 17)이 브라우징으로 도달 불가가 된다. 타이핑 인덱스(`liveSearchIndex`)는 46개 전부를 색인하므로 **검색하면 여전히 나오지만 "둘러보다 발견"은 사라진다.**

- **권장**: 캐러셀 레일 **끝에 칩 1개**(`전체 탐색`, `Grid3x3` 아이콘)를 두고, 누르면 29축 + 17앱을 한 화면 그리드로 보여주는 모달(`slot:index`)을 연다. 회전 박스는 완전히 사라지고 진입점은 보존된다.
- **대안**: 지시대로 완전 삭제하고 타이핑 경로만 남긴다.
→ **창립자 결정 항목 D-1.**

---

## §4. [요구 4] 키워드 클릭 팝업 — 검색바 폭 앵커 + 내부 페이지네이션

### 4.1 앵커링 (폭·경계 완벽 일치)
**포털을 쓰지 않는다.** 현재 타워는 `document.body` 포털이라 `.dashboard-zoom`(zoom 0.75) 바깥에 있고, 그래서 검색바와 좌표계가 다르다. 새 패널은 **타이핑 드롭다운과 정확히 같은 자리**에 형제로 둔다.

```tsx
// OmniSynapseSearch.tsx — 드롭다운과 같은 컨테이너의 형제
<div className="qw-search-wrap relative mx-auto w-full max-w-7xl px-6">
  <form>… #omni-synapse-search …</form>
  {suggestOpen && <div className="qw-search-dropdown absolute left-6 right-6 top-full …" />}
  {keywordPanel && <div className="qw-keyword-panel absolute left-6 right-6 top-full …" />}   {/* 신규 */}
</div>
```

현재 `left-6 right-6`은 컨테이너 `px-6`을 손으로 미러링한 **이중 상수**다. REV-20은 단일 소스로 묶는다.
```css
html[data-unitas-surface='quantum-white'] .qw-search-wrap { --qw-search-inset: 1.5rem; padding-inline: var(--qw-search-inset); }
html[data-unitas-surface='quantum-white'] .qw-search-dropdown,
html[data-unitas-surface='quantum-white'] .qw-keyword-panel {
  inset-inline: var(--qw-search-inset);
}
```
→ 패널의 좌우 경계는 `#omni-synapse-search`와 **정의상 동일**하다(같은 컨테이너의 콘텐츠 박스). rect 동기화 코드 불필요.

실측 목표값: 데스크톱 1366에서 패널 `x=221, w=924`, 모바일 390에서 `x=18, w=354` — 즉 현재 검색바의 rect와 **완전 일치**. (현재 타워는 모바일에서 `x=0, w=390`으로 좌우 각각 18px를 넘친다.)

높이: `max-height: min(72vh, calc(100svh - var(--unitas-nav-bottom, 64px) / var(--unitas-zoom, .75) - 140px)); overflow-y: auto; overscroll-behavior: contain;` — **홈 본문 스크롤 잠금 없음**(REV-14 원칙). 풀스크린 금지 요구 충족.

히스토리 레이어: `useHistoryLayer(open, 'keyword:' + axisKey, close)`. L1 또는 L3 위에 쌓이므로 back 1회에 패널만 닫힌다. ESC는 `isTop()`일 때만.

### 4.2 기본 콘텐츠 전면 제거
제거: 형제 사다리 wrap 카운터 행 · `restoredNote` 배너 · 축 독트린 정적 설명 · 글로벌 펄스 게이지 · 6축 점수 버튼 그리드 · 형제 축 `extraChips` 벽 · 추가검색 폼 · **`AppLoopRow`**.
→ `AppLoopRow` 제거는 2026-09-03 "모든 U-AI 팝업 공통 고정" 지시와 정면 충돌. **창립자 결정 항목 D-2.**

### 4.3 내부 페이지네이션 (§6 공통 엔진 사용)
- 하단 고정 바: `‹ 이전 | N 페이지 | 다음 ›` + 페이지 점 8개(9페이지 이상은 `…`), 키보드 `←/→`, 모바일 가로 스와이프.
- 다음 페이지 **프리페치 1장**(현재 페이지 렌더 직후 유휴 시 요청).
- 페이지 전환은 카드 스택 슬라이드(0.22s), `prefers-reduced-motion`이면 크로스페이드.
- **빈약 방지**: 한 페이지의 블록 텍스트 총량이 900자 미만이면 다음 소스 레그를 승격해 채운다(§6.4 fail-closed 폴백).

### 4.4 실시간 시그널·호기심 카드 이관
두 위젯은 현재 **타이핑 드롭다운**(`data-discovery="signals"`, `data-discovery="curiosity"`)에 있다. 창립자 지시대로 Enter 전 화면에서 **완전히 제거**하고 §5 풀스크린에 주입한다. 드롭다운에는 섹션 1(실시간 검색 키워드)과 "이어서 탐색"(최근 쿼리)만 남긴다.

---

## §5. [요구 5] Enter 후 100vw/100vh 하이퍼 검색엔진

### 5.1 전환 연출
현재 타워는 모바일에서 `y=74.5, h=769.5`(뷰포트 844의 **91.2%**)로 내비 아래에서 시작한다. 100vh가 아니다.

`DialogTower`에 `variant?: 'nav-anchored' | 'fullscreen'` 추가. 숏컷 타워는 `nav-anchored` 기본값 유지 → **회귀 0**.
- `fullscreen`: `top: 0; left: 0; width: 100vw; height: 100svh;` 내비까지 덮는다. 완료 조건: 실측 rect가 `y=0, h=viewport.h`.
- 모프: 제출 순간 `#omni-synapse-search`의 rect를 캡처해 framer-motion `initial={{ top, left, width, height, borderRadius: 18 }} → animate={{ top:0, left:0, width:'100vw', height:'100svh', borderRadius:0 }}`, 0.72s `[0.16,1,0.3,1]`. 검색바가 확장되어 화면을 삼키는 느낌. reduced-motion이면 0.2s 페이드.
- **CSS 결합 해소 필수**: `quantum-white-rev19.css:425-432`가 `.z-\[120\]`과 `.bg-quantum\/95` **클래스명에 하드 결합**되어 있다. 변형을 추가하면 리맵이 깨지므로 셀렉터를 `[data-tower-variant]` 속성 기반으로 바꾸고 두 변형 모두 등록한다.
- z-index: 내비를 덮어야 하므로 PHASE 2에서 `#unitas-nav`의 계산된 z를 실측해 그 위로 둔다(측정 없이 숫자를 정하지 않는다).
- 닫기: 툴바 X·back 1회 → 역모프 후 `uai.reset()`. 검색 3레이어는 그 아래 그대로 → back 계약 불변.

### 5.2 레이아웃
데스크톱 ≥1024px 3열:
- **좌 스파인 240px**: 현재 쿼리 · **깊이 미터**(페이지 진행률) · **각인 원장**(핀한 카드 스택) · 페이지 점프 점
- **중앙 스트림** max-width 760px: 무한 지식 카드
- **우 레일 300px**: 실시간 시그널(주입) · 호기심 카드(주입)

모바일: 단일 열. 스파인은 상단 스티키 바(쿼리 + 깊이 미터)로 접히고, 시그널·호기심은 카드 6장마다 스트림에 인라인 주입.

### 5.3 스트림 카드 타입 (풀스크린 전용 신규 모듈 — AI 위임 창작)

| # | 카드 | 내용 | 소스 | 페이지 모델 |
|---|---|---|---|---|
| 1 | **정의** | 쿼리 문서 도입부 전문 + 썸네일 | Wikipedia `generator=search&prop=extracts&exintro` | `gsroffset` 무한 |
| 2 | **숫자 하나** | 이 쿼리를 대표하는 수치 1개를 대형 타이포로 | OpenAlex 인용 수 · World Bank · CoinGecko · HN 포인트 중 해당하는 것 | 페이지마다 다른 지표 |
| 3 | **연관 성좌** | 링크 그래프를 별자리로 렌더, 노드 클릭 = 후속 쿼리 | Wikipedia `prop=links` | `plcontinue` 무한 |
| 4 | **시간선** | 연도별 언급/발행 분포 막대 + 대표 연도 사건 | OpenAlex 연도 히스토그램 + 위키 날짜 문서 | 연도 구간 페이지 |
| 5 | **반대 관점** | 같은 쿼리에 대한 비판·논쟁 스레드 | HN Algolia(`page`) · StackExchange | `page` 무한 |
| 6 | **좌표** | 쿼리가 장소를 가지면 반경 내 문서 | Wikipedia `list=geosearch` | `gscontinue` |
| 7 | **질문 사슬** | 이 쿼리에서 파생된 질문 3개, 누르면 새 스트림 | 로컬 휴리스틱 + 호기심 카드 풀 | 페이지마다 재생성 |
| 8 | **6축 해체** | 헌법 6축 재설계 블록 | 기존 `genesis_memory` cr-v1 **캐시 재사용(0원)** | 쿼리당 1장 |
| 9 | **심층 리포트 게이트** | 유료 3 U-COIN CTA + 결과 | 기존 `/api/u-ai/insight` | 쿼리당 1장 |
| 10 | **실시간 시그널**(주입) | 회전 테마 헤드라인 4 | 기존 `useHubHeadlines` | 테마 순환 |
| 11 | **호기심 카드**(주입) | 12문 중 3장 | 기존 `pickCuriosityCards` | 6h 순환 |

### 5.4 중독성 루프 — 구글을 닮지 않기 위한 6가지 장치
1. **가변 보상**: 페이지 N의 카드 순서는 `hash(query, N)`로 결정론적 셔플. 다음 페이지에 무엇이 나올지 모르지만 **재현·캐시 가능**(오프라인 결정론 유지).
2. **깊이 미터**: 좌 스파인이 페이지마다 차오르고 3/7/15페이지에 마일스톤 배지. "얼마나 깊이 들어왔는가"가 항상 보인다.
3. **각인(Engrave)**: 카드를 탭하면 세션 원장에 고정되어 스파인에 쌓인다. 쌓인 카드는 하나의 후속 쿼리로 내보낼 수 있다. 수집욕.
4. **다음 카드 예고(peek)**: 다음 카드의 제목 스트립이 항상 접힘선 위로 조금 보인다. 종료 비용을 만든다.
5. **"한 단계 더" 플레이트**: 페이지 끝마다 전폭 플레이트에 다음 페이지 카드 타입 아이콘을 미리 렌더. 클릭 유인.
6. **사운드**: 카드 포커스에 `playHoverSfx`, 페이지 전진에 `playSpatialPing`(기존 엔진 재사용, 신규 에셋 0).

**금지**: 10개 파란 링크 나열, 지식 패널 사이드박스, "사람들이 많이 묻는 질문" 아코디언. 스트림은 항상 **이종 카드의 수직 연쇄**이지 동종 결과의 목록이 아니다.

### 5.5 무한 스크롤
`OmniSynapseSearch:991`의 스크롤 컨테이너 바닥에 `IntersectionObserver` 센티널. 한 번에 1페이지 로드, 최대 동시 요청 2, 실패 시 지수 백오프 3회 후 "다시 시도" 카드.
**주의**: 현재 `handleChange`가 입력 변경 즉시 `uai.reset()`을 호출해 스트림을 통째로 파괴한다. 풀스크린이 열려 있는 동안에는 입력 편집이 스트림을 리셋하지 않도록 제출된 쿼리로 스트림을 키잉한다.

---

## §6. 공통 엔진 — 데이터 사다리 (요구 4·5 공유)

### 6.1 볼륨 상한 상향 (최우선 · 최대 효과)
`lib/uai/webSynthesisCore.ts`
- `MAX_SOURCES` 8 → **24**
- `MAX_SNIPPET` 260 → **600**
- `MAX_DIGEST` 2800 → **6000**
- **신규 레그**: `generator=search&gsrlimit=10&prop=extracts&exintro=1&explaintext=1` (문서 10개 도입부 전문, `gsroffset` 연속)
- abort 서버 4500ms 유지, 브라우저 3000ms → 5000ms

이 한 묶음만으로 키워드당 실제 텍스트가 약 820자에서 **1만 자 이상**으로 늘어난다. 신규 유료 API 0건.

### 6.2 페이지 조립 레시피 (순수 함수, 테스트 가능)
```ts
// lib/uai/dataLadder.ts (신규, 순수)
export interface LadderCursor {
  wikiSearch?: number;    // sroffset
  wikiExtract?: number;   // gsroffset
  wikiLinks?: string;     // plcontinue
  wikidata?: number;      // search-continue
  hn?: number;            // page
  openAlex?: number;      // page
  news?: number;          // axis-news page (0..13)
}
export function recipeFor(page: number): LadderLeg[];   // 페이지 → 소스 조합
export function foldPage(legs: LegResult[]): LadderPage; // 결과 → 블록 배열
export function isThin(page: LadderPage): boolean;       // 900자 미만 판정
```
- p1 정의·핵심 개체 / p2 관련 문서·카테고리 / p3 뉴스 / p4 지표 / p5+ `sroffset`·OpenAlex·HN 라운드로빈

### 6.3 캐싱 (초지능 캐싱 · 마진 ∞)
- 키: `sk-v1::<locale>::<normalizedQuery>::p<N>` — 기존 `shortcut_cache` 테이블에 **행을 추가**한다. **DB 스키마 변경 0, `SHORTCUT_CACHE_VERSION` 범프 0.**
  - `payload.pages[]` 확장안은 `sc-v1 → sc-v2` 범프를 강제하고 시드 580행 전량 재합성을 유발하므로 **채택하지 않는다.**
- CDN: 기존 라우트와 동일 `public, s-maxage=3600, stale-while-revalidate=86400`.
- 브라우저: 페이지 단위 localStorage 24h(`unitas.uai.ladder.v1`, LRU 120).
- 두 번째 방문·같은 쿼리는 네트워크 0.

### 6.4 Fail-Closed 폴백
`sourced: false`(타임아웃·오프라인)일 때 **빈 화면을 절대 만들지 않는다**. 순서대로 승격: ① 로컬 라이브 인덱스 매치 ② `genesis_memory` cr-v1 캐시 ③ 최근 쿼리·호기심 카드 ④ "네트워크 없음" 상태 카드(재시도 버튼).

### 6.5 운영 제약 (실측)
Wikimedia 계열은 **병렬 버스트에 429**가 떨어진다(20로케일 동시 호출 시 대부분 429, 1.2초 간격 직렬은 전부 200). → 20로케일 프리워밍은 **서버 크론에서 직렬·스로틀**로만 하고 CDN이 흡수한다. 브라우저 팬아웃 금지.

---

## §7. 삭제 체크리스트

### 7.1 UNITAS Shorts
- **파일 삭제 4**: `components/home/UnitasShortsPanel.tsx`, `components/home/ShortsCreatorPass.tsx`, `lib/live/shortsSeed.ts`, `lib/live/shortsPass.ts`
- **참조 제거**: `LiveHubPanel.tsx` import 10행 · 마운트 173~177행 · 헤더 주석 29행; `HotShortcutMatrixStrip.tsx` 247~248 주석
- **CSS**: `quantum-white-rev19.css` 629~713(`.qw-shorts-rail`, `.qw-short-card`, `.qw-short-title`, `.qw-short-meta`, `.qw-short-poster`, `.qw-pill-btn`) · §19 주석 534~535
- **⚠ `app/waitlist.css`는 통째로 지우지 말 것 — §1도 통째로 지우면 회원가입이 깨진다.** 이 파일은 `app/layout.tsx:18`에서 전역 import된다. §1(`.u-wl-*`, 50~494행)이 대부분 쇼츠 전용이지만 **가입 폼의 메일 핸들 필드(`components/auth/MailHandleField.tsx`)가 §1의 클래스 4개를 공유한다.**

  **반드시 존치(허용목록)**: `.u-wl-eyebrow` · `.u-wl-input-row`(모든 `[data-state]` 변형 포함) · `.u-wl-input` · `.u-wl-domain`, 그리고 §2(`.u-mail-*`, 495행~)·§3(클레임 토스트) 전부.

  **삭제 대상**: 위 4개를 제외한 모든 `.u-wl-*` 규칙 — `scene, card, card-inner, card-body, orb, title, lede, ticket, ticket-handle, ticket-sub, serial, seal, waves, wave, wave-now, perks, perk, perk-dot, form, at, btn, honest, status, rail-card, rail-plus, rail-title, rail-sub` — 및 `@property --u-wl-spin`, `@keyframes u-wl-spin|u-wl-sweep|u-wl-float|u-wl-pulse|u-wl-btn-ring`. 파일 하단 리듀스모션 블록(682행 부근)에서는 **삭제된 셀렉터만** 골라낸다.

  행 번호가 아니라 **클래스 허용목록으로 작업할 것**(한 줄만 지워도 이후 행 번호가 전부 밀린다). 근거: `u-wl-`를 쓰는 파일은 `ShortsCreatorPass.tsx`(26개 클래스), `UnitasShortsPanel.tsx`(`rail-*` 4개), `MailHandleField.tsx`(위 4개) 셋뿐이다.
- **`components/ui/usePointerTilt.ts` 존치** — `MailHandleField`와 `ShortsCreatorPass`가 함께 쓴다.
- **i18n**: `Rev19.shorts.*` **37키 × 20로케일**(`messages/*.json`) + `docs/rev19/i18n/*.json` 20파일. `Rev19.mail.perk2`의 쇼츠 언급 문구 20로케일 수정
- **테스트**: `__tests__/live/hubThemes.test.ts` import 12행 + `describe('shorts seed')` 64~81행; E2E `rev19-back-stack.spec.js` 126~134행
- **localStorage**(잔존해도 무해): `unitas.shorts.v1`, `unitas.shorts.pass.v1`, `unitas.device.v1`
- **Supabase**: `user_metadata.unitas_shorts_pass`는 스키마 무변경이나 기존 가입자 메타데이터가 고아로 남는다 → **창립자 결정 항목 D-3**
- **유지**: `lib/auth/unitasHandle.ts`의 예약어 `'ushorts','u-shorts'`(브랜드 보호), `usePointerTilt`, `DiscoveryLinks`

### 7.2 회전 타이틀 박스 행
- `HotShortcutMatrixStrip.tsx` 169~272행(탭 행·`DraggableCarouselRow`·탭별 콘텐츠 분기) 제거, `TabKey`/`TABS`/`activeTab`/`selectTab`/`unitas.ouroboros.tab.v1` 소멸
- `DraggableCarouselRow.tsx` **파일은 존치**(랭킹 3종·뉴스가 사용)
- `AppDetailCard.tsx` 존치(검색 타워 `AppLoopRow`가 사용)
- `OmniSynapse.tab.*` 8키 존치(`LiveLadderExplorer`가 계속 사용)

### 7.3 시그널·호기심 이동
- `OmniSynapseSearch.tsx` 873~926행(두 섹션) 제거 → 풀스크린 스트림으로 이관
- `useHubHeadlines`/`clock` 이펙트의 게이트를 `browsing` → 풀스크린 열림 조건으로 변경
- i18n 키는 **삭제하지 말고 `Rev19.search.*` 그대로 재사용**(패리티 영향 0)

### 7.4 키워드 팝업·풀스크린에서 제거할 정적 블록
§4.2, §5 참조. `SurfaceReport` 타입(lenses/shield/constitution/swarm)은 `shortcutCore`·`shortcutCache` 테스트가 공유하므로 **렌더만 제거하고 데이터 계약은 유지**한다.

---

## §8. i18n 계획

- **신규 네임스페이스 `Rev20`** ≈ 120키: 슬롯 12×{title,tag} 24 · 슬롯 fact 라벨 약 30 · 캐러셀 UI 10 · 키워드 패널 18 · 풀스크린 26 · 카드 타입 라벨 12
- 파이프라인은 REV-19를 그대로 복제: `scripts/i18n/apply-rev20.mjs`(= `apply-rev19.mjs` 사본, `NAMESPACE='Rev20'`, `draftsDir = docs/rev20/i18n`), 드래프트는 **평문 dot-path 키**, 게이트는 "en과 키 집합 완전 일치 + ICU 토큰 일치", 실패 시 en 폴백 + 시끄러운 리포트
- **실행 순서 함정**: 반드시 `apply(write) → --check → build` 순. `--check`를 먼저 돌리면 드리프트로 exit 1
- 신규 `__tests__/i18n/rev20Parity.test.ts` — `rev19Parity.test.ts` 패턴 복제(20로케일 키 집합 동일, ICU 동일, 빈 문자열 금지)
- `rev19Parity.test.ts`는 `shorts.*` 삭제 후에도 통과(en과 20로케일이 함께 줄어들면 집합은 계속 일치). 단 **en 한 곳만 지우면 즉시 실패** → 21개 파일 동시 수정
- 법적 리스크 어휘 준수: 주권→소버린, 제국→네트워크. `ko.json` "고지" 0건 규칙 유지

---

## §9. 테스트·게이트 계획

### 9.1 갱신이 필요한 기존 테스트
| 파일 | 단언 | 조치 |
|---|---|---|
| `tests/web-cinema-e2e/rev19-hero-geometry.spec.js:69` | `\|itCx − h1Cx\| ≤ 1` | §1.3 잉크 규약으로 교체(`\|inkCx − viewportCx\| ≤ 1`) |
| 〃 `:70-71` | `\|A − B\| ≤ 1.5`, `A > 20` | **불변**(회귀 가드로 유지) |
| `web/__tests__/live/hubThemes.test.ts:19` | 테마 "정확히 9개" | 뉴스 테마 9 + **슬롯 22** 두 단언으로 분리 |
| 〃 `:64-81` | shorts seed | 삭제 |
| `tests/web-cinema-e2e/rev19-search-back.spec.js:58` | 드롭다운에 호기심 카드 존재 | 풀스크린에 존재하는지로 이전 |
| 〃 `:57` | 드롭다운에 `[data-live-hub]` 0건 | **불변** |
| `tests/web-cinema-e2e/rev19-back-stack.spec.js:126-134` | shorts 레이어 | 삭제 |
| `web/__tests__/i18n/rev19Parity.test.ts` | Rev19 키 집합 | shorts 제거분 반영 |

### 9.2 신규 테스트
- vitest: `live/discoverySlots.test.ts`(22슬롯·색상 인접 규칙·어댑터 계약), `uai/dataLadder.test.ts`(레시피 결정론·`isThin`·커서 전진), `uai/streamShuffle.test.ts`(같은 (query,page)는 항상 같은 순서), `i18n/rev20Parity.test.ts`
- E2E: `rev20-hero-centre.spec.js`(잉크 중심·밑줄 길이 ≥ 런 폭 95%), `rev20-carousel.spec.js`(날씨 첫 카드·22칩·활성 칩 센터링·hold), `rev20-keyword-panel.spec.js`(패널 좌우가 검색바와 ±1px·풀스크린 아님·페이지 넘김·back 1회 닫힘), `rev20-fullscreen.spec.js`(100vw/100svh·시그널·호기심 주입·무한 스크롤 2페이지·back 1회 닫힘 후 검색 3레이어 유지)

### 9.3 Fail-Closed 게이트 (순서 고정)
```
cd index.html
node scripts/sync-codex.mjs            # drift=0 (prebuild가 자동 실행하나 선확인)
npm --prefix web run typecheck         # EXIT 0
node scripts/i18n/apply-rev20.mjs      # write
node scripts/i18n/apply-rev20.mjs --check
cd web && npx vitest run               # 전건 통과 (npm --prefix 형태는 깨짐)
cd index.html && npm --prefix web run build   # EXIT 0, prebuild 3종 + postbuild 매니페스트
npx playwright test --config tests/web-cinema.config.js
```
배포는 창립자 결정대로 CLI 수동: `git push origin main` → `cd web && npx vercel --prod --yes --scope the-unitas-global-ou-e`.

---

## §10. PHASE 2 실행 순서

1. **§1 + §2** (히어로) — 가장 작고 독립적. CSS 2블록 + E2E 규약 교체. 여기서 먼저 게이트를 통과시켜 기준선을 만든다.
2. **§7.1 쇼츠 삭제** — 순수 제거. i18n 21파일 동시.
3. **§6.1 볼륨 상한 상향** — 단독으로도 체감 효과가 가장 크다. 기존 UI 그대로 검증 가능.
4. **§3 캐러셀** — `useLiveWeather` 훅 추출 → `discoverySlots.ts` → 12어댑터 → 캐러셀 컴포넌트 → §7.2 행 삭제.
5. **§6.2~6.4 데이터 사다리 엔진** — 순수 함수 + 캐시 레이어. 단위 테스트 선행.
6. **§4 키워드 패널** — 엔진 위에 UI.
7. **§5 풀스크린** — `DialogTower` variant → 모프 → 스트림 → §7.3 시그널·호기심 이관.
8. **§8 i18n 20로케일** → 게이트 → 배포.

---

## §11. 편집 경계 · 금지

- `lib/exit/appExit.ts` 센티널 계약, `EXIT_GUARD_BOOTSTRAP`, `sealHistoryEntryNow`, `terminateInPlace` **무변경**
- `lib/history/modalStack.ts` 코어 **무변경**(신규 표면은 `useHistoryLayer`만 사용)
- 다크 라우트(모듈 페이지·커밍순·게이트) 시각 **무변경** — 모든 신규 CSS는 `html[data-unitas-surface='quantum-white']` 스코프
- **DB 마이그레이션 0건**, Supabase 스키마 0건, 외부 **유료** API 0건
- 홈 본문 스크롤 잠금 금지(REV-14) — 키워드 패널은 내부 스크롤만
- 20로케일 키 패리티 유지, `QuantumWhite` 드리프트 테스트 임계 유지
- `HotShortcutResultModal`의 셸을 바꾸더라도 `DialogTower`의 `nav-anchored` 기본 동작은 유지해 숏컷 타워 회귀 0

---

## §12. 창립자 결정 필요 항목

| # | 사안 | 권장 | 대안 |
|---|---|---|---|
| **D-1** | 캐러셀 행 삭제로 L1에서 46개 진입점(29축 + 17앱) 도달 불가 | 레일 끝에 `전체 탐색` 칩 1개 → 그리드 모달로 진입점 보존 | 지시대로 완전 삭제, 타이핑 경로만 유지 |
| **D-2** | 요구 4·5의 "기본 콘텐츠 전부 제거" vs 2026-09-03 "`AppLoopRow`를 모든 U-AI 팝업에 공통 고정" 지시 충돌 | 키워드 패널에서는 제거(폭이 좁아 18타일이 들어가지 않음), 풀스크린 하단에는 유지 | 두 곳 모두 제거 / 두 곳 모두 유지 |
| **D-3** | 쇼츠 삭제 후 `user_metadata.unitas_shorts_pass` 고아 데이터 | 그대로 둔다(스키마 무변경, 무해) | 1회성 정리 스크립트 |
| **D-4** | 풀스크린이 내비를 덮음(현재는 내비가 항상 살아있음) | 덮되 툴바에 홈·언어 버튼을 승계 | 내비 노출 유지(= 100vh 요구 일부 양보) |
| **D-5** | `bestseller`(뉴스 RSS 기반)와 신규 `library`(OpenLibrary 실데이터) 주제 중복 | `bestseller`를 OpenLibrary 데이터로 승격하고 `library`를 흡수 → 21슬롯 | 둘 다 유지(22슬롯) |
| **D-6** | 유료 심층은 `genesis_memory` 캐시 히트에도 3 U-COIN을 선차감하고 생성 실패 시 환불 경로가 없다(기존 결함) | REV-20 범위에서 캐시 히트 시 차감 면제 또는 실패 시 환불 추가 | 현행 유지(별도 라운드) |

---

## §13. 미결 · 리스크

1. **데스크톱 타워 실측 공백**: §0.1 참조. 히어로·L1·모바일 타워는 실측됐고, 데스크톱 키워드·타이핑 단계만 `ExitGuard` 종료 확인 팝업 간섭으로 실패했다. PHASE 2 첫 단계에서 보강한다.
2. **`docs/rev19/measure/*.json`은 낡았다**(`text-indent: 19.04px` 시절 스냅샷). `measure19.js`도 `h1.firstChild`를 텍스트 노드로 가정해 현재 마크업(`.qw-title-word` span)에서 깨진다. REV-20은 `docs/rev20/measure/`를 정본으로 쓴다.
3. **22슬롯 첫 순회 비용**: 테마별 첫 로드 1회씩. 10분 캐시 안에서는 0. 저사양에서 22칩 가로 스크롤의 레이아웃 비용은 PHASE 2에서 측정.
4. **`onthisday` 피드 로케일 구멍**: 20로케일 중 en·zh·de·pt만 지원(ko·et·ja·vi·id·pl·nl은 404). 그래서 `history` 슬롯의 정본 소스를 로케일 위키 날짜 문서로 정했다.
5. **Wikimedia 429**: §6.5 참조. 서버 직렬·스로틀 필수.
6. **`DialogTower` 셸 공유**: 변형 추가는 숏컷 타워(824행)에 즉시 전파된다. `variant` 기본값과 E2E 회귀로 가드.
7. **`quantum-white-rev19.css:425-432`의 클래스명 결합**: `.z-\[120\]`·`.bg-quantum\/95`에 묶여 있어 타워 클래스를 바꾸면 화이트 글래스 리맵이 조용히 사라진다. 속성 셀렉터로 전환할 것.
8. **`handleChange`의 즉시 `uai.reset()`**: 풀스크린 스트림을 통째로 파괴한다(§5.5).
9. **키워드 패널 E2E 공백**: 현재 숏컷 타워를 여는 Playwright spec이 0건이다. REV-20에서 신설한다.
10. **`role="dialog"` 셀렉터 오염**: `omni-exit.spec.js:122`·`app-exit-collapse.spec.js:27`이 `[role="dialog"]`로 로케이터를 잡고, `ExitGuard.anotherOverlayOpen()`도 같은 셀렉터로 hit-test한다. 키워드 패널이 `role="dialog"`를 달면 두 곳 모두에 영향 → 패널은 `role="dialog"` + `aria-modal="false"`로 두고 E2E 로케이터를 좁히는 편이 안전.
