# REV-17 UI/UX · 심리 아키텍처 진화 사양서 (SPEC.md) — PHASE 1 블루프린트

- 상태: **PHASE 1 (설계 확정본, 프로덕션 코드 미작성)** — Codex v17.0 제20장(2단계 분할 실행) 준수. 본 문서가 PHASE 2의 유일한 작업 지시서.
- 기준 정본: 세션 루트 `CLAUDE.md` = **Ultimate Sovereign Master Codex v17.0** (커밋 `b2ec5d7`, 2026-09-09 각인). REV-14/15가 "v17 부재"로 기록했던 정본이 이번에 실재하므로 v17.0을 유효 정본으로 채택.
  - **⚠ 사전 게이트 결함(PHASE 2 착수 전 필수 해소)**: `b2ec5d7`은 루트 정본 3파일만 v17.0으로 갱신했고 운영 사본 4파일(`index.html/CLAUDE.md`, `index.html/THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md`, `index.html/.roo/rules/unitas-constitution.md`, `index.html/.continue/context/THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md`)은 v16.0 마커 블록 그대로다. 실측: `node scripts/sync-codex.mjs` → **4파일 drift, fail-closed (exit 1)**. `prebuild`가 이 스크립트를 verify 모드로 실행하므로 **현 상태에서 `npm run build`는 첫 단계에서 실패**한다. PHASE 2 step 0 = `node scripts/sync-codex.mjs --write` 후 verify EXIT 0 확인 → 별도 커밋(`chore(codex): sync v17.0 copies`).
- 기준 커밋: `b2ec5d7` (web/ 코드는 REV-15 완료 상태 `e71665a`와 동일, 2026-09-09 19:5x)
- 작업 루트: `index.html/web/` (Next.js 14.2.35 App Router, Tailwind 3.4, next-intl 20로케일, lucide-react 1.33.0, framer-motion 13)
- 검증 게이트(불변): `npm run typecheck` EXIT 0 → `npm run build` EXIT 0 (prebuild sync-codex verify 포함) → `npx vitest run` **504/504 + 신규** → Playwright `tests/web-cinema.config.js` 신규 스펙 5종 EXIT 0 (§9). REV-15의 교훈대로 Playwright 매트릭스는 완료 조건에 강제 편입.
- 표기 규칙: 파일 경로:행 번호는 `b2ec5d7` 실측. 신규 CSS 변수는 `--qw-*`(퀀텀 화이트) / `--u-*`(전역 게이트) 접두사만. 신규 sessionStorage/localStorage 키는 `unitas_*`(부트스트랩 공유) 또는 `unitas.qw.*`(홈 표면 전용).
- 언어: 모든 산출 카피는 **en(정본) + ko(정본)** 를 본 문서에 확정 수록하고, 나머지 18로케일은 PHASE 2 워크북(§7.4)으로 일괄 실번역.

## 실측 방법 (PHASE 1에서 실제 수행)

| 항목 | 내용 |
|---|---|
| 서버 | `npm --prefix web run start -- -p 3123` (BUILD_ID `uaPl5SSjzFDUksQHWPG86`, 2026-09-09 16:07 = REV-15 완료 빌드). 측정 후 프로세스 종료(로우메모리 아머) |
| 브라우저 | Playwright chromium (`index.html/node_modules/playwright`), 1366×768 데스크톱 + Pixel 7 에뮬(412×915, isMobile/hasTouch, DPR 1) |
| 경로 | 창립자 경로 `?sovereign_auth=<token>&splash=0` → 게이트(QA 노트 캡처) → 스킵 → 봉인 → 창립자 도어 → 홈 → 코그니티브 코어 팝업 → Echo 모듈 패널 → **F5** → `about:blank` 이동 후 **뒤로가기**. 각 단계 `getBoundingClientRect()`·`getComputedStyle()`·`history.state`·`performance.getEntriesByType('navigation')[0].type` 판독 |
| 정적 분석 | `lib/pwa/installPrompt.ts` 부트스트랩 ES5, `lib/splash/splashTimeline.ts` 재진입 독트린, `node_modules/next/dist/client/components/app-router.js` 히스토리 패치(14.2.35) 원문 확인, `lib/exit/appExit.ts` 센티널 계약, `messages/{en,ko}.json` QuantumWhite 네임스페이스 전수 |
| 스크립트·증거 | `docs/rev17/measure/` — `measure17.js`(하네스), `measure17.json`(1366×768)·`measure17-mobile.json`(Pixel 7), 스크린샷 7장(게이트 QA 노트·클러스터·팝업·모듈 패널·모바일 내비). §9-4 E2E 승격의 원본 |

---

## 0. 실측 진단 요약 (6대 과제별 현재 상태와 결함)

### 0.1 [M1] 진입 게이트 — 창립자 QA 노트
| # | 실측 |
|---|---|
| A-1 | `components/ComingSoonCinema.tsx:1218-1222` `{isFounder && (<p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-accent/50">founder · full sequential QA</p>)}` — 하드코딩 영문(비 i18n), 창립자 모드에서만 렌더. 1366×768 실측 y≈493, ENTER 버튼(y 447-497) 직하단. 공개 방문자에게는 원래 비노출 |

### 0.2 [M2-a] 내비 "UNITAS App Download" CTA
| # | 실측 (QW 홈, 1366×768 / Pixel 7) |
|---|---|
| B-1 | `components/nav/NavBar.tsx:59-71` 버튼: Tailwind `border-none bg-transparent`, `.app-download-pulse`(`app/globals.css:399-420`)의 keyframes가 `border-color`/`box-shadow`를 애니메이션하지만 **border-width 0 → 테두리 미표시**. computed `border: 0px none`, `box-shadow: rgba(212,175,55,.20~.34) 0 0 16~26px` (백색 내비 위 금색 글로우만) |
| B-2 | QW 스코프 `app/quantum-white.css:165-177`가 `box-shadow: 0 0 0 1px var(--qw-nav-line)`를 선언하지만 **애니메이션 keyframe의 box-shadow가 이를 덮어** 헤어라인이 사라짐(캐스케이드: 애니메이션 > 일반 선언) |
| B-3 | 크기: 데스크톱 146.6×20.3px(브랜드 15px / 라벨 11px), **모바일 60×22.9px(브랜드 10px / 라벨 8px, 2줄 스택)** → 44px 탭 타깃 미달, 라벨 8px는 판독 한계 이하 |
| B-4 | 색: 브랜드 `#0a0a0c`, 라벨 `--qw-blue-deep #0847c9` (대비 충분). 문제는 경계·존재감이지 색이 아님 |

### 0.3 [M2-b] 새로고침 라우팅 — 원인 4중 분해 (코드에서 확정 + 실측)
| # | 사실 | 근거 |
|---|---|---|
| C-1 | **팝업 상태는 어디에도 영속되지 않는다.** 클러스터 팝업 `openKey`(`SingularityCoreGrid.tsx:36`)와 모듈 패널 `activeModuleId`(`ClusterPopout.tsx:51`)는 React 메모리 상태 전용. F5 실측(데스크톱·모바일 동일): `phase: released` 유지, `navType: 'reload'`, **`popout: false`, `modulePanel: false`** → 홈 최상단으로 착지(데스크톱 scrollY 0) | measure17.json `reload.after` |
| C-2 | **F5 자체는 커튼 단계를 보존한다**(`unitas_cinema_phase` sessionStorage, `ComingSoonCinema.tsx:198-300`). "새로고침 → 광고 시퀀스" 는 F5가 아니라 **브라우저/OS가 대신 수행한 재로드**에서 발생한다 | 아래 C-3 |
| C-3 | 프리하이드레이션 부트스트랩 `lib/pwa/installPrompt.ts:152-153`: `nt = performance.getEntriesByType('navigation')[0].type`; **`nt !== 'reload'` 이면 `sessionStorage.clear()`**(재진입 리셋 독트린 2026-09-05 round 11, `shouldResetEntrySession()` `splashTimeline.ts:105-108`). 그런데 (a) **Chromium 탭 디스카드 복원**(백그라운드 메모리 회수 후 탭 복귀)은 `type === 'back_forward'` + `document.wasDiscarded === true`, (b) **WebKit(iOS Safari/WKWebView) 프로세스 퍼지 복원**은 `'back_forward'` 또는 `'navigate'`, (c) **설치형 App(standalone) 콜드 재기동**은 `'navigate'` + sessionStorage 소실 가능 — 셋 모두 방문자는 "잠깐 다른 앱 봤다가 돌아왔을 뿐"인데 `reload`가 아니므로 **세션 전량 소거 → 로고 페이지 → 게이트 → 광고 1단계**. 이것이 창립자가 모바일에서 관측한 "새로고침 시 광고 시퀀스로 회귀"의 실체다. 이 코드는 `wasDiscarded`·복원 타입을 전혀 참조하지 않는다(`grep wasDiscarded` → 0건) | installPrompt.ts:152-154 |
| C-4 | 실측 보조: `about:blank` → 뒤로가기 시 `navType: 'back_forward'`, `wasDiscarded: false`, 헤드리스 bfcache 비활성 → 문서 재로드. 하네스가 `?splash=0`(QA 플래그)라 소거는 면제됐지만, 실제 방문자 URL엔 플래그가 없으므로 동일 경로에서 소거된다 | measure17.json `backForward` |
| C-5 | 히스토리 상태 실측(홈, 첫 제스처 후): `history.state = { __NA:true, __PRIVATE_NEXTJS_INTERNALS_TREE:[…"/?splash=0","refresh"], unitasExitGuard:true, unitasExitDepth:12 }`, `history.length 14` → ExitGuard 12단 센티널이 **현재 URL(해시 포함)을 복제**해 쌓인다(`appExit.ts:1455` `pushState(n,'')`). URL 해시 설계 시 반드시 고려(§3.4.5) | measure17.json `reload.before` |
| C-6 | Next 14.2.35 히스토리 패치(`app-router.js:416-455`): `pushState/replaceState(data)`에서 **`data.__NA`가 있으면 원본 호출로 조기 반환(라우터 미동기화)**, 없으면 `copyNextJsInternalHistoryState` + `ACTION_RESTORE`(canonicalUrl 갱신, `preserveCustomHistoryState:true`). `HistoryUpdater`(`:98-121`)는 라우터 상태가 바뀔 때마다 `replaceState(historyState,'',canonicalUrl)`를 호출하며, `navigate/refresh/server-patch/server-action/fast-refresh` 리듀서는 `preserveCustomHistoryState=false`로 **커스텀 키를 버린다**. → 해시를 라우터 canonicalUrl에 "등록"하지 않으면 다음 라우터 갱신 때 해시가 조용히 소거된다. `sealHistoryEntryNow()`(`appExit.ts:1146-1159`)가 `__NA:true`를 넣어 조기 반환 경로를 **의도적으로** 타는 것과 정반대 요구 | 정적 분석 |

### 0.4 [M3] 4대 클러스터 카드
| # | 실측 (1366×768; Pixel 7 동일 구조, 카드 376×209) |
|---|---|
| D-1 | 로고 = **궤도 도트 링**(`SingularityCoreGrid.tsx:15-22, 68-76`, `quantum-white.css:489-494`): 도트 수 = 모듈 수(16/5/8/3) → 로고 자체가 카운터. 신비감 0, "숫자 세기" 유도 |
| D-2 | 카운터 텍스트 `t('moduleCount')` "16 modules"(`:83-85`, 10.88px 금색 대문자) + **태그라인이 수를 단어로 명시**("Sixteen intelligence engines…", ko "열여섯 개의 지능 엔진") — `QuantumWhite.clusters.*.tagline` 20로케일 전부 |
| D-3 | 제목 `font-serif 19.2px 700 #0a0a0c` (Tailwind `text-[1.2rem]`), `.dashboard-zoom` 0.75 안이라 실효 14.4px — 카드 220px 폭 대비 존재감 부족. 태그라인 13.1px `--qw-ink-3` |
| D-4 | 카드 209px 높이 중 궤도 63px(실효) + 제목 21.6 + 태그라인 44.3 + 카운터 12.2 |

