# REV-14 UI/UX 정제 사양서 (SPEC.md) — PHASE 1 블루프린트

- 상태: **PHASE 1 (설계 확정본, 프로덕션 코드 미작성)**
- 기준 정본: `CLAUDE.md` (Ultimate Sovereign Master Codex **v16.0**). 요청문의 "Codex v17.0"은 저장소 어디에도 존재하지 않아(`grep -rli v17` 0건) v16.0을 유효 정본으로 채택함. v17.0 파일이 별도로 존재한다면 PHASE 2 착수 전 반입 요망.
- 기준 커밋: `32d5e1e` (REV-13 Quantum White + U-Pay 확장 완료 상태)
- 작업 루트: `index.html/web/` (Next.js 14 App Router, Tailwind 3, next-intl 20로케일)
- 검증 게이트(불변): `npm run typecheck` EXIT 0 → `npm run build` EXIT 0 → `npx vitest run` 283/283 → Playwright 뷰포트 매트릭스(§7)
- 표기 규칙: 파일 경로:행 번호는 2026-09-09 실측 기준. 모든 신규 CSS 변수는 `--qw-*`(퀀텀 화이트 스코프) 또는 `--u-*`(전역 게이트 스코프) 접두사만 사용.

---

## 0. 실측 진단 요약 (왜 고쳐야 하는가)

| # | 영역 | 현행 실측 | 결함 |
|---|---|---|---|
| 1 | 고정 스크린 5종 | 전부 `fixed inset-0` + 패널 `overflow-y-auto`; `100dvh/svh` 사용 0건; 스크롤바 전역 숨김(`globals.css:28-42`) | 넘침이 **무음**으로 발생(스크롤바가 안 보여 사용자는 잘린 줄 모름). 창립자 봉인 화면은 375×667에서 여유 **≈11px** |
| 2 | 내비바 | `#unitas-nav` 배경 `rgba(255,255,255,.84)`, 하단선 `--qw-line = rgba(10,10,12,.08)`, 그림자 없음, blur 12px | 백색 표면과 경계 소실. 설치 CTA 라벨 `#67e8f9`(대비 ≈1.4:1), 호버색 = 휴지색(`#b8962e`)이라 피드백 소멸 |
| 3 | UNITAS 타이틀 | Cinzel 700, `text-7xl/md:text-9xl`(clamp 없음), `--qw-ink`, `text-shadow:none`, 72px 골드 헤어라인 | 럭셔리 감 부족, 그림자 전무. 하단 태그라인 `QuantumWhite.heroTagline` 20로케일 잔존 |
| 4 | U-AI 검색바 | `bg-white/[0.04]` + `border-white/15` + 인라인 boxShadow; `#omni-synapse-search` 대상 CSS 규칙 **0건** | 흰 바탕 위 4% 흰 유리 = **비가시**. 포커스 전까지 윤곽 없음 |
| 5 | 모듈 패널 | 카드/타일 테두리 `1px var(--qw-line)`(8% 알파) × `.dashboard-zoom{zoom:.75}` = 유효 **≈0.75px** | 서브픽셀 + 저알파 = 번짐 |

---

## 1. 토큰 아키텍처 (CSS 변수 추가·변경 전량)

### 1.1 퀀텀 화이트 스코프 — `app/quantum-white.css:19-35` 블록에 **추가** (기존 11개 토큰 값은 불변)

