# REV-31 최종 완결 종합 보고서 — U-AI 팝업 옴니-오픈 대공사

창립자 지령일 2026-09-15 · 설계 정본 `docs/rev31/SPEC.md` · 대상 `index.html/web`

---

## 1. 3대 미션 결과

| 미션 | 지령 | 결과 |
|---|---|---|
| **M1** | "더 깊이 탐색" 구역 영구 삭제 (타이틀·UI 박스·하위 기능·렌더링 로직 100%) | **완료** — 소스 13파일 + 테스트 6파일 삭제, i18n 148키 소거, CSS 346줄 소거, 출하 DOM·문자열 잔재 **0건** |
| **M2** | "출처" → "다른출처에서열기", 타이틀 100% 픽셀 동기화, "다른플랫폼에서열기" 직상단 강제, 무조건 쌍 렌더링 | **완료** — 브라우저 실측 8속성 전부 일치, `nextElementSibling` 인접 확정 |
| **M3** | "다른곳에서열기" 폐기 → "다른플랫폼에서열기" 신규 창조 | **완료** — 20 로케일 전부 앞뒤 구조 동일 라임으로 재창조 |

---

## 2. 무결성 게이트 실측 (제25장 Fail-Closed)

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 | `npx tsc --noEmit` | **EXIT 0** |
| 단위 | `npx vitest run` | **1465 / 1465 pass · 90 / 90 파일 · 실패 0** |
| 빌드 | `npm run build` (prebuild 3단 + postbuild 포함) | **EXIT 0** · fingerprint `eb09b6b8bab1d401` |
| E2E (3엔진) | `npx playwright test --config=tests/web-cinema.config.js` | **549 pass · 33 skip · 0 fail** (1.3h, chromium + webkit + mobile-chrome) |
| E2E (타깃 4스펙) | 동일 하네스 `--project=chromium` | **33 pass · 3 skip · 0 fail** |

단위 테스트 수는 REV-30의 1536에서 1465로 내려갔다. 렌즈 기계와 함께 그 전용 스위트 6개(79 케이스)를 삭제하고, 신규 계약 스위트 `omniOpen.test.ts` 8 케이스를 각인한 결과다. **삭제로 줄어든 것이지 실패로 줄어든 것이 아니다.**

### 2.1 M2 픽셀 동기화 — 브라우저 실측 원본

`tests/web-cinema-e2e/rev29-verify.spec.js` "M2.4 / REV-31"이 릴리스 홈에서 직접 측정한 값 (chromium·mobile-chrome 양쪽 동일):

```
sourcesFirst : true          (출처 행이 DOM에서 먼저)
adjacent     : true          (출처 행이 플랫폼 행의 직전 형제)
fontSize     : 12px    / 12px
color        : rgb(138,109,20) / rgb(138,109,20)
fontWeight   : 700     / 700
textTransform: uppercase / uppercase
letterSpacing: 1.2px   / 1.2px
fontFamily   : __JetBrains_Mono_4330c6 … / (동일)
columnGap    : 6px     / 6px
height       : 13      / 13
```

8속성 전부 일치. 이것은 "맞춰 놓은 값"이 아니라 **두 타이틀이 단일 상수 `ROW_TITLE_CLASS`에서 파생되므로 드리프트가 구조적으로 불가능한 값**이다.

---

## 3. 소거 실측 (M1)

전체 변경: **141 파일 · +2,067 / −14,656 줄** (삭제 19 · 신규 3)

| 대상 | 수량 |
|---|---|
| 컴포넌트 (`ExploreDeeper`, `DeeperThemePage`, `OmniTechSwarm`) | 3 |
| 렌즈 엔진 (`deeperThemes`, `useDeeperPage`, `swarmLayout`) | 3 |
| 앵커 브릿지 (`anchorBridge`, `useAnchorBridge`) | 2 |
| 어댑터 (`deeperAdapters/*`) | 5 |
| 단위 테스트 스위트 | 5 |
| E2E 스펙 (`rev25-anchor-bridge`) | 1 |
| i18n 키 (`Rev21.deeper.*` 143 + `Rev19.discovery.*` 5) | 148 × 20 로케일 |
| CSS (globals 310줄 + quantum-white 36줄) | 346줄 |

### 3.1 출하되는 것에서의 잔재 — 실측 0건