### 0.5 [M4] 32 모듈 팝업 (코그니티브 코어 16타일 기준)
| # | 실측 |
|---|---|
| E-1 | 헤더 `h2` 클러스터명 + `p` "16 MODULES"(`ClusterPopout.tsx:155-157`), 그 아래 지시문 `t('selectModule')` "Select a module to see its return profile and invest in one click."(`:169`, 896px 전폭 36px) |
| E-2 | 타일(데스크톱 198.5×212.6, `quantum-white.css:542-641`): 헤드 행 = 메달리온(36px, 좌) + **`ECOSYSTEM` 종류 배지(우, `space-between`)**; 제목은 헤드 **아래**(min-height 2줄 = 36.8px → "Echo" 한 줄 뒤 빈 줄); 설명 3줄 클램프; 푸터 = **`1 U-COIN` 칩(좌) + 셰브런(우)**. 좌측 정렬 본문 vs 우측 끝에 매달린 배지·셰브런 → 시각적 무게 불균형("깨진 우측 정렬") |
| E-3 | **모바일 그리드 영역 미적용 결함(REV-15 회귀)**: `@media (max-width:767px)` `.qw-tile { grid-template-areas:'medal head' 'medal title' 'medal desc' 'medal foot' }`(`:712-718`)는 메달리온이 타일의 **직계 자식**일 때만 성립하나, DOM은 `<span.qw-tile-head><span.qw-tile-medallion/><span.qw-tile-kind/></span>`(`ClusterPopout.tsx:257-262`)로 **메달리온이 헤드 안에 중첩**. `grid-area: medal`(`:724-726`)은 플렉스 자식엔 무효 → 1열(40px)+간격 12px가 **빈 채로** 남고 모든 내용이 2열에 쌓임. 실측: 타일 x 28~380, 메달리온 x **97**, 제목 x 97, 배지 x 145, 셰브런 우측 363 → 좌측 53px 데드 스페이스 + 우측 끝 셰브런 = 창립자가 본 "우측으로 깨진 정렬"의 모바일 정체 |
| E-4 | 배지 i18n `QuantumWhite.kind.*`(REV-15 §4.2 신설) 5키×20로케일, 칩 `coinUnit` — 모두 제거 대상. `coinUnit`은 지갑 컴포넌트 4곳(`ChargeCoinsModal.tsx:145,168`, `CoinBalanceBadge.tsx:42`, `WalletBalanceModal.tsx:143,287`)이 공유 → **키는 유지**, 타일 소비만 제거 |
| E-5 | 팝업 바디 `pt-4` 위 지시문 36px, 헤더 84px → 콘텐츠 시작 y 208(데스크톱)/166(모바일) |

### 0.6 [M5] 최종 입장·체크아웃 게이트 (모듈 패널 + U-Pay)
| # | 실측 |
|---|---|
| F-1 | 구조: 데스크톱은 팝업 우측 **슬라이드 열**(`.qw-module-slide` 380×474.5, `ClusterPopout.tsx:180-192`), 모바일은 **바텀시트**(`quantum-white.css:743-760`, 412×378.6)이며 그 위 타일 그리드는 `display:none`(`:740-742`) → 시트 위 **500px 빈 회색 영역**(Pixel 7 스크린샷) |
| F-2 | 패널 내용(`ModulePopupSpace.tsx:72-130`): 액센트 바 → h3 제목 → 설명 → "ACCESS 1 U-COIN" 라벨 행 → `UPayGateway`(칩 "Access / 1 U-COIN", "Your balance / —", 링 버튼 **"Invest now"** 377×44, 상태 문단) → 성공 블록(제목·본문·잔액·"Enter now"/"Activate") |
| F-3 | 비용이 **두 번** 표기(패널 라벨 행 + 게이트웨이 칩) |
| F-4 | 법률 리스크 카피: `investNow`/`successTitle`("Investment executed")/`successBody`("Your position is live")/`insufficient`("…for this position")/`signInToInvest`/`unlisted`("opens for investment") — U-COIN은 접근 권한 선불 크레딧(`module_access_grants` 30분 TTL, `supabase/migrations/20260902000000_module_access_grants.sql:130`)인데 **투자·포지션 어휘**를 사용. 초법적(제1장 26·58·70·71)·초투명적 원칙과 충돌. M5의 "엄격한 법률·보안 경고"와 함께 **어휘 전환이 필수**(§6.6) |
| F-5 | 시나리오·이용 가이드·경고·영상 슬롯: 현재 **전무** |

---

## 1. [M1] 진입 게이트 — QA 노트 삭제

- `components/ComingSoonCinema.tsx:1218-1222` 블록 전체 삭제. 잔여 마크업 불변(h1 → p → 버튼). `isFounder`는 다른 곳(봉인 도어 `:1435-1458`, 오디오 토글)에서 계속 사용되므로 변수는 유지.
- 창립자 식별의 시각 표지는 **봉인 화면의 도어**(`founderAccessLabel` "창립자 인증 확인됨")로 충분. 게이트 화면은 공개·창립자 완전 동일(파일 헤더 주석 `:37` "identical" 계약 회복).
- 회귀 가드: `tests/web-cinema-e2e/rev17-entry-gate.spec.js` — 창립자 경로 게이트에서 `.cs-gate` 내 텍스트에 `/sequential|QA/i` **0건**, ENTER 버튼 `bottom ≤ innerHeight` 유지(REV-15 §2.2 예산 그대로, 노트 제거로 26px 여유 증가).

---

## 2. [M2-a] 내비 CTA — 은근한 가시성·테두리 강화

### 2.1 원칙
"클릭을 유도하되 요란하지 않게": **(1) 실재하는 헤어라인 테두리, (2) 6초 주기의 느린 호흡(링 확장 0→3px, 알파 ≤ .14), (3) 탭 타깃 ≥ 36px, (4) 라벨 최소 9px.** 금색 글로우 폭주(현행 26px 블러)는 백색 표면에서 번짐으로 읽히므로 QW 스코프에서 폐기.

### 2.2 마크업 — `components/nav/NavBar.tsx:59-71`
- 버튼 className에서 `border-none` **제거**, `rounded-xl … sm:rounded-full` 유지. 신규 훅 없음(`.unitas-install-cta`가 이미 훅).
- 라벨 span: `text-[8px]` → `text-[9px]`, `sm:text-[11px]` → `sm:text-[12px]`, `font-medium` → `font-semibold`.
- (선택, 기본 ON) 라벨 앞 `<ArrowDownToLine size={12} strokeWidth={2} aria-hidden className="hidden sm:inline-block" />` — lucide 1.33.0 export 확인 완료. 모바일은 공간 부족으로 숨김.

### 2.3 전역(다크 내비, 모듈 페이지) — `app/globals.css:453-476` `.unitas-install-cta`
```css
.unitas-install-cta {
  /* 기존 선언 유지 + */
  border: 1px solid var(--u-cta-line, rgba(212, 175, 55, 0.42));
  min-height: 32px;
  padding: 5px 10px;
}
@media (min-width: 640px) { .unitas-install-cta { min-height: 36px; padding: 6px 14px; } }
```
- keyframes `app-download-pulse`(`:399-410`)는 다크 표면 전용으로 **유지**하되 `border-color` 스텝을 .42→.65로 상향(테두리가 이제 실제로 보이므로 호흡이 드러남).

### 2.4 QW 스코프 — `app/quantum-white.css:165-177` 교체
```css
html[data-unitas-surface='quantum-white'] {
  --qw-cta-line: rgba(10, 10, 12, 0.45);        /* 백색 94% 위 3.15:1 (REV-15 플래그 헤어라인과 동일 수치) */
  --qw-cta-line-peak: rgba(10, 10, 12, 0.62);
  --qw-cta-bg: rgba(255, 255, 255, 0.72);
  --qw-cta-ring: rgba(184, 150, 46, 0.14);      /* --qw-gold 14% */
}
html[data-unitas-surface='quantum-white'] #unitas-nav .unitas-install-cta {
  color: var(--qw-ink);
  border-color: var(--qw-cta-line);
  background: var(--qw-cta-bg);
  box-shadow: 0 1px 2px rgba(10, 10, 12, 0.06);
  animation-name: qw-cta-breathe;               /* 이름만 교체 → duration/iteration은 globals 상속 */
  animation-duration: 6s;
}
@keyframes qw-cta-breathe {
  0%, 100% { box-shadow: 0 1px 2px rgba(10,10,12,.06), 0 0 0 0 var(--qw-cta-ring); border-color: var(--qw-cta-line); }
  50%      { box-shadow: 0 1px 2px rgba(10,10,12,.06), 0 0 0 3px var(--qw-cta-ring); border-color: var(--qw-cta-line-peak); }
}
html[data-unitas-surface='quantum-white'] #unitas-nav .unitas-install-cta:hover,
html[data-unitas-surface='quantum-white'] #unitas-nav .unitas-install-cta:focus-visible {
  border-color: var(--qw-blue-deep);
  box-shadow: 0 1px 2px rgba(10,10,12,.06), 0 0 0 3px rgba(11, 92, 255, 0.14);
  animation-play-state: paused;
}
```
- `__brand`/`__label` 색 규칙(`:169-177`) 불변. `prefers-reduced-motion` 블록(`globals.css:531-534`)이 `.app-download-pulse` animation을 `none !important`로 이미 끄므로 추가 규칙 불필요(테두리는 정적으로 남음 — 의도).
- 예산: 데스크톱 버튼 ≈ 168×36px, 모바일 ≈ 72×34px(2줄 스택 유지). 내비 높이 불변(py-5).

---

## 3. [M2-b] 새로고침·복원·재진입 상태 영속화 아키텍처 (핵심)

### 3.0 불변 계약
1. **Fail-closed 정체성 불변**: `released`는 어떤 저장소에서 복원되더라도 `verifySovereignFounder()` 서버 검증을 통과해야만 화면에 적용된다(`ComingSoonCinema.tsx:227-234, 266-297` 로직 무변경). 공개 방문자는 여전히 홈에 도달할 수 없다.
2. **재진입 독트린(2026-09-05 round 11)은 정제되되 폐기되지 않는다**: 타이핑 URL·북마크·외부 링크·다른 탭에서의 진입은 여전히 로고 페이지부터. 바뀌는 것은 **"방문자가 떠난 적이 없는 탭"** 을 재진입으로 오분류하던 부분뿐이다.
3. `?splash=0`(QA) 의미 불변: 상태 보존.
4. ExitGuard 센티널 계약(`appExit.ts:1425-1445`) 불변: 엔트리 수·`__NA`·마커/깊이 키를 건드리지 않는다. 신규 코드는 `pushState`를 **절대 호출하지 않는다**(replaceState만).
5. `lib/ecosystems.ts`·`lib/modules.ts`·DB·미들웨어 무변경. 서버 왕복 0건 추가.

### 3.1 문서 로드 분류기 — 신규 `lib/entry/loadClass.ts` (순수) + 부트스트랩 ES5
```ts
export type DocumentLoadClass = 'refresh' | 'restore' | 'entry';
export interface LoadSignals {
  navigationType: string | null;   // PerformanceNavigationTiming.type
  wasDiscarded: boolean;           // document.wasDiscarded === true (Chromium)
  hasPhaseRecord: boolean;         // sessionStorage[CINEMA_PHASE_STORAGE_KEY] 존재
  leaveStampPresent: boolean;      // sessionStorage['unitas_leave_at'] 존재 (직전 문서가 pagehide로 정상 종료됨)
  standalone: boolean;             // display-mode standalone/minimal-ui/window-controls-overlay 또는 navigator.standalone
  ledgerAgeMs: number | null;      // localStorage 방문 원장 나이 (없으면 null)
  qaKeepState: boolean;            // ?splash=0|off|false
  handoff: boolean;                // sessionStorage['unitas_handoff'] — 같은 탭 안의 자체 문서 교체(standalone 로케일 리다이렉트) 직전에 세팅
}
export const VISIT_LEDGER_TTL_MS = 30 * 60 * 1000;
export function classifyDocumentLoad(s: LoadSignals): DocumentLoadClass {
  if (s.qaKeepState) return 'refresh';
  if (s.handoff) return 'refresh';                                                // R0 자체 hand-off(문서 교체) = 연속
  if ((s.navigationType ?? '').toLowerCase() === 'reload') return 'refresh';
  if (s.wasDiscarded && s.hasPhaseRecord) return 'restore';                       // R1 Chromium 디스카드 복원
  if (s.hasPhaseRecord && !s.leaveStampPresent) return 'restore';                 // R2 pagehide 없이 죽은 문서(퍼지·크래시·프로세스 킬)
  if (!s.hasPhaseRecord && s.standalone && s.ledgerAgeMs !== null && s.ledgerAgeMs < VISIT_LEDGER_TTL_MS) return 'restore'; // R3 App 콜드 재기동
  return 'entry';
}
```
| 로드 사례 | 신호 | 분류 | 결과 |
|---|---|---|---|
| F5·당겨서 새로고침·`location.reload()` | `reload` | refresh | 제자리(현행) |
| standalone 로케일 프리페인트 리다이렉트(`standaloneLaunch.ts:68` `location.replace`) | `handoff` 플래그 | refresh | 연속(신규 — 없으면 R3로 복원한 세션을 2번째 문서가 `navigate`+스탬프로 다시 소거함) |
| Chromium 탭 디스카드 후 복귀 | `back_forward` + `wasDiscarded` | restore | **제자리(신규)** |
| WebKit 퍼지 후 복귀 (`navigate`/`back_forward`, 세션 잔존) | phase 있음 + 이탈 스탬프 없음 | restore | **제자리(신규)** |
| 설치형 App 콜드 재기동 (30분 이내) | phase 없음 + standalone + 원장 신선 | restore | **원장에서 제자리 복원(신규)** |
| 같은 탭에서 URL 타이핑/북마크 | `navigate` + 이탈 스탬프 있음 | entry | 로고 페이지(현행) |
| 타 오리진 갔다가 뒤로가기(비 bfcache) | `back_forward` + 이탈 스탬프 있음 | entry | 로고 페이지(현행 독트린) |
| bfcache 복원 (`pageshow.persisted`) | 별도 핸들러 | entry | 소거+reload(현행 독트린, §3.6 D-2) |
| 새 탭·PWA 첫 실행·30분 경과 재기동 | phase 없음 (+원장 부재/만료) | entry | 로고 페이지(현행) |

