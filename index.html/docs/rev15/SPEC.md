# REV-15 UI/UX 정제 사양서 (SPEC.md) — PHASE 1 블루프린트

- 상태: **PHASE 1 (설계 확정본, 프로덕션 코드 미작성)**
- 기준 정본: `CLAUDE.md` (Ultimate Sovereign Master Codex **v16.0**). 요청문의 "Codex v17.0"은 REV-14 때와 동일하게 저장소 어디에도 존재하지 않음(`grep -rIl v17` → `docs/rev14/SPEC.md`의 부재 기록 1건뿐). v16.0을 유효 정본으로 채택. v17.0 파일이 별도로 존재하면 PHASE 2 착수 전 반입 요망.
- 기준 커밋: `3c5e177` (REV-14 정밀 폴리시 완료 상태, 2026-09-09 10:20)
- 작업 루트: `index.html/web/` (Next.js 14.2.35 App Router, Tailwind 3.4, next-intl 20로케일, lucide-react 1.33.0)
- 검증 게이트(불변): `npm run typecheck` EXIT 0 → `npm run build` EXIT 0 → `npx vitest run` 489/489 + 신규 → **Playwright 뷰포트 매트릭스(§7.3) EXIT 0 — REV-14는 이 단계를 계획만 하고 실행하지 않아(`tests/rev14-viewport.spec.js` 미존재) 본 문서의 근본 결함이 그대로 출하됨. REV-15부터 완료 조건에 강제 편입.**
- 표기 규칙: 파일 경로:행 번호는 2026-09-09 `3c5e177` 실측 기준. 신규 CSS 변수는 `--qw-*`(퀀텀 화이트 스코프) 또는 `--u-*`(전역 게이트 스코프) 접두사만 사용.

## 실측 방법 (PHASE 1에서 실제 수행)

| 항목 | 내용 |
|---|---|
| 서버 | `npm --prefix web run start -- -p 3123` (BUILD_ID `13Zv2HSIk-…`, 2026-09-09 10:19 = `3c5e177` 빌드). 측정 후 프로세스 종료(로우메모리 아머) |
| 브라우저 | Playwright chromium-1234 + webkit-2336 (`index.html/node_modules/playwright`) |
| 뷰포트 | 375×667 (iPhone SE), 360×640 (Galaxy), 390×844, 412×915 (Pixel 7), 844×390 (폰 가로), 1366×650/768 (노트북), 1920×1080 |
| 로케일 | 실측 en/tl/de/pl/ja (자동 로케일 전환은 `unitas_locale_pref` 사전 주입 + `locale` 컨텍스트로 고정), 문자열 길이는 20로케일 전수 정적 분석 |
| 진입 | 공개 방문(토큰 없음) + 창립자 경로(`?sovereign_auth=<token>&splash=0`)로 게이트→시네마→봉인→메인 홈→클러스터 팝업까지 단계별 `getBoundingClientRect()` 판독 |
| 원인 분리 | 페이지 내 `body.style.filter='none'` 주입 전/후 비교, 팝업 그리드는 최소 재현 HTML 9변형(Chromium+WebKit) |

---

## 0. 실측 진단 요약 (왜 고쳐야 하는가)

### 0.1 결함 (a) 고정 스크린(인트로·광고·커밍순) 단일 뷰포트 넘침 — **근본 원인 1건 + 부수 원인 2건**

| # | 실측 | 수치 (공개 방문, iPhone SE 375×667) |
|---|---|---|
| A-1 | **`html[data-unitas-surface='quantum-white'] body { filter: brightness(var(--qw-lum, 1)) }`** (`app/quantum-white.css:75-81`)가 `<body>`를 모든 `position: fixed` 자손의 **포함 블록**으로 전환 (CSS Filter Effects §"filter가 none이 아닌 요소는 absolute/fixed 자손의 containing block") | 커튼 루트 `.z-[400]`(`ComingSoonCinema.tsx:1082`, `fixed inset-0`) 높이 **1702.4px** (= `body.scrollHeight`, 뷰포트 667) · `scrollTo(0,400)` 후 top **−400** (문서 스크롤에 끌려감) |
| A-2 | 게이트 ENTER 버튼 위치 | top **927.2 / bottom 973.2** → 뷰포트 하단보다 **260px 아래**. 방문자는 검은 빈 화면만 보고 스크롤해야 버튼을 발견 |
| A-3 | `body.style.filter='none'` 주입 직후 | 커튼 667px, top 0 (scrollY 400 유지 상태에서도) → **인과 확정** |
| A-4 | AudioGate `.gate-panel`(REV-14가 svh 적용) | 높이 667은 맞으나 top −400으로 동일하게 끌려감 (svh는 원인을 덮지 못함) |
| A-5 | 데스크톱 1366×650 | body 1002.5 → 커튼 1002.5; ENTER 588-638(우연히 보임); 봉인 하단 행(재생/종료)은 y≈1002 → **폴드 아래**. Playwright도 skip 버튼을 누르려고 문서를 352px 스크롤해야 했음 |
| A-6 | 데스크톱 1920×1080 | body 1080 = 뷰포트 → **증상 없음**. 창립자 대형 모니터 QA가 통과하고 모바일 필드 테스트에서만 드러난 이유 |
| A-7 | 메인 홈(릴리즈 후) | `#unitas-nav`(fixed) scrollY 500에서 top **−500** → 내비바가 스크롤과 함께 사라짐. `.qw-void` 1702px(패럴랙스 배경이 뷰포트가 아닌 문서에 고정) |
| A-8 | 클러스터 팝업(`ModalPortal`→body, `fixed inset-0 z-[200]`) | 백드롭 **1746.7px**, 패널(`height:100dvh`=667) **y=539.8** → 팝업 본체 전체가 폴드 아래. 1366×650: 패널 y 225, bottom 777.5(>650). filter none → y 0 / y 48.8 |
| B-1 | 부수 원인: **REV-14가 변환한 AudioGate(z-300)는 커튼(z-400) 아래에 있어 공개 방문자에게 절대 보이지 않는 컴포넌트**(`AudioGate.tsx:49-66` 주석 자체가 이를 명시). 실제 "인트로 화면" = `ComingSoonCinema.tsx:1167-1226` GATE 단계이며 **미변환**(`px-6 py-16`, `mb-6 text-5xl md:text-7xl lg:text-8xl`, `mb-12 text-base md:text-xl` 잔존) | 필터 무효화 시뮬레이션에서도 가로 844×390 게이트 넘침 **14px(en/pl) / 28px(tl/de)** |
| B-2 | 부수 원인: 커튼 루트에 명시 높이 없음(`inset-0`만) | 포함 블록이 탈취되면 무제한 성장. 방어선 부재 |
| C-1 | 창립자 봉인 변형, 가로 844×390 | 인플로우 콘텐츠 27.3-238.8 vs 창립자 도어(`absolute bottom: 6rem+safe`) 172.5-294 → **66px 겹침**(pl 82px). 공개 변형은 도어가 없어 정상 |

