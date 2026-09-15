# REV-28 최종 완결 종합 보고서

**창립자 지령 2026-09-14 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0 제25장**
설계 정본: `index.html/docs/rev28/SPEC.md`

이 보고서는 **측정된 것만** 적는다. 측정하지 않은 상태를 완료로 적지 않는다(제25장).

---

## §1. 4대 게이트 실측

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 | `npm --prefix web run typecheck` | **EXIT 0** |
| 유닛 | `cd web && npx vitest run` | **1360 / 1360 passed · 87 files** (REV-26 1334/85 → **+26 / +2**) |
| 빌드 | `npm --prefix web run build` | **EXIT 0** |
| E2E | `npx playwright test --config=tests/web-cinema.config.js` | §6에 기재 |

---

## §2. MISSION 1 — 진입 링크와 병목 어댑터

### 2.1 링크 하나로는 해결되지 않는다 (실측)

지령이 적어 준 주소를 실제로 두드렸다:

```
https://theunitas.global/?diag=1      -> 308  https://www.theunitas.global/?diag=1
https://www.theunitas.global/?diag=1  -> 307  /en/gateway?diag=1
```

에이펙스는 쿼리를 보존해 넘긴다(정상). 그러나 **세션이 없는 폰에서는 게이트웨이로
봉인된다.** 링크는 세션을 만들어 주지 못한다.

그래서 두 가지를 같이 넣었다: 소버린 콘솔의 **`RENDER PROBE`** 액션(이 기기 — 한 번 누르면
`?diag=1`로 재진입)과, 같은 자리의 안내(다른 기기 — 창립자 문을 먼저 통과할 것).
**조용히 게이트웨이로 떨어지는 바로가기는 바로가기가 없는 것보다 나쁘다.**

### 2.2 병목 수집 어댑터

`lib/diagnostics/paintBisect.ts` — REV-26이 손으로 하던 "영역 숨기고 재측정"을 계측기로
만들었다. 8개 영역의 **회수 시간**을 재고 **기기 바닥 대비 총비용의 지분**으로 환산한다.
프로파일러가 아니며, 영역은 겹치고 지분은 100%가 되지 않는다 — **정규화하지 않고 그
사실을 화면에 띄운다.**

### 2.3 테스트가 내 임계값을 교정했다

REV-26이 손으로 **"diffuse"** 라고 결론 낸 데이터를 어댑터에 먹였더니, 첫 구현이
hero(**24.23%**)를 "최대 기여자"로 승격시켰다 — **앞선 측정이 이미 무죄로 판정한 대상을
다시 기소한 것이다.** 밴드를 교정했다: < 30% diffuse / 30–50% "최대 기여자지만 전부는
아님" / ≥ 50% 지배적. 교정 후 REV-26의 손 결론과 같은 답이 나온다.

---

## §3. MISSION 2 — PWA 설치 판정

`lib/diagnostics/pwaReadiness.ts` — 다섯 상태: `installed` / `ready` / `ios-manual` /
`waiting` / `blocked`.

**핵심은 iOS를 고장으로 부르지 않는 것이다.** Safari에는 어떤 버전에도
`beforeinstallprompt`가 없고, 설치는 사람이 하는 공유 → 홈 화면에 추가다. 그걸 실패로
보고하면 창립자가 존재하지 않는 버그를 쫓게 된다. 마찬가지로 **"아직 아님(waiting)"과
"불가(blocked)"를 분리**한다.

실측(헤드리스):

```
chromium      waiting · desktop · sw yes · manifest ok · prompt none
mobile-chrome waiting · android · sw yes · manifest ok · prompt none
```

**워커가 제어 중이고 매니페스트도 정상이다** — REV-26의 워커 변경은 설치 전제를 깨지
않았다. E2E는 상태가 `blocked`로 나오면 블로커 목록을 담아 **실패**시키므로, 이 프로젝트가
소유한 전제가 깨지면 즉시 드러난다.

---

## §4. 이번 구간의 진짜 발견 — 하네스 전반의 가정이 틀려 있었다

REV-28에서 E2E 실패가 계속 나왔다. **개별 버그가 아니었다.**

| 스펙 | 무엇을 가정했나 | 프레임 기준 실제 |
|---|---|---|
| `rev15-cluster-popout` | 커튼 해제 15초 | ~27프레임 |
| `rev17-refresh-persistence` ×3 | 진입 버튼 클릭 기본 예산 | 안정 판정 1회에 1.4초 |
| `rev19-back-stack` | 모달 스택 확인 전 300ms | **1프레임 미만** |
| `rev21-footer-links` ×2 | Escape 5초 / 스크롤 700ms | 9프레임 / 1프레임 |
| `rev24-verify` | rAF 90프레임 수집 | **약 50초** → 60초 예산 초과 |
| `rev26-worker-gpu` | 청크 관측 2.5초 | 동적 import + 서버 확인이 더 걸림 |
| `omni-exit` ×4 | 스플래시 언마운트 8초 | 열두 프레임 남짓 |

**공통 가정은 "프레임은 빠르다"였고, 그 가정을 숫자로 깬 것이 REV-26의 렌더 프로브다** —
이 하네스의 WebKit은 릴리스 페이지를 **555~698ms/프레임**(바닥의 34배)으로 래스터화한다.

전부 **동기화 대기이지 성능 단언이 아니므로**, 예산을 넓힌 것이 아니라 엔진 속도에 맞춰
기다리게 했다. 가능한 곳은 고정 대기를 `expect.poll`로, 프레임 수 고정을 **시간 한정**으로
바꿨다. **어떤 주장도 한 글자 바뀌지 않았다.**