| 표면 | 검증 | 결과 |
|---|---|---|
| i18n 20 로케일 | `grep "더 깊이 탐색\|Explore Deeper" messages/*.json` | **0** |
| DOM 속성 | `data-explore-deeper` / `data-deeper-theme` / `data-omni-swarm` | **0** (E2E가 매 실행 단언) |
| CSS 클래스 | `qw-deeper*` / `qw-swarm*` | **0** |
| 스트림 카드 kind | `'deeper'` → `'omni'` | 전량 이전 |
| 외부 송출 UA | `UNITAS-ExploreDeeper/1.0` → `UNITAS-OmniOpen/1.0` | 이전 |
| 개인정보 페이지 원장 | `unitas.deeper.v1` (기록하는 코드가 사라진 키) | 폐기 |
| 헬프센터 안내문 | 삭제된 렌즈를 설명하던 문단 | 20 로케일 재작성 |

남은 것은 **삭제 이력을 의도적으로 기록한 주석 4곳**뿐이다.

---

## 4. 설계상 자율 해결한 결함 (제6장 셀프 힐링)

지령을 문자 그대로 구현하면 발생했을 결함을, 창립자 승인 대기 없이 설계 단계에서 차단했다.

1. **빈 출처 행 (구조적 5곳)** — M2의 "무조건 쌍 렌더링"을 기존 QID 게이트 위에 얹으면, 운영자 프로필·쇼츠·뉴스 스토리·유니타스 랭킹·`nearby` 슬롯에서 **타이틀만 있고 링크가 0개인 행**이 100% 발생한다. 출처 행을 용어 기반 키리스 검색 URL로 재정의해 원천 차단했다. 식별자는 이제 *정밀도*를 사는 것이지 *존재*를 사는 것이 아니다.
2. **i18n 드리프트 게이트 탈락 (fr 5/3)** — 네임스페이스가 213→70 리프로 줄면 허용치가 10→3으로 조여져 프랑스어가 탈락한다. 원인은 오역이 아니라 정당한 동형어(`modules`·`Relations`·`Nexus`·`UNITAS`·`Suggestions`)의 허용목록 누락이었다. 오역을 만들어 통과시키는 대신 허용목록을 근거와 함께 정정했다.
3. **드래프트 화석 56키 부활** — `apply-rev21`은 네임스페이스를 통째 치환한다. 드래프트에는 후속 리비전이 이미 폐기한 56키(구 스트림 kind 16종, `cogs.*` 등)가 화석으로 남아 있어, 그대로 적용하면 폐기 키가 되살아난다. HEAD와 대조해 정확히 제거했고, 최종 diff는 `stream.kinds.omni` 추가 1건 · `deeper.*` 143 + `stream.kinds.deeper` 1 삭제로 수렴했다.
4. **`deeperFetch.ts` 오삭제 위험** — 이름과 달리 전역 위키미디어 레이트리밋 큐이며 `awardsThemes`·`dataLadder`·`dataLadder2`가 의존한다. 감사가 지목해 보존했다.
5. **`deeperAdapters/open.ts` 타입 누수** — `app/api/live/entity-news/route.ts`가 type-import 중이었고, 해당 파일은 인코딩 탓에 일반 `grep`이 "Binary file"로 보고해 누락되기 쉬웠다. 타입을 `lib/live/entityNews.ts`로 이전하고 라우트를 재지정했다(인코딩 보존).

---

## 5. 창립자 판단이 필요한 잔여 사항

1. **옴니-테크 스웜 소멸** — REV-24 M4로 신설되고 REV-25 M1이 도달성을 복구했던 스웜은, 유일한 진입로인 `bigTechPulse` 렌즈 타일과 함께 소멸했다. 감사 실측 결과 라우트·API·동적 import 어디에도 다른 진입로가 없었다. M1 지령의 직접적 귀결이며, 재도입을 원하실 경우 **독립 진입로(전용 모듈 또는 라우트)** 신설이 필요하다.
2. **`nearby` 슬롯 QID 폴백 누락** — `DiscoveryCarousel:674`의 `placeAnchor(...)`는 날씨 슬롯과 달리 QID 폴백 인자가 없다. REV-31의 용어 기반 URL이 증상(빈 행)은 원천 차단했으나, 정확 문서 링크는 여전히 얻지 못한다. 인자 1개로 해결되나 본 지령 범위 밖이라 보류했다.
3. **레거시 모듈 파일명** — `deeperAnchor.ts`(앵커 원시형, 14곳 의존)·`deeperFetch.ts`(위키미디어 큐, 5곳 의존)는 이름만 레거시이고 기능은 "더 깊이 탐색"과 무관한 공용 기반이다. 출하되는 DOM·문자열·i18n에는 잔재가 0건이므로 개명은 별도 구간으로 분리했다.