- **hand-off 플래그**: `STANDALONE_LAUNCH_BOOTSTRAP`(`lib/pwa/standaloneLaunch.ts:68`)이 `location.replace` 직전에 `sessionStorage.setItem('unitas_handoff','1')`. 분류기가 R0에서 소비(removeItem). 다른 자체 문서 교체(`SovereignDebugPanel`의 `?dev=` 콘솔 전환, 인앱 탈출)는 **의도적으로 플래그를 세우지 않는다**(콘솔 전환은 `consoleLoad()`가 별도 처리, 인앱 탈출은 외부 브라우저 새 문서).
- **이탈 스탬프**: `window.addEventListener('pagehide', () => sessionStorage.setItem('unitas_leave_at', String(Date.now())))` — 부트스트랩에서 등록(프리하이드레이션, 첫 바이트부터). 분류 직후 **항상 소비(removeItem)** 하므로 스탬프의 존재 자체가 "직전 문서가 정상 종료됐다"는 1비트 신호다. 디스카드·퍼지·프로세스 킬은 `pagehide`를 발화하지 않는다(Page Lifecycle: discard는 unload 핸들러 미실행). `beforeunload`는 사용하지 않는다(bfcache 자격 박탈).
- 부트스트랩 교체 — `lib/pwa/installPrompt.ts:152-154`의 3행을 §3.1 규칙의 ES5 등가문으로 교체. `shouldResetEntrySession()`(`splashTimeline.ts:105-108`)은 런타임 호출자 0건(주석 `installPrompt.ts:116`과 `__tests__/splash/splashTimeline.test.ts:149-150`만 참조) → `classifyDocumentLoad(...) === 'entry'` 래퍼로 재정의하고 테스트 2건을 분류기 표로 이관.
- 순서: (1) `qa` 판정 → (2) 스탬프 읽기 → (3) 원장 읽기 → (4) 분류 → (5) `entry`면 `sessionStorage.clear()` + 원장 삭제, `restore`(R3)면 **원장 → sessionStorage 복사**(phase·segment·surface·`unitas_splash_active` 제외) → (6) 스탬프 소비 → (7) 기존 `data-splash` 스탬프 로직(`:155`)은 그대로(복원된 phase가 in-place 집합이면 로고 페이지 생략).
- 회귀 가드: `__tests__/entry/loadClass.test.ts` 표의 9행 전부 + ES5 문자열이 동일 결정을 내리는지 `new Function` 실행 패리티(`__tests__/exit/appExit.test.ts`가 `EXIT_GUARD_BOOTSTRAP`에 쓰는 기법 재사용).

### 3.2 방문 원장 — 신규 `lib/entry/visitLedger.ts` (순수) + `localStorage['unitas_visit_ledger']`
```ts
export interface VisitLedger { v: 1; at: number; phase: string; segment?: string; surface?: string; locale?: string }
export function serializeLedger(l: VisitLedger): string; export function parseLedger(raw: string | null, now: number, ttlMs = VISIT_LEDGER_TTL_MS): VisitLedger | null; // 만료·손상 → null
```
- 기록 시점: `ComingSoonCinema.tsx:311-335` 영속 효과에서 sessionStorage 쓰기(`:323`) 옆에 원장 쓰기(같은 가드 — `verifyingReleased`·`skipInitialGate` 조건 동일 적용), 세그먼트 효과(`:338-345`) 동일, 표면 상태 쓰기(§3.4)마다, `visibilitychange:hidden`/`pagehide`/`freeze`에서 `at` 갱신(하트비트).
- 소비 시점: 부트스트랩 R3 전용. 온라인 브라우저 탭에서는 소비하지 않는다(새 탭=재진입 독트린). **R3를 비 standalone으로 확장하는 것은 실기기 검증 후 D-3 결정**(§3.6).
- 보안: 원장은 위치만 복원한다. `released`는 §3.0-1대로 서버 재검증. 원장 위조 → 공개 방문자는 `sealed`로 즉시 강등(현행 `if (!founder) … 'sealed'` 경로).
- 종료 시 소거: `terminateInPlace`(`appExit.ts:660` `sessionStorage.clear()` 옆)에서 원장 `removeItem` — App 종료 후 콜드 런치는 계속 로고 페이지부터(round 19 계약 유지).

### 3.3 표면 상태(팝업) 영속화 — 신규 `lib/quantumWhite/surfaceState.ts` (순수)
```ts
export interface SurfaceState { cluster: ClusterKey; moduleId?: string }     // moduleId = ClusterModule.id ('ecosystem:echo')
export const SURFACE_MIRROR_KEY = 'unitas.qw.surface.v1';
export const SURFACE_TOMBSTONE = '-';                                          // "명시적으로 닫힘"
export function encodeSurface(s: SurfaceState | null): string;                 // 'core/cognitive' | 'core/cognitive/ecosystem:echo' | ''
export function parseSurface(text: string, clusters: readonly SingularityCluster[]): SurfaceState | null; // 검증: cluster 존재 + module이 그 cluster 소속
export function resolveInitialSurface(input: { hash: string; mirror: string | null }, clusters): SurfaceState | null;
export function stripRouterKeys(state: unknown): Record<string, unknown>;      // __NA / _N / __PRIVATE_NEXTJS_INTERNALS_TREE 제거, 나머지(센티널 키) 보존
export function surfaceHref(location: { pathname: string; search: string }, s: SurfaceState | null): string;
```
- **우선순위 규칙(`resolveInitialSurface`)**: mirror가 존재하면 mirror가 진실(값이 톰스톤이면 "닫힘"). mirror가 **부재**할 때만 URL 해시를 딥링크로 채택. 이유: 같은 문서 안에서 ExitGuard 센티널이 이전 해시를 복제해 두고(C-5), 팝업을 닫은 뒤 뒤로가기 → 센티널 착지 → URL이 **옛 해시**를 보일 수 있다. mirror 톰스톤이 이를 무효화한다. 재진입(세션 소거) 후 남는 해시는 진짜 딥링크다.
- **URL 표기**: 쿼리가 아닌 **해시** `#core/<clusterKey>[/<moduleId>]`. 근거: 서버·미들웨어·CDN 캐시 키·canonical/hreflang(`app/[locale]/layout.tsx:36-52`)에 영향 0, `useSearchParams` Suspense 바운더리 불필요, 로케일 프리픽스와 무관, `sealedLaunchUrl()`(`appExit.ts:1108-1121`)이 종료 시 해시를 제거하므로 App 콜드 런치 계약과 자동 정합.
- **쓰기 경로(라우터 동기화 필수, C-6)**:
  ```ts
  const url = surfaceHref(window.location, next);
  window.history.replaceState(stripRouterKeys(window.history.state), '', url);
  ```
  `__NA`를 **제거한** 상태 객체를 넘겨야 Next 패치가 `copyNextJsInternalHistoryState`로 라우터 키를 다시 붙이고 `ACTION_RESTORE`로 canonicalUrl에 해시를 등록한다(`preserveCustomHistoryState:true` → `unitasExitGuard`/`unitasExitDepth` 보존). `__NA`를 남기면 조기 반환으로 라우터가 모르는 해시가 되어 다음 `HistoryUpdater` 실행(예: `router.refresh()`, 로케일 전환, 서버 액션)에서 소거된다.
  - 타이밍: **마운트 시 URL 쓰기 0건**(읽기 전용). React는 자식 효과를 부모보다 먼저 실행하므로 첫 커밋의 효과는 `AppRouter`의 패치 설치 `useEffect`(`app-router.js:412`)보다 앞서 원본 `replaceState`를 만날 수 있고, 그 경우 라우터가 모르는 URL이 된다. 톰스톤+잔존 해시(센티널 착지 잔상)의 정리는 **다음 사용자 쓰기(열기/닫기) 시점에 병합**한다 — 그때까지 남는 해시는 mirror 우선 규칙으로 무해(장식적 잔상). 사용자 상호작용에 의한 쓰기는 항상 패치 이후이므로 즉시.
  - `pushState` 금지(센티널 버퍼·DialogTower 프로토콜과 충돌 회피). "뒤로가기로 팝업 닫기" 제스처는 **본 REV 범위 밖**(ExitGuard 메인 홈 = 종료 확인 모달 계약 유지).
- **mirror 쓰기**: 열림 `setItem(KEY, encodeSurface(s))`, 닫힘 `setItem(KEY, '-')`(removeItem 아님). `HotShortcutResultModal`의 `unitas.ouroboros.shortcut.v1`(`QuantumWhiteHome.tsx:36, 65-86`)과 같은 패턴이며 로케일 리마운트에서도 살아남는다.
- **원장 쓰기**: 동일 시점에 `surface` 필드 갱신(§3.2).

### 3.4 복원 흐름 — `SingularityCoreGrid.tsx` + `ClusterPopout.tsx`
1. `SingularityCoreGrid`가 `useCurtainReleased()`(`useCurtainReleased.ts:43-60`)를 구독. `released`가 **true가 되는 첫 렌더**에서 `resolveInitialSurface({ hash: location.hash, mirror })`를 읽고(동기, useLayoutEffect), 유효하면 `acquireGate('qw-cluster')` 성공 시 `setOpenKey(cluster)` + `pendingModuleRef.current = moduleId`. 게이트 실패(다른 팝업이 선점: 예 `HotShortcutResultModal` 복원)면 표면 상태를 톰스톤으로 정리하고 포기.
   - 커튼 뒤에서 미리 열지 않는 이유: `ClusterPopout` 포커스 트랩이 `nav/main`에 `inert`를 걸고 첫 포커스를 이동시키므로(`ClusterPopout.tsx:64-121`) 커튼이 보이는 동안 실행하면 안 된다. 이미 `released`인 F5 경로에서는 layout effect가 홈과 **같은 커밋**에 팝업을 마운트하므로 "홈 → 팝업" 플래시가 없다.
2. `ClusterPopout`에 `initialModuleId?: string | null` prop 추가. `useEffect(() => setActiveModuleId(null), [cluster?.key])`(`:59-61`)를 `setActiveModuleId(consumeInitial())`로 변경(`initialModuleId`를 **1회 소비**하는 ref; 이후 클러스터 전환은 현행대로 null).
3. 쓰기 소유자는 **`SingularityCoreGrid` 단일**: `handleOpen` → `{cluster}`, `handleClose` → null(톰스톤), `ClusterPopout`은 `onModuleChange(moduleId|null)` 콜백으로 타일 열림/뒤로를 보고(`handleTileOpen`, 뒤로 버튼 `:185`). 이렇게 하면 mirror·해시·원장 3곳의 쓰기가 한 함수 `commitSurface()`에 모인다.
4. 스크롤: 복원 시 팝업이 열리므로 홈 스크롤 위치는 무의미(모달이 화면을 덮음). 팝업이 없던 경우의 스크롤 복원은 브라우저 기본(`history.scrollRestoration` 'auto')에 맡긴다 — 범위 밖.
5. 모듈 **페이지**(예 `/echo`)에서의 F5는 이미 제자리(커튼이 레이아웃 레벨). 변경 없음.
6. 로케일 전환(`LanguageSwitcher` → `router.replace(pathname,{locale})`, 클라이언트 트리 리마운트): mirror가 살아 있으므로 팝업이 같은 위치로 복원된다(현행은 소실). 해시는 next-intl 라우터가 유지하지 않을 수 있으나 mirror 우선 규칙으로 무해.

### 3.5 ExitGuard·Next 상호작용 검증 항목 (PHASE 2 필수 확인)
| 항목 | 기대 | 확인 방법 |
|---|---|---|
| 해시 쓰기 후 `history.state` | `__NA`, 트리, `unitasExitGuard`, `unitasExitDepth` **전부 보존** | E2E: 팝업 열기 → `history.state` 키 집합 비교(전/후 동일 + URL만 변화) |
| 해시 쓰기 후 `router.refresh()`·프리캐시 프리페치 | 해시 잔존 | E2E: 타일 호버(프리페치) 후 500ms 뒤 `location.hash` 유지 |
| 팝업 닫기 → 뒤로가기(센티널 착지) → F5 | 팝업 **열리지 않음**(톰스톤 우선), 해시 정리됨 | E2E |
| ESC/닫기 → 종료 확인 모달 | ExitGuard 동작 불변(`exit/*`, `omni-exit`, `app-exit-collapse` 기존 스펙 재실행) | 회귀 |
| `sealHistoryEntryNow()` | 해시 제거(기존) | 기존 vitest |

### 3.6 창립자 결정 사항 (기본값으로 PHASE 2 진행, 이의 시 1개 상수로 전환)
| ID | 결정 | 기본값 | 근거 |
|---|---|---|---|
| D-1 | "탭을 떠난 적 없는 재로드"(R1·R2)를 제자리 복원으로 분류 | **채택** | 창립자 관측 결함의 직접 원인(C-3). 독트린의 "재진입" 정의를 침해하지 않음 |
| D-2 | bfcache 복원(`pageshow.persisted`) | **현행 유지(소거+reload)** | 타 오리진 왕복은 독트린상 재진입. 변경 시 `installPrompt.ts:154` 1행만 삭제 |
| D-3 | 원장 복원 TTL / 적용 채널 | **30분 / standalone 전용** | 네이티브 앱의 상태 복원 창과 동등. iOS Safari 퍼지 시 sessionStorage 소실이 실기기에서 확인되면 R3를 `back_forward` 한정으로 브라우저 채널에 확장 |
| D-4 | 딥링크(해시만 존재)로 도착 시 퍼널 종료 후 팝업 자동 개방 | **채택** | 창립자 QA 링크 공유·향후 공개 후 모듈 공유 링크. 공개 방문자는 홈 미도달이라 무해 |