> 필터 무효화 시뮬레이션(§9.2)에서 세로 모바일 4종·노트북 768의 게이트/시네마/봉인은 REV-14 토큰만으로 넘침 0을 기록 → **REV-14의 clamp 토큰 설계는 유효했고, 결함의 90%는 A-1 단일 원인**이다.

### 0.2 결함 (b) 클러스터 팝업 카드 — 정렬 붕괴·아이콘 도트·설명 부재 (4중 결함)

| # | 실측 | 수치 |
|---|---|---|
| D-1 | 패널 위치 | A-8과 동일 근본 원인 (팝업이 폴드 아래) |
| D-2 | **모바일 단일 협폭 열** — `.qw-popout-body`의 Tailwind `items-start`(`ClusterPopout.tsx:168`)가 모바일 `flex-direction: column`(`quantum-white.css:510-512`) 아래서 교차축(가로) 정렬이 되어 그리드가 fit-content로 수축. `repeat(auto-fill, …)`은 부정(indefinite) 폭에서 **1회만 반복** | 그리드 **155.6px / 패널 375px (41%)**, `grid-template-columns: 151.609px`(1열), x=28 좌측 밀착, 우측 절반 공백 |
| D-3 | **타일 44px 붕괴** — 모바일에서 그리드가 컬럼 플렉스의 `flex-1` 아이템이 되어 **정의된 높이(473px)를 가진 스크롤 컨테이너**가 되면, `auto` 행 트랙의 base size = 아이템의 *minimum contribution* = `min-h-[44px]`(css-grid §12.5.1). 잔여 공간이 음수라 "maximize tracks" 단계에서 성장 0 → 행 44px → `align-self: stretch`가 버튼을 44px로 강제 → 제목·코인 칩이 타일 밖으로 넘쳐 **다음 타일의 불투명 배경 뒤에 숨음** (스크린샷: "Pulse" 제목이 타일 하단 테두리에 걸치고 칩은 소실). 데스크톱은 행 플렉스+`items-start`라 그리드 높이가 부정 → max-content로 105px | 타일 **151.6×44** ×16, 그리드 scrollHeight 934 / client 473 |
| D-3' | 최소 재현(Chromium/WebKit 동일): A 현행 → 1열·44px·칩 소실 / C `align-items:stretch`만 → 2열·44px / E `grid-auto-rows:max-content`만 → 1열·104.5px / **I 통합(stretch + width:100% + grid-auto-rows:max-content + align-content:start + min-height:0) → 2열·104.5px(WebKit 101.5)·칩 가시** | §4.1 채택 근거 |
| D-4 | **데스크톱 마지막 행 클리핑** — `items-start`로 그리드 높이가 미구속 → `overflow-y-auto`가 작동하지 않고 부모 `overflow-hidden`이 자름 | 1366×650: 그리드 y 375.3, bottom **851.3 > 패널 bottom 777.5**, client=scroll=476(스크롤 불가) → 4행("Life Library") 절단·도달 불가 |
| D-5 | **아이콘 커버리지 14/32 결손** — `lib/ecosystems.ts`(11)와 `B2B_PROTOCOLS`(3)에는 `icon` 필드가 없어 `ClusterModule.icon`이 undefined → 10px 도트만 렌더(`ClusterPopout.tsx:254-261`). 나머지 18개는 도트+16px 아이콘 | 헤드 행 높이 **10 vs 16px** → 같은 행 안에서 제목 베이스라인 **6px 편차** (1366 스크린샷: "Chronos" y 475 vs "Life Dashboard" y 481) |
| D-6 | **설명 미렌더** — `ClusterModule.i18n.descriptionKey`는 32모듈 × 20로케일 = **640문자열 전부 존재(결손 0)**하나 타일은 제목+칩만 렌더 | 길이: 최대 166자(tl), 로케일 평균 20~80자, 락인 태그라인 최대 45자(nl/tl), 제목 최대 28자(km) |
| D-7 | 팝업 헤더 모바일 safe-area 미반영(`pt-6` 고정) | 노치 기기에서 제목이 상태바에 근접 |

### 0.3 결함 (c) 언어 스위처 플래그 — 대비·경계 소실

| # | 실측 | 수치 |
|---|---|---|
| E-1 | `FlagIcon.tsx:295` 래퍼 `ring-1 ring-white/20` → computed `box-shadow: rgba(255,255,255,.2) 0 0 0 1px` | 내비 배경 `rgba(255,255,255,.94)` 위 대비 **≈1.0:1** (비가시). WCAG 1.4.11 비텍스트 경계 기준 3:1 미달 |
| E-2 | 흰 필드 국기 융합: ja(빨간 원만 잔존), ko(태극·괘만 부유), pl/id(절반 소실), th/fr/it/ru/nl/hi/tl 흰 밴드 소실 | 드롭다운 스크린샷으로 확인 |
| E-3 | 크기: 내비 트리거 `size={24}`가 `.dashboard-zoom{zoom:.75}` 안에서 **18×12.75px** 실효 렌더; 드롭다운(포털, 줌 밖) 20×14; 게이트/시네마 `GlobalLanguagePicker` 16/18 | 24px 미만 국기는 세부 식별 불가 |
| E-4 | `rounded-[2px]` + 그림자 없음 | 백색 위 부유감 0 |

---

## 1. 근본 원인 A 제거 — 크로노 루미넌스의 `filter` 탈피 (최우선, 다른 모든 수정의 전제)

### 1.1 설계 원칙
`filter`, `backdrop-filter`, `transform`, `perspective`, `will-change: transform|filter`, `contain: paint|layout|strict`은 **`html`, `body`, `.dashboard-zoom`(`app/[locale]/layout.tsx:115`) 및 fixed 레이어의 어떤 조상에도 선언 금지**. 이 셋은 사이트의 모든 fixed 레이어(커튼·AudioGate·내비·스플래시·ModalPortal 팝업·언어 드롭다운·ExitGuard 셔라우드·PwaInstallHost·DialogTower·QuantumVoid·Shockwave·QuantumBluePulse)의 공통 조상이다.

### 1.2 `applyChrono` 확장 — `lib/quantumWhite/chrono.ts:55-73`
- 신규 상수 `CHRONO_LUM_PCT_PROP = '--qw-lum-pct'`. `applyChrono`가 `--qw-lum`(기존, 하위 호환)과 함께 `--qw-lum-pct: ${Math.round(lum * 100)}%`를 기록, `clearChrono`가 함께 제거.
- 이유: `color-mix()`의 `<percentage>` 인수에 `calc(var(--qw-lum) * 100%)`를 쓰는 대신 완성된 퍼센트 문자열을 주입해 계산식 의존을 0으로 만든다.
- `__tests__/quantumWhite/chrono.test.ts:108-124`에 `--qw-lum-pct` 기록/제거 단언 2건 추가.

