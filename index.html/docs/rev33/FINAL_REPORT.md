# REV-33 최종 완결 종합 보고서 — 스웜 시각적 하이퍼-폴리싱 및 초지능 캐싱

창립자 지령일 2026-09-15 · 설계 정본 `docs/rev33/SPEC.md` · 대상 `index.html/web`

---

## 1. 3대 미션 결과

| 미션 | 지령 | 결과 |
|---|---|---|
| **M1** | 딥 스페이스 그라데이션 + 다크 글래스모피즘 100% 덧입히기 | **완료** — 4겹 성운 + 2중 별 격자, 글래스는 하우스 기법(135° 램프 + 내부 베벨). **필드·프레임 blur 0 · filter 0 · animation 0** 실측 |
| **M2** | 브라우저 스크롤·확대/축소 완전 제어, 제로-프릭션 유영 | **완료** — 3중 거절(`touch-action: none` · 비수동 `touchmove` · WebKit `gesture*`). 이동 중 **문서 스크롤 0px** 실측 |
| **M3** | 탐색 경로 초지능 캐싱, 재호출 시 네트워크 I/O 완전 차단 | **완료** — 새 JS 렐름에서 재방문 시 **`wbgetentities` 요청 0건** 실측 |

---

## 2. 무결성 게이트 실측 (제25장 Fail-Closed)

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 | `npx tsc --noEmit` | **EXIT 0** |
| 단위 | `npx vitest run` | **1525 / 1525 pass · 94 / 94 파일 · 실패 0** |
| 빌드 | `npm run build` (prebuild 3단 + postbuild) | **EXIT 0** |
| E2E 전체 (3엔진) | `npx playwright test --config=tests/web-cinema.config.js` | **587 pass · 33 skip · 1 fail** |
| E2E REV-33 재검증 (3엔진) | 동일 하네스, 수정 후 `rev33-swarm-polish` | **21 / 21 pass** |

**1 fail에 대한 정직한 보고**: 전체 회차의 유일한 실패는 WebKit에서 `the stage refuses the browser gestures that would fight it` 1건이었고, **제품 결함이 아니라 측정 방식의 결함**이었다. 이 WebKit은 `overscroll-behavior` 선언을 지키면서도 CSSOM의 카멜케이스 `overscrollBehaviorX`를 노출하지 않아 `undefined`를 답한다. 프로브를 `getPropertyValue('overscroll-behavior-x')`로 바꾸고 보고 불가한 엔진에서는 그 항목만 건너뛰도록 고쳤으며, **핵심 계약인 `touch-action: none`과 `overflow: hidden` 단언은 그대로 엄격하다.** 수정 후 해당 스펙은 3엔진 21/21로 통과했다. 전체 스위트를 통째로 재실행하지는 않았다 — 한 스펙의 프로브만 바뀌었으므로 나머지 566건의 회귀 결과는 그 회차 것이 유효하다.

단위 테스트는 REV-32의 1486에서 1525로 올랐다(+39): 뷰포트 수학 26, 영속 캐시 13.

---

## 3. 감사가 먼저 뒤집은 두 전제

### 3.1 `/omni-swarm`은 다크 라우트다

이 라우트는 `SurfaceScope`를 렌더하지 않는다. 따라서 `html[data-unitas-surface='quantum-white']`가 각인되지 않고 `--qw-ink / --qw-line / --qw-blue / --qw-glass` 전 계열이 **로드조차 되지 않는다**. `OmniSwarmPanel`이 쓰던 `.qw-section-label`은 무효 클래스였다. 실제로 도달하는 토큰(`--qw-card-*`, `--u-wl-*`, Tailwind `void/accent/neon`)만으로 지었다.

### 3.2 `backdrop-filter`로는 지을 수 없었다

`globals.css`와 `quantum-white-rev19.css` 두 곳이 스웜을 직접 지목해 금지한다 — "the swarm field forbids both -- it must stay a still volume, never a blurred one". 640px blur 레이어가 패럴랙스 프레임마다 재래스터되던 실측이 근거다.