---

## 4. [M3] 4대 클러스터 — 시길(Sigil) 로고 · 제목 · 카운터 소각

### 4.1 카운터 소각 (홈 + 팝업 + 도트 + 태그라인)
| 대상 | 조치 |
|---|---|
| `SingularityCoreGrid.tsx:83-85` 카운터 span | 삭제 |
| `SingularityCoreGrid.tsx:15-22, 68-76` `orbitDotStyle`·도트 span, `quantum-white.css:489-494` `.qw-cluster-dot` | 삭제 → §4.2 시길로 대체. **REV-15 §7 "궤도 도트 제거 금지"는 본 REV로 명시 폐기**(도트 수=모듈 수라 카운터와 동치) |
| `ClusterPopout.tsx:155-157` 헤더 카운터 p | §5.1 수수께끼 서브타이틀로 대체 |
| `QuantumWhite.moduleCount` 20로케일 | 키 삭제(잔존 참조 0 확인 후) |
| `QuantumWhite.clusters.*.tagline` 20로케일 | **수사(數詞) 제거 재집필**(§7.1) |
| `__tests__/quantumWhite/clusters.test.ts` EXPECTED_COUNTS | 데이터 계층 카운트 단언은 **유지**(16/5/8/3은 레지스트리 계약). UI 단언만 제거 |
| `tests/web-cinema-e2e/rev15-cluster-popout.spec.js:37-40, 81-88, 117-150` | 타일 수 단언 유지, 배지/칩 단언 삭제(§9) |
| 신규 가드 | `__tests__/quantumWhite/rev17Copy.test.ts`: 20로케일 `QuantumWhite.clusters.*.tagline`·`.enigma`, `QuantumWhite.modules.*.riddle`에 **아라비아 숫자 0건**, `moduleCount`·`kind`·`selectModule`·`investNow` 키 **부재** |

### 4.2 시길 — 신규 `lib/quantumWhite/clusterSigils.tsx` (인라인 SVG, 단일 소스)
공통: `viewBox="0 0 64 64"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.25"`, `stroke-linecap="round"`, `vector-effect="non-scaling-stroke"`, `aria-hidden`. 색은 `.qw-cluster-sigil { color: var(--qw-ink-2); }`, 호버/포커스 시 `color: var(--qw-sigil-accent)`(= `cluster.accent`, 인라인 `--qw-sigil-accent`). 글로우·그라데이션·채움 **금지**. 카드당 1개 요소만 60~90초 주기로 극저속 회전(`prefers-reduced-motion: reduce`면 정지).

| 클러스터 | 시길명 | 기하(정확 사양) | 은유(내부 문서용, 화면 비노출) |
|---|---|---|---|
| cognitive | **Aperture (미개안)** | 중심 (32,32). 동심 호 3개: r=24 · 17 · 10, 각 호 sweep 300°, 열림(60°)의 방향을 0° / 120° / 240°로 회전. 중심점 `circle r=1.4 fill=currentColor`. 애니메이션: 바깥 호만 `rotate` 90s linear, 중간 호 −120s | 아직 열리지 않은 눈·조리개 |
| live | **Open Meridian (열린 자오선)** | `circle r=22` 를 `stroke-dasharray`로 36° 결손(결손 중심 45°, 우상단). 중심을 지나는 직선 1개: 각도 −30°, 중심 기준 t∈[−24, +28] (한쪽만 링 밖으로 4px 돌출). 애니메이션: 결손 링만 60s 회전 | 신호가 새어 나가는 살아 있는 고리 |
| lockin | **Trefoil (삼엽 매듭)** | 매개변수 곡선 x(t)=sin t+2 sin 2t, y(t)=cos t−2 cos 2t, t∈[0,2π), 96 샘플, 스케일 ×7.6, 중심 (32,32) — 단일 폐곡선 `path`. PHASE 2에서 `scripts/gen-sigils.mjs`로 결정론 생성(소수 2자리). 애니메이션: 전체 −150s | 풀리지 않는 매듭·귀환 |
| enterprise | **Three Rails (삼선 결속)** | 수직 헤어라인 3개: x=22 (y 14→50), x=32 (y 10→54), x=42 (y 18→46). 결속 사선 1개: (17,41)→(47,23). 교점 3곳에 `circle r=1.1 fill=currentColor`. 애니메이션: 없음(정적) | 신원·키·결제 — 세 레일을 꿰는 한 획 |

- 렌더: `SingularityCoreGrid.tsx:68-76` 궤도 span → `<span className="qw-cluster-sigil" style={{'--qw-sigil-accent': cluster.accent}}><Sigil name={cluster.key} /></span>`. `SingularityCluster`(`clusters.ts:74-83`)에 필드 추가 없음(키로 매핑).
- CSS(`quantum-white.css` §6 블록):
  ```css
  html[data-unitas-surface='quantum-white'] { --qw-sigil-size: 64px; --qw-sigil-stroke: 1.25px; }
  html[data-unitas-surface='quantum-white'] .qw-cluster-sigil { display:block; width:var(--qw-sigil-size); height:var(--qw-sigil-size); margin-bottom:14px; color:var(--qw-ink-2); transition:color .25s ease; }
  html[data-unitas-surface='quantum-white'] .qw-cluster-card:hover .qw-cluster-sigil,
  html[data-unitas-surface='quantum-white'] .qw-cluster-card:focus-visible .qw-cluster-sigil { color: var(--qw-sigil-accent); }
  html[data-unitas-surface='quantum-white'] .qw-sigil-spin { transform-origin: 50% 50%; animation: qw-sigil-spin var(--qw-sigil-period, 90s) linear infinite; }
  @keyframes qw-sigil-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { html[data-unitas-surface='quantum-white'] .qw-sigil-spin { animation: none; } }
  ```
- 대비: `--qw-ink-2 #2a2c33` 위 백색 글래스 12.6:1. 액센트 `#14b8a6`(live)는 백색 위 2.5:1로 **호버 상태 전용**(정지 상태는 잉크) — 비텍스트 3:1 기준을 정지 상태에서 충족.
- 테스트: `__tests__/quantumWhite/clusterSigils.test.tsx` — 4키 렌더, `fill="none"` 루트, `stroke-width 1.25`, trefoil path 샘플 96점, `aria-hidden`.

### 4.3 제목 가시성·카드 타이포
| 요소 | 현행(`SingularityCoreGrid.tsx:77-82`) | 변경 |
|---|---|---|
| 제목 span | `font-serif text-[1.2rem] font-bold tracking-[0.01em]` | 클래스 → `qw-cluster-title` (CSS: `font-size: var(--qw-cluster-title)` = **1.45rem**(23.2px, 실효 17.4px), `font-weight:700`, `letter-spacing:.02em`, `line-height:1.15`, `color:var(--qw-ink)`, `text-wrap: balance`) + 제목 아래 `::after` 금색 헤어라인 28×1px(`--qw-gold`, margin 8px auto 0) |
| 태그라인 span | `max-w-[26ch] text-[0.82rem]` | `qw-cluster-tagline` (`font-size:.84rem`, `max-width:24ch`, `color:var(--qw-ink-3)`, `line-height:1.45`, `margin-top:10px`) — 카피는 §7.1 |
| 카드 | `px-6 pb-7 pt-8`, `min-h-[44px]` | `padding: 30px 22px 26px` (CSS 이관), 높이 예산: 시길 64 + 14 + 제목 27 + 9 + 태그라인 2줄 36 + 여백 = **≈ 206px**(현행 209와 동일 밴드 → 레이아웃 시프트 0) |
| 모바일 | 동일 | `--qw-cluster-title: 1.3rem`, 시길 56px |

---

## 5. [M4] 32 모듈 팝업 — 헤더 카피 · 타일 재구성 · 정렬

### 5.1 헤더·지시문
- `ClusterPopout.tsx:152-157`: `h2` 클러스터명 유지; `p`(카운터) → `<p className="qw-popout-enigma">{tFull(cluster.enigmaKey)}</p>`(`SingularityCluster.enigmaKey = 'QuantumWhite.clusters.<key>.enigma'`, `clusters.ts:232-240` `cluster()`에 1행 추가). 스타일: `.qw-popout-enigma { margin-top:4px; font-size:.8rem; color:var(--qw-ink-3); letter-spacing:.01em; font-style: italic; }` (금색 대문자 트래킹 폐기 — 카운터의 시각 잔상 제거).
- `:169` 지시문 p → **삭제**. 대신 바디 상단 여백 `pt-4` → `pt-6`. `QuantumWhite.selectModule` 키 삭제.
- 헤더 좌측 `div`에 `min-w-0`, `h2`에 `text-wrap: balance`(km/vi 장문 대비).

### 5.2 타일 DOM — `ClusterPopout.tsx:244-272` 재구성
```tsx
<button ref={ref} type="button" data-kind={module.kind} style={style}
  className="qw-tile unitas-tap rounded-2xl border border-[var(--qw-line)] bg-[var(--qw-bg-2)]"  /* text-left 제거 */
  onPointerEnter={onWarm} onFocus={onWarm} onPointerMove={handlePointerMove} onPointerLeave={resetTilt} onClick={onOpen}>
  <span className="qw-tile-head">
    <span className="qw-tile-medallion" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
    <span className="qw-tile-title">{title}</span>                       {/* 로고 우측 */}
  </span>
  <span className="qw-tile-riddle">{tFull(module.i18n.riddleKey)}</span>  {/* 추상 카피 */}
  <span className="qw-tile-cue" aria-hidden="true" />                     {/* 중앙 헤어라인 */}
</button>
```
- 삭제: `.qw-tile-kind` 배지(`:261`), `.qw-tile-desc`(`:264`), `.qw-tile-foot`/`.qw-upay-chip`/`ChevronRight`(`:265-270`). `ChevronRight` import는 유지(`ChevronLeft`만 남으면 정리).
- `ClusterModule.i18n`(`clusters.ts:69`)에 `riddleKey: string` 추가 = `QuantumWhite.modules.<id>.riddle` (id는 `'ecosystem:echo'` 형태 — JSON 키에 `:` 허용, next-intl은 `.`만 구분자). 5개 빌더(`:140-230`) 각 1행.
- `descriptionKey`는 **유지**(입장 게이트·모듈 페이지가 계속 소비).

### 5.3 타일 CSS — `quantum-white.css:542-641` 교체, `:685-760` 모바일 블록 재작성
```css
html[data-unitas-surface='quantum-white'] {
  --qw-tile-min-w: 196px; --qw-tile-gap: 14px; --qw-tile-pad: 18px 14px 14px; --qw-tile-min-h: 148px;
  --qw-tile-medallion: 36px; --qw-tile-icon: 18px; --qw-tile-head-gap: 10px;
  --qw-tile-title-size: 0.95rem; --qw-tile-riddle-size: 0.78rem; --qw-tile-riddle-lines: 2;
  --qw-tile-cue-w: 20px; --qw-tile-cue-w-hover: 40px;
}
html[data-unitas-surface='quantum-white'] .qw-tile {
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  gap: 10px; min-height: var(--qw-tile-min-h); padding: var(--qw-tile-pad); text-align: center;
  /* border-width/color, box-shadow, transform(틸트), transition, --qw-tile-ink 폴백+@supports: 현행 유지 */
}
html[data-unitas-surface='quantum-white'] .qw-tile-head {
  display: flex; align-items: center; justify-content: center; gap: var(--qw-tile-head-gap);
  width: 100%; min-height: var(--qw-tile-medallion);
}
/* .qw-tile-medallion: 현행 규칙 유지(색·그림자·@supports) */
html[data-unitas-surface='quantum-white'] .qw-tile-title {
  flex: 0 1 auto; min-width: 0; max-width: calc(100% - var(--qw-tile-medallion) - var(--qw-tile-head-gap));
  text-align: left; font-size: var(--qw-tile-title-size); font-weight: 600; line-height: 1.2; color: var(--qw-ink);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere;
  /* min-height 제거 — 빈 2번째 줄(E-2) 소멸 */
}
html[data-unitas-surface='quantum-white'] .qw-tile-riddle {
  font-size: var(--qw-tile-riddle-size); line-height: 1.45; color: var(--qw-ink-3); text-wrap: balance;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--qw-tile-riddle-lines); overflow: hidden;
  min-height: calc(var(--qw-tile-riddle-lines) * 1.45em);   /* 같은 행 타일의 큐 y 정렬 */
}
html[data-unitas-surface='quantum-white'] .qw-tile-cue {
  margin-top: auto; width: var(--qw-tile-cue-w); height: 1px; background: var(--qw-tile-ink); opacity: .55;
  transition: width .2s ease, opacity .2s ease;
}
html[data-unitas-surface='quantum-white'] .qw-tile:hover .qw-tile-cue,
html[data-unitas-surface='quantum-white'] .qw-tile:focus-visible .qw-tile-cue { width: var(--qw-tile-cue-w-hover); opacity: 1; }
@media (max-width: 767px) {
  html[data-unitas-surface='quantum-white'] {
    --qw-tile-min-w: 140px; --qw-tile-gap: 10px; --qw-tile-pad: 16px 12px 12px; --qw-tile-min-h: 136px;
    --qw-tile-medallion: 32px; --qw-tile-icon: 16px; --qw-tile-head-gap: 8px; --qw-tile-title-size: 0.9rem; --qw-tile-riddle-size: 0.76rem;
  }
  html[data-unitas-surface='quantum-white'] .qw-tile-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--qw-tile-min-w)), 1fr)); }  /* 1fr 단일열 규칙(:709-711) 삭제 */
  /* 구 grid-template-areas 블록(:712-739) 전체 삭제 — E-3 근본 제거 */
}
```
- **정렬 보장(균형 중앙)**: 헤드 그룹(메달리온+제목)이 타일 중앙에 정렬되고 제목은 그룹 내부에서 좌측 정렬(아이콘 옆 라벨의 자연 독법). 수수께끼는 중앙 2줄 고정 높이, 큐 헤어라인은 `margin-top:auto`로 바닥 중앙. 좌·우 끝에 매달리는 요소 0 → E-2·E-3 해소.
- 폭 예산: 데스크톱 타일 198.5 − 28 = 170.5 → 제목 최대 124px(0.95rem ≈ 15.2px: "Life Dashboard" ≈ 112px 1줄, km 28자 2줄). 모바일 412px: 그리드 356 → **2열 173px**, 360px 기기: 304 → 2열 147px(140 최소 충족), 제목 최대 99px → 2줄 클램프 내.
- 높이 예산(데스크톱): pad 18+14 + 헤드 36 + gap 10 + 수수께끼 2줄 32.6 + gap 10 + 큐 1 = **121.6 → min-h 148** (4행 × 148 + 3 × 14 = 634 > 그리드 client 474 → 스크롤, REV-15 §4.1 `min-height:0` 유지로 정상 스크롤).
- 모바일 시트: 그리드 2열 8행(코그니티브) = 8×136+7×10 = 1158px 스크롤(현행 16행 리스트 3,100px 대비 −63%).
- `tests/…/rev15-cluster-popout.spec.js`의 "chip.bottom ≤ tile.bottom" 단언 → "cue.bottom ≤ tile.bottom", "hasKindBadge" 삭제, "desc 비어있지 않음" → `.qw-tile-riddle` 비어있지 않음 + 숫자 0건.
- `__tests__/quantumWhite/rev15Tokens.test.ts:44,55` (`--qw-tile-kind-size`, `.qw-tile-kind` 존재 단언) → REV-17 토큰 표(§8)로 교체(`rev17Tokens.test.ts`로 개명, REV-15 유지 항목은 이관).

