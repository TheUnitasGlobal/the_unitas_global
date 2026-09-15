# REV-29 최종 완결 종합 보고서

**창립자 지령 2026-09-15 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0 제25장**
설계 정본: `index.html/docs/rev29/SPEC.md`

이 보고서는 **측정된 것만** 적는다. 측정하지 않은 상태를 완료로 적지 않는다(제25장).

---

## §1. 4대 게이트 실측

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 | `npm --prefix web run typecheck` | **EXIT 0** |
| 유닛 | `cd web && npx vitest run` | **1501 / 1501 passed · 92 files** (REV-28 1360/87 → **+141 / +5**) |
| 빌드 | `npm --prefix web run build` | **EXIT 0** · postbuild 지문 `eb09b6b8bab1d401…` |
| E2E | `npx playwright test --config=tests/web-cinema.config.js …` | §7 |

---

## §2. MISSION 1 — 입력 폼 물리적 제어

| 지령 | 구현 | 실측 |
|---|---|---|
| 키보드는 텍스트 박스 터치에만 | 터치 `pointerdown` 캡처 → 비텍스트 타깃이면 `input.blur()` + 팝업 유지(`suppressBlurRef`) · 인풋 비활성 시 외부 탭 닫기(포털/다이얼로그 제외) · 타워 닫기 시 coarse 포인터는 재포커스 안 함 | mobile-chrome: 인풋 탭 → `activeElement===input` **true** → 뉴스 칩 탭 → **false**(키보드 내려감) + `[data-news-scope]` **visible 유지** → 인풋 재탭 → **true** |
| 포커스 링 미세 완화 | 화이트 `0 0 0 6px/.14 + 36px/.45 + 56px/.55` → **`4px/.10 + 26px/.30 + 48px/.42`**, 다크 `70px/.28` → `56px/.22` | chromium: 포커스 `box-shadow`에 `0px 0px 0px 4px` **포함**, `6px` **불포함** |
| 돋보기·플레이스홀더 +20% | 돋보기 16/20 → **19.2/24px**, 폰트 `clamp(10,1px+2.8125vw,19)` → **`clamp(12,1.2px+3.375vw,22.8)`** | chromium 1280: 돋보기 24×0.75 zoom = **18px 실측 오차 <0.6**, 폰트 **22.8px**; Pixel 7 412px: 폰트 **15.1px**(=1.2+3.375×4.12) |

데스크톱 마우스 경로는 무변경 — `rev19-search-back`(⏎/첨부 토글 동일 박스·휴지 중립·타이핑 시 활성) **통과**.

---

## §3. MISSION 2 — 실시간 뉴스 대공사

### 3.1 롤링 동기화 (실측)

`[data-news-axes]` 활성 칩의 `.qw-hub-progress` vs 숏컷 레일 활성 칩의 `.qw-hub-progress`:

```
animationName  qw-hub-progress-fill == qw-hub-progress-fill
animationDur   7s                   == 7s
height         3px(zoom)            == 3px(zoom)
data-rotating  1
```

칩 22개 텍스트에 **숫자 0건**(배지 삭제), `[·・]` **0건**(결합 라벨 소멸), 전부 `.qw-hub-chip`.

### 3.2 22축

`welfare / health / security / conflict` 각 1칩. 분류기 8케이스 유닛 통과(영·한 각 4). 20로케일
라벨은 로케일 자기 구분자에서 분할 보존(예: `Wohlfahrt`/`Gesundheit`, `福祉`/`保健`, `An ninh`/`Xung đột`).

### 3.3 팝업 단일화

`[data-news-rail]` **0**, `[data-news-deeper-toggle]` **0**. 카드 타이틀 1클릭 = 선택(`data-selected=1`,
다이얼로그 0), 2클릭 = `[data-news-modal]` 열림 → 행 좌표 `left` **단일값**(세로 정렬) →
`[data-news-more]` 1 → 행 클릭 → `[data-news-story]` + `[data-news-open-original]` **visible**.

