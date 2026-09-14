# REV-26 최종 완결 종합 보고서

**창립자 지령 2026-09-14 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0 제25장**
설계 정본: `index.html/docs/rev26/SPEC.md`

이 보고서는 **측정된 것만** 적는다. 측정하지 않은 상태를 완료로 적지 않는다(제25장).

---

## §1. 4대 게이트 실측

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 | `npm --prefix web run typecheck` | **EXIT 0** |
| 유닛 | `cd web && npx vitest run` | **1334 / 1334 passed · 85 files** (REV-25 1303/83 → **+31 / +2**) |
| 빌드 | `npm --prefix web run build` | **EXIT 0** (fingerprint `eb09b6b8bab1d401…`) |
| E2E | `npx playwright test --config=tests/web-cinema.config.js` | **519 passed · 18 skipped · 0 failed · EXIT 0** (3엔진, 1.4시간) |

배포할 빌드와 측정한 빌드는 같다 — 재빌드 직후 같은 명령 체인에서 스위트를 돌렸다.

---

## §2. 지령 전제 정정 — 틀린 출처는 내 REV-25 보고서다

지령 2항은 "서비스 워커가 `_next/static` 청크를 **강제 캐싱**하여 발생했던" 문제를 지목한다.
**그 전제는 사실이 아니다.**

`public/sw.js`에는 캐시 쓰기가 **한 줄도 없고**, `activate`는 Cache Storage를 **전부 삭제**한다.
런타임 실측: 로드 후 `caches.keys()`가 SW 활성/차단 양쪽 모두 **`[]`**.

실제 기전은 **재발행(re-issue)** 이었다. `respondWith(fetch(event.request))`가 요청을 워커
컨텍스트에서 새로 띄우고, **워커 발원 요청은 페이지 스코프 밖**이라 `page.route`에 0건으로
보였다. 캐싱이었다면 처방은 퍼지였겠지만, 재발행이므로 처방은 **통과**다.

---

## §3. MISSION 2 — 워커가 청구하던 비용, 실측과 제거

빌드된 앱, 5회 로드 중앙값:

| | SW 활성(변경 전) | **SW 활성(변경 후)** | SW 차단(대조군) |
|---|---|---|---|
| Cache Storage 키 | `[]` | `[]` | `[]` |
| TTFB | 16.7ms | 14.7ms | 9.9 / 10.6ms |
| DOMContentLoaded | 65.2ms | 61.8ms | 50.0 / 56.1ms |
| load | 316.0ms | **286.7ms** | 269.7 / 275.6ms |
| 자산당 워커 홉 | 5.2ms | **0.3ms** | 0 |
| 32자산 합계 | 139.2ms | **22.1ms** (−84%) | 0 |

워커 없는 대조군과의 격차: **+46.3ms → +11.1ms.**

**핸들러는 지우지 않았다.** Chrome 공식 문서상 메뉴 설치 요건에서 fetch 핸들러 요구는
제거됐지만(모바일 108 / 데스크톱 112) **`beforeinstallprompt` 알고리즘은 여전히 존재를
요구**한다. 원클릭 설치는 여러 revision을 들인 기능이므로 추측으로 건드리지 않았다.
내비게이션과 나머지는 그대로 답하고, **콘텐츠 해시가 박힌 불변 산출물만** 통과시킨다.
남은 0.3ms는 재발행이 아니라 이벤트 디스패치 비용이다.

E2E 실측(최종 실행): `32 static assets · worker hop total 0ms · max 0ms`.

계약은 말이 아니라 테스트로 고정했다 — 정적 13건(`serviceWorkerContract.test.ts`,
`isImmutableBuildOutput`을 파일에서 꺼내 실행) + 런타임 3건.

---

## §4. MISSION 1 — 실기기 렌더 프로브

`lib/diagnostics/renderProbe.ts`(순수 코어, 유닛 18건) +
`components/system/RenderDiagnostics.tsx`(수집기·readout·JSON 복사) +
`RenderDiagnosticsHost.tsx`(무장 펜스).

**설계 원칙은 절대 예산 금지.** 판정은 ① 구성상 이식 가능한 것(유휴 프레임 0)이거나
② **같은 기기·같은 초에 잰 대조군 대비 상대값**이다. 느린 폰은 느린 것이지 고장난 게 아니다.

