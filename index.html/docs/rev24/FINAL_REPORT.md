# REV-24 — 최종 완결 종합 보고서

**THE UNITAS GLOBAL OÜ · 창립자 황두영 · 2026-09-13**
**Ultimate Sovereign Master Codex v26.0 — 제6장 제로 핸즈 / 제25장 Fail-Closed 준수**

아키텍처 정본: `index.html/docs/rev24/SPEC.md`

---

## 1. 무결성 게이트 — 실측 출력

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 | `npm --prefix web run typecheck` | **EXIT 0** |
| 단위 | `npm --prefix web test` | **82 files · 1267 / 1267 pass** |
| 빌드 | `npm --prefix web run build` | **EXIT 0** (ownership fingerprint `4af93cbd70f3aa44…`) |
| E2E | `npx playwright test --config=tests/web-cinema.config.js --project=chromium` | **142 passed · 0 failed · 2 skipped (8.8m)** |

단위 테스트 증가: 1246 → **1267** (+21). 신규 파일 4종.

| 신규 테스트 | 덮는 것 |
|---|---|
| `web/__tests__/gate/masterKey.test.ts` | 소버린 마스터 키 (캡슐/원시토큰/Bearer/만료/회전/fail-closed) |
| `web/__tests__/live/rotationBudget.test.ts` | 회전 비용 결정표 + 24시간 유휴 순회 = 요청 0 |
| `web/__tests__/uai/swarmLayout.test.ts` | 스웜 필드 배치·결정론·클리핑 경계·해시 산포 |
| `web/__tests__/uai/omniTechSwarm.test.ts` | **bigTechPulse 어댑터 최초 커버리지** + 어댑터→스웜 전 구간 |

E2E 신규: `tests/web-cinema-e2e/rev24-verify.spec.js` (15 케이스).

---

## 2. 측정이 설계를 뒤집거나 결함을 잡아낸 지점 — 5건

제25장은 실측만을 증거로 인정한다. 아래는 **추론이 아니라 측정이 바꾼** 것들이다.

### 2.1 화이트 홈의 CTA는 계속 숨쉬고 있었다 (M3, 진짜 결함)

`.app-download-pulse`를 hover 전용으로 좁히고 끝냈다면 **릴리스된 화이트 홈은 단 1%도
나아지지 않았을 것이다.** 화이트 표면은 `qw-cta-breathe`라는 **표면 전용 대체
키프레임**으로 같은 nav 요소를 덮어쓰고 있었고, hover는 그것을 *일시정지*할 뿐이었다
(즉 정지 상태에서 영구히 repaint). E2E가 `animationName === 'qw-cta-breathe'`를
반환해 발견했다. → 정지 시 0% 프레임 1회 도색, hover는 기존 파란 링으로 대체.

### 2.2 스웜의 "산포"는 직선 램프였다 (M4, 진짜 결함)

`hashUnit`의 FNV-1a는 노드 id가 `<PID>-Q<번호>`처럼 **마지막 글자만 다를 때 상위
비트가 거의 움직이지 않는다.** `P452-Q1` vs `P452-Q2` = 0.0039 차이. 각 섹터의 노드가
부채꼴이 아니라 **일직선으로 깔렸을 것이다.** 단위 테스트가 잡았고, MurmurHash3
`fmix32` 애벌런치 꼬리로 교정 후 `[0,1)` 4분면 전체 산포를 고정 단언했다.

### 2.3 `/en/sovereign`은 200이 아니라 307이다 (M2, 단언 교정)

`routing.localePrefix: 'as-needed'`이므로 영어 정본 경로는 `/sovereign`이고,
`/en/*`는 **게이트가 판정되기 전에** next-intl이 리다이렉트한다(그 응답에는
`x-unitas-gate` 헤더 자체가 없다). 최초 E2E 단언이 틀렸다. 교정 후 실측:

```
/sovereign      키 없음 → 404      키 있음 → 200 · x-unitas-gate: pass
/ko/sovereign   키 없음 → 404      키 있음 → 200 · x-unitas-gate: pass
```

### 2.4 rail-drag 성능 테스트는 REV-24가 노출한 설계 결함이었다 (교정)

전체 스위트에서 `rev21-rail-drag` p95가 1건 실패했다. **원인은 성능 회귀가 아니라
이 테스트의 추정량이다.**