### 4.1 타임아웃을 늘리기 전에 제품 무죄를 먼저 확인한 사례

`rev26` 청크 분리 테스트가 WebKit에서 `arming pulled 0 more`로 실패했다. 이것은
**"프로브 코드가 모두에게 배포되고 있다"** 를 뜻할 수도 있었다. 그래서 타임아웃을 건드리기
전에 직접 쟀다:

```
chromium  unarmed 27 · armed 28 · extra: /_next/static/chunks/5818.534de7aa8bfc93f3.js
webkit    unarmed 28 · armed 28 · extra: /_next/static/chunks/5818.534de7aa8bfc93f3.js
```

**두 엔진 모두 무장할 때만 내려온다 — 분리는 실재한다.** 틀린 것은 내 관측 창이었고,
고친 것도 그것이다(스톱워치 대신 **결과를 대기** — 프로브가 렌더되면 청크가 도착한 증거).

---

## §5. 비용 — 계측기는 자기 규율을 지킨다

REV-26의 3중 펜스 유지: `?diag=1` 없으면 **동적 import 자체가 없고**(실측: 무장 시 청크
1개 추가), 서버 창립자 확인 전엔 `null`, **Run 전엔 측정 0**. REV-28이 더한 것 중 측정을
수반하는 것(병목 8패스)은 **별도 버튼** 뒤에 있고, PWA 판독은 프레임을 전혀 쓰지 않는다.
신규 i18n 키 **0개**.

---

## §6. 전수 게이트

| 실행 | 결과 |
|---|---|
| 1회차 | 526 pass · 18 skip · **5 fail** |
| 2회차 | 530 pass · 18 skip · **1 fail** |
| 3회차 | 530 pass · 18 skip · **1 fail** |
| **4회차 (최종)** | **531 pass · 18 skip · 0 fail · EXIT 0** (549건 × 3엔진, 1.2시간) |

세 번의 전수가 매번 **같은 뿌리로 한 건씩** 더 뱉었다. 개별 대응은 사이클 낭비이므로
4회차 전에 **구조적으로** 처리했다 — WebKit 프로젝트에만 측정된 시계를 부여
(`actionTimeout 45s` · `expect 20s` · `test 240s`, `tests/web-cinema.config.js`).

**이것이 예산 완화가 아니라 시계 교정인 이유:** chromium과 mobile-chrome은 **기본값
그대로**다. 진짜 회귀는 그 두 프로젝트에서 그대로 드러나며, WebKit에서만 관대해진 것은
"같은 바운딩 박스를 연속 두 프레임에서 본다"는 판정이 **한 번에 1초를 넘는** 엔진에 대한
인내심이다. 단언은 한 줄도 바뀌지 않았다.

한 건은 성격이 달라 별도 처방했다 — `rev21-hub-card`의 `element was detached from the
DOM`. 디스커버리 캐러셀이 **자동 회전**하므로 제목은 움직이는 표적이고, 안정 판정이
회전 주기와의 경쟁에서 진다. **예산으로 이길 수 없는 경쟁이라**(이미 3분을 줬다) 이
저장소가 캐러셀 요소에 이미 쓰는 방식(`evaluate` 디스패치)으로 바꿨다. 2단계 계약도
`data-selected` 확인도 그대로다.

## §6.1 배포 및 라이브 실측

커밋 `1510881` → `origin/main` 푸시 → Vercel 프로덕션
`dpl_5q4F1gL6JunmNkHUJjtqxWcsbPFA` (`the-unitas-global-bulay6t9b`) **READY**.

```
/                사람 UA      -> 307  gate=seal  loc=/en/gateway
/                Googlebot    -> 200  gate=pass
/sovereign       사람 UA      -> 404
/?diag=1         iOS Safari UA-> 307  gate=seal  loc=/en/gateway?diag=1
```

`?diag=1`은 **iOS UA로도 퍼널을 열지 않는다** — 창립자 세션이 먼저다.

라이브 매니페스트 실측(PWA 판정기가 요구하는 4개 필드):

| 필드 | 값 |
|---|---|
| `name` | UNITAS |
| `icons` | 3 |
| `start_url` | `/` |
| `display` | standalone |

**라이브 `gitCommit = 1510881843aec2199b4fbd119264e490a654d03b` = 로컬 HEAD 일치.**

---

## §7. 남은 것 — 숨기지 않는다

1. **실기기 수치는 여전히 창립자의 손이 필요하다.** 계측기는 이제 "어디가 비싼가"까지
   답하지만, 실제 아이폰 판정은 그 기기에서 창립자 문을 통과한 뒤 `RENDER PROBE`를 눌러야
   나온다. 이 세션은 그 수치를 만들어낼 수 없다.
2. **`beforeinstallprompt`의 실제 발화는 여전히 헤드리스에서 재현 불가.** 판독기가
   실기기에서 `ready`를 보고하고 Install이 네이티브 다이얼로그를 띄우는 것을 확인하면
   REV-26이 남긴 미해결이 닫힌다.
3. **WebKit 하네스의 잔여 플레이크.** 34배 느린 래스터라이저 위에서 일부 단언은 여전히
   경계에 있다(`omni-exit` 1건이 조합 실행에서 한 번 실패하고 단독·재실행에서 통과).
   제품 결함이 아니라 하네스 속성이며, 이 revision에서 같은 뿌리를 **10곳** 고쳤다.
4. `sovereign:key` 실행은 자동 승인 분류기가 계속 차단(올바른 동작).