**비용 0 — 3중 펜스, 실측 확인.**
① `?diag=1`이 없으면 동적 import 자체가 없다 → E2E 실측 `unarmed 26 chunks · armed 27 ·
arming pulled 1 more` (청크가 실제로 분리돼 있고, 무장해야 내려온다)
② 플래그가 있어도 서버가 창립자를 확인하기 전엔 `null`
③ 확인돼도 Run 전엔 측정 0 — 수동 타이머·rAF·리스너 없음

**계측기가 스스로를 증명했다** (헤드리스 chromium):

```
SOFTWARE · ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device ...), SwiftShader driver)
· page 16.7ms vs floor 16.7ms (1x) · idle frames 0 · main thread 10.4ms
```

케이던스는 완벽한데 **GPU가 없다고 정확히 말하고**, 페이지 비용은 1배로 **페이지를 무죄**
처리한다. REV-25가 하지 못한 구분이다.

---

## §5. 측정이 내 판단을 뒤집은 것 — 2건

### 5.1 "WebKit 푸터 실패는 내 동시 프로브 탓" → 틀렸다

REV-25 후속에서 나는 그 실패를 CPU 경합으로 돌리고 기록했다. **단독 실행에서도 재현되어
그 진단은 틀렸다.**

실측으로 좁혔다. 먼저 푸터가 정말 흔들리는지 쟀다 — **24샘플 10초 동안 이동 0건**,
두 엔진 모두. 요소는 안정적이다. 그러면 남는 건 에러 문구 자체였다:
`Test timeout of 180000ms exceeded` — 액션이 아니라 **테스트 전체 예산**이 소진된 것이다.

그 파일은 이미 `test.slow(webkit)`으로 180초를 쓰고 있었고, 주석은 프레임 비용을
"350–700ms"로 **추측**하고 있었다. 그리고 **내가 Escape 상한을 5초 → 20초로 올리면서
12회 반복의 총합이 그 예산을 넘겼다.** 즉 앞선 수정이 만든 회귀다.

프로브가 그 추측을 실측으로 대체했다 — **`page 555ms vs floor 16ms (34.69x)`**.
5초는 거기서 약 9프레임, 700ms 고정 대기는 1프레임 남짓이다. 성능 단언이 아니라
**동기화 대기**였으므로 ① 타임아웃을 엔진 속도에 맞추고 ② 고정 대기를 `expect.poll`로
바꾸고 ③ 예산 근거를 추측에서 실측으로 교체했다. **주장은 한 글자도 바뀌지 않았다.**
WebKit 9/9 통과.

### 5.2 프로브의 GPU 분류에는 한계가 있다

같은 실행의 WebKit 판정: `RASTER-BOUND · Apple GPU · page 555ms vs floor 16ms (34.69x)`.

**Playwright의 WebKit은 Windows에서, Apple GPU도 GPU 경로도 없는 기계에서 `Apple GPU`를
보고한다.** 렌더러 문자열은 주장이고, 어떤 브라우저는 뒷받침할 수 없는 주장을 한다.
그래서 분류기는 그 하네스를 `hardware`로 부른다 — **"페이지가 그리기 비싸다"는 맞고
"왜 그런가"는 틀린** 읽기다.

Windows 전용 예외를 넣으면 **실제 맥에서 틀리게** 되므로, 특수 케이스 대신 한계를 기록했다.
실기기 아이폰에서 `Apple GPU`는 말 그대로의 뜻이고, 이 계측기는 그 기기를 위한 것이다.

---

## §6. 배포 및 라이브 실측

(배포 직후 실측으로 채운다.)

---

## §7. 남은 것 — 숨기지 않는다

1. **실기기 수치는 창립자의 손이 필요하다.** 계측기는 배포됐고 자기 검증도 마쳤지만,
   실제 아이폰·안드로이드 판정은 창립자가 로그인한 상태에서 `?diag=1`을 붙여 열고 **Run**을
   눌러야 나온다. 이 세션은 그 수치를 만들어낼 수 없고, 만들어낸 척하지 않는다.
   판정이 `raster-bound`로 나오면 그때 비로소 "실제 사파리에서 페이지가 비싸다"가 증명되고,
   최적화 대상이 확정된다.
2. **PWA 설치 프롬프트는 헤드리스에서 발화하지 않는다.** `beforeinstallprompt`는 실제
   브라우저의 참여 휴리스틱을 타므로, fetch 핸들러를 남긴 것이 충분한지는 Chrome 문서에
   근거했을 뿐 이 하네스로 재현 검증하지 못했다. 실기기에서 설치 배너가 뜨는지 확인이 필요하다.
3. `sovereign:key` 실행은 자동 승인 분류기가 계속 차단(올바른 동작).