### 5.4 모듈 상세 패널 → 입장 게이트 뷰로 승격 (§6)
`ClusterPopout.tsx:180-192` 슬라이드 열과 `quantum-white.css:677-680, 743-760` 슬라이드/바텀시트 규칙은 §6의 전면 뷰로 대체(삭제).

---

## 6. [M5] 최종 입장 게이트 — "Entry Gate" 전면 뷰

### 6.1 구조 결정
모듈 상세는 별도 z-레이어를 만들지 않고 **같은 `role="dialog"` 패널의 2번째 뷰**(`data-view="entry"`)로 승격한다. 근거: 포커스 트랩·`inert`·ESC·게이트 소유권(`qw-cluster`)을 그대로 상속(신규 접근성 코드 0), 모바일 "시트 위 빈 회색 500px"(F-1) 소멸, 해시 `#core/<cluster>/<module>`와 1:1 대응. 데스크톱은 패널 `max-width`를 896 → **640px**로 수축(`transition: max-width .28s`), 모바일은 전면 시트 유지.

```
.qw-popout-panel[data-view="entry"]
├─ header  (paddingTop safe-area 유지)
│   ├─ [← 뒤로]  (44×44, aria-label back → 타일 그리드 뷰)
│   ├─ .qw-entry-ident : 메달리온(36) + h2#qw-popout-title = 모듈 제목 (클러스터명은 작은 eyebrow로 위에)
│   └─ [×]
├─ .qw-entry-scroll  (flex:1; overflow-y:auto; overscroll-contain; padding 0 28px 20px)      ← "상단 절반"
│   ├─ .qw-entry-stage      16:9 영상 슬롯 (§6.3)
│   ├─ .qw-entry-scenario   eyebrow "SCENARIO" + 2문장 추상 시나리오 (§7.3)
│   ├─ .qw-entry-guide      eyebrow "HOW IT UNFOLDS" + 3개 항목 (kind별, §7.5)
│   └─ .qw-entry-notice     role="note" eyebrow "NOTICE" + 엄격 고지 4항 + /legal 링크 (§6.6)
└─ .qw-entry-pay  (position:sticky; bottom:0; background:var(--qw-bg); border-top:1px solid var(--qw-line-strong); padding:14px 28px calc(14px + var(--u-safe-bottom)))   ← "하단 절반"
    ├─ <UPayGateway module founder onSuccess/>   (DOM·상태기계 불변, 라벨만 §6.5)
    └─ 성공 블록 (ModulePopupSpace 현행 `qw-module-success`, 조건부)
```
- `ModulePopupSpace.tsx`는 `EntryGate.tsx`(신규, `components/home/quantum/`)로 대체하되 **`handleEnter`/`handleActivate`/`founderHint`/상태 3종/리셋 효과(`:30-56`)는 그대로 이식**. `:84-89` 비용 라벨 행 삭제(F-3 중복 제거 — 게이트웨이 칩이 유일 표기).
- 헤더 `h2` 텍스트가 모듈명으로 바뀌므로 `aria-labelledby` 계약 자동 충족. 뷰 전환 시 포커스: 진입 → 뒤로 버튼, 복귀 → 직전 타일(`openerTileRef`).
- 뒤로 버튼 = `onModuleChange(null)`(§3.4-3) → 해시 `#core/<cluster>`.

### 6.2 상단 절반 높이 예산 (1366×768, 패널 max-height 85vh = 652px)
헤더 84 + 스테이지 `min(34vh, 300px)`=261(16:9 → 폭 464 기준 261) + 시나리오 ≈ 70 + 가이드 3행 ≈ 78 + 고지 ≈ 96 + 하단 페이 존(칩 2×28 + 링 47 + 상태 20 + 패딩 28 = 151). 합 ≈ 740 > 652 → **스크롤 존이 흡수하고 페이 존은 sticky로 항상 노출**(전환점 상시 가시 = 설계 의도). 모바일 412×915: 헤더 84 + 스테이지 34vh 311 + 텍스트 ≈ 244 + 페이 151 = 790 ≤ 915 → 스크롤 없이 전량 노출.

### 6.3 영상 슬롯(2D/플래시 애니메이션 플레이스홀더) — `.qw-entry-stage`
- 컨테이너: `aspect-ratio:16/9; max-height:min(34vh,300px); width:100%; border-radius:14px; overflow:hidden; background: radial-gradient(120% 90% at 50% 100%, rgba(11,92,255,.10), transparent 60%), var(--qw-bg-2); border:1px solid var(--qw-line-strong); position:relative; content-visibility:auto;`
- 속성 계약: `data-video-slot="<moduleId>"`, `data-video-src=""`(비어 있으면 플레이스홀더 렌더). 추후 에셋: `public/entry/<kind>/<key>.webm|.mp4`(16:9, ≤ 1.2MB, 무음 루프, `preload="none"`, `muted playsInline loop`, 뷰가 열려 있고 `IntersectionObserver`가 가시일 때만 `<video>` 마운트) 또는 Lottie JSON(≤ 200KB). **오디오 자동재생 금지**(오디오 독트린 round 26).
- 플레이스홀더 씬(네트워크 0, 인라인): 중앙에 해당 클러스터 시길(§4.2) 96px, `--qw-tile-ink` 색, `opacity:.7`; 그 뒤로 대각 스윕 하이라이트(`linear-gradient(115deg, transparent 40%, rgba(255,255,255,.55) 50%, transparent 60%)`, `background-size:250% 100%`, 14s 왕복, `transform`/`background-position`만 사용) + 좌하단 캡션 `TRANSMISSION · STANDBY`(`QuantumWhite.entry.stageStandby`, .62rem 대문자 트래킹 .2em `--qw-ink-3`). `prefers-reduced-motion`: 스윕 정지.
- 성능: `<video>` 미마운트 상태에서 페인트 비용 = 그라데이션 2장 + SVG 1개. 첫 열림 INP 예산 < 120ms(§9 측정).

### 6.4 제로-랙 계약 (U-Pay)
- `UPayGateway.tsx` 상태기계·RPC·`ARM_MS 120`·이중 소진 가드·`attestUSignature`·`emitQuantumPulse` **무변경**. 마운트 시점도 현행과 동일(뷰 진입 즉시).
- 페이 존은 `contain: layout paint`, 스테이지는 `content-visibility:auto`로 상단 스크롤 존의 레이아웃이 버튼에 전파되지 않게 격리. 링 회전(`.qw-upay-ring::before`)은 compositor 전용(현행).
- 프리캐시: 타일 호버 `precache.warmModule`(현행) 유지. 입장 게이트 진입 시 라우트 프리페치가 이미 완료되어 성공 후 이동이 즉시.

### 6.5 CTA 라벨·상태 문구 (QuantumWhite 네임스페이스, 20로케일 재집필)
| 키 | 현행 en | **신규 en** | **신규 ko** | 비고 |
|---|---|---|---|---|
| `investNow` → **`enter`** | Invest now | **Enter** | **입장하기** | `UPayGateway.tsx:191,194,197,206` 4곳 |
| `executing` | Securing your position... | Opening the gate… | 문을 여는 중… | |
| `successTitle` | Investment executed | Access granted | 입장이 승인되었습니다 | `:200` 성공 라벨 겸용 |
| `successBody` | Your position is live. Enter and start creating value. | The gate is open for the next thirty minutes. | 지금부터 30분 동안 문이 열려 있습니다. | TTL 사실 고지 |
| `enterModule` | Enter now | Step inside | 안으로 들어가기 | 성공 블록 2차 버튼(§6.7 자동 진행 실패 시 폴백) |
| `activateModule` / `activated` | Activate / Activated on this device | 유지 | 유지 | 락인 전용 |
| `insufficient` | Balance too low for this position. | Not enough U-COIN to open this gate. | 이 문을 열기에는 U-COIN이 부족합니다. | |
| `chargeCoins` | Add U-COIN | 유지 | 유지 | |
| `signInToInvest` → **`signInToEnter`** | Sign in to invest | Sign in to enter | 입장하려면 로그인하세요 | `:188, 213` |
| `guestInvest` → **`guestEnter`** | Create a full account to hold assets and invest. | Create a full account to hold U-COIN and enter. | U-COIN을 보유하고 입장하려면 정식 계정을 만들어 주세요. | |
| `unlisted` | This position opens for investment shortly. | This gate opens soon. | 이 문은 곧 열립니다. | |
| `phoneRequired` | Verify your phone to invest. | Verify your phone to enter. | 입장하려면 휴대폰 인증이 필요합니다. | |
| `shieldBlocked` / `failed` | 유지(투자 어휘 없음) | 유지 | 유지 | |
| `costLabel` | Access | Entry | 입장 비용 | 칩 라벨 |
| `balanceLabel` | Your balance | 유지 | 보유 U-COIN | |
- 렌더 규칙: 버튼 `data-state` 불변(E2E 셀렉터). `oneClick.ts` 타입명(`planInvestment` 등)은 내부 식별자이므로 **개명하지 않는다**(리스크 0, 회귀 0).

### 6.6 법률·보안 고지 — `.qw-entry-notice` (`QuantumWhite.entry.notice.*`, 4항 + 링크)
| 키 | en | ko |
|---|---|---|
| `n1` | U-COIN is a prepaid utility credit that opens access. It is not an investment, a security, or a promise of any financial return. | U-COIN은 접근 권한을 여는 선불 유틸리티 크레딧입니다. 투자·증권·수익 상품이 아니며 어떠한 금전적 수익도 약속하지 않습니다. |
| `n2` | Once the gate opens, the U-COIN spent is final and non-refundable. Access stays open for 30 minutes per entry. | 문이 열리는 즉시 소모된 U-COIN은 확정되며 환불되지 않습니다. 입장 1회당 접근 권한은 30분간 유지됩니다. |
| `n3` | Every entry is checked by U-Signature behavioural attestation and zero-trust verification. Shared sessions, automation, or tampering are refused without notice. | 모든 입장은 U-Signature 행동 서명과 제로트러스트 검증을 거칩니다. 세션 공유·자동화 도구·변조는 사전 고지 없이 거부됩니다. |
| `n4` | Entering means you accept the Terms of Service and Privacy Policy. Where local law restricts prepaid digital credits, entry may be unavailable. | 입장은 이용약관 및 개인정보 처리방침에 대한 동의로 간주됩니다. 현지 법령이 선불 디지털 크레딧을 제한하는 지역에서는 입장이 제한될 수 있습니다. |
| `legalLink` | Terms · Privacy | 이용약관 · 개인정보 처리방침 |
- 스타일: `font-size:.72rem; line-height:1.5; color:var(--qw-ink-3); border-left:2px solid var(--qw-gold); padding:8px 12px; background:var(--qw-bg-2); border-radius:0 10px 10px 0;` 항목은 `<ol>`(번호 없는 `list-style:none`, 각 항 앞 `§` 글리프). 접기 없음(엄격 고지는 상시 노출). 링크는 `/legal/terms`·`/legal/privacy`(`lib/sitePages.ts` 기존 라우트, 존재 확인 필요 — 부재 시 `/legal`).
- 사실 정합성: n2의 30분은 `module_access_grants` `interval '30 minutes'`와 동일. n3은 `attestUSignature`·`profile.phone_verified` 게이트(`UPayGateway.tsx:104-122`)의 사실 기술.