```css
html[data-unitas-surface='quantum-white'] {
  /* --- REV-14 추가 --- */
  --qw-line-strong: rgba(10, 10, 12, 0.18);      /* 패널·타일 테두리 (8%→18%) */
  --qw-line-card:   rgba(10, 10, 12, 0.24);      /* 1차 클러스터 카드 테두리 */
  --qw-gold-deep:   #8a6d14;                     /* 백색 위 텍스트용 골드 (대비 4.6:1) */
  --qw-blue-deep:   #0847c9;                     /* 호버/포커스 청색 */
  --qw-glass-solid: rgba(255, 255, 255, 0.86);   /* 카드 배경 (.62→.86) */

  --qw-nav-bg:      rgba(255, 255, 255, 0.94);
  --qw-nav-line:    rgba(10, 10, 12, 0.16);
  --qw-nav-shadow:  0 1px 0 rgba(10, 10, 12, 0.06), 0 10px 28px -14px rgba(10, 10, 12, 0.22);
  --qw-nav-blur:    blur(18px) saturate(1.5);

  --qw-title-size:  clamp(3.25rem, 11.5vw, 8.5rem);
  --qw-title-track: 0.14em;
  --qw-title-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95),
    0 2px 2px rgba(10, 10, 12, 0.10),
    0 12px 28px rgba(10, 10, 12, 0.16),
    0 0 48px rgba(184, 150, 46, 0.22);

  --qw-search-radius: 18px;
  --qw-search-bg:     linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.86) 100%);
  --qw-search-ring:   linear-gradient(120deg, var(--qw-blue) 0%, var(--qw-gold) 50%, var(--qw-blue) 100%);
  --qw-search-glow-idle:  0 0 0 4px rgba(11, 92, 255, 0.08), 0 14px 40px -12px rgba(11, 92, 255, 0.35);
  --qw-search-glow-focus: 0 0 0 6px rgba(11, 92, 255, 0.14), 0 0 36px rgba(11, 92, 255, 0.45), 0 22px 56px -14px rgba(11, 92, 255, 0.55);
  --qw-search-glow-drag:  0 0 0 6px rgba(0, 200, 150, 0.16), 0 0 36px rgba(0, 200, 150, 0.45);
  --qw-search-inset:  inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(10,10,12,0.04);

  --qw-card-border-w: 2px;    /* zoom .75 → 유효 1.5px */
  --qw-tile-border-w: 1.5px;  /* zoom .75 → 유효 1.125px */
  --qw-card-shadow-rest:  0 1px 2px rgba(10,10,12,0.05), 0 6px 18px -10px rgba(10,10,12,0.12);
  --qw-card-shadow-hover: 0 18px 40px rgba(10,10,12,0.12);
}
```

### 1.2 전역 게이트 스코프 — `app/globals.css` `:root`(현재 5-7행, `color-scheme:dark`만 존재)에 **추가**

```css
:root {
  color-scheme: dark;
  /* --- REV-14 단일 뷰포트 게이트 토큰 --- */
  --u-vp-pad-y:   clamp(1.25rem, 5svh, 4rem);          /* 세로 패딩: 기존 py-16(64px) 대체 */
  --u-vp-pad-x:   clamp(1rem, 4vw, 2.5rem);
  --u-safe-top:   env(safe-area-inset-top, 0px);
  --u-safe-bottom: env(safe-area-inset-bottom, 0px);
  --u-gate-title: clamp(2.25rem, 8.5vmin, 6rem);        /* AudioGate h1: 48→96px 3단 → 연속 */
  --u-gate-sub:   clamp(0.875rem, 0.5rem + 1.6vmin, 1.25rem);
  --u-cin-head:   clamp(1.05rem, min(5.4vw, 9svh), 4.5rem);   /* 시네마 HEAD: 기존 clamp+sm/lg 통합 */
  --u-cin-sub:    clamp(0.72rem, min(3.2vw, 4svh), 1.5rem);
  --u-cin-gap:    clamp(0.75rem, 2.5svh, 1.5rem);              /* 기존 my-6 대체 */
  --u-seal-title: clamp(2rem, min(11vw, 9svh), 5.25rem);       /* COMING SOON */
  --u-seal-mark:  clamp(1.25rem, min(7vw, 5svh), 2.62rem);     /* UNITAS 워드마크 */
  --u-seal-gap:   clamp(1.25rem, 5svh, 4rem);                  /* 기존 mt-16 대체 */
  --u-seal-foot:  calc(4.5rem + var(--u-safe-bottom));         /* 하단 행 예약 (공개) */
  --u-seal-foot-founder: calc(clamp(9rem, 26svh, 13rem) + var(--u-safe-bottom)); /* 창립자 도어 포함 */
}
```

> `svh` 미지원 브라우저 폴백: 각 사용처에서 `vh` 값을 먼저 선언하고 `svh` 값을 뒤에 재선언한다(§2.0 공용 클래스 참조).

---

## 2. 고정 스크린 단일 뷰포트 최적화

### 2.0 불변 계약 (위반 금지)
1. **스크롤 잠금 금지** — `ComingSoonCinema.tsx:963-975`, `AudioGate.tsx:101-109` (창립자 지시 2026-08-29). `html/body`에 `overflow:hidden` 추가 불가. 패널의 `overflow-y-auto overscroll-contain`은 **페일세이프로 유지**하되, 콘텐츠가 뷰포트 안에 들어가도록 만들어 실제 스크롤이 발생하지 않게 한다.
2. `line-clamp-2` 크로스페이드 계약 — `ComingSoonCinema.tsx:1272-1284`. 유지.
3. `text-indent == tracking` 광학 중앙 계약 — `:1374-1384`, `:1391-1404`. `tracking-*` 값은 **손대지 않음**(폰트 크기만 토큰화).
4. 하단 행 레이아웃 계약 — `:1451-1462` (단일 `justify-between` 행, safe-area). 유지.
5. 창립자 도어 `absolute bottom-24` 핀 — `:1412-1426`. 유지(예약 패딩만 토큰화).
6. 스플래시 기하 계약 — `splash.css:1-10, 74-81, 155-159, 186-197, 297-308`. 유지.
7. 종료 가이드 카드 판독 순서 — `appExit.ts:778-788`. 유지.

