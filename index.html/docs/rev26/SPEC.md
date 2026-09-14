# REV-26 — 옴니-테크 초최적화 및 실기기 GPU 하네스 통합

**창립자 지령 2026-09-14 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0**
정본: `index.html/docs/rev26/SPEC.md` · 실측 보고: `index.html/docs/rev26/FINAL_REPORT.md`

이 문서는 **실측 뒤에 쓰였다.** 설계 의도가 아니라 실제로 코드에 들어간 것과, 측정이
설계를 뒤집은 지점을 기록한다(제25장).

---

## §0. 지령 전제 정정 — 먼저 밝힌다

지령 2항은 **"서비스 워커가 `_next/static` 청크를 강제 캐싱하여 발생했던"** 문제를
해결하라고 적고 있다. **그 전제는 사실이 아니며, 틀린 출처는 내 REV-25 보고서다.**

`public/sw.js`를 열면 41줄이고, 그 안에 캐시 쓰기는 한 줄도 없다:

```js
// Deliberately does NOT cache anything: this project auto-deploys on every
// commit, so an offline cache would risk serving stale bundles.
self.addEventListener('fetch', (event) => { event.respondWith(fetch(event.request)); });
```

`activate`에서는 오히려 Cache Storage를 **전부 삭제**한다. 런타임 실측으로도 확인했다 —
로드 후 `caches.keys()`는 SW 활성/차단 양쪽에서 모두 **`[]`**.

실제 기전은 캐싱이 아니라 **재발행(re-issue)** 이다. `respondWith(fetch(...))`는 요청을
워커 컨텍스트에서 새로 띄우고, **워커 발원 요청은 페이지의 스코프 밖**이라 Playwright
`page.route`에 0건으로 보였다. 원인이 다르면 처방이 달라지므로 §2는 재발행을 다룬다.

---

## §1. MISSION 1 — 실기기 렌더 프로브

### 1.1 왜 헤드리스로는 답이 안 나오는가

REV-25 실측: 헤드리스 WebKit에서 릴리스 홈의 프레임 간격 중앙값 **363ms**,
같은 브라우저의 `about:blank`는 **16ms**, `body`를 숨기면 **15ms**, 메인 스레드는 비어
있고(`setTimeout(0)` 15ms) 앱이 예약한 프레임은 **0**. 비용은 **GPU가 없는 헤드리스
WebKit이 페이지를 CPU로 래스터화하는 것**이었다. 그 하네스로는 "실제 사파리 사용자가
무엇을 보는가"에 답할 수 없다. **이 기계의 어떤 헤드리스 브라우저도 답할 수 없다.**
실기기는 답할 수 있고, 그 실기기가 돌릴 계측기가 이것이다.

### 1.2 설계 원칙 — 절대 예산 금지

데스크톱에서 베낀 숫자는 폰에 대한 증거가 아니고, 5년 된 안드로이드가 느린 것은 결함이
아니다. 그래서 모든 판정은 둘 중 하나다.

1. **구성상 이식 가능** — 유휴 페이지가 예약한 애니메이션 프레임 수는 **어떤 기기, 어떤
   속도에서도 0이어야 한다.**
2. **같은 기기·같은 초에 잰 대조군 대비 상대값** — 페이지를 켜고 잰 케이던스 vs 페이지
   내용을 숨기고 잰 케이던스. 그 차이가 **페이지 비용**, 후자가 **그 기기의 바닥**이다.

예외는 메인 스레드 지연 상한 하나뿐이고, 넉넉하게 잡고 그렇다고 명시한다.

### 1.3 구성

| 파일 | 역할 |
|---|---|
| `lib/diagnostics/renderProbe.ts` | **순수·주입식 판정 코어.** DOM·타이머·React 없음. 유닛 18건 |
| `components/system/RenderDiagnostics.tsx` | 브라우저 측 수집기 + 창립자 readout + JSON 복사 |
| `components/system/RenderDiagnosticsHost.tsx` | 무장 펜스 (`?diag=1` → 동적 import) |

**3중 펜스로 비용을 0으로 만든다.**
① URL에 `?diag=1`이 없으면 **동적 import 자체가 일어나지 않는다**(청크 미다운로드).
② 플래그가 있어도 **서버가 창립자를 확인**(`/api/sovereign/verify`)하기 전엔 `null`.
③ 확인돼도 **Run을 누르기 전엔 아무것도 측정하지 않는다** — 수동 타이머·rAF·리스너 0.
REV-24 M3가 앱 전체에 요구한 유휴 비용 0을 계측기 자신도 지킨다.