### 6.7 성공 후 진행 (D-5, 기본 채택)
- 라우트가 있는 kind(ecosystem·b2c·b2b·lifeos-창립자)는 `onSuccess` 후 **700ms**(Quantum Blue 펄스 가시 시간) 뒤 `router.push(module.href)` 자동 진행 — "입장하기"를 눌렀는데 또 "들어가기"를 눌러야 하는 이중 동작 제거. 성공 블록은 그 700ms 동안 노출되며, 이동 실패(라우트 에러)·락인(`activate`)·`unlisted`는 현행 성공 블록+2차 버튼(`enterModule` "Step inside") 유지.
- 이의 시 `ENTRY_AUTO_PROCEED_MS = 0`으로 비활성(단일 상수).

### 6.8 CSS(신규, `quantum-white.css` §7 뒤 §7b)
```css
html[data-unitas-surface='quantum-white'] { --qw-entry-max-w: 640px; --qw-entry-stage-h: min(34vh, 300px); --qw-entry-eyebrow: .62rem; }
html[data-unitas-surface='quantum-white'] .qw-popout-panel { transition: max-width .28s cubic-bezier(.2,.8,.2,1); }
html[data-unitas-surface='quantum-white'] .qw-popout-panel[data-view='entry'] { max-width: var(--qw-entry-max-w); }
html[data-unitas-surface='quantum-white'] .qw-entry-scroll { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:0 28px 20px; display:flex; flex-direction:column; gap:18px; }
html[data-unitas-surface='quantum-white'] .qw-entry-eyebrow { font-size:var(--qw-entry-eyebrow); font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:var(--qw-ink-3); margin-bottom:6px; }
html[data-unitas-surface='quantum-white'] .qw-entry-scenario p { font-size:.92rem; line-height:1.55; color:var(--qw-ink-2); text-wrap:pretty; }
html[data-unitas-surface='quantum-white'] .qw-entry-guide li { display:grid; grid-template-columns:18px 1fr; gap:10px; font-size:.82rem; line-height:1.45; color:var(--qw-ink-2); }
html[data-unitas-surface='quantum-white'] .qw-entry-guide li::before { content:''; width:6px; height:6px; margin-top:.5em; border-radius:50%; background:var(--qw-tile-ink); justify-self:center; }
html[data-unitas-surface='quantum-white'] .qw-entry-pay { position:sticky; bottom:0; z-index:1; background:var(--qw-bg); border-top:1px solid var(--qw-line-strong); padding:14px 28px calc(14px + var(--u-safe-bottom, 0px)); contain:layout paint; }
@media (max-width:767px) { html[data-unitas-surface='quantum-white'] .qw-entry-scroll { padding:0 18px 16px; } html[data-unitas-surface='quantum-white'] .qw-entry-pay { padding-inline:18px; } }
```
- 삭제: `.qw-module-slide`(`:677-680, 743-760`), `qw-sheet-enter` keyframes, reduced-motion 내 `.qw-module-slide` 항목(`:882-884`), `.qw-tile-grid-hidden`(`:740-742`; 뷰 전환은 `data-view`로 그리드 자체를 언마운트).

---

## 7. 카피라이팅 가이드라인 · 확정 카피 · i18n 인벤토리

### 7.0 원칙 (전 표면 공통)
1. **숫자·수사 금지**: 아라비아 숫자, 수 단어(sixteen/열여섯), "모듈 N개" 류 전부 금지(테스트 가드 §4.1).
2. **지시문 금지**: "선택하세요/클릭하세요/투자하세요" 대신 **상태·질문·역설**로 끌어당긴다. 문장 끝은 마침표 또는 물음표, 느낌표 금지.
3. **길이**: 태그라인 ≤ 44자(ko ≤ 28자), 수수께끼 ≤ 60자(ko ≤ 34자, 2줄), 시나리오 2문장 ≤ 160자(ko ≤ 90자).
4. **어휘**: 투자·포지션·수익률·제국·주권(한국어) 금지(리스크 어휘 규칙 2026-08-29 유지). 영어 `Sovereign`은 허용. 모듈의 실제 기능에 **정확히 대응**하되 기능명을 직접 말하지 않는다(기능 = `descriptionKey` 원문이 근거).
5. **톤**: 차갑고 정확한 신비(과학적 미스터리), 감탄사·과장 부사 없음. 한국어는 하십시오체 아닌 **명사형·평서형 종결**("…이 남는다", "…를 본다").

### 7.1 클러스터 카피 (`QuantumWhite.clusters.<key>.{tagline,enigma}`)
| 클러스터 | tagline en / ko | enigma(팝업 서브타이틀) en / ko |
|---|---|---|
| cognitive | The engines that think before you ask. / 묻기 전에 먼저 생각하는 엔진들. | Every answer here was waiting for its question. / 이곳의 모든 답은 제 질문을 기다리고 있었다. |
| live | Services that answer within the first breath. / 첫 순간에 응답하는 서비스. | Some doors open the moment you look at them. / 어떤 문은 바라보는 순간 열린다. |
| lockin | The network that remembers you back. / 당신을 되기억하는 네트워크. | What holds you here is not a lock. / 당신을 붙드는 것은 자물쇠가 아니다. |
| enterprise | Rails beneath identity, keys and value. / 신원·키·가치 아래를 흐르는 레일. | Three rails. One current. / 세 개의 레일, 하나의 전류. |

### 7.2 모듈 수수께끼 32선 (`QuantumWhite.modules.<id>.riddle`) — 타일 카피
| id | en | ko |
|---|---|---|
| ecosystem:echo | Ask once. Hear what your question was hiding. | 한 번 묻는다. 질문이 숨긴 것을 듣는다. |
| ecosystem:void | The answer is in what was never written. | 답은 쓰이지 않은 자리에 있다. |
| ecosystem:mirror | It shows the pattern you keep looking past. | 늘 지나쳐 온 패턴을 비춘다. |
| ecosystem:oracle | Tomorrow, weighted before it arrives. | 도착하기 전에 무게가 매겨진 내일. |
| ecosystem:pulse | The world has a heartbeat. This is where it's felt. | 세계에는 맥박이 있다. 여기서 만져진다. |
| ecosystem:apex | Run the stakes before you place them. | 걸기 전에 판을 먼저 돌려 본다. |
| ecosystem:genesis | Start from nothing. Keep what survives. | 무에서 시작해, 살아남은 것만 남긴다. |
| ecosystem:syndicate | Every hidden alliance leaves a trace. | 숨은 동맹은 언제나 흔적을 남긴다. |
| ecosystem:aura | The presence you project, measured. | 당신이 내뿜는 기운, 측정된다. |
| ecosystem:paradox | Hold both sides until one gives way. | 양쪽을 쥐고 한쪽이 무너질 때까지. |
| ecosystem:chronos | Time, folded so you can read it. | 읽을 수 있도록 접어 둔 시간. |
| lifeos:life-dashboard | Your whole life, one silent panel. | 당신의 삶 전체, 소리 없는 한 화면. |
| lifeos:second-brain | It remembers so you can forget. | 당신이 잊을 수 있도록 대신 기억한다. |
| lifeos:review-agent | Someone reads it back to you, honestly. | 누군가 그것을 있는 그대로 되읽어 준다. |
| lifeos:brand-kit | A face that stays the same everywhere. | 어디서나 같은 얼굴. |
| lifeos:life-library | What you kept, finally in order. | 당신이 남겨 둔 것들, 마침내 제자리에. |
| b2c:arche | The first principle, before the first line. | 첫 줄보다 먼저 있는 첫 원리. |
| b2c:score | A number that knows more than you told it. | 말한 것보다 더 아는 숫자 하나. |
| b2c:arena | Enter unarmed. Leave sharper. | 맨손으로 들어가 더 날카로워져 나온다. |
| b2c:fate | The path is drawn. The turns are yours. | 길은 그려져 있다. 갈림은 당신 몫이다. |
| b2c:codex22 | Twenty-two keys. One is already turning. | 스물둘의 열쇠, 하나는 이미 돌아가고 있다. |
| lockin:nexus | One identity. Every door recognises it. | 하나의 신원, 모든 문이 알아본다. |
| lockin:aegis | A shield that never has to be raised. | 들어 올릴 필요가 없는 방패. |
| lockin:uTwin | A second you, learning while you rest. | 당신이 쉬는 동안 배우는 또 하나의 당신. |
| lockin:infinity | What was answered once never costs again. | 한 번 답해진 것은 두 번 값을 치르지 않는다. |
| lockin:panopticon | The whole world, held on a single screen. | 온 세계가 한 화면 위에 놓인다. |
| lockin:oracle | Probability, read before the coin lands. | 동전이 떨어지기 전에 읽는 확률. |
| lockin:syndicateX | Borrow the factory. Keep the output. | 공장은 빌리고 결과는 남긴다. |
| lockin:fateMatrix | Change the cause. Watch the effect follow. | 원인을 바꾸면 결과가 따라온다. |
| b2b:u-signature | You are the password you never type. | 당신 자신이 한 번도 입력하지 않는 비밀번호다. |
| b2b:u-key | One key, cut for every lock you own. | 당신이 가진 모든 자물쇠에 맞춘 열쇠 하나. |
| b2b:u-pay | Value moves the moment you decide. | 결정하는 순간 가치가 움직인다. |
- 예외 검토: `codex22`의 "Twenty-two/스물둘"은 **모듈 고유명(Codex22)의 일부**이므로 §7.0-1의 예외로 허용하되 아라비아 숫자는 쓰지 않는다. 테스트 가드는 아라비아 숫자만 검사.