### 2.1 공용 클래스 신설 — `app/globals.css` (섹션 `.cs-*` 인근)

```css
/* 단일 뷰포트 게이트 셸: fixed inset-0 위에 dvh 높이를 명시해
   모바일 URL바 수축 시 '큰 뷰포트' 기준으로 잘리는 현상 제거 */
.u-viewport-fit {
  height: 100vh;
  height: 100svh;          /* 정적 최소 뷰포트 = 넘침 0 보장 */
  max-height: 100dvh;
  padding-block: max(var(--u-vp-pad-y), var(--u-safe-top)) max(var(--u-vp-pad-y), var(--u-safe-bottom));
  padding-inline: max(var(--u-vp-pad-x), env(safe-area-inset-left, 0px)) max(var(--u-vp-pad-x), env(safe-area-inset-right, 0px));
  box-sizing: border-box;
}
```

### 2.2 화면별 변경 매트릭스

| 화면 | 파일:행 | 현행 클래스/값 | 변경 (클래스 치환 / CSS) |
|---|---|---|---|
| **로고 스플래시** | `splash.css:12-24` `.sp-root` | `fixed; inset:0; overflow:hidden; grid` (dvh 없음) | `.sp-root`에 `height:100vh; height:100svh;` 추가. `.sp-mark-3d` `clamp(150px,34vmin,260px)` → `clamp(120px,30vmin,260px)`. 중간 티어 `@media (max-height:560px){.sp-mark-3d{width:clamp(110px,26vmin,200px)} .sp-title{width:clamp(220px,52vw,520px)} .sp-stage{gap:clamp(6px,1.6vmin,14px)}}` 신설 (기존 470px 티어 `splash.css:415-425`는 유지) |
| **AudioGate** | `AudioGate.tsx:145-153` 루트 | `fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-y-auto overscroll-contain bg-void px-6 py-16 …` | `px-6 py-16` 제거 → `u-viewport-fit gate-panel` 추가 |
| | `:183-189` h1 | `mb-6 text-5xl md:text-7xl lg:text-8xl` | `text-5xl md:text-7xl lg:text-8xl mb-6` 제거 → `.gate-panel h1{font-size:var(--u-gate-title); line-height:1; margin-bottom:clamp(.75rem,2.5svh,1.5rem)}` |
| | `:190-192` p | `mb-12 text-base md:text-xl leading-relaxed` | `mb-12 text-base md:text-xl` 제거 → `.gate-panel p{font-size:var(--u-gate-sub); line-height:1.5; margin-bottom:clamp(1rem,4svh,3rem); display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:5; overflow:hidden}` (tl 147자 = 6줄 방어) + `@media (max-height:600px){-webkit-line-clamp:3}` |
| | `:156-158` 언어 피커 | `absolute right-4 top-4` | `top: max(1rem, var(--u-safe-top))` 로 CSS 보강 |
| **시네마 광고** | `ComingSoonCinema.tsx:1285` 캡션 박스 | `absolute inset-0 grid place-items-center overflow-y-auto overscroll-contain px-6 py-20 sm:px-10` | `px-6 py-20 sm:px-10` 제거 → `cs-cinema-body` 추가; `.cs-cinema-body{padding: clamp(3rem,10svh,5rem) var(--u-vp-pad-x)}` (상단 세그먼트 도트 `top-5`+하단 스킵 `bottom-6` 회피 유지) |
| | `:1298-1303` h2 | `text-[clamp(1.05rem,5.4vw,1.9rem)] leading-[1.12] sm:text-5xl lg:text-7xl` | 3개 크기 클래스 제거 → `.cs-cinema-body h2{font-size:var(--u-cin-head); line-height:1.12}` (`line-clamp-2`·`break-keep`·`tracking` 유지) |
| | `:1307-1310` 구분선 | `my-6` | → `.cs-cinema-body hr,.cs-cinema-divider{margin-block:var(--u-cin-gap)}` |
| | `:1311-1316` p | `text-[clamp(0.72rem,3.2vw,0.95rem)] sm:text-lg lg:text-2xl leading-snug` | → `.cs-cinema-body p{font-size:var(--u-cin-sub); line-height:1.35}` (`line-clamp-2` 유지) |
| **커밍순 봉인** | `:1349-1357` 패널 | `absolute inset-0 flex flex-col items-center justify-center overflow-y-auto overscroll-contain px-6 py-16 ${isFounder?'pb-56':''}` | `px-6 py-16 pb-56` 제거 → `cs-sealed` + `data-founder={isFounder?'1':undefined}`; `.cs-sealed{padding: var(--u-vp-pad-y) var(--u-vp-pad-x) var(--u-seal-foot)} .cs-sealed[data-founder]{padding-bottom:var(--u-seal-foot-founder)}` |
| | `:1358-1360` h2 | `text-[2.75rem] sm:text-7xl lg:text-[5.25rem]` (line-height 미지정) | → `.cs-sealed h2{font-size:var(--u-seal-title); line-height:1.05}` (tracking 0.22em 불변) |
| | `:1361-1366` p×2 | `mt-7` / `mt-3` | → `margin-top: clamp(.75rem,2.5svh,1.75rem)` / `clamp(.5rem,1.2svh,.75rem)` |
| | `:1385-1390` 워드마크 | `mt-16 text-[1.62rem] sm:text-[2.62rem]` | → `.cs-sealed .cs-seal-mark{margin-top:var(--u-seal-gap); font-size:var(--u-seal-mark)}` (`tracking-[0.45em]`+`[text-indent:0.45em]` 쌍 불변) |
| | `:1405-1410` 법인 라인 | `text-[0.8rem] sm:text-[1.05rem]` | → `font-size: clamp(.72rem, .5rem + 1vw, 1.05rem)` (`nowrap`·indent 쌍 불변) |
| | `:1427-1449` 창립자 도어 | `absolute bottom-24` | 위치 불변. `bottom: calc(6rem + var(--u-safe-bottom))` 로만 보강 |
| | `components/system/SealedFallback.tsx:15-25` | `p-6`, h2 `text-3xl` | 동일 토큰 적용(`.cs-sealed` 클래스 공유) — 3중 봉인 변형 동기화 |
| | `app/[locale]/layout.tsx:163-190` `<noscript>` | 인라인 `padding:1.5rem; fontSize:2rem` | 인라인 값에 `var(--u-vp-pad-y)`/`var(--u-seal-title)` 사용 |
| **종료 가이드** | `lib/exit/appExit.ts:793-797` 프레임 / `:811-817` 카드 | safe-area 패딩 이미 존재, 스크롤 폴백 없음 | 카드에 `max-height:calc(100dvh - 48px); overflow:hidden` 1줄 추가만. 나머지 불변 |