### 3.4 다이렉트 전용

`[data-news-block] [data-explore-deeper][data-deeper-direct]`: `[data-deeper-theme]` **0**,
`googleSearch/bingSearch/wikipedia` 링크 **visible**, 두 `.qw-deeper-label`의 `font-size · color ·
font-weight · text-transform · letter-spacing` **전부 동일**. 타워·피드·랭킹 호스트의 렌즈 타일은
무변경(`rev24-verify` 스웜 5건·`rev25-anchor-bridge` 계약 유지).

### 3.5 측정이 설계를 고친 지점

1. Bash heredoc이 정규식 `\b` 9개를 0x08로 깨뜨림 → 유닛이 즉시 검출("Pension reform"→institution) → 스크립트 파일로 재패치, 0x08 **0건**.
2. 한국어 `공격`이 conflict에서 "사이버 공격"을 가로챔 → conflict 한국어 어간에서 제거.
3. 테스트 문장 `휴전 붕괴`는 disaster(`붕괴`)가 먼저 잡는 것이 **설계**대로 → 문장 교체.

---

## §4. MISSION 3 — 글로벌 신상품

| 항목 | 실측 |
|---|---|
| 배치 | 숏컷 레일 **2번째**(`[data-slot]` nth(1) = `newProducts`), 총 **17칩** |
| 소스 | en.wikipedia `categorymembers`(timestamp desc) + `extracts|pageimages|langlinks`, 0원·무키 |
| 유닛 | `newProducts.test.ts` 12건: URL 계약(`cmsort=timestamp`, `lllang` en 제외), 폴드(리스트 문서 제외·중복 제거·langlink → 로케일판 URL·썸네일), 일 회전 래핑 |
| 레지스트리 | `discoverySlots` 17/피드 14, `SLOT_QID.newProducts=Q2424752`, `SLOT_SOURCES=['wikipedia']`, `rotationBudget` TTL 17 |
| UI | 카드 4행 + 썸네일/한 줄 소개, 딥 모달 **5패밀리 탭** + 12행(`FeedDeepModal` 탭 인프라 신설) |

---

## §5. MISSION 4 — UNITAS 마스터 허브

| 항목 | 실측 (chromium + mobile-chrome) |
|---|---|
| 타일 | `[data-unitas-hub-toggle]` = ⏎ 키와 폭/높이 차 **≤1px**, 첨부 토글의 **오른쪽**, 롤 아이콘 **6**(5+랩) |
| 팝업 | 클릭 → `[role=dialog] [data-unitas-hub]` visible, 다이얼로그 중심 − 뷰포트 중심 **<2px**, 토글 `data-active=1`, 탭 **5** |
| 5표면 | `[data-hub-exchange]`·`[data-hub-packs] [data-pack]`, `[data-unitas-shorts] [data-short]`, `[data-hub-rankings]`, `[data-hub-rooms] [data-room]` **22**, `[data-hub-social] [data-social-app]` — 모두 visible, Esc 닫힘 후 `data-active=0` |
| 거래소 | 팩 구매 → 해당 팩 `data-verdict` `ok → owned`, 크레딧 숫자 변화, `[data-hub-trade]` 티커 행 생성 |
| 대화방 | 입력 → 전송 → `[data-hub-msg][data-mine=1]` **1** |
| 유닛 | `knowledgeExchange.test.ts` 14건(카탈로그 24·시드 통계·정렬·70/30·구매/부족/보유·등록 검증·심사→판매·예상 수익·트레이드 페이로드), `themeChat.test.ts` 12건(22방·정화·id·페이로드 가드·병합 60·플러드·신원), `shortsSeed.test.ts` 6건 |

스키마 변경 **0**(broadcast+presence 전용). `ShortsOrphanCleanup` 삭제, 숏츠 로컬 키 v2.

---

## §6. MISSION 5 — 워드마크 · 3-단축키