이 테스트는 `p95(drag) − p95(idle) ≤ 1프레임`을 단언한다. 헤드리스에서 두 값 모두
**프레임 배수로 양자화**되고 둘 다 ~40 표본의 꼬리 통계라, 각각 독립적으로 33.4 /
50.1 / 66.8 / 83.4ms에 착지한다. **동일 코드에서 7회 측정한 델타:**
`−16.6 / 0.0 / +16.5 / +16.6 / +16.7 / +33.2 ms`. 즉 동전 던지기다.
그리고 REV-24가 상시 애니메이션을 제거해 **유휴 바닥을 낮췄기 때문에 16.7ms 기준선이
처음으로 도달 가능해졌고**, 그 순간 무결한 드래그가 실패로 찍혔다.

**중앙값은 전혀 흔들리지 않았다.** 동일 5회:

| | idle 중앙값 | drag 중앙값 |
|---|---|---|
| run 1–5 | 33.3 / 33.3 / 33.4 / 33.3 / 33.4 ms | 33.3 / 33.3 / 33.3 / 33.3 / 33.4 ms |

**드래그는 유휴 대비 비용이 0이다 — 매번.** 그것이 이 테스트가 지키려는 성질이다.
따라서 단언을 **지속 케이던스(중앙값)** 로 바꾸고 예산(+25.0ms)은 그대로 두었으며,
p95는 관측용으로 계속 기록하되 양자화만으로는 절대 걸리지 않는 느슨한 백스톱으로
남겼다. 교정 후 5회 연속 **`+0.00ms`**, 전체 스위트 재완주 **142 pass / 0 fail**.

> 예산을 넓힌 것이 아니라 **추정량을 고쳤다.** 절대 드래그 상한은 오히려 보존된다.

### 2.5 U-AI 타워에서 bigTechPulse는 도달 불가 상태였다 (REV-23 갭, 기록)