### 2.3 높이 예산 (변경 후 추정, 375×667 기준)
- AudioGate: 패딩 2×33 + h1 ≈ 57 + 12 + 부제 3줄 63 + 27 + 버튼 42 ≈ **267px** (여유 400px)
- 시네마: 패딩 2×67 + HEAD 2줄 45 + 구분 24+24 + SUB 2줄 33 ≈ **260px**
- 봉인(창립자): 33 + h2 2줄 ≈ 84 + 26 + 52 + 8 + 39 + 33 + 28 + 8 + 16 + 푸터 예약 ≈ 173 ≈ **500px** (여유 167px, 기존 11px → 15배 확보)

---

## 3. 내비바 대비 상향 — `app/quantum-white.css` §2 블록(57-73행) 교체·확장

```css
html[data-unitas-surface='quantum-white'] #unitas-nav {
  background: var(--qw-nav-bg);
  border-color: var(--qw-nav-line);
  box-shadow: var(--qw-nav-shadow);
  -webkit-backdrop-filter: var(--qw-nav-blur);
  backdrop-filter: var(--qw-nav-blur);
}
/* 휴지 아이콘/텍스트: 골드 → 딥골드 (대비 4.6:1) */
html[data-unitas-surface='quantum-white'] #unitas-nav .text-accent,
html[data-unitas-surface='quantum-white'] #unitas-nav .text-accent\/60,
html[data-unitas-surface='quantum-white'] #unitas-nav .text-accent\/70,   /* 신규: AuthButton.tsx:52 로그아웃 */
html[data-unitas-surface='quantum-white'] #unitas-nav .text-accent\/80 { color: var(--qw-gold-deep); }
/* 호버는 청색으로 분리 → 피드백 복원 */
html[data-unitas-surface='quantum-white'] #unitas-nav .hover\:text-accent:hover,
html[data-unitas-surface='quantum-white'] #unitas-nav .focus-visible\:text-accent:focus-visible { color: var(--qw-blue-deep); }
/* 설치 CTA: -webkit-text-fill-color 우선권 문제 해결 (globals.css:289-297) */
html[data-unitas-surface='quantum-white'] #unitas-nav .unitas-install-cta { color: var(--qw-ink); box-shadow: 0 0 0 1px var(--qw-nav-line); }
html[data-unitas-surface='quantum-white'] #unitas-nav .unitas-install-cta__brand { color: var(--qw-ink); -webkit-text-fill-color: var(--qw-ink); }
html[data-unitas-surface='quantum-white'] #unitas-nav .unitas-install-cta__label { color: var(--qw-blue-deep); -webkit-text-fill-color: var(--qw-blue-deep); opacity: 1; }
/* 로고 디스크 (globals.css:113-135) */
html[data-unitas-surface='quantum-white'] #unitas-nav .logo-hologram { background: rgba(10,10,12,0.04); border-color: rgba(10,10,12,0.14); }
/* 로그인 칩 (globals.css:478-485) */
html[data-unitas-surface='quantum-white'] #unitas-nav .nav-glass { background: rgba(255,255,255,0.92); border-color: var(--qw-nav-line); box-shadow: 0 1px 2px rgba(10,10,12,0.06); }
/* 스와이프 엣지 스크림 (globals.css:392-417): 검정 → 백색 그라데이션 */
html[data-unitas-surface='quantum-white'] #unitas-nav .nav-edge-hint-left  { background: linear-gradient(90deg, rgba(255,255,255,0.95), transparent); box-shadow: none; }
html[data-unitas-surface='quantum-white'] #unitas-nav .nav-edge-hint-right { background: linear-gradient(270deg, rgba(255,255,255,0.95), transparent); box-shadow: none; }
/* 포털 드롭다운 활성 항목 (LanguageSwitcher.tsx:130, 기존 128-137행 블록에 추가) */
html[data-unitas-surface='quantum-white'] .z-\[140\] .text-accent { color: var(--qw-gold-deep); }
```