### 7.3 입장 게이트 시나리오 32선 (`QuantumWhite.modules.<id>.scenario`) — 상단 절반 카피
| id | en | ko |
|---|---|---|
| ecosystem:echo | You type a single line. It comes back layered, each layer holding a part of what you meant. | 한 줄을 적는다. 그것이 겹겹이 되돌아오고, 층마다 당신이 뜻했던 조각이 들어 있다. |
| ecosystem:void | You describe what you have. It answers with what is missing, and the gap turns out to be the plan. | 가진 것을 말한다. 빠진 것이 돌아오고, 그 빈틈이 곧 계획이 된다. |
| ecosystem:mirror | You bring a decision you keep circling. It shows the loop from outside, then the exit. | 맴돌던 결정을 가져온다. 바깥에서 본 궤도를 보여 주고, 그다음 출구를 보여 준다. |
| ecosystem:oracle | You name a choice with a long horizon. Futures come back weighted, not promised. | 긴 지평의 선택을 꺼낸다. 미래들이 약속이 아니라 무게로 돌아온다. |
| ecosystem:pulse | You watch a market, a mood, a momentum. The screen breathes with it before the headlines do. | 시장과 분위기와 흐름을 본다. 헤드라인보다 먼저 화면이 그와 함께 숨 쉰다. |
| ecosystem:apex | You set the stakes as if they were real. The simulation spends them, so you don't have to. | 판돈을 진짜처럼 건다. 시뮬레이션이 대신 써 버리고, 당신은 잃지 않는다. |
| ecosystem:genesis | You start with one claim and no assumptions. What stands at the end is yours to build. | 가정 없이 주장 하나로 시작한다. 끝에 서 있는 것은 당신이 세울 것이다. |
| ecosystem:syndicate | You name the players. The hidden lines between them appear, and one of them leads to you. | 참가자를 적는다. 숨은 연결선이 드러나고, 그중 하나는 당신에게 닿아 있다. |
| ecosystem:aura | You show how you appear. It tells you how you are received, and what a single change would do. | 당신이 보이는 방식을 내놓는다. 어떻게 받아들여지는지, 한 가지를 바꾸면 무엇이 달라지는지 알게 된다. |
| ecosystem:paradox | You bring two truths that cannot coexist. You leave with the one that was load-bearing. | 양립할 수 없는 두 진실을 가져온다. 하중을 견디던 하나만 들고 나온다. |
| ecosystem:chronos | You lay your timeline down. It folds, and the moments that mattered line up. | 시간선을 펼쳐 놓는다. 그것이 접히며 중요했던 순간들이 한 줄로 선다. |
| lifeos:life-dashboard | Everything you run, on one quiet surface. Nothing shouts; the thing that needs you glows. | 당신이 굴리는 모든 것이 고요한 한 면 위에. 아무것도 소리치지 않고, 당신이 필요한 것만 빛난다. |
| lifeos:second-brain | You drop a thought in without filing it. Months later it returns, exactly when it fits. | 정리하지 않고 생각을 떨어뜨린다. 몇 달 뒤, 정확히 맞는 순간에 돌아온다. |
| lifeos:review-agent | You hand over a week. It comes back as a reading of what you actually did. | 한 주를 넘긴다. 실제로 무엇을 했는지에 대한 독해로 돌아온다. |
| lifeos:brand-kit | You set the face once. Every place you appear inherits it without asking. | 얼굴을 한 번 정한다. 당신이 나타나는 모든 곳이 묻지 않고 그것을 물려받는다. |
| lifeos:life-library | What you saved is finally shelved. The shelf knows what you'll reach for next. | 저장해 둔 것들이 마침내 서가에 꽂힌다. 서가는 당신이 다음에 꺼낼 것을 안다. |
| b2c:arche | Before the plan, the principle. It finds the one line the rest must obey. | 계획보다 먼저 원리. 나머지 모두가 따라야 할 한 줄을 찾아낸다. |
| b2c:score | You answer a few things honestly. A number appears that you'll argue with, then trust. | 몇 가지에 솔직히 답한다. 처음엔 반박하다 결국 믿게 될 숫자가 나타난다. |
| b2c:arena | You step in with an idea. It is tested against pressure until only the strong part remains. | 아이디어 하나로 들어선다. 압력에 시험되어 강한 부분만 남는다. |
| b2c:fate | You choose a destination. The path draws itself, and every fork shows its cost. | 목적지를 고른다. 길이 스스로 그려지고, 갈림길마다 값이 보인다. |
| b2c:codex22 | Twenty-two principles, one at a time. Each unlocks a way of seeing you didn't have yesterday. | 스물두 원리를 하나씩. 각각이 어제는 없던 시선을 연다. |
| lockin:nexus | One identity, carried everywhere. No door asks who you are twice. | 하나의 신원을 어디든 지닌다. 어떤 문도 두 번 묻지 않는다. |
| lockin:aegis | It watches while you don't. When something moves, you already know. | 당신이 보지 않는 동안 그것이 본다. 무언가 움직이면 당신은 이미 알고 있다. |
| lockin:uTwin | A twin built from your data, growing while you rest. Ask it what you would have said. | 당신의 데이터로 지어진 쌍둥이가 당신이 쉬는 동안 자란다. 당신이 했을 말을 그에게 묻는다. |
| lockin:infinity | Every answer you've earned is kept. Ask again and it costs nothing. | 얻어 낸 모든 답이 보관된다. 다시 물으면 값은 없다. |
| lockin:panopticon | The world's motion on one screen. You don't search; you notice. | 세계의 움직임이 한 화면에. 검색하지 않고 알아차린다. |
| lockin:oracle | You describe the moment before it happens. It returns the odds, and what shifts them. | 일어나기 전의 순간을 묘사한다. 확률과, 그것을 바꾸는 것이 돌아온다. |
| lockin:syndicateX | You rent a factory that runs itself. What it makes is yours; what it learns stays with the network. | 스스로 도는 공장을 빌린다. 만들어진 것은 당신 것, 배운 것은 네트워크에 남는다. |
| lockin:fateMatrix | You set the goal. It traces the causes backward and tells you which one to touch. | 목표를 정한다. 원인을 거슬러 추적해 어느 것을 건드려야 하는지 알려 준다. |
| b2b:u-signature | You never type a password again. The way you move is the proof, and it cannot be copied. | 다시는 비밀번호를 치지 않는다. 당신이 움직이는 방식이 증명이며, 복제되지 않는다. |
| b2b:u-key | One key that fits every lock you issue. Rotate it, and every door follows. | 당신이 발급한 모든 자물쇠에 맞는 열쇠 하나. 돌리면 모든 문이 따라온다. |
| b2b:u-pay | Value moves the instant you decide, with no page in between. What you meant to pay, paid. | 결정하는 순간 가치가 움직인다, 그 사이에 어떤 페이지도 없이. 내려던 값이 그대로 내어진다. |

### 7.4 i18n 볼륨·절차
| 그룹 | 키 수 | ×20 | 비고 |
|---|---|---|---|
| 클러스터 tagline 재집필 + enigma 신설 | 4 + 4 | 160 | §7.1 |
| 모듈 riddle | 32 | 640 | §7.2 |
| 모듈 scenario | 32 | 640 | §7.3 |
| 가이드(kind별 3항) `QuantumWhite.entry.guide.<kind>.{g1,g2,g3}` | 15 | 300 | §7.5 |
| 고지 `entry.notice.{n1..n4,legalLink}` + 라벨 `entry.{eyebrowScenario,eyebrowGuide,eyebrowNotice,stageStandby,back}` | 10 | 200 | §6.3, §6.6 |
| U-Pay 라벨 재집필(§6.5, 키 개명 3) | 13 | 260 | 기존 키 재집필 |
| 삭제 | `moduleCount`, `selectModule`, `kind.*`(5), `investNow`, `signInToInvest`, `guestInvest` | −200 | |
| **합계 신규/변경** | | **≈ 2,200 문자열** | REV-15(100)의 22배 → **워크북 절차 필수** |
- 절차: (1) PHASE 2-a에서 en·ko를 `messages/en.json`·`ko.json`에 직접 각인(본 문서 표가 정본). (2) `npm run i18n:sync`로 18로케일에 `[MISSING:en]` 플레이스홀더 생성. (3) `docs/rev17/copy-workbook.json`(키 → en/ko/컨텍스트/글자 수 한도) 생성 후 18로케일 실번역을 **한 배치**로 주입(자동 번역 초안 + 원어 검수 필드). (4) `quantumWhiteParity.test.ts:96-102` `[MISSING` 0건 통과가 배포 게이트. 플레이스홀더 상태로는 `build`는 통과하나 **vitest가 fail-closed** — 의도된 게이트.
- 한도 검증: `rev17Copy.test.ts`가 로케일별 글자 수 상한(riddle 72, tagline 56, scenario 200 — 라틴 기준; CJK/태국어는 ×0.6) 초과 시 실패 → 타일 2줄 클램프 보장.

### 7.5 이용 가이드(kind별 3항) 정본
| kind | en (g1 / g2 / g3) | ko |
|---|---|---|
| ecosystem | One entry opens one engine for thirty minutes. / Ask in your own words; the engine answers in yours. / Answers you accept are kept for you in Genesis Memory. | 입장 한 번에 엔진 하나가 30분 열린다. / 당신의 말로 묻고, 당신의 말로 답을 받는다. / 받아들인 답은 제네시스 메모리에 당신 몫으로 보관된다. |
| lifeos | Founder-verified surfaces only; the gate confirms before it opens. / Your data stays yours and leaves only when you export it. / Sessions close silently after thirty minutes. | 창립자 검증을 거친 표면만 열린다. 문은 열기 전에 확인한다. / 데이터는 당신 것으로 남고 내보낼 때만 나간다. / 세션은 30분 뒤 조용히 닫힌다. |
| b2c | Enter once; the service runs for thirty minutes. / Nothing is charged twice for the same open door. / Leave and return within the window at no cost. | 한 번 입장하면 30분 동안 서비스가 돈다. / 이미 열린 문에는 두 번 값을 매기지 않는다. / 시간 안에 나갔다 돌아오면 값은 없다. |
| lockin | Activation lives on this device until you turn it off. / It works while you sleep; nothing runs without your data. / Deactivate anytime; nothing is deleted. | 활성화는 끄기 전까지 이 기기에 머문다. / 당신이 잠든 동안 돌아가고, 당신 데이터 없이는 아무것도 돌지 않는다. / 언제든 끌 수 있고, 아무것도 지워지지 않는다. |
| b2b | Enterprise rails open to a preview surface first. / Keys, signatures and settlements are simulated until a contract is live. / Your access is logged for audit; nothing else is. | 엔터프라이즈 레일은 먼저 프리뷰 표면으로 열린다. / 키·서명·정산은 계약이 살아 있기 전까지 시뮬레이션이다. / 접근 기록은 감사를 위해 남고, 그 외에는 남지 않는다. |
- "thirty minutes/30분"은 고지·가이드에서만 사용(사실 기술이므로 §7.0-1 예외; 타일·태그라인·수수께끼에는 불가).

---

## 8. 토큰 아키텍처 총괄 (신규·변경 전량)

| 스코프 | 토큰 | 값 | 용도 |
|---|---|---|---|
| `html[qw]` | `--qw-cta-line`, `--qw-cta-line-peak`, `--qw-cta-bg`, `--qw-cta-ring` | ink .45 / .62 / white .72 / gold .14 | §2.4 |
| `:root` | `--u-cta-line` | gold .42 | §2.3 다크 내비 |
| `html[qw]` | `--qw-sigil-size`, `--qw-sigil-stroke`, `--qw-sigil-period` | 64px / 1.25px / 90s | §4.2 |
| `.qw-cluster-sigil` | `--qw-sigil-accent` | 인라인 `cluster.accent` | §4.2 호버 |
| `html[qw]` | `--qw-cluster-title` | 1.45rem (모바일 1.3rem) | §4.3 |
| `html[qw]` | `--qw-tile-min-w/gap/pad/min-h/medallion/icon/head-gap/title-size/riddle-size/riddle-lines/cue-w/cue-w-hover` | §5.3 | 타일 |
| 삭제 | `--qw-tile-desc-size`, `--qw-tile-desc-lines`, `--qw-tile-kind-size` | — | REV-15 토큰 3종 폐기 |
| `html[qw]` | `--qw-entry-max-w`, `--qw-entry-stage-h`, `--qw-entry-eyebrow` | 640px / min(34vh,300px) / .62rem | §6.8 |
| 상수(TS) | `VISIT_LEDGER_TTL_MS`, `ENTRY_AUTO_PROCEED_MS`, `SURFACE_MIRROR_KEY`, `SURFACE_TOMBSTONE` | 1,800,000 / 700 / `unitas.qw.surface.v1` / `-` | §3, §6.7 |
| 저장소 키 | `unitas_leave_at`(session), `unitas_handoff`(session), `unitas_visit_ledger`(local), `unitas.qw.surface.v1`(session) | — | §3 |
| 불변 | `--qw-line`(8%), `--qw-line-strong/card`, `--qw-lum-pct`, REV-14 토큰, `--u-*` 게이트 토큰, `--u-flag-*` | — | — |

---

## 9. 검증 계획 (PHASE 2 완료 조건)

0. **사전 게이트**: `cd index.html && node scripts/sync-codex.mjs --write && node scripts/sync-codex.mjs` EXIT 0 (§헤더 결함).
1. `npm --prefix web run typecheck` EXIT 0.
2. `npm --prefix web run build` EXIT 0 (prebuild 3종 통과; `lib/ecosystems.ts`/`modules.ts` 무변경으로 레지스트리 검증기 보장).
3. `cd web; npx vitest run` — 기존 504 (개정 후) + 신규:
   - `__tests__/entry/loadClass.test.ts` (§3.1 표 8행 + ES5 패리티), `__tests__/entry/visitLedger.test.ts` (직렬화·TTL·손상 입력)
   - `__tests__/quantumWhite/surfaceState.test.ts` (encode/parse/검증/우선순위/`stripRouterKeys`가 `unitasExitGuard`·`unitasExitDepth` 보존·`__NA`/트리 제거)
   - `__tests__/quantumWhite/clusterSigils.test.tsx` (§4.2)
   - `__tests__/quantumWhite/rev17Copy.test.ts` (§4.1 숫자 0건·삭제 키 부재·글자 수 상한·`entry.*`/`modules.*.riddle|scenario` 32×20 존재)
   - `__tests__/quantumWhite/rev17Tokens.test.ts` (§8 토큰 존재, `.qw-tile-kind`/`.qw-module-slide`/`.qw-cluster-dot` 셀렉터 **부재**, `grid-template-areas` 부재)
   - 개정: `rev15Tokens.test.ts`(REV-15 유지 항목만), `clusters.test.ts:147-148`(kind 단언 삭제, riddleKey 32/32 단언 추가), `quantumWhiteParity.test.ts` 통과, `__tests__/exit/appExit.test.ts` 불변 통과
