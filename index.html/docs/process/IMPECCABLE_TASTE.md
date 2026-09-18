# IMPECCABLE TASTE — THE UNITAS GLOBAL 프론트엔드 취향 독트린

> 각인: 2026-09-18 창립자 지령 MISSION 2 · 정본 경로 `index.html/docs/process/IMPECCABLE_TASTE.md`
> 구속 선언: 운영 루트 `index.html/CLAUDE.md` §0 부록 하단 「IMPECCABLE TASTE」 절 · `.roo/rules/unitas-impeccable-taste.md`
> 강제 게이트: `npm --prefix web run test` (아래 §4 표에 규칙 ↔ 테스트 대응)

---

## §0. 이 문서가 존재하는 이유

창립자는 최고급 UI/UX(글래스모피즘, 정밀 픽셀 정렬, 고급 모션 곡선)를 에이전트가 **강제로 적용받도록** 지시했다. 그 지시를 일반적인 디자인 조언으로 이행하면 오히려 품질이 내려간다 — 실측된 사실 때문이다.

이 저장소에는 이미 7개 전역 스타일시트(`web/app/` 하위, 합계 약 300KB)와 두 개의 표면(dark / `quantum-white`)을 가진 엄격한 디자인 시스템이 살아 있다. 그리고 **널리 쓰이는 취향 조언 중 최소 두 가지가 이 시스템과 정면으로 충돌한다**:

1. "프리미엄 패널에는 글래스모피즘 = `backdrop-filter: blur()`를 쓰라" → 이 저장소는 REV-21에서 중첩 blur 6~8겹과 640px 블러 레이어가 **패럴랙스 프레임마다 재래스터화**되는 것을 실측하고, 사이트 전체를 **blur 1겹**으로 못박았다. 카드에 blur를 얹는 조언은 성능 회귀 지시서다.
2. "ALL-CAPS 라벨과 eyebrow 라벨을 피하라"(`frontend-design` 스킬의 anti-default 목록) → 이 저장소는 `.u-wl-eyebrow`를 `text-transform: uppercase; letter-spacing: 0.32em`로 출하 중이며, 프로젝트 스킬 `unitas-component`가 eyebrow/badge에 대문자 트래킹을 **명시적으로 요구**한다. 이는 출하된 창립자 승인 시각 규약이다.

따라서 본 독트린은 **취향을 서술하지 않는다**. 취향은 이미 결정되어 출하되었다. 본 독트린이 하는 일은 그 취향이 **다음 커밋에서 조용히 무너지는 경로를 봉쇄**하는 것이다. 모든 조항은 디프를 읽어 판정할 수 있어야 하며, 판정할 수 없는 조항은 조항이 아니다.

## §1. 우선순위

1. 최상위 운영 헌법(`CLAUDE.md` §0 / Codex **v49.0 제1~17장**)이 언제나 우선한다.
   - **2026-09-18 승격:** v49.0이 **제12장 「U-Square 하이퍼-테마 생태계 및 제로-프릭션 UI/UX」**를 신설하면서 Impeccable Taste는 문서 독트린에서 **헌법 조문**이 되었다. 본 문서는 이제 그 조문의 시행세칙이며, 조문과 충돌하면 조문이 이긴다. 제12장은 "AI 특유의 밋밋한 기본 스타일 영구 엄금 · 마이크로 인터랙션 · 글래스모피즘 · 1픽셀 오차 0 정밀 타이포그래피"를 강제하고, 에이전트가 **최신 글로벌 디자인 트렌드를 자율 분석해 스스로 미적 판단을 내릴 것**을 요구한다.
   - 제12장 신설로 구 제12~16장은 **제13~17장으로 +1 이동**했다. 본 문서 아래의 장 인용은 모두 v49.0 번호다.
2. 그 다음이 본 독트린.
3. 그 다음이 외부 디자인 스킬(`frontend-design`, `ui-ux-pro-max`, `ui-styling`, `design-system`, `brand` 등).

**외부 스킬이 §3의 조항과 충돌하면 §3이 이긴다.** 외부 스킬은 이 저장소를 측정한 적이 없다. 충돌을 발견하면 침묵하고 따르지 말고, 본 문서에 충돌 항목으로 등재하라(제15장 자율 기록).

## §2. 적용 대상

`web/` 아래의 모든 프론트엔드 변경. 레거시 정적 사이트(저장소 루트 `index.html`, `assets/`, `pages/`)는 읽기 전용이며 본 독트린의 대상이 아니다.