| 항목 | 실측 |
|---|---|
| 플레이트 파괴 | `h1::before content` **none**, `.qw-title-word` background-clip **text, text**(2층), fill `rgba(0,0,0,0)`, `linear-gradient` 포함; 히어로 대칭 `rev19-hero-geometry`·`rev23` |A−B|<1.5 **통과** |
| 아이콘 동기화 | 메뉴 3아이콘 박스 크기 집합 **1개**(20×20 zoom), Video `scale(1.22)` |
| 1줄 강제 | 라벨 `white-space` **nowrap**, 줄 수 **1**, 폰트 ≥ 13×0.74px(축소 없음) |
| 모바일 롤링 | 트랙 `display` **flex**(그리드 스택 소멸), 롤 창 정사각형(폭=높이) — chromium·mobile-chrome 동일 |
| 활성 상태 | 스케치 선택 → 토글 `data-active=1`·`data-attach-active=sketch`, 트랙 `data-stop=1`·`animation none`·`matrix(1,0,0,1,0,-40)`, 채움 **rgb(11,92,255)/#fff**(⏎ 활성과 동일) → 무첨부 닫기 → `data-active=0`·`data-stop=0` |

---

## §7. E2E 실측 (빌드된 앱, `next start :3123`)

| 프로젝트 | 스펙 | 결과 |
|---|---|---|
| chromium | rev29-verify · rev23-verify · rev21-hub-card · rev24-verify | **44 pass · 0 fail · 1 skip**(터치 전용) |
| chromium | rev19-search-back · rev19-hero-geometry | **pass**(1차 실행에서 통과, 이후 무변경) |
| mobile-chrome | rev29-verify · rev23-verify | **24 pass · 0 fail**(M1 폰트 기대식 교정 후 재실측) |
| webkit | rev29-verify · rev23-verify | §7.1 |

### 7.1 WebKit

`rev29-verify` + `rev23-verify` on WebKit(Desktop Safari 에뮬, REV-28 시계): **22 pass · 0 fail · 2 skip**
(4.8분). 스킵 2건은 설계상 스킵 — M1 픽셀 측정은 chromium/mobile-chrome 전용(WebKit
헤드리스 555ms+/프레임), 터치 키보드 계약은 모바일 전용. 뉴스 롤링·팝업·다이렉트 블록·
신상품·허브 5표면·거래소 구매·대화방 전송·플레이트 소멸·첨부 1줄·활성 상태 **전부 통과**.

### 7.2 계약 갱신

`rev23-verify` "글래스 플레이트 존재"는 창립자 지령(M5.1)으로 **반전**. 그 외 REV-19/21/24
계약은 무변경 통과.

---

## §8. i18n

`scripts/apply-rev29-i18n.mjs` — 20로케일 × **127키** 기록(`--check` 재실행 **clean**).
`rev29Copy.test.ts` 20로케일 × 5단언(Rev29 키 집합 = en, HotNews 22라벨, 결합 라벨 0,
플레이스홀더 0, ICU 인자 보존) **전부 통과**. 숏츠 36키는 git `359c4c3^`의 REV-19 원어
번역을 그대로 복원.

---

## §9. 배포

DEPLOY_PLACEHOLDER

---

## §10. 후속 과제 (측정되지 않은 것)

1. 지식 거래소·대화방 **서버 원장**(테이블·RPC·RLS·정산 잡)은 스키마 변경이라 이번 구간 밖 — 현재는 기기 원장 + 실시간 브로드캐스트.
2. **실기기 가상 키보드**(iOS Safari) 관측은 헤드리스 모바일 크로미움의 `activeElement` 전이로만 증명 — 실기기 확인은 창립자 손(REV-28과 동일 유예).
3. 위키백과 출시 카테고리의 문서화 지연으로 연초에는 전년도 병합이 대부분을 채움.
4. WebKit 실기기(맥 Safari GPU) 렌더 판정은 REV-26/28 유예 그대로.