4. **Playwright** `npx playwright test --config=tests/web-cinema.config.js` (chromium/webkit/mobile-chrome, `next start` :3123):
   - `rev17-entry-gate.spec.js`: 게이트 QA 노트 0건(§1); 내비 CTA `getComputedStyle().borderWidth === '1px'`, 데스크톱 높이 ≥ 36 / 모바일 ≥ 32, 라벨 폰트 ≥ 9px.
   - `rev17-clusters.spec.js`: 홈 4카드 `.qw-cluster-sigil svg` 존재·`.qw-cluster-dot` 0건·카드 텍스트에 `/\d|modules/i` 0건(en/ko/ja/tl); 제목 computed font-size ≥ 23px(줌 전); 카드 높이 195~215px 밴드.
   - `rev17-popout.spec.js`: 4클러스터 × (헤더에 `/\d/` 0건, 지시문 p 부재, 타일 수 16/5/8/3, 각 타일 `.qw-tile-kind`·`.qw-upay-chip` 0건, **헤드 그룹 중심 x = 타일 중심 x ± 2px**, 제목 x > 메달리온 우측 x(로고 우측), 수수께끼 비어있지 않음·숫자 0건, 큐 `bottom ≤ tile.bottom`); 모바일 412×915 열 수 **2**, 360×640 열 수 2, 1366 열 수 4; 모바일 타일 좌측 데드스페이스 = 메달리온.x − tile.x ≤ 28px(E-3 소멸).
   - `rev17-entry-checkout.spec.js`: 타일 클릭 → 패널 `data-view="entry"`·`max-width` 640; `.qw-entry-stage` aspect 16:9·`data-video-slot` 값 = 모듈 id; 고지 `li` 4개 + 링크; `.qw-entry-pay` `position: sticky`·뷰포트 내 `bottom ≤ innerHeight`; 버튼 텍스트 = `Enter`(en)/`입장하기`(ko), `data-state="idle"`; 뒤로 → 그리드 복귀 + 해시 `#core/<cluster>`.
   - `rev17-refresh-persistence.spec.js`(§3): (a) 팝업+모듈 열고 F5 → 팝업·모듈 뷰 복원, 커튼 무재생, `history.state` 키 집합 보존; (b) 닫기 → `history.back()`(센티널) → F5 → 팝업 **미복원**·해시 정리; (c) `addInitScript`로 `unitas_leave_at` 제거 + `page.goto(sameUrl)`(퍼지 시뮬) → 로고 페이지 없이 제자리; (d) standalone 몽키패치 + 새 컨텍스트(localStorage 원장 복사, sessionStorage 공백) + `/` 진입 → 30분 이내 제자리 / TTL 조작 후 로고 페이지; (e) `?splash=0` 부재 상태로 `about:blank` 왕복(이탈 스탬프 존재) → 로고 페이지(재진입 독트린 유지); (f) 딥링크 `#core/live/b2c:arche` 콜드 진입 → 퍼널 후 팝업 자동 개방(D-4).
   - 회귀: `exit/*`, `omni-exit`, `app-exit-collapse`, `founder-bypass`, `module-gate`, `rev15-*`(개정본) 전부 EXIT 0.
   - **토큰 취급(보안 리뷰 2026-09-09 반영)**: 신규 rev17 스펙 5종은 창립자 토큰을 **`process.env.SOVEREIGN_AUTH_TOKEN`에서만** 읽고 부재 시 즉시 실패한다(`docs/rev17/measure/measure17.js`가 이미 이 형태). `tests/web-cinema.config.js`의 `webServer.command`가 같은 값을 `next start`에 전달하도록 `env`를 넘긴다. URL 쿼리 전달은 서버 프로토콜(`middleware.ts:69-96`, 303 + `no-store`)이 요구하는 형태라 유지하되, 하네스 로그에 URL을 출력하지 않는다.
5. 성능: 입장 게이트 첫 열림 INP < 120ms(Playwright `PerformanceObserver` event timing), 팝업 열림 LCP 요소 = 헤더(스테이지 플레이스홀더는 페인트 ≤ 1 프레임).
6. 대비: §2.4 CTA 헤어라인 3.15:1, §4.2 시길 정지 상태 12.6:1, 고지 본문 `--qw-ink-3` 6.0:1, 큐 헤어라인은 장식(비텍스트 기준 면제).
7. `prefers-reduced-motion`: 시길 회전·CTA 호흡·스테이지 스윕·큐 확장 전부 정지 확인(기존 §11 블록에 3규칙 추가).
8. 실기기 QA(창립자, 배포 후): iPhone Safari(탭 10개 열어 퍼지 유도 후 복귀), Android Chrome(백그라운드 10분 후 복귀), 설치형 App 강제 종료 후 재기동(30분 이내/이후) — D-3 확정 근거 수집.

---

## 10. 편집 경계 요약 (PHASE 2 작업 지시서)

| 분류 | 파일 | 변경 성격 |
|---|---|---|
| 사전 게이트 | `index.html/{CLAUDE.md, THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md, .roo/rules/unitas-constitution.md, .continue/context/…}` | `sync-codex.mjs --write` (v17.0 마커 블록 동기화, 별도 커밋) |
| 컴포넌트(삭제) | `components/ComingSoonCinema.tsx:1218-1222` | QA 노트 블록 삭제 |
| 컴포넌트(클래스) | `components/nav/NavBar.tsx:59-71` | `border-none` 제거, 라벨 크기·굵기, 아이콘(선택) |
| CSS | `app/globals.css:399-420, 453-476` | 다크 CTA 테두리·최소 높이·keyframe 알파 |
| CSS | `app/quantum-white.css` | §2.4 CTA 블록 교체(165-177), §4.2 시길 규칙(§6 블록, 도트 삭제 489-494), §4.3 카드 타이포, §5.3 타일 규칙 교체(542-641)·모바일 블록 재작성(685-760), §6.8 입장 게이트 규칙 신설, 슬라이드/시트 규칙 삭제(677-680, 743-760, 882-884), 토큰 블록(84-93) 개정 |
| 라이브러리(신규) | `lib/entry/loadClass.ts`, `lib/entry/visitLedger.ts`, `lib/quantumWhite/surfaceState.ts`, `lib/quantumWhite/clusterSigils.tsx`, `scripts/gen-sigils.mjs` | §3.1, §3.2, §3.3, §4.2 |
| 라이브러리 | `lib/pwa/installPrompt.ts:152-154` | 부트스트랩 분류기·이탈 스탬프·원장 복원 ES5 |
| 라이브러리 | `lib/pwa/standaloneLaunch.ts:68` | `location.replace` 직전 hand-off 플래그 1행 |
| 라이브러리 | `lib/splash/splashTimeline.ts:105-108` | `shouldResetEntrySession` → 분류기 위임/삭제 |
| 라이브러리 | `lib/quantumWhite/clusters.ts:69, 74-83, 140-240` | `riddleKey`·`scenarioKey`(i18n), `enigmaKey`(cluster) |
| 라이브러리 | `lib/exit/appExit.ts:660` | 종료 시 원장 삭제 1행 |
| 컴포넌트 | `components/ComingSoonCinema.tsx:311-345` | 영속·세그먼트 효과에 원장 쓰기(가드 동일) |
| 컴포넌트(재구성) | `components/home/quantum/SingularityCoreGrid.tsx` | 도트·카운터 삭제, 시길, 제목 클래스, `useCurtainReleased` 복원, `commitSurface()` 단일 쓰기 |
| 컴포넌트(재구성) | `components/home/quantum/ClusterPopout.tsx` | 헤더 enigma, 지시문 삭제, `initialModuleId`/`onModuleChange`, `data-view`, 타일 DOM(§5.2), 슬라이드 열 → `EntryGate` |
| 컴포넌트(신규/대체) | `components/home/quantum/EntryGate.tsx` (← `ModulePopupSpace.tsx` 이식 후 삭제) | §6 |
| 컴포넌트(라벨) | `components/upay/UPayGateway.tsx:182-232` | 키 개명 3 + 라벨 (`data-state` 불변) |
| i18n | `messages/*.json` ×20 | §7.4 인벤토리 (en/ko 정본 각인 → 워크북 → 18로케일) |
| 테스트 | `__tests__/entry/*`, `__tests__/quantumWhite/{surfaceState,clusterSigils,rev17Copy,rev17Tokens}.test.ts`, 개정 `rev15Tokens`·`clusters`·`quantumWhiteParity` | §9-3 |
| E2E | `tests/web-cinema-e2e/rev17-{entry-gate,clusters,popout,entry-checkout,refresh-persistence}.spec.js`, 개정 `rev15-cluster-popout.spec.js` | §9-4 (스크래치 `measure17.js` 승격) |

**금지 사항**: `pushState` 신규 호출; `history.replaceState`에 `__NA`를 포함한 상태 전달(§3.3); `html/body/.dashboard-zoom` 필터·변환(REV-15 §1.1 승계); 스크롤 잠금; `lib/ecosystems.ts`·`lib/modules.ts`·`lib/upay/universal.ts`·DB 마이그레이션·`middleware.ts` 수정; `UPayGateway` 상태기계·RPC·`ARM_MS` 변경; `ModalPortal` 대상 변경; `.z-[400]`·`.z-[140]`·`.qw-cluster-card`·`.qw-popout-panel`·`.qw-tile`·`.event-horizon-btn` 훅 제거; `coinUnit` 키 삭제(지갑 4곳 공유); 아라비아 숫자·수 단어가 든 카피; 오디오 자동재생이 있는 영상; `?dev=true` 재도입; 신규 웹폰트; 재진입 독트린의 "타이핑 URL·외부 링크·새 탭 = 로고 페이지" 규칙 변경(D-1/D-3 범위 밖).

**범위 밖 관찰(별도 티켓 권고)**: (0) **기본 창립자 토큰 리터럴 `SOVEREIGN_AUTH_TOKEN_DEFAULT`(`web/lib/sovereignAuth.ts:33`)가 E2E 스펙 6종(`cinema-flow`, `founder-bypass`, `module-gate`, `rev15-*` 3종)과 단위 테스트 2종에 그대로 복제**되어 있음. Vercel 프로덕션에 별도 `SOVEREIGN_AUTH_TOKEN`이 설정되어 있는지 확인하고(미설정이면 소스 기본값이 곧 실제 우회 토큰 → 즉시 회전), 기존 스펙도 §9-4의 env 방식으로 이관 권고. (1) 창립자 `SovereignDebugPanel`(`z-[450]`, `left-4 top-24`)이 모바일에서 팝업 헤더·본문 좌상단을 덮음(Pixel 7 스크린샷 — 지시문 첫 글자 가림). 768px 미만 기본 접힘 또는 팝업 열림 시 자동 축소 권고. (2) 홈 F5 후 스크롤 위치 미복원(scrollY 0) — 팝업 없이 하단 열람 중이던 방문자 대상, `history.scrollRestoration` 점검. (3) `AudioGate`는 REV-15 §2.5대로 은폐 컴포넌트 — 본 REV 무관.

---

## 11. 실측 원본 요약 (재현 기준값, `b2ec5d7` 빌드 `uaPl5SSjzFDUksQHWPG86`)

### 11.1 내비 CTA
| 뷰포트 | rect | border | box-shadow(애니메이션 순간값) | 폰트 |
|---|---|---|---|---|
| 1366×768 | 57,21.4 · 146.6×20.3 | 0px none | gold .34 0 0 25.7px, inset gold .12 | 15 / 11px |
| 412×915 | 51,20.1 · 60×22.9 | 0px none | gold .20 0 0 15.8px | 10 / 8px |

### 11.2 클러스터 카드 (1366×768, 4카드 동일 밴드)
카드 219.8×209.1 · 궤도 63×63 · 제목 19.2px 700 y 464.6 · 태그라인 13.1px 44.3h · 카운터 10.9px `#b8962e` y 542.5 · 도트 16/5/8/3.

### 11.3 팝업 타일 (코그니티브, 첫 타일)
| 뷰포트 | 타일 | 메달리온 | 배지 | 제목 | 설명 | 칩 | 셰브런 | 그리드 열 |
|---|---|---|---|---|---|---|---|---|
| 1366×768 | 263,207.9 · 198.5×212.6 | 280,224.9 · 36 | 378.8 (우측) | 280,268.9 · 164.5×36.8 | 313.7 · 54.3h | 280,375.9 · 78×27.5 | 430.5 (우측 끝) | `198.5px ×4` |
| 412×915 | 28,166.3 · 352×194.1 | **97**,183.3 · 40 | 145 | **97**,227.3 · 266×19 | 250.3 · 55.6h | 97,315.9 | 349 | `352px` ×1 |
→ 모바일 메달리온 x 97 = 타일 x 28 + 패딩 16 + **빈 1열 40 + 간격 12** + 1 (E-3).

### 11.4 모듈 패널·U-Pay
| 뷰포트 | 슬라이드/시트 | 게이트웨이 | 버튼 | 칩 텍스트 |
|---|---|---|---|---|
| 1366×768 | 723,207.9 · 380×474.5 | 723,398.5 · 380×147.9 | "Invest now" 724.5,473.6 · 377×44 `idle` | "Access 1 U-COIN", "Your balance —" |
| 412×915 | 0,536.4 · 412×378.6 (그리드 `display:none`) | 20,747.1 · 372×147.9 | 21.5,822.2 · 369×44 | 동일 |

### 11.5 새로고침·히스토리
- F5(양 뷰포트): `navType reload`, `phase released` 유지, 커튼 없음, **popout false / modulePanel false**, scrollY 0(데스크톱) / 331(모바일).
- `history.length 14`, top state `{__NA, tree("/?splash=0","refresh"), unitasExitGuard:true, unitasExitDepth:12}`.
- `about:blank` → back: `navType back_forward`, `wasDiscarded false`, `data-splash off`(QA 플래그로 상태 보존; 플래그 없으면 `installPrompt.ts:153`에서 소거).
- 코덱스 동기화: `node scripts/sync-codex.mjs` → 4파일 drift fail-closed (`eaf5a661…` ≠ canon).

### 11.6 재현 절차
1. `cd index.html && npm --prefix web run build`(현재는 step 0 미이행 시 prebuild 실패 — 의도된 게이트) `&& (npm --prefix web run start -- -p 3123 &)`
2. 창립자 경로 `http://127.0.0.1:3123/en?sovereign_auth=<token>&splash=0` → 게이트에서 "FOUNDER · FULL SEQUENTIAL QA" 확인 → 스킵 → 도어 → 홈.
3. 코그니티브 카드 클릭 → 첫 타일 클릭 → F5 → 팝업 소실 확인. DevTools에서 `JSON.stringify(history.state)`.
4. Pixel 7 에뮬로 2~3 반복 → 첫 타일 `.qw-tile-medallion` x 판독(97).
5. 측정 후 `:3123` 프로세스 종료.