- `app-download-pulse` 키프레임(`globals.css:211-232`)은 백색 위 골드 펄스가 약하므로 `#unitas-nav .app-download-pulse{animation-name: qw-install-pulse}` + 청색 계열 키프레임 1개 신설.
- 컴포넌트 편집: **없음** (전량 CSS 오버라이드). `NavBar.tsx:48` 클래스 문자열 불변.

---

## 4. 메인 "UNITAS" 타이틀 — 럭셔리 세리프 + 그림자, 태그라인 완전 소각

### 4.1 타이포 결정
- 폰트: **Cinzel** (이미 `app/layout.tsx:19-23`에서 `--font-cinzel` 400/700 로드 중). 신규 폰트 추가 없음 → 페이로드 0 증가. 웨이트 900이 필요하면 `weight:['400','700','900']` 1줄 확장(선택, 기본은 700 유지).
- 서브픽셀 광학: `font-feature-settings: 'kern' 1, 'liga' 1`, `-webkit-font-smoothing: antialiased`.

### 4.2 CSS — `app/quantum-white.css` §4 블록(144-156행) 교체

```css
html[data-unitas-surface='quantum-white'] .qw-hero-wrap h1 {
  color: var(--qw-ink);
  animation: none;                 /* .title-breathe 킬 유지 */
  font-size: var(--qw-title-size); /* text-7xl/md:text-9xl 계단 → 연속 */
  line-height: 0.95;
  letter-spacing: var(--qw-title-track);
  text-indent: var(--qw-title-track);   /* 광학 중앙 (tracking==indent 계약과 동일 원리) */
  text-shadow: var(--qw-title-shadow);
  font-feature-settings: 'kern' 1, 'liga' 1;
  -webkit-font-smoothing: antialiased;
}
html[data-unitas-surface='quantum-white'] .qw-hero-wrap h1::after {
  width: 112px;                     /* 72 → 112 */
  height: 1px;
  margin: 1.1rem auto 0;
  background: linear-gradient(90deg, transparent, var(--qw-gold) 35%, var(--qw-gold-deep) 50%, var(--qw-gold) 65%, transparent);
  box-shadow: 0 0 12px rgba(184,150,46,0.35);
}
@media (prefers-reduced-motion: no-preference) {
  /* 6s 미세 호흡: 그림자 알파만 변조, 스케일·색상 변화 없음 (REV-13 §0.3 절제 원칙) */
  html[data-unitas-surface='quantum-white'] .qw-hero-wrap h1 { animation: qw-title-luster 6s ease-in-out infinite; }
}
@keyframes qw-title-luster {
  0%,100% { text-shadow: var(--qw-title-shadow); }
  50%     { text-shadow: 0 1px 0 rgba(255,255,255,.95), 0 2px 2px rgba(10,10,12,.12), 0 16px 34px rgba(10,10,12,.20), 0 0 64px rgba(184,150,46,.32); }
}
```