### 1.3 CSS — `app/quantum-white.css:75-81` 교체
```css
html[data-unitas-surface='quantum-white'] body {
  background: var(--qw-bg);
  color: var(--qw-ink);
  /* filter: brightness(...) 삭제 — fixed 포함 블록 탈취 원인 (REV-15 §1) */
}
```
토큰 블록(`:19-73`)의 밝기 대상 4종을 정적 폴백 유지 + `@supports` 승격:
```css
html[data-unitas-surface='quantum-white'] {
  --qw-bg: #ffffff;                       /* 정적 폴백 (변경 없음) */
  --qw-bg-2: #f6f7fa;
  --qw-glass-solid: rgba(255, 255, 255, 0.86);
  --qw-nav-bg: rgba(255, 255, 255, 0.94);
  --qw-lum-pct: 100%;                     /* applyChrono가 덮어씀 */
}
@supports (color: color-mix(in srgb, #fff 50%, #000)) {
  html[data-unitas-surface='quantum-white'] {
    --qw-bg:          color-mix(in srgb, #ffffff var(--qw-lum-pct), #000000);
    --qw-bg-2:        color-mix(in srgb, #f6f7fa var(--qw-lum-pct), #000000);
    --qw-glass-solid: color-mix(in srgb, rgba(255,255,255,.86) var(--qw-lum-pct), rgba(0,0,0,.86));
    --qw-nav-bg:      color-mix(in srgb, rgba(255,255,255,.94) var(--qw-lum-pct), rgba(0,0,0,.94));
  }
}
```
- 등가성: `brightness(k)`는 각 채널 ×k. `color-mix(white k%, black)` = 255k → 백색·연회색 표면에서 **수치적으로 동일**(lum .92: #ffffff→#ebebeb, #f6f7fa→#e2e3e6). 잉크(#0a0a0c)는 필터 시 #09090b였으므로 차이는 지각 불가. 알파는 동일 알파의 검정과 섞어 보존.
- `--qw-warm`(라이트 풀 색온도)은 기존대로 `QuantumVoid` 풀에서만 소비. 변경 없음.
- `color-mix` 미지원 브라우저(2023 이전)는 정적 백색으로 우아하게 강등(크로노 효과만 사라짐, 레이아웃 무손상).

### 1.4 회귀 가드 (필수)
1. vitest `__tests__/quantumWhite/rev15FixedLayerGuard.test.ts`: `quantum-white.css`·`globals.css`·`splash.css` 원문을 파싱해 셀렉터가 `html`/`body`/`.dashboard-zoom`으로 끝나는 규칙 블록에 `filter|backdrop-filter|transform|perspective|will-change|contain|translate|rotate|scale` 선언(값 `none` 제외)이 **0건**임을 단언.
2. Playwright `tests/web-cinema-e2e/rev15-fixed-layers.spec.js` (§7.3): 공개 방문 커튼 루트와 릴리즈 후 `#unitas-nav`에 대해 `rect.height === innerHeight`(커튼), `rect.top === 0` after `scrollTo(0,500)`.
3. 파급 효과 검증: 기존 exit/omni-exit/app-exit-collapse E2E 재실행 (ExitGuard 셔라우드·모달이 뷰포트 기준으로 복귀 — 기대 동작이며 회귀가 아님).

---

## 2. 고정 스크린 단일 뷰포트 최적화 (결함 a)

### 2.0 불변 계약 (REV-14 §2.0 전부 승계 + 추가)
1. 스크롤 잠금 금지(2026-08-29) — `html/body overflow:hidden` 불가. 패널의 `overflow-y-auto overscroll-contain`은 페일세이프로 유지.
2. `line-clamp-2` 크로스페이드, `text-indent == tracking` 광학 중앙, 하단 단일 행, 창립자 도어 `bottom: 6rem+safe` 핀, 스플래시 기하, 종료 가이드 판독 순서 — 전부 유지.
3. **신규**: §1.1 조상 필터 금지.

### 2.1 커튼 루트 방어 셸 — `ComingSoonCinema.tsx:1082`
클래스 `cs-root` 추가 (`fixed inset-0 z-[400] overflow-hidden bg-void text-center` 유지):
```css
/* app/globals.css — .u-viewport-fit 직후 */
.cs-root { height: 100vh; height: 100svh; max-height: 100dvh; }
```
- 목적: 포함 블록이 다시 탈취되더라도 박스가 문서 높이로 성장하지 못하게 하는 2차 방어선(1차는 §1). `inset-0`의 top/bottom 중 bottom은 height 명시로 무시됨 — 의도.
- `SealedFallback.tsx:15-25`(커튼 실패 폴백)에도 동일 클래스.

### 2.2 GATE 단계 변환 (REV-14 §2.2가 겨냥했어야 할 실제 대상) — `ComingSoonCinema.tsx:1170-1226`
| 행 | 현행 | 변경 |
|---|---|---|
| 1170 패널 | `absolute inset-0 flex flex-col items-center justify-center overflow-y-auto overscroll-contain px-6 py-16 backdrop-blur-2xl` | `px-6 py-16` 제거 → `cs-gate gate-panel` 추가 |
| 1198 h1 | `mb-6 font-serif text-5xl font-bold tracking-[0.14em] text-white md:text-7xl lg:text-8xl` | `mb-6 text-5xl md:text-7xl lg:text-8xl` 제거 (`.gate-panel h1` 규칙이 `--u-gate-title`·`margin-bottom` 공급) |
| 1205 p | `mx-auto mb-12 max-w-lg text-base leading-relaxed text-gray-300 [text-wrap:balance] md:max-w-3xl md:text-xl` | `mb-12 text-base leading-relaxed md:text-xl` 제거 (`.gate-panel p` 규칙: `--u-gate-sub`, lh 1.5, clamp 5줄/≤600px 3줄) |
| 1212 버튼 | 불변 | — |
| 1217 창립자 QA 노트 | 불변 (`mt-6`) | — |
| 1142 언어 피커 래퍼 | `absolute right-4 top-4 z-20 sm:right-6 sm:top-6` | `top-4 sm:top-6` 제거 → `style={{ top: 'max(1rem, var(--u-safe-top))' }}` (AudioGate.tsx:156-158과 동일 패턴) |
| 1158 사운드 토글 | `left-4 top-4 … sm:left-6 sm:top-6` | 동일하게 `top` 인라인 safe-area화 |

```css
/* app/globals.css — .gate-panel 규칙(92-109행) 바로 앞 */
.cs-gate {
  padding-block: max(var(--u-vp-pad-y), var(--u-safe-top)) max(var(--u-vp-pad-y), var(--u-safe-bottom));
  padding-inline: max(var(--u-vp-pad-x), env(safe-area-inset-left, 0px)) max(var(--u-vp-pad-x), env(safe-area-inset-right, 0px));
  box-sizing: border-box;
}
```
- `.u-viewport-fit`을 재사용하지 않는 이유: 게이트는 `absolute inset-0`(커튼 안)이라 높이 선언이 불필요하고, 이중 높이 선언은 `.cs-root`와 충돌 여지가 있다. 패딩 정의만 공유.
- **높이 예산** (필터 제거 후, 실측 폰트/행간 기준):
  - 375×667 tl(부제 147자): pad 2×33 + h1 36(`clamp(2.25rem, 8.5vmin=31.9, 6rem)`→36) + mb 17 + p 4줄×21=84 + mb 27 + 버튼 46 = **276px** (여유 391)
  - 360×640: 64 + 36 + 16 + 84 + 26 + 46 = **272px**
  - **844×390 가로**(현행 넘침 14~28px): pad 2×20 + h1 36 + mb 12 + p 3줄(≤600px 클램프)×21=63 + mb 16 + 46 = **213px** (여유 177) → 넘침 해소
  - 언어 피커(y 16-46) vs 콘텐츠 상단(≥112) 비중첩.

### 2.3 시네마 광고 단계 — 변경 없음 (검증만)
필터 제거 시뮬레이션: 375×667 h2 2줄 45.3px(20.25px), p 2줄 32.4px, 도트 20-26, skip 615-643, 넘침 0 (5세그먼트 전부). 360×640·844×390·1366×768 동일 0. §7.3 매트릭스에 단언만 추가.

### 2.4 봉인(커밍순) 단계 — 창립자 가로 모드 보강 (C-1)
`ComingSoonCinema.tsx:1435` 창립자 도어 `motion.div`에 클래스 `cs-founder-door` 추가, 노트(`:1452`)에 `cs-founder-note`.
```css
/* app/globals.css — .cs-sealed 블록(134-147행) 뒤 */
@media (max-height: 480px) {
  .cs-sealed[data-founder] {
    --u-seal-gap: 0.75rem;
    --u-seal-foot: calc(3.75rem + var(--u-safe-bottom));
    padding-bottom: var(--u-seal-foot);           /* 도어 예약분(--u-seal-foot-founder) 해제 */
  }
  .cs-sealed[data-founder] .cs-founder-door {
    position: static;                              /* inset-x-0/bottom 무효화 → 인플로우 */
    margin-top: 0.75rem;
    gap: 0.5rem;
  }
  .cs-sealed[data-founder] .cs-founder-note { display: none; }
}
```
- 예산 844×390: 인플로우 211.5 + 12 + 도어(라벨 15 + gap 8 + 버튼 46 = 69) + pad-top 20 + foot 60 = **372.5px ≤ 390** (여유 17.5). 잔여 편차는 유지되는 `overflow-y-auto` 페일세이프가 흡수(창립자 전용·가로 전용 경로).
- 세로 모드 검증치(필터 제거 후): SE en 인플로우 111-416 vs 도어 453.5(여유 38) · Galaxy pl 367.7 vs 395.3(여유 28) · 1366×768 454 vs 550(여유 96). 공개 변형(도어 없음)은 전 뷰포트 여유 ≥ 150px.
- `framer-motion` `initial={{ y: 10 }}` 애니메이션은 static에서도 동작(transform) → 변경 없음.

### 2.5 AudioGate — 변경 없음
z-300으로 커튼 아래에 영구 은폐되는 컴포넌트. REV-14 변환분(`u-viewport-fit gate-panel`)은 무해하므로 유지하되, **REV-15부터 "인트로 화면" 작업 대상은 `ComingSoonCinema` GATE 단계임을 파일 상단 주석에 명기**(오인 재발 방지).

---

## 3. 언어 스위처 플래그 (결함 c)

### 3.1 컴포넌트 — `components/nav/FlagIcon.tsx:279-304`
```tsx
<span
  className={`u-flag inline-block shrink-0 overflow-hidden ${className}`}   // ring-1 ring-white/20 rounded-[2px] 제거
  style={style}
  data-flag={locale}
  aria-hidden="true"
>
```
- 크기 계산(`Math.round(size*14/20)`)·`preserveAspectRatio="xMidYMid slice"`·20개 SVG 실루엣 불변.

### 3.2 토큰·규칙 — `app/globals.css :root`(5-28행) + 신규 블록
```css
:root {
  --u-flag-radius: 3px;
  /* 다크 표면(게이트·시네마·다크 라우트) 기본: 백색 헤어라인 38% (검정 위 3.3:1) + 낙하 그림자 */
  --u-flag-ring: 0 0 0 1px rgba(255, 255, 255, 0.38), 0 1px 2px rgba(0, 0, 0, 0.45);
}
.u-flag {
  border-radius: var(--u-flag-radius);
  box-shadow: var(--u-flag-ring);
  background: #fff;             /* SVG 서브픽셀 틈 새는 색 고정 */
  isolation: isolate;
}
.u-flag > svg { display: block; }
```
```css
/* app/quantum-white.css §2 내비 블록(95-160행) 말미 + .z-[140] 블록(300-309행) — 백색 표면 위 잉크 헤어라인 45% (백색 위 3.15:1) */
html[data-unitas-surface='quantum-white'] #unitas-nav .u-flag,
html[data-unitas-surface='quantum-white'] .z-\[140\] .u-flag {
  --u-flag-ring: 0 0 0 1px rgba(10, 10, 12, 0.45), 0 1px 3px rgba(10, 10, 12, 0.18);
}
```
- 스코프를 `#unitas-nav`와 포털 드롭다운 `.z-[140]`으로 한정하는 이유: 커튼 위 `GlobalLanguagePicker`는 `data-unitas-surface`가 이미 찍힌 `<html>` 아래의 **다크 표면**이므로 잉크 헤어라인이 새면 안 된다.
- 대비 계산: 잉크 45% 합성 = #919192 → 상대휘도 .283 → 백색 대비 **3.15:1** (≥3:1). 백색 38% 합성 = #616162 → 검정(#030305) 대비 **3.3:1**.

### 3.3 크기 상향
| 위치 | 현행 | 변경 | 실효 |
|---|---|---|---|
| `LanguageSwitcher.tsx:107` 트리거 | `size={24}` | `size={30}` | 22.5×15.75px (zoom .75) |
| `LanguageSwitcher.tsx:133` 드롭다운 항목 | `size={20}` | `size={22}` | 22×15.4px (포털, 줌 밖) |
| `LanguageSwitcher.tsx:129` 항목 패딩 | `px-3 py-2` | `px-3 py-2.5` | 행 36px (모바일 탭 타깃 개선) |
| `GlobalLanguagePicker.tsx:111/135` | 16 · 18 | 18 · 20 | 다크 표면(선택, 게이트 픽커 폭 +4px) |

### 3.4 드롭다운 폴리시 (선택, 동일 블록)
`html[data-unitas-surface='quantum-white'] .z-\[140\] .font-bold.text-accent { background: var(--qw-blue-soft); border-radius: 8px; }` — 활성 로케일 행 배경 강조.

---

## 4. 클러스터 팝업 카드 (결함 b)

### 4.1 지오메트리 수정 (D-2·D-3·D-4) — CSS 소유권 이관
`ClusterPopout.tsx`:
- `:168` body: `items-start` **제거** (`qw-popout-body flex flex-1 gap-6 overflow-hidden px-7 pb-7 pt-4`)
- `:170` grid: `[grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]`·`gap-3`·`pr-1` **제거** (`qw-tile-grid grid flex-1 overflow-y-auto pb-2`)
- `:180` slide: 불변 (`qw-module-slide flex w-full max-w-[380px] shrink-0 flex-col overflow-y-auto`)

`app/quantum-white.css` §7(455-540행) 규칙 추가·교체:
```css
html[data-unitas-surface='quantum-white'] .qw-popout-body { align-items: stretch; min-height: 0; }
html[data-unitas-surface='quantum-white'] .qw-tile-grid {
  width: 100%;
  min-height: 0;                              /* flex 아이템 자동 최소 높이 해제 → overflow-y:auto 작동 */
  grid-template-columns: repeat(auto-fill, minmax(var(--qw-tile-min-w), 1fr));
  grid-auto-rows: max-content;                /* auto 트랙의 min-contribution(44px) 붕괴 차단 */
  align-content: start;
  gap: var(--qw-tile-gap);
  padding-right: 4px;
}
html[data-unitas-surface='quantum-white'] .qw-module-slide { align-self: stretch; min-height: 0; }
@media (max-width: 767px) {
  html[data-unitas-surface='quantum-white'] .qw-tile-grid { grid-template-columns: 1fr; }   /* 리스트 행 */
}
```
- 근거: §0.2 D-3' 변형 I가 Chromium/WebKit 양쪽에서 2열·104.5px·칩 가시로 유일하게 통과. `align-items: stretch`는 데스크톱(행 플렉스)에서 그리드 높이를 body에 구속해 `overflow-y:auto`를 살리고(D-4 해소), 모바일(컬럼 플렉스)에서 전폭을 준다(D-2 해소). `grid-auto-rows: max-content`가 D-3을 차단한다.
- 데스크톱 1366×650 예산: 그리드 client = body 418 − 32 = 386px 스크롤 컨테이너 → 4행 전부 스크롤 도달 가능.

### 4.2 리치 타일 인테리어 — `ModuleTile` 재구성 (`ClusterPopout.tsx:206-268`)
```tsx
<button ref={ref} type="button" data-kind={module.kind} style={{ '--qw-tile-accent': module.color }}
  className="qw-tile unitas-tap rounded-2xl border border-[var(--qw-line)] bg-[var(--qw-bg-2)] text-left">
  <span className="qw-tile-head">
    <span className="qw-tile-medallion" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
    <span className="qw-tile-kind">{t(`kind.${module.kind}`)}</span>
  </span>
  <span className="qw-tile-title">{title}</span>
  <span className="qw-tile-desc">{tFull(module.i18n.descriptionKey)}</span>
  <span className="qw-tile-foot">
    <span className="qw-upay-chip">{module.coinCost} {t('coinUnit')}</span>
    <ChevronRight size={14} aria-hidden="true" />
  </span>
</button>
```
- 기존 `flex min-h-[44px] flex-col items-start gap-2 p-4 transition-shadow …` Tailwind 리터럴은 CSS로 이관(아래). 도트 `<span h-2.5 w-2.5 rounded-full>`(`:255-259`) **삭제** → 메달리온이 대체.
- 포인터 틸트(`--qw-tilt-x/y`), `onWarm` 프리캐시, 햅틱, `resolveModuleTitle` 불변.

```css
html[data-unitas-surface='quantum-white'] {
  --qw-tile-min-w: 196px;   --qw-tile-gap: 14px;   --qw-tile-pad: 16px;   --qw-tile-min-h: 168px;
  --qw-tile-medallion: 36px; --qw-tile-icon: 18px;
  --qw-tile-title: 0.92rem; --qw-tile-desc: 0.78rem; --qw-tile-desc-lines: 3;
  --qw-tile-kind: 0.6rem;
}
html[data-unitas-surface='quantum-white'] .qw-tile {
  display: flex; flex-direction: column; align-items: stretch; gap: 8px;
  min-height: var(--qw-tile-min-h); padding: var(--qw-tile-pad);
  --qw-tile-ink: var(--qw-tile-accent);                     /* color-mix 미지원 폴백 */
  /* 기존: border-width/color, box-shadow, transform(틸트), transition 유지 */
}
@supports (color: color-mix(in srgb, #fff 50%, #000)) {
  html[data-unitas-surface='quantum-white'] .qw-tile { --qw-tile-ink: color-mix(in srgb, var(--qw-tile-accent) 62%, var(--qw-ink)); }
}
html[data-unitas-surface='quantum-white'] .qw-tile-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: var(--qw-tile-medallion); }
html[data-unitas-surface='quantum-white'] .qw-tile-medallion {
  display: grid; place-items: center; width: var(--qw-tile-medallion); height: var(--qw-tile-medallion);
  border-radius: 50%; color: var(--qw-tile-ink);
  background: var(--qw-bg);
  box-shadow: 0 0 0 1.5px var(--qw-tile-ink), inset 0 1px 0 rgba(255,255,255,.9), 0 2px 6px rgba(10,10,12,.08);
}
@supports (color: color-mix(in srgb, #fff 50%, #000)) {
  html[data-unitas-surface='quantum-white'] .qw-tile-medallion { background: color-mix(in srgb, var(--qw-tile-accent) 14%, #fff); }
}
html[data-unitas-surface='quantum-white'] .qw-tile-kind { font-size: var(--qw-tile-kind); font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--qw-ink-3); white-space: nowrap; }
html[data-unitas-surface='quantum-white'] .qw-tile-title { font-size: var(--qw-tile-title); font-weight: 600; line-height: 1.25; color: var(--qw-ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; min-height: calc(2 * 1.25em); }
html[data-unitas-surface='quantum-white'] .qw-tile-desc { font-size: var(--qw-tile-desc); line-height: 1.45; color: var(--qw-ink-3); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--qw-tile-desc-lines); overflow: hidden; }
html[data-unitas-surface='quantum-white'] .qw-tile-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; color: var(--qw-ink-3); }
html[data-unitas-surface='quantum-white'] .qw-tile:hover .qw-tile-foot,
html[data-unitas-surface='quantum-white'] .qw-tile:focus-visible .qw-tile-foot { color: var(--qw-tile-ink); }
@media (max-width: 767px) {
  html[data-unitas-surface='quantum-white'] {
    --qw-tile-min-h: 0px; --qw-tile-medallion: 40px; --qw-tile-icon: 20px; --qw-tile-title: 0.95rem; --qw-tile-desc: 0.8rem;
    --qw-tile-desc-lines: 99;                 /* 모바일 리스트 행: 설명 전문, 클램프 없음 */
  }
  html[data-unitas-surface='quantum-white'] .qw-tile { display: grid; grid-template-columns: var(--qw-tile-medallion) 1fr; grid-template-areas: 'medal head' 'medal title' 'medal desc' 'medal foot'; column-gap: 12px; row-gap: 4px; }
  html[data-unitas-surface='quantum-white'] .qw-tile-head { grid-area: head; height: auto; justify-content: flex-start; }
  html[data-unitas-surface='quantum-white'] .qw-tile-medallion { grid-area: medal; align-self: start; }
  html[data-unitas-surface='quantum-white'] .qw-tile-title { grid-area: title; min-height: 0; -webkit-line-clamp: 3; }
  html[data-unitas-surface='quantum-white'] .qw-tile-desc { grid-area: desc; }
  html[data-unitas-surface='quantum-white'] .qw-tile-foot { grid-area: foot; margin-top: 6px; }
}
```
- **정렬 보장**: 헤드 행 고정 36px + 제목 2줄 고정 최소 높이 + `margin-top:auto` 푸터 → 같은 행의 32개 타일이 제목 베이스라인·칩 y를 공유(D-5 6px 편차 소멸). 데스크톱 행 높이는 그리드 stretch로 행 내 최대치 동기화.
- **i18n 설명 전문 렌더(D-6)**: 32×20 = 640 문자열을 `descriptionKey`로 그대로 소비(락인은 `LockIn.modules.<key>.tagline`, 최대 45자 → 데스크톱 2줄 이내). 데스크톱은 `--qw-tile-desc-lines: 3` 클램프(166자 tl = 6줄 → 3줄 노출, 전문은 기존 `ModulePopupSpace.tsx:81` 상세 패널이 이미 렌더), 모바일 리스트 행은 클램프 해제로 전문 노출. 창립자가 데스크톱 전문 노출을 원하면 토큰 1개(`--qw-tile-desc-lines: 99`)로 전환 가능 — 이 경우 최악 로케일 타일 245px, 4행 980px 스크롤(§9.1 예산 표 참조).
- **종류 배지 i18n**: `QuantumWhite.kind.{ecosystem,lifeos,b2c,lockin,b2b}` 5키 신설 × 20로케일 (en: `ECOSYSTEM / LIFE-OS / LIVE / LOCK-IN / RAIL`, ko: `에코시스템 / 라이프-OS / 라이브 / 락인 / 레일`). `__tests__/i18n/quantumWhiteParity.test.ts:96-98`이 20로케일 동시 존재 + `[MISSING` 부재를 요구하므로 **`scripts/i18n-sync.ts` 실행 후 100문자열 실번역** 필수.
- 메달리온 잉크 대비(백색 배경, 62% 액센트 + 38% 잉크): platinum #e5e4e2→#929291 **3.1:1**, silver #c0c0c0→#7b7b7b **3.9:1**, gold #d4af37→#876f27 **4.6:1**, rose #b76e79→#754850 **6.5:1**, titanium #8a97a0→#596167 **5.5:1**, 에코 채도색 전부 ≥4:1. 순수 액센트만 쓰면 platinum 1.2:1로 실패 — 혼합이 필수.

### 4.3 아이콘 전수 커버리지 (D-5) — 신규 `lib/quantumWhite/moduleIcons.ts`
```ts
import { AudioWaveform, CircleDashed, FlipHorizontal2, Eye, Activity, Mountain, Sparkles, Waypoints, Sun, Blend, Hourglass, Fingerprint, KeyRound, Wallet, type LucideIcon } from 'lucide-react';
export const ECOSYSTEM_ICONS: Readonly<Record<string, LucideIcon>> = {
  echo: AudioWaveform, void: CircleDashed, mirror: FlipHorizontal2, oracle: Eye, pulse: Activity, apex: Mountain,
  genesis: Sparkles, syndicate: Waypoints, aura: Sun, paradox: Blend, chronos: Hourglass,
};
export const B2B_ICONS: Readonly<Record<string, LucideIcon>> = { 'u-signature': Fingerprint, 'u-key': KeyRound, 'u-pay': Wallet };
```
- 14개 전부 lucide-react 1.33.0 export 확인 완료. 코그니티브 클러스터 내 Life-OS 5종(LayoutDashboard/Network/ShieldCheck/Palette/Library)과 **중복 0**. 락인 클러스터의 Eye/InfinityIcon은 다른 팝업이라 허용.
- `lib/quantumWhite/clusters.ts:118-131` `icon: ECOSYSTEM_ICONS[m.key]`, `:190-206` `icon: B2B_ICONS[m.key]` 추가. `ClusterModule.icon`(`:54`)을 **필수** `icon: LucideIcon`으로 승격. `lib/ecosystems.ts`·`lib/modules.ts`는 **불변**(prebuild 레지스트리 검증기가 정규식 파싱 — `clusters.ts:13-18` 주석).
- `__tests__/quantumWhite/clusters.test.ts`에 "32/32 모듈이 icon을 가진다" 단언 추가.

### 4.4 팝업 셸 폴리시 (D-7)
- `ClusterPopout.tsx:147` 헤더 `pt-6` → CSS `html[…] .qw-popout-panel header { padding-top: max(1.5rem, var(--u-safe-top)); }` (모바일 시트 전용은 `@media (max-width:767px)` 안).
- `:166` 힌트 문단은 유지, `:135` 백드롭 `p-6`·`:141` 패널 `max-h-[85vh]`는 §1 적용 후 뷰포트 기준으로 정상 복귀 → 변경 없음.
- 홈 클러스터 카드의 궤도 도트(`SingularityCoreGrid.tsx:68-76`)는 클러스터 단위 시각 언어이므로 **유지**(결함 범위 밖).

---

## 5. 토큰 아키텍처 총괄 (신규·변경 전량)

| 스코프 | 토큰 | 값 | 용도 |
|---|---|---|---|
| `html[qw]` | `--qw-lum-pct` | `100%` (chrono 기록) | §1 color-mix 밝기 |
| `html[qw]` @supports | `--qw-bg`, `--qw-bg-2`, `--qw-glass-solid`, `--qw-nav-bg` | color-mix 재정의 | 정적 값은 폴백으로 잔존 |
| `html[qw]` | `--qw-tile-min-w/gap/pad/min-h/medallion/icon/title/desc/desc-lines/kind` | 196px/14px/16px/168px/36px/18px/.92rem/.78rem/3/.6rem | §4.2 타일 |
| `.qw-tile` | `--qw-tile-ink` | color-mix(accent 62%, ink) | 메달리온·아이콘·호버 |
| `:root` | `--u-flag-radius`, `--u-flag-ring` | 3px / 백색 38% 헤어라인 | §3 |
| `html[qw] #unitas-nav, .z-[140]` | `--u-flag-ring` | 잉크 45% 헤어라인 | §3 |
| `.cs-sealed[data-founder]` ≤480px | `--u-seal-gap`, `--u-seal-foot` | .75rem / 3.75rem+safe | §2.4 |
| 불변 | `--qw-line`(8%), `--qw-lum`, `--qw-warm`, REV-14 토큰 25종, `--u-*` 게이트 토큰 16종 | — | — |

---

## 6. 검증 계획 (PHASE 2 완료 조건)

1. `cd index.html && npm --prefix web run typecheck` EXIT 0
2. `npm --prefix web run build` EXIT 0 (prebuild `sync-codex.mjs`·레지스트리 검증기 통과 — `ecosystems.ts`/`modules.ts` 무변경으로 보장)
3. `cd web; npx vitest run` — 기존 489 + 신규:
   - `__tests__/quantumWhite/rev15FixedLayerGuard.test.ts` (§1.4-1)
   - `__tests__/quantumWhite/chrono.test.ts` `--qw-lum-pct` 2건
   - `__tests__/quantumWhite/clusters.test.ts` 아이콘 32/32
   - `__tests__/quantumWhite/rev15Tokens.test.ts`: §5 토큰 전량 존재, `quantum-white.css`에 `body {` 블록 내 `filter` 부재
   - `__tests__/i18n/quantumWhiteParity.test.ts` 통과 (`kind.*` 5키 × 20로케일)
4. **Playwright** `npx playwright test --config=tests/web-cinema.config.js` (프로덕션 빌드 `next start` :3123) — 신규 스펙 3종, 프로젝트 chromium/webkit/mobile-chrome:
   - `tests/web-cinema-e2e/rev15-fixed-layers.spec.js`: 공개 방문(토큰 없음) 375×667·1366×768에서 커튼 `rect.height === innerHeight`, `scrollTo(0,500)` 후 `rect.top === 0`; ENTER 버튼 `bottom ≤ innerHeight`; 릴리즈 후 `#unitas-nav` top 0 유지; `.qw-void` 높이 = innerHeight.
   - `tests/web-cinema-e2e/rev15-viewport-fit.spec.js`: 뷰포트 8종(375×667, 360×640, 390×844, 412×915, 844×390, 1366×650, 1366×768, 1920×1080) × 로케일 en/tl/de/pl/ko/ja — 게이트/시네마 5세그/봉인 각각 `scrollHeight ≤ clientHeight + 1`; 게이트 피커 박스 ∩ 콘텐츠 박스 = ∅; 봉인 창립자 변형 `flowBottom + 8 ≤ doorTop`(세로) 또는 도어 static(가로 ≤480px); 하단 행 `bottom ≤ innerHeight`. 로케일 고정은 `unitas_locale_pref` 사전 주입 + 컨텍스트 `locale`(tl→`fil`).
   - `tests/web-cinema-e2e/rev15-cluster-popout.spec.js`: 창립자 경로로 홈 진입 → `.qw-cluster-card` JS 클릭(창립자 콘솔 오버레이 회피) → 패널 `top ≥ 0 ∧ bottom ≤ innerHeight`; 그리드 폭 ≥ 0.9 × body 폭; 모바일 열 수 1(리스트) / 1366px 열 수 ≥ 4; 16타일 전부 `chip.bottom ≤ tile.bottom`, 타일 높이 ≥ 100(데스크톱); 32타일 전부 `.qw-tile-medallion svg` 존재 및 `.qw-tile-desc` 비어있지 않음(로케일 6종); 플래그 `getComputedStyle(.u-flag).boxShadow`가 `rgba(10, 10, 12, 0.45)` 포함(내비·드롭다운), `GlobalLanguagePicker`는 `rgba(255, 255, 255, 0.38)`.
5. 대비: §3.2 헤어라인 3.15:1/3.3:1, §4.2 메달리온 잉크 5금속 ≥3.1:1, `--qw-tile-kind` `--qw-ink-3`(#5d616b) 백색 대비 6.0:1.
6. `prefers-reduced-motion: reduce`: 신규 애니메이션 없음(메달리온은 정적) → §11 블록 변경 불필요. `.qw-tile` transition none 규칙(`quantum-white.css:661`) 유지.
7. 파급 검증: 기존 `exit/*`, `omni-exit`, `app-exit-collapse`, `founder-bypass`, `module-gate` E2E 재실행 — ExitGuard 모달/셔라우드·PwaInstallHost가 뷰포트 기준으로 렌더되는 것이 기대값.

---

## 7. 편집 경계 요약 (PHASE 2 작업 지시서)

| 분류 | 파일 | 변경 성격 |
|---|---|---|
| CSS 전용 | `app/quantum-white.css` | body `filter` 삭제(75-81), 토큰 블록 `--qw-lum-pct`+@supports color-mix 4종(19-73), §2 플래그 스코프 규칙, `.z-[140]` 플래그·활성행, §7 `.qw-popout-body/.qw-tile-grid/.qw-module-slide` 지오메트리, 타일 인테리어 규칙 일체 + 모바일 리스트 행, 헤더 safe-area |
| CSS 전용 | `app/globals.css` | `:root` `--u-flag-*` 2종, `.u-flag`, `.cs-root`, `.cs-gate`, `.cs-sealed[data-founder]` ≤480px 블록 |
| 라이브러리 | `lib/quantumWhite/chrono.ts` | `CHRONO_LUM_PCT_PROP` + applyChrono/clearChrono 1줄씩 |
| 라이브러리(신규) | `lib/quantumWhite/moduleIcons.ts` | 14 아이콘 맵 |
| 라이브러리 | `lib/quantumWhite/clusters.ts` | `icon` 필수화 + 2곳 주입 (118-131, 190-206) |
| 컴포넌트(클래스 치환) | `ComingSoonCinema.tsx:1082, 1142, 1158, 1170, 1198, 1205, 1435, 1452` | 훅 클래스 추가·Tailwind 크기 리터럴 제거·safe-area 인라인 top. 마크업 구조·이벤트·계약 불변 |
| 컴포넌트(클래스 치환) | `components/system/SealedFallback.tsx:15-25` | `cs-root` |
| 컴포넌트(재구성) | `components/home/quantum/ClusterPopout.tsx:168-172, 206-268` | body/grid 클래스 정리, `ModuleTile` 인테리어(메달리온·kind·desc·foot), 도트 삭제 |
| 컴포넌트(속성) | `components/nav/FlagIcon.tsx:294-298` | `u-flag` 훅 + `data-flag` |
| 컴포넌트(숫자) | `LanguageSwitcher.tsx:107, 129, 133`, `GlobalLanguagePicker.tsx:111, 135` | 크기·패딩 |
| i18n | `messages/*.json` ×20 | `QuantumWhite.kind.*` 5키 실번역 |
| 테스트 | `__tests__/quantumWhite/{rev15FixedLayerGuard,rev15Tokens}.test.ts`(신설), `chrono.test.ts`, `clusters.test.ts` | §6-3 |
| E2E | `tests/web-cinema-e2e/rev15-{fixed-layers,viewport-fit,cluster-popout}.spec.js` | §6-4 (PHASE 1 스크래치 스크립트 `measure.js`/`verify-fixed.js`/`measure-postfix.js`/`repro-grid.js`를 승격) |
| 주석 | `components/audio/AudioGate.tsx` 상단 | "인트로 화면 작업 대상은 ComingSoonCinema GATE" 명기 |

**금지 사항**: `html`/`body`/`.dashboard-zoom`에 `filter|backdrop-filter|transform|perspective|will-change|contain` 선언; `html/body overflow:hidden`; `tracking-*` 값 변경; `line-clamp-2` 제거; 하단 행·창립자 도어 세로 모드 절대 위치 변경; `--qw-line` 값 변경; `lib/ecosystems.ts`·`lib/modules.ts` 수정; `ModalPortal` 대상(body) 변경; `.z-[140]`·`.z-[400]` 클래스 훅 제거(CSS·E2E가 의존); 홈 클러스터 카드 궤도 도트 제거; 신규 웹폰트; `?dev=true` 재도입; `HomeContent`/`cards/*` 삭제(별도 티켓 유지).

**범위 밖 관찰(별도 티켓 권고)**: 창립자 전용 `SovereignDebugPanel`이 모바일에서 홈 클러스터 카드를 덮음(§1 적용 후 뷰포트 좌상단 고정) → 768px 미만 기본 접힘 권고. 공개 경로 무관.

---

## 8. 실측 원본 요약 (재현 기준값)

### 8.1 body 필터 활성(현행) — 공개 방문
| 뷰포트 | body.scrollHeight | 커튼 높이 | ENTER top/bottom | scrollTo(0,400) 후 커튼 top |
|---|---|---|---|---|
| 375×667 | 1702 | 1702.4 | 927.2 / 973.2 | −400 |
| 1366×650 | 1002.5 | 1002.5 | 588.2 / 638.2 | −352 |
| 1920×1080 | 1080 | 1080 | 627 / 677 | 0 |

### 8.2 body 필터 무효화 시뮬레이션 — 넘침(scrollHeight−clientHeight) / 인플로우 범위
| 뷰포트·로케일 | 게이트 | 시네마 | 봉인(창립자) | 봉인 도어 / 하단 행 |
|---|---|---|---|---|
| 375×667 en | 0 / 179-488 (btn.b 449) | 0 / 277.5-389.5 | 0 / 111-416 | 453.5-571 / 609-667 |
| 375×667 tl | 0 / 166-501 (btn.b 462) | 0 | 0 / 111-416 | 453.5-571 / 609-667 |
| 360×640 tl | 0 / 152.5-487.5 | 0 / 266-374 | 0 / 104-401.5 | 426.5-544 / 582-640 |
| 360×640 pl | 0 | 0 | 0 / 138-368 | 395.3-544 / 582-640 |
| **844×390 tl/de** | **28** / 36.5-353.5 | 0 / 142-248 | 0 / 27-239 | **172.5-294 (겹침 66)** / 338-390 |
| 844×390 pl | 14 | 0 | 0 | **156.3-294 (겹침 82)** |
| 1366×768 tl | 0 / 213.5-554.5 | 0 / 254.5-513.5 | 0 / 152-454 | 550.5-672 / 716-768 |

### 8.3 팝업 (필터 무효화, 코그니티브 코어 16타일)
| 뷰포트 | 패널 y/h | body 방향·정렬 | 그리드 폭·열·템플릿 | 타일 h | 그리드 client/scroll |
|---|---|---|---|---|---|
| 375×667 | 0 / 667 | column · flex-start | 155.6 (41%) · 1 · `151.609px` | 44 | 473 / 934 |
| 1366×650 | 48.8 / 552.5 | row · flex-start | 840 · 5 · `157.6px ×5` | 105 (마지막 행 111) | 476 / 476 (bottom 851 > 777.5) |
| 1920×1080 | 212.9 / 654.3 | row · flex-start | 840 · 5 | 105 | 476 / 476 |

### 8.4 문자열 길이(20로케일 전수)
- 설명(descriptionKey): 최대 de 153 · fr 154 · nl 147 · ru 150 · **tl 166**, 최소 ja 5 · zh 7. 락인 태그라인 최대 45(nl/tl). 제목 최대 km 28 · vi 25 · fr 22.
- 게이트 부제(AudioGate.subtitle): **tl 147** · de 128 · fr 123. 커밍순 제목: fr 18("PROCHAINEMENT") · en 11 · ru 5. 시네마 SUB 최대 **tl 116** · pl 114 · it 111.

### 8.5 재현 절차 (PHASE 2 E2E 승격 전 수동 검증)
1. `cd index.html && npm --prefix web run build && (npm --prefix web run start -- -p 3123 &)`
2. 공개 방문 `http://127.0.0.1:3123/en?splash=0` (모바일 에뮬 375×667) → DevTools에서 `document.querySelector('.z-\\[400\\]').getBoundingClientRect().height` = 1702 확인 → `document.body.style.filter='none'` → 667 확인.
3. 창립자 경로 `?sovereign_auth=<token>&splash=0` → 게이트 ENTER → skip → 봉인 도어 → 홈 → 클러스터 카드 JS 클릭 → `.qw-tile-grid` 폭·`.qw-tile` 높이 판독.
4. 측정 후 `:3123` 프로세스 종료.