---

## §3. 15개 조항

### A군 — 레이어링 (가장 비싼 실수가 사는 곳)

**규칙 1 · 컨테이닝 블록 절대 금지.**
`html`, `body`, `.dashboard-zoom` 어디에도 `filter` · `backdrop-filter` · `-webkit-backdrop-filter` · `transform` · `perspective` · `will-change` · `contain` · `translate` · `rotate` · `scale`를 `none` 이외의 값으로 선언하지 않는다. 이 9개 속성 중 하나라도 걸리는 순간 그 요소가 **사이트 전역 모든 `position: fixed` 자손의 컨테이닝 블록**이 된다 — 커튼, 내비, 모든 `ModalPortal` 다이얼로그, `ExitGuard`가 동시에 좌표계를 잃는다.
근거: REV-15에서 `body { filter }` 한 줄이 667px 높이 iPhone SE에 **1702px 커튼**을 그렸다(`web/app/quantum-white.css:132-140`, `docs/rev15/SPEC.md:70`).
전역 광량 조절이 필요하면 `filter`가 아니라 토큰에 `color-mix()`를 쓴다(`web/app/quantum-white.css:120-127`, `--qw-lum-pct`).
**기계 강제:** `web/__tests__/quantumWhite/rev15FixedLayerGuard.test.ts` — 2026-09-18 감시 범위를 3개 시트에서 **출하 7개 시트 전량**으로 확대했다.

**규칙 2 · 글래스는 1겹.**
`backdrop-filter`는 `#unitas-nav`(`--qw-nav-blur`)와 **뷰포트 고정 모달 백드롭 1개**(`--qw-modal-blur`)에만 허용된다. 그 외 모든 패널의 유리질감은 `--u-wl-glass`(135° 화이트-알파 램프) + `--u-wl-edge`(내부 베벨), 또는 불투명도 0.94~0.97 바탕 + `box-shadow`로 만든다.
근거: `docs/rev21/SPEC.md:219`·`:365`(D-6), `docs/rev33/SPEC.md:29-32`. 인플로우 패널은 전부 명시적으로 `backdrop-filter: none`이다.
**기계 강제:** `web/__tests__/quantumWhite/rev21OneLayer.test.ts` — 새 선택자는 그 파일의 `it.each` 목록에 등재해야 한다.

**규칙 3 · 두 표면, 같은 이름.**
라이트/다크에서 값이 달라지는 토큰은 **같은 이름으로 두 번** 선언한다 — 맨 `:root`(다크)에 한 번, `html[data-unitas-surface='quantum-white']`(화이트)에 한 번. 이름을 포크하지 않는다.
전례: `--qw-card-*`(`web/app/globals.css:23-26` ↔ `web/app/quantum-white-rev19.css:18-25`), `--u-wl-*`(`web/app/waitlist.css:26-42` ↔ `:45-57`).
값이 표면과 무관한 토큰(타이밍·이징 등)은 맨 `:root`에만 둔다. 규칙 3은 **값이 갈리는** 토큰만 지배한다.

**규칙 4 · 다크 라우트에는 `--qw-ink/-line/-blue/-gold/-glass`가 존재하지 않는다.**
그 계열은 표면 프리픽스 아래에만 선언된다. `SurfaceScope`를 렌더하지 않는 라우트(`/omni-swarm` 등)에서 그 토큰을 쓰면 **조용히 무스타일로 렌더**된다. 다크 라우트가 소비할 수 있는 것은 `--qw-card-*`, `--u-wl-*`, Tailwind `void`/`quantum`/`accent`/`neon`뿐이다.
근거: `docs/rev33/SPEC.md:20-26`.

**규칙 5 · 스코프 프리픽스 누락 금지.**
`quantum-white.css`와 `quantum-white-rev19.css`의 **모든 페인팅 규칙**은 `html[data-unitas-surface='quantum-white']`를 달고 있어야 한다. 프리픽스 없이 허용되는 것은 맨 `@keyframes`와 `@media (prefers-reduced-motion)` 블록뿐이다. 프리픽스를 빠뜨린 규칙은 다크 라우트로 새어나간다.

### B군 — 모션

**규칙 6 · `transform`·`opacity`·`color`·`border-color`·`box-shadow`만 애니메이트한다.**
인플로우 요소의 `height` · `width` · `top`/`left` · `filter` · `background-position`은 애니메이트하지 않는다. L1 팝업 확장이 **매 프레임 리레이아웃**을 유발한 원인이 정확히 이것이다.