- `Hero.tsx:11` 클래스 중 `text-7xl md:text-9xl tracking-[0.03em] leading-none` 4개 제거(CSS가 대체). `title-breathe font-serif font-bold text-white` 유지 → 다크 라우트 폴백 보존.
- **워터마크 의존성**: `SovereignWatermark.tsx:32-36`이 `.qw-hero-wrap h1`에 텍스트 노드를 append하므로 셀렉터·마크업 구조 불변.

### 4.3 태그라인 완전 소각 (컴포넌트 + i18n)
1. `QuantumWhiteHome.tsx:156-158` `<p className="qw-hero-tagline …">{t('heroTagline')}</p>` **삭제**.
2. `messages/{de,en,es,et,fr,hi,id,it,ja,km,ko,nl,pl,pt,ru,th,tl,tr,vi,zh}.json:1559` `QuantumWhite.heroTagline` 키 **20개 전부 삭제**.
   - 근거: `__tests__/i18n/quantumWhiteParity.test.ts:96-98`은 로케일별 QuantumWhite 키 집합 == en 집합을 요구. en만 지우면 19회 실패, 20개 동시 삭제면 통과. `scripts/i18n-sync.ts`는 미사용 키를 감지하지 않음.
3. `qw-hero-wrap` 하단 `pb-16` → `pb-12`로 축소(태그라인 소거로 생긴 공백 보정), 검색바 `-mt-[19px]`(`OmniSynapseSearch.tsx:543`) 불변.

---

## 5. U-AI 검색바 — 크리스탈 유리 내부 + 고임팩트 발광 테두리

### 5.1 컴포넌트 편집 (필수, 최소)
`OmniSynapseSearch.tsx:546-561`:
- 인라인 `style={{boxShadow…}}` **제거** (인라인 스타일은 CSS를 이기므로 발광을 CSS로 옮길 수 없음).
- `data-state={dragActive ? 'drag' : focused ? 'focus' : 'idle'}` 속성 추가.
- 클래스 문자열의 `border-white/15 | border-accent | border-neon` 삼항은 다크 라우트 폴백용으로 **유지**(QW 스코프에서 CSS가 덮음).

### 5.2 CSS — `app/quantum-white.css` 신규 §3b 블록 (`.dashboard-zoom` 리맵 직후)

```css
html[data-unitas-surface='quantum-white'] #omni-synapse-search {
  position: relative;
  border: 1.5px solid transparent;
  border-radius: var(--qw-search-radius);
  background: var(--qw-search-bg) padding-box, var(--qw-search-ring) border-box;
  background-size: 100% 100%, 300% 100%;
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  backdrop-filter: blur(24px) saturate(1.6);
  box-shadow: var(--qw-search-inset), var(--qw-search-glow-idle);
  transition: box-shadow .3s ease, background-position .6s ease;
  animation: qw-search-ring-flow 9s linear infinite;
}
html[data-unitas-surface='quantum-white'] #omni-synapse-search[data-state='focus'] {
  box-shadow: var(--qw-search-inset), var(--qw-search-glow-focus);
  animation-duration: 4s;
}
html[data-unitas-surface='quantum-white'] #omni-synapse-search[data-state='drag'] {
  box-shadow: var(--qw-search-inset), var(--qw-search-glow-drag);
}
@keyframes qw-search-ring-flow { from { background-position: 0 0, 0% 50%; } to { background-position: 0 0, 300% 50%; } }
/* 내부 요소 */
html[data-unitas-surface='quantum-white'] #omni-synapse-search input { color: var(--qw-ink); caret-color: var(--qw-blue); }
html[data-unitas-surface='quantum-white'] #omni-synapse-search input::placeholder { color: var(--qw-ink-3); opacity: 1; }
html[data-unitas-surface='quantum-white'] #omni-synapse-search .text-accent { color: var(--qw-blue); }              /* 검색 아이콘 :562 */
html[data-unitas-surface='quantum-white'] #omni-synapse-search .border-accent\/50 { border-color: var(--qw-blue); border-radius: 8px; } /* 제출 :624-632 */
html[data-unitas-surface='quantum-white'] #omni-synapse-search .hover\:bg-accent\/10:hover { background: var(--qw-blue-soft); }
html[data-unitas-surface='quantum-white'] #omni-synapse-search .text-gray-600 { color: var(--qw-ink-3); }           /* 클립/비디오/펜 :594-620 */
html[data-unitas-surface='quantum-white'] #omni-synapse-search .hover\:text-neon:hover { color: var(--qw-blue-deep); }
```