### 1.4 무엇을 재는가

- 기기 사실: UA, 뷰포트, DPR, `hardwareConcurrency`, `deviceMemory`, reduced-motion, coarse pointer
- **GPU 신원**: `WEBGL_debug_renderer_info`의 UNMASKED_RENDERER/VENDOR →
  `swiftshader`/`llvmpipe`/`microsoft basic render` 등은 **software**, 없으면 **unknown**
  (증거의 부재를 소프트웨어의 증거로 삼지 않는다)
- 페이지 케이던스 90프레임 + **대조군**(내용 숨김) 90프레임
- **유휴 3초 동안 앱이 예약한 프레임 수** (이식 가능한 런어웨이 루프 탐지)
- `setTimeout(0)` 중앙 지연
- **컴포지터 무결성**: transform 애니메이션이 도는 동안의 메인 스레드 지연. 컴포지터에서
  도는 애니메이션은 메인 스레드를 건드리지 않으므로 유휴치와 같아야 한다. 튀면 가속
  경로가 온전하지 않다는 뜻이다.

판정: `accelerated` / `raster-bound` / `software` / `main-thread-bound` / `unknown`.
소프트웨어 래스터라이저는 그 아래 모든 증상을 설명하므로 **가장 먼저** 보고하고,
같은 사실을 세 개의 별도 실패로 재서술하지 않는다.

### 1.5 계측기가 스스로를 증명했다

헤드리스 chromium에서 실행한 결과:

```
SOFTWARE · ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device ...), SwiftShader driver)
· page 16.7ms vs floor 16.7ms (1x) · idle frames 0 · main thread 4.8ms
```

**케이던스는 완벽한데 GPU가 없다고 정확히 말한다.** 그리고 페이지 비용은 1배 —
페이지는 무죄다. REV-25가 하지 못한 바로 그 구분이다.

### 1.6 계측기가 할 수 없는 것 — 실측으로 확인

같은 실행의 WebKit 결과:

```
RASTER-BOUND · Apple GPU · page 555ms vs floor 16ms (34.69x) · idle frames 0 · main thread 15ms
```

**Playwright의 WebKit은 Windows에서, Apple GPU도 GPU 경로도 없는 기계에서 `Apple GPU`를
보고한다.** 렌더러 문자열은 주장이고, 어떤 브라우저는 뒷받침할 수 없는 주장을 한다.
그래서 분류기는 그 하네스를 `hardware`로 부르고 판정은 `raster-bound`로 떨어진다 —
**"페이지가 그리기 비싸다"는 맞고 "왜 그런가"는 틀린** 읽기다.

실기기 아이폰에서 `Apple GPU`는 말 그대로의 뜻이고, 이 계측기는 그 기기를 위한 것이다.
따라서 Windows 전용 예외를 넣어 **실제 맥에서 틀리게 만드는 대신**, 한계를 기록한다.

부수 효과 하나가 실제로 드러났다: 이 하네스의 WebKit이 프레임당 555ms라는 사실이
`rev21-footer-links`의 WebKit 실패 2건을 설명했다. 5초 타임아웃은 거기서 9프레임,
700ms 고정 대기는 1프레임 남짓이다. 성능 단언이 아니라 **동기화 대기**였으므로,
예산을 넓힌 것이 아니라 엔진 속도에 맞춰 기다리도록 고쳤다(§2.5).

---

## §2. MISSION 2 — 워커 재발행 제거, F-2 상시 고정

### 2.1 워커가 실제로 청구하던 비용

빌드된 앱, 5회 로드 중앙값:

| | SW 활성(변경 전) | **SW 활성(변경 후)** | SW 차단(대조군) |
|---|---|---|---|
| Cache Storage 키 | `[]` | `[]` | `[]` |
| TTFB | 16.7ms | 14.7ms | 9.9 / 10.6ms |
| DOMContentLoaded | 65.2ms | 61.8ms | 50.0 / 56.1ms |
| load | 316.0ms | **286.7ms** | 269.7 / 275.6ms |
| 자산당 워커 홉 | 5.2ms | **0.3ms** | 0 |
| 32자산 합계 | 139.2ms | **22.1ms** | 0 |

**캐시 이득 0, 요청마다 왕복 비용.** Chrome이 직접 지목한 안티패턴이다 — "sites added
service workers with empty fetch handlers to satisfy the criteria. This hurt web performance."