**규칙 7 · 모션은 토큰을 참조한다.**
새로 쓰는 모든 `transition`/`animation`은 리터럴이 아니라 토큰을 참조한다 — `--qw-ease`(`cubic-bezier(0.2, 0.8, 0.2, 1)`), `--qw-dur-fast`(0.18s), `--qw-dur`(0.22s), `--qw-dur-slow`(0.35s). 정본은 `web/app/globals.css`의 `:root`이며 2026-09-18 신설되었다.
근거: 신설 이전 7개 시트에 이징·듀레이션 커스텀 프로퍼티가 **0개**였고, 대신 손으로 쓴 cubic-bezier 8종과 0.18s(11회)·0.2s(66회)·0.22s(9회)·0.25s(16회)가 흩어져 있었다. 위 네 값은 그중 **이미 다수를 차지하던 값**을 토큰으로 승격한 것이다.
Framer Motion 스프링의 기본값은 `{ type: 'spring', stiffness: 220, damping: 22 }`(실측 최다). 다른 값을 쓰면 왜 다른지 한 줄 주석을 단다.
**기존 리터럴을 일괄 치환하지 않는다** — 약 100개 선언을 맹목 스윕하는 것은 시각적 이득 0에 회귀 위험만 있는 큰 디프다. 본 조항은 **새 모션**을 구속한다.

**규칙 8 · 감속 모션과 일시정지.**
화이트 표면에서 쓰는 새 `@keyframes`는 같은 파일에 `@media (prefers-reduced-motion: reduce)` 대응 블록을 함께 출하한다. 그리고 rAF가 아니라 CSS `animation`으로 구동해 기존 `html[data-page-hidden='1']` 일시정지 게이트(`web/app/globals.css:917-920` 인근)를 상속받는다.

### C군 — 타이포·색·기하

**규칙 9 · 새 웹폰트 금지.**
Cinzel(`font-serif`)과 JetBrains Mono(`font-sans`)만, `next/font`를 통해서만 쓴다. REV-14·REV-15·REV-17 SPEC에 이미 각인된 금지다.

**규칙 10 · 토큰이 이미 이름 붙인 색을 `.tsx`에 raw hex로 다시 쓰지 않는다.**
`#d4af37` → `accent` / `--u-wl-gold`, `#00f3ff` → `neon`, `#0b5cff` → `--qw-blue`. 모듈·에코시스템 액센트는 `web/lib/ecosystems.ts` / `web/lib/modules.ts`에서 온다.

**규칙 11 · 공유 상수는 토큰 하나.**
두 규칙이 같은 숫자에 합의해야 한다면 그 숫자는 커스텀 프로퍼티다. 기하 리터럴을 복제하지 않는다.
근거: 브랜드 킬라인이 1px → 3px로 자랐을 때 `.qw-search-wrap`의 보정 `margin-top`이 1px로 하드코딩된 채 남아 히어로 수직 대칭이 **2px 어긋났고 어떤 테스트도 실패하지 않았다**. 해결은 `--qw-title-rule-h`(`web/app/quantum-white-rev19.css:44`, 주석에 "Single source")를 `:127-131`이 소비하는 형태다.

**규칙 14 · 줌 인지 계산.**
`.dashboard-zoom { zoom: 0.75 }` 트리 안에서 화면 px 측정치로부터 유도한 레이아웃 값은 반드시 `var(--unitas-zoom)`으로 나눈다. `vw`/`svh`는 zoom으로 분할되지 않는다 — 화면 px와 CSS px는 1:1이 아니다.
전례: `web/app/quantum-white-rev19.css:74-79`의 `calc(var(--unitas-nav-bottom, 64px) / var(--unitas-zoom, 0.75) + …)`.
부수 사실: `zoom`은 문서 `scrollWidth`에 pre-zoom 폭을 흘리며, 그래서 `html, body { overflow-x: hidden }`이 백스톱으로 존재한다(`web/app/globals.css:68-75`). **정리하지 말 것.**

**규칙 15 · 삭제는 클래스 허용목록으로.**
클래스 제거는 행 번호가 아니라 **클래스 허용목록**으로 명세한다. 이 시트들은 35~101KB에 섹션이 교차되어 있어 한 줄을 지우면 이후 모든 행 번호가 밀린다. REV-20 §7.1에서 이미 한 번 잃었다(`docs/rev20/SPEC.md:406`·`:410`). `.u-wl-eyebrow` / `-input-row` / `-input` / `-domain`은 명시적 보호 대상이다(`web/app/waitlist.css:15-19`).