### 5.3 드롭다운·스트립 리맵 (누락분 보강, 동일 파일 §3에 추가)
| 대상 | 현행 | 리맵 |
|---|---|---|
| 드롭다운 패널 `:690-695` | `bg-white/[0.045] border-white/15 rounded-sm shadow-[0_30px_90px_rgba(0,0,0,0.6)]` | `.dashboard-zoom .bg-white\/\[0\.045\]` → `rgba(255,255,255,.96)`; `.border-white\/15` → `--qw-line-strong`; `.shadow-\[0_30px_90px_rgba\(0\,0\,0\,0\.6\)\]` → `0 30px 90px rgba(10,10,12,.18)`; `border-radius: 14px` |
| 매트릭스 스트립 `HotShortcutMatrixStrip.tsx:154` | `bg-white/[0.03] border-white/10` | `.bg-white\/\[0\.03\]` → `rgba(255,255,255,.9)` (`border-white/10`은 121-123행에서 이미 리맵) |
| 탭 필 `:176-180, :212-216` | `border-accent bg-accent/15 text-accent` | `.dashboard-zoom .border-accent`→`--qw-blue`, `.bg-accent\/15`→`--qw-blue-soft`, `.text-accent`→`--qw-blue-deep` |
| 행 `rowClass :741-742` | `hover:border-white/30` | `.hover\:border-white\/30:hover` → `--qw-line-strong` |

- 형태 결정: 현행 검색바는 의도적 **직각**이나, 발광 테두리는 라운드에서 번짐 없이 읽히므로 `18px` 채택. 직각 유지 요망 시 `--qw-search-radius: 0`으로 한 줄 회귀 가능.

---

## 6. 모듈 패널 테두리 선명화

### 6.1 대상 (라이브 홈에서 실제 렌더되는 패널은 2종 + 팝아웃 부속)
> `components/home/HomeContent.tsx`와 `components/cards/*`, `LockInModuleCarousel.tsx`는 **데드 코드**(import 0건, `app/[locale]/page.tsx:12`는 `QuantumWhiteHome`만 렌더). REV-14 범위 외 — 별도 정리 티켓 권고.

| 대상 | 파일:행 | 현행 | 변경 CSS (`quantum-white.css` §6/§7 확장) |
|---|---|---|---|
| 클러스터 카드 `.qw-cluster-card` | `SingularityCoreGrid.tsx:61` | `border border-[var(--qw-line)] bg-[var(--qw-glass)]` 그림자 없음 | `border-width: var(--qw-card-border-w); border-color: var(--qw-line-card); background: var(--qw-glass-solid); box-shadow: var(--qw-card-shadow-rest), inset 0 1px 0 rgba(255,255,255,.9)` |
| 〃 호버/포커스 | 〃 `hover:border-[rgba(10,10,12,.16)]` | | `border-color: var(--qw-ink-3); box-shadow: var(--qw-card-shadow-hover), inset 0 1px 0 #fff` |
| 모듈 타일 `.qw-tile` | `ClusterPopout.tsx:246` + `quantum-white.css:253-261` | `border 1px var(--qw-line)`, `bg-2` | `border-width: var(--qw-tile-border-w); border-color: var(--qw-line-strong); box-shadow: var(--qw-card-shadow-rest)`; 호버 `border-color: var(--qw-tile-accent, var(--qw-ink-3))` (기존 규칙 색상 폴백만 교체) |
| 팝아웃 헤더 하단선 | `ClusterPopout.tsx:147` | `border-b border-[var(--qw-line)]` | `.qw-popout-panel header{border-bottom-color: var(--qw-line-strong)}` |
| 닫기 버튼 | `:158` | `border-[var(--qw-line)]` | `.qw-popout-panel header button{border-color: var(--qw-line-strong)}` |
| 성공 카드 `.qw-module-success` | `ModulePopupSpace.tsx:94` | 〃 | `border-color: var(--qw-line-strong); border-width: 1.5px` |
| 팝아웃 패널 | `:141` `shadow-[0_30px_80px_rgba(10,10,12,.22)]` | | `outline: 1px solid var(--qw-line-strong); outline-offset:-1px` 추가 (백색 배경 위 패널 윤곽) |