**금지 범위는 정확히 `.qw-swarm`(필드)와 `.qw-swarm-portal`(문)이고, 페이지 크롬은 포함하지 않는다.** 그럼에도 크롬에도 blur를 쓰지 않았다 — 한 표면에 유리 레시피가 둘이면 한 표면이 아니기 때문이다. `--u-wl-glass`(135° 화이트-알파 램프) + `--u-wl-edge`(내부 베벨)가 하우스의 무블러 유리 기법이며, REV-21 §4.3이 처방한 바로 그 보상이다.

E2E가 매 실행 단언한다: 필드와 프레임의 `backdropFilter` `none|none` · `filter` `none` · `animationName` `none`.

---

## 4. 실행이 잡아낸 결함 3건

읽어서가 아니라 **돌려서** 나왔다.

### 4.1 리스너를 `dragging` 상태에 묶은 것

더 깔끔해 보였고 틀렸다. `setDragging(true)`가 예약한 렌더 **이후에** 이펙트가 붙으므로, 한 프레임 안에서 down·up이 끝나는 빠른 탭은 **리스너 없이 릴리스**된다. 포인터가 맵에서 제거되지 않아 다음 누름이 두 번째 손가락으로 집계되고, 핀치로 읽혀 `movedRef`가 서고, 그 뒤로는 **어떤 노드도 흡수될 수 없다.** → 무조건 바인딩(맵이 비면 no-op)으로 경합 자체를 제거.

### 4.2 `setPointerCapture`

올바른 도구처럼 읽히고 필드를 조용히 망가뜨린다. 캡처는 해당 포인터의 이후 이벤트를 캡처 요소로 **재타깃**하므로 `pointerup`이 스테이지에 떨어지고, 브라우저는 `click`을 노드가 아니라 스테이지에 발화한다. 실측: 평범한 탭이 아무것도 흡수하지 않게 됐다. → 캡처 제거. 윈도우 리스너가 이미 박스를 벗어난 포인터를 따라간다.

### 4.3 WebKit CSSOM 프로브 (측정 결함)

§2에 기록. 제품이 아니라 테스트가 틀렸던 유일한 건이다.

**진단 절차에 대한 메모**: 4.2는 처음에 "드래그 뒤의 탭"과 "탭 자체"를 한 테스트에서 함께 검증하다 발견됐고, 그 상태로는 **둘 중 무엇이 깨졌는지 알 수 없었다**. 두 테스트로 분리한 직후 신선한 페이지의 단독 탭도 실패한다는 사실이 드러나 원인이 특정됐다. 하나의 테스트가 두 가지를 증명하면 아무것도 증명하지 못한다.

---

## 5. M3 — 3계층 캐시

| 계층 | 무엇을 답하나 | 수명 |
|---|---|---|
| 모듈 `Map` | 같은 탭의 같은 주제 — JSON 파싱조차 없이. **흡수 경로 되돌아가기가 공짜인 이유** | 탭 |
| in-flight `Map` | 두 진입로가 같은 순간 같은 주제를 열 때 해석 1회를 공유 | 요청 중 |
| **`swarmCache`(localStorage)** | 재방문·새 탭·내일 | 7일 · 40행 · LRU |

설계 결정: TTL 7일(회사의 자회사·CEO는 변한다 — `geoCache`가 TTL을 두지 않는 이유와 정반대), **빈 결과는 절대 캐시하지 않음**(제3자의 한 순간을 일주일 얼리면 일시 장애가 영구 빈 필드가 된다), 쿼터 초과 시 차가운 절반을 버리고 1회 재시도, 개인정보 페이지 원장에 키 공시.

실측: `{"v":"sw-v1","keys":["Q2283::ko"]}` 영속 후, localStorage만 공유하는 **새 JS 렐름**에서 다시 열었을 때 `wbgetentities` 요청 **0건**.