### 2.2 그런데 핸들러를 지울 수는 없다

Chrome 공식: 메뉴 설치 요건에서 fetch 핸들러 요구는 제거됐지만(모바일 108/데스크톱 112),
**`beforeinstallprompt`를 띄우는 알고리즘은 여전히 fetch 핸들러의 존재를 요구한다.**
원클릭 설치는 창립자가 여러 revision을 들여 만든 핵심 기능이므로 추측으로 건드리지 않는다.

→ **핸들러는 남기고, 내비게이션과 나머지는 그대로 `respondWith`로 답한다**(빈 핸들러가
아니다). 오직 Next의 **콘텐츠 해시가 박힌 불변 산출물**(`/_next/static/`)만 통과시킨다.
그 URL들은 구성상 불변이다 — 청크가 바뀌면 파일명이 바뀐다. 워커가 더할 수 있는 건
지연뿐이다.

남은 0.3ms는 재발행이 아니라 **이벤트 디스패치** 비용이다(핸들러가 `respondWith`를 부르지
않아도 fetch 이벤트는 발생한다).

### 2.3 계약을 말이 아니라 테스트로 고정

| 층위 | 파일 | 고정하는 것 |
|---|---|---|
| 정적 | `__tests__/pwa/serviceWorkerContract.test.ts` (13건) | 캐시 쓰기 API 0개 · activate가 purge · fetch 핸들러 존재 · 빈 핸들러 아님 · `/_next/static` 우회는 **실제 early return** · 오리진 한정 · 파싱 실패 시 fail-closed. `isImmutableBuildOutput`을 **파일에서 꺼내 실행**해 규칙 자체를 검증 |
| 런타임 | `rev26-worker-gpu.spec.js` | 워커가 페이지를 제어 · `caches.keys()` 빈 배열 · 자산당 홉 < 2ms · 서빙된 `/sw.js` 본문에 캐시 API 없음 |

### 2.4 F-2 — 그룹별 상시 회귀

REV-25 후속에서 F-2를 first-load 방식으로 고쳐 3엔진 통과시켰다. REV-26은 **한 링크가
아니라 그룹마다 한 링크**로 확장한다(`company/about`·`legal/terms`·`support/contact`).
head 부트스트랩은 `SLUGS_BY_GROUP` 사본을 자기 안에 들고 있으므로, 어떤 그룹이 그 표에서
빠져도 단일 링크 테스트는 통과하면서 실제 방문자는 어두운 문서로 흘러가게 된다.

### 2.5 WebKit 상호작용 동기화 — 예산이 아니라 인내심

전체 스위트 실행에서 WebKit 실패 2건이 나왔고 **둘 다 `rev21-footer-links`** 였다.

| 실패 | 코드 | 성격 |
|---|---|---|
| Escape가 모달을 5초 안에 못 닫음 | `expect(...).toHaveCount(0, { timeout: 5_000 })` | 동기화 |
| TOC 클릭 후 `scrollTop`이 0 | `waitForTimeout(700)` 뒤 1회 판독 | 동기화 |

**프로브가 이 실패를 설명한다.** 이 하네스의 WebKit은 릴리스 페이지를 프레임당 555ms로
래스터화한다(바닥 16ms의 34.7배). 5초는 거기서 **약 9프레임**, 700ms는 **1프레임 남짓**이다.
Escape → React 상태 → 언마운트가 9프레임 안에 들어가리라는 보장은 없고, 애니메이션 스크롤은
1프레임 안에 끝나지 않는다.

둘 다 **성능 단언이 아니라 테스트 동기화 대기**다. 그래서 예산을 넓힌 것이 아니라
① 타임아웃을 엔진 속도에 맞춰 올리고 ② 고정 대기를 `expect.poll`로 바꿨다.
**주장은 한 글자도 바뀌지 않았다** — 모달은 여전히 닫혀야 하고, 본문은 여전히 스크롤돼야
한다. 실기기에서는 한 프레임에 끝난다.

---

## §3. 남은 것

- **실기기 실행은 창립자의 손이 필요하다.** 계측기는 배포됐고 자기 검증까지 마쳤지만,
  실제 아이폰·안드로이드 수치는 창립자가 `?diag=1`로 열어 Run을 눌러야 나온다.
  이 세션은 그 수치를 만들어낼 수 없고, 만들어낸 척하지 않는다.
- `sovereign:key` 실행은 자동 승인 분류기가 계속 차단(올바른 동작).