### D군 — 출하 규율

**규칙 12 · 20개 로케일, 같은 커밋.**
새 사용자 노출 문자열은 `web/messages/*.json` **20개 전부**에 같은 변경에서 착지한다. `en`만 추가한 디프는 결함이다.

**규칙 13 · 가드를 변경과 함께 출하한다.**
새 토큰 계열이나 선택자 계열은 `web/__tests__/**/*.test.ts`에 정적 텍스트 단언(=`readFileSync` + 정규식)을 함께 낸다 — 새 이름이 존재하고 은퇴한 이름이 없음을 단언한다. `rev15Tokens.test.ts` / `rev17Tokens.test.ts` 패턴.
**함정:** 이 저장소의 vitest는 node 환경이며 `__tests__/**/*.test.ts`만 수집한다. `.test.tsx`로 쓰거나 DOM을 렌더하는 가드는 **조용히 한 번도 실행되지 않는다**(기존 127개 테스트 중 `.tsx`는 0개). 가드를 작성했다면 `npm --prefix web run test` 출력에 그 이름이 실제로 나타나는지 확인하기 전에는 "강제된다"고 말하지 않는다(제14장 미측정 완료 보고 금지).

---

## §4. 규칙 ↔ 강제 대응표

| 규칙 | 강제 방식 | 위치 |
|---|---|---|
| 1 컨테이닝 블록 | **기계** | `web/__tests__/quantumWhite/rev15FixedLayerGuard.test.ts` (7개 시트) |
| 2 글래스 1겹 | **기계** | `web/__tests__/quantumWhite/rev21OneLayer.test.ts` |
| 7 모션 토큰 존재 | **기계** | `web/__tests__/quantumWhite/impeccableTaste.test.ts` |
| 본 독트린의 존재·구속 | **기계** | `web/__tests__/quantumWhite/impeccableTaste.test.ts` |
| 3·4·5·6·8·9·10·11·12·13·14·15 | 리뷰 | `-Lens code` / `-Lens ux` 롤 헌장이 본 문서를 인용해 판정 |

기계 강제는 `npm --prefix web run test`(= 루트 `npm test`의 `test:unit` 단계)에서 EXIT 0으로 증명된다. 리뷰 강제는 `scripts/agent-review.ps1`의 5단 롤 파이프라인이 수행한다.

## §5. 알려진 미해결 항목

- ~~**`index.html/.claude/skills/unitas-component/SKILL.md`가 낡았다**~~ → **2026-09-18 해소(설치 완료·실측 IN SYNC).** 낡은 본문은 로케일을 6개로 서술(실제 20개)하고, `--qw-*`·quantum-white 표면·글래스 1겹 규칙·`ModalPortal`·퍼널 게이트·`@/i18n/navigation`·라우트 레지스트리를 전혀 언급하지 않으며, `accent`를 시안이라 잘못 부른다(실제 `accent`=금 `#d4af37`, `neon`=시안 `#00f3ff`). `.claude/**` 쓰기는 하네스 분류기가 `[Self-Modification]`으로 차단하므로, 새 본문은 저장소 안 `docs/skills/unitas-component/SKILL.md`에 정본으로 두고 창립자가 `scripts/agent/sync-component-skill.ps1`(백업→BOM 없는 UTF-8 기록→sha256 재확인, 실패 시 복원)을 1회 실행해 덮어쓴다. 정본 본문의 저장소 주장은 `web/__tests__/doctrine/componentSkillStaging.test.ts`가 파일시스템(로케일 20개·시트 7개)과 대조해 기계로 지킨다.
- 규칙 6·10·12는 정적 스캔으로 기계화할 여지가 있으나(인플로우 애니메이션 속성 스캔, `.tsx` raw hex 스캔, 로케일 키 대칭 스캔) 오탐 설계가 끝나기 전에는 리뷰 강제로 둔다. 잡히지 않는 가드를 초록으로 세는 것이 규칙 13이 금지하는 바로 그것이다.

## §6. 개정

본 문서는 `docs/process/`의 자율 진화 대상이다(제10장·제15장). 조항을 추가할 때는 **강제 방식을 함께 적어야** 한다 — 강제 방식이 비어 있는 조항은 조항이 아니라 희망이다.