- 원칙: `--qw-line`(8%) 토큰 값은 **불변** — 내비 하단선·헤어라인 등 미세 구분선용으로 잔존. 강조가 필요한 곳만 `--qw-line-strong / --qw-line-card`로 승격.
- `.dashboard-zoom{zoom:.75}` 보정: 카드 2px·타일 1.5px는 유효 1.5px·1.125px로 렌더되어 정수 픽셀 스냅 안정.
- 컴포넌트 편집: **없음** (`.qw-cluster-card`, `.qw-tile` 훅이 이미 존재, CSS 규칙 신설로 Tailwind 임의값보다 높은 특이도 확보).

---

## 7. 검증 계획 (PHASE 2 완료 조건)

1. `cd index.html && npm --prefix web run typecheck` EXIT 0
2. `npm --prefix web run build` EXIT 0 (prebuild `sync-codex.mjs` + 매니페스트, postbuild 핑거프린트)
3. `cd web; npx vitest run` — 기존 283 + 신규 2:
   - `__tests__/i18n/quantumWhiteParity.test.ts` 통과 (heroTagline 20파일 동시 삭제 확인)
   - 신규 `__tests__/quantumWhite/rev14Tokens.test.ts`: `quantum-white.css` 문자열에 §1.1 토큰 25개 전량 존재, `globals.css :root`에 §1.2 토큰 16개 존재
4. Playwright (`tests/web-cinema.config.js` 하네스 재사용) — 뷰포트 매트릭스 × 화면 5종, 각 패널 루트에서 `scrollHeight <= clientHeight + 1` 단언:
   - 375×667 (iPhone SE), 360×780 (Galaxy), 390×844 (iPhone 14), 430×932 (Pro Max), 768×1024, 1366×650 (PC 브라우저 크롬 차감), 1920×1080, 844×390 (폰 가로)
   - 로케일 최악 케이스: `tl`(AudioGate 부제 147자), `pl`(시네마 SUB 114자), `de`
   - 창립자 봉인 변형: `?sovereign_auth=<token>` 세션으로 `data-founder` 분기 검증
5. 대비 측정: `#unitas-nav` 텍스트/아이콘 전부 WCAG AA 4.5:1 이상 (`--qw-gold-deep` 4.6:1, `--qw-blue-deep` 7.1:1, `--qw-ink-2` 12.6:1)
6. `prefers-reduced-motion: reduce`에서 `qw-title-luster`, `qw-search-ring-flow`, `qw-install-pulse` 정지 확인 (`quantum-white.css:413-429` 블록에 3개 추가)

---

## 8. 편집 경계 요약 (PHASE 2 작업 지시서)

| 분류 | 파일 | 변경 성격 |
|---|---|---|
| CSS 전용 | `app/quantum-white.css` | 토큰 25개 추가, §2 내비 블록 교체, §3b 검색바 신설, §4 히어로 교체, §6/§7 패널 규칙 추가, §11 reduced-motion 3건 |
| CSS 전용 | `app/globals.css` | `:root` 토큰 16개, `.u-viewport-fit`, `.gate-panel`, `.cs-cinema-body`, `.cs-sealed` 신설 |
| CSS 전용 | `app/splash.css` | `.sp-root` svh 2줄, `.sp-mark-3d` clamp 하한, 560px 티어 |
| 컴포넌트(클래스 치환만) | `AudioGate.tsx:145-192`, `ComingSoonCinema.tsx:1285-1410`, `SealedFallback.tsx:15-25`, `[locale]/layout.tsx:163-190`, `Hero.tsx:11` | Tailwind 크기 리터럴 → 훅 클래스; 마크업 구조·이벤트·계약 불변 |
| 컴포넌트(속성 1개) | `OmniSynapseSearch.tsx:546-561` | 인라인 boxShadow 제거 + `data-state` |
| 컴포넌트(삭제) | `QuantumWhiteHome.tsx:156-158` | 태그라인 `<p>` 삭제, `pb-16→pb-12` |
| i18n | `messages/*.json` ×20, 1559행 | `QuantumWhite.heroTagline` 삭제 |
| 라이브러리 | `lib/exit/appExit.ts:811-817` | 카드 `max-height` 1줄 |
| 테스트 | `__tests__/quantumWhite/rev14Tokens.test.ts`, `tests/rev14-viewport.spec.js` | 신설 |

**금지 사항**: `html/body overflow:hidden`, `tracking-*` 값 변경, `line-clamp-2` 제거, 하단 행/창립자 도어 절대 위치 변경, `--qw-line` 값 변경, `.qw-hero-wrap h1` 셀렉터 구조 변경, 신규 웹폰트 추가, `HomeContent`/`cards/*` 삭제(별도 티켓).