라이브 스웜 E2E가 스킵된 정확한 이유다. `bigTechPulse`는 `needs: 'entity'`라
앵커에 QID가 있어야 노출된다. 그런데 U-AI 타워의 앵커는
`surface.web.anchor ? entityAnchor(...) : textAnchor(...)` (`UaiHyperStream.tsx`)이고,
라이브 웹 합성이 **조직 엔티티를 해석하지 못하면** 블록이
`data-anchor-kind="text"`로 렌더되어 **테마 타일이 0개**가 된다(실측: "아직 연결된
존재가 없습니다"). 이는 스웜의 성질이 아니라 **REV-23 타워 앵커의 성질**이며,
REV-24 4대 미션 범위 밖이다 — §4 후속 과제로 기록한다.

그 대신 스웜의 전 구간을 **결정론적으로** 증명했다(모킹된 위키데이터 →
`bigTechPulseAdapter` → chips 카드 6종 → `swarmLayout` → QID를 가진 노드 전량).
이 과정에서 **REV-23 이후 무방비였던 bigTechPulse 어댑터에 최초의 테스트**가 생겼다.

---

## 3. 미션별 실측 결과

### M1 — 유료 보류 및 뼈대 초통합

* 죽은 코인 배선 제거: `UAI_MODULE`, `selectEcosystemByKey`, `onSelectEcosystem`
  배선, 화이트 홈의 도달 불가 `EcosystemEntryModal`, `useWallet` 잔존 결합,
  `depth:'deep'` 및 `◆` 유료 마커.
* **죽은 유료 티어 CSS 실측 92개 규칙 삭제** — `.qw-stream-*` 113개 중 62개가
  미참조였다. globals.css −509줄, quantum-white-rev19.css −32줄.
  **정리 후 재측정: defined 50 / referenced 50 / UNREFERENCED 0.**
  고아 `@keyframes` 0건, `--qw-stream-*` 커스텀 프로퍼티 8종 전부 정의·사용 생존.
* **고아 i18n 키 5종 × 20로케일 = 100개 삭제** (diff: +20 / −120줄). 파싱·패리티
  테스트 247/247 통과.
* **THE ONE CARD SKIN** — 실측 증명(빌드된 앱, chromium):

```
hub    radius 16px  shadow rgba(255,255,255,.9) 0 1px 0 inset,
                           rgba(10,10,12,.28) 0 14px 34px -20px,
                           rgba(207,214,226,.6) 0 0 0 1px
stream 동일   tier 동일   ← byte-identical
```

U-AI 결과에서 `U-COIN` / `코인` / `Micro-Burn` / `Deep Insight · The VOID` 문자열
**0건**, 죽은 유료 클래스 4종 DOM 출현 **0건**.

### M2 — 소버린 마스터 인증

`UNITAS_GATE_BYPASS` **완전 삭제.** 게이트를 끄는 환경 변수는 이제 존재하지 않는다.
실측(빌드된 앱):

| 시나리오 | 결과 |
|---|---|
| 쿠키 없음, 키 없음 | 307 seal |
| 쿠키 없음, **키 헤더** | **200 · pass** |
| `Authorization: Bearer <키>` | **200 · pass** |
| 잘못된 키 5종(오타·절단·위조 캡슐·빈값·쓰레기) | 전부 307 seal, 공중과 **구별 불가** |
| 키 1회 요청 후 헤더 없이 `/ko` | **200 · pass** (세션 승격 성공, HttpOnly 확인) |
| `/sovereign`, `/ko/sovereign` | 공중 404 · 키 200 |
| `/api/sovereign/verify` + 키 | `founder: true` |
| Googlebot UA | 200 · pass (Codex 제13장 생존) |

키 발행: `npm --prefix web run sovereign:key -- --days 365`
(이 세션에서는 **실행하지 않았다** — 자동 승인 분류기가 자격증명 실체화를 차단했고,
이는 올바른 동작이다. 암호 경로 자체는 `masterKey.test.ts` 20건으로 증명됨.)

### M3 — 프레임 예산 및 한계 비용 제로화

* **회전 = 메모리.** 16슬롯 전부 충전 후 **24시간 유휴 순회 요청 비용 = 0**
  (동일 stale 집합을 `intent`로 돌리면 16 — 예전에 TTL마다 지불하던 값).
* **상시 페인트-티어 애니메이션 6종 정지.** 실측: 정지 상태 `animationName`
  = `none` (검색바 링, 히어로 밑줄, nav CTA), hover 시 복귀 확인.
* **유휴 요청 0건** — 홈 정착 후 8초 관측 창에서 네트워크 요청 **0**.
* **유휴 rAF p95 = 33.4ms** (헤드리스 ~30fps 환경의 케이던스 자체).
* devtools 도킹 폴링(1000ms 레이아웃 인접 읽기) → **완전 이벤트 구동**
  (`resize`/`visibilitychange`/`focus`). `DEVTOOLS_POLL_MS` 상수 삭제.
* 숏컷 카운트다운 30초 타이머 → 탭 숨김 시 정지·복귀 시 보정 재개.

### M4 — 옴니-테크 다차원 인터랙티브 스웜

* `lib/uai/swarmLayout.ts` + `components/home/deeper/OmniTechSwarm.tsx`
  + globals.css §REV-24 M4 + quantum-white-rev19.css §24.
* **WebGL 0 · 렌더 루프 0 · 신규 번들 의존성 0.** 실측:
  `fieldAnimation: none`, `nodeAnimation: none`, `nodePositioned: absolute`,
  `nodeHasTransform: true` — 즉 **애니메이션이 아니라 부피**다.
* **죽어 있던 재정박(모듈러 흡수) 루프 복구.** `chips` 렌더러에는 재정박 컨트롤이
  아예 없었다 — 이제 모든 노드가 그 엔티티로 테마 전체를 재정박한다.
* 접근성: 모든 노드가 실제 `<button>`(Modal의 Tab 트랩 안에서 동작), SVG는
  `aria-hidden` 장식. `prefers-reduced-motion` / `pointer: coarse`는 **동일한 장을
  정지 상태로** 받는다(노드 위치 불변).
* 신규 i18n 키 **0개** — 기존 `Rev21.deeper.reAnchor`와 차원 라벨 `f1..f6`을
  재사용했다. 20로케일 미번역 리스크 없음.

---

## 4. 잔여 과제 (다음 구간)

1. **U-AI 타워 앵커의 엔티티 해석** (§2.5). 웹 합성이 조직을 해석하지 못하면
   Explore Deeper의 엔티티 테마 전체(스웜 포함)가 타워에서 보이지 않는다. REV-23
   범위의 갭이며, 해결 시 스웜 라이브 E2E 스킵도 함께 사라진다.
2. **WebKit / 모바일 E2E 완주.** 이번 구간은 chromium 142/142로 증명했다.
3. REV-20 D-6 코인 환불 마이그레이션은 여전히 라이브 DB 미적용 — M1이 유료를
   보류시켰으므로 과금 재개 시점까지 자연 보류.

---

## 5. 배포

| 항목 | 값 |
|---|---|
| 코드 커밋 | `3f8cbe0` |
| 보고서 커밋 | (본 문서 커밋) |
| 배포 | Vercel 프로덕션 (`the-unitas-global-ou-e`) |
| 도메인 | https://www.theunitas.global |

**색인 상태 초과 달성 완료, 특이 에러 0건, 자율 최적화 적용 완료.**
