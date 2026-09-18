# 3단계 스윕 구조적 한계 — 전 엔진 공통 규칙

**Codex v49.0 제16장 부속 · 2026-09-18 창립자 직권 각인 · 적용 대상: Claude Code, Roo Code, Copilot, Continue, aider, `.github/agents/*`**

> 이 규칙의 목적은 금지가 아니라 **연산 낭비의 원천 차단**이다. 아래 산술은 2026-09-17과 2026-09-18 두 세션에서 각각 독립적으로 재발견되었다. 세 번째 재발견은 없어야 한다.
> 전문 실측 정본: `index.html/docs/stage3/STRUCTURAL_LIMITS.md`

---

## 절대 명제

**창립자가 활성 세션으로 에이전트와 대화하는 동안 3엔진 전수 스윕(`UnitasIdleSensorStage3`)이 완주하는 것은 튜닝 문제가 아니라 구조적 불가능이다.** 스윕은 사람이 자리를 비운 야간에만 돈다. 이것은 결함이 아니라 설계다.

## 실측 근거 (`test-results/stage3/daemon.log` 103틱 / 231분 전수 파싱)

- `decision: idle` **0 / 103**. 스윕 기동 로그 **0건**. 적립 샤드 **0 / 6**.
- **1순위 병목은 `osInput`(GetLastInputInfo)이다** — 최대 연령 **409초(6.8분)** vs 임계 600초, **돌파 0회**. 103틱 중 **30틱에서 유일한 잔여 블로커**였고 나머지 세 신호는 이미 10분 이상 조용했다. 트랜스크립트는 2순위다.
- `transcript` 신호는 **전 프로젝트** `~/.claude/projects/**/*.jsonl` 2,454개(서브에이전트·워크플로 포함)의 최대 mtime이다. 워크플로 1회 실행만으로 11개가 갱신된다. claude-mem 옵저버는 40~60초 뒤에 쓴다.
- 데몬 자체가 같은 창에서 **107.8분(47%) 죽어 있었다**(틱 67 → 틱 1 카운터 리셋).

## 완주 요건 산술

- **샤드 1개** = 600s 무장 + ≤60s 틱 지연 + ≤120s webServer 부팅 + 900~1800s 실행 = **25~43분 무중단 부재**
- **6샤드 전체**(chromium · webkit · mobile-chrome · tablet · inapp-kakao · inapp-instagram) = **연속 2.0~3.5시간**, 또는 6회 × 25~43분
- 관측된 최장 무접촉 6.8분 → 샤드 1개에 **3.7~6.3배 부족**, 무장선에조차 **1.47배 부족**

## 완주를 막는 4중 장치 (전부 의도된 설계)

1. **무장** `computeIdle` — 네 신호 전부 ≥10분 + 바쁜 프로세스 0. 읽기 실패는 활동으로 센다(fail-closed).
2. **취소** `cancelReasons` — 임계가 아니라 **스윕 시작 시각** 기준. `ts > sweepStartedAt`이면 즉시 취소, 60초마다 재평가. **메시지 1건이 ≤60초 안에 샤드를 죽인다.**
3. **취소 = 손실** `idle-sensor-daemon.mjs:670`의 `if (summary.status === 'cancelled') return;`가 `recordShard`/`writeProgress` **앞**에 있다. 키 입력 1회가 최대 30분을 버린다.
4. **키 이탈** 스윕 키는 `BUILD_ID@HEAD`. 바뀌면 `shardState()`가 적립분을 전량 폐기한다(`idle-sensor-core.mjs:626`). 실측 키 평균 수명 32.8분 — 단일 샤드 요구 구간 안이다. **커밋 1회·리빌드 1회가 완벽한 야간 부재를 무효화한다.**

## 금지

- ❌ 전경에서 3엔진 전수 실행 (`docs/stage3/READER.md:26` 정본 금지 조항)
- ❌ `--idle-min 0` 강제 기동 — 무장→취소 무한 처닝, 취소는 체크포인트되지 않으므로 순손실
- ❌ "10분 기다렸다가 말 걸기" 패턴 — 무장에는 닿아도 완주엔 절대 못 닿고, 오히려 구동 중 샤드를 죽인다
- ❌ 수동 Playwright 재실행 시 `--output=test-results/stage3-artifacts` 누락 — 2026-09-18 이 실수로 **4샤드를 실제로 잃었다**
- ❌ 스윕 대기 중 커밋·리빌드
- ❌ 무인 시간대 LLM 기동으로 조건을 "자동 충족"시키려는 시도 — **제5장 백그라운드 LLM 연산 영구 차단** 위반. 데몬은 모델 무관·토큰 0이어야 한다.

## 의무

- ✅ 게이트 5(스윕 완주) 미충족 시 **`done` 승격 금지, 그대로 보고**(제14장 미측정 완료 보고 금지)
- ✅ 나머지 게이트(typecheck · vitest · build · security:trust:verify)는 전경에서 즉시 실측하고 **숫자로** 보고
- ✅ 누적 실적은 `latest.md`가 아니라 **`progress.json`**에서 읽을 것 — 취소된 샤드의 `latest.md`는 `0/0/0`으로 보이지만 그건 그 샤드의 기록이지 스윕 전체가 아니다
- ✅ 실행 창을 만드는 유일한 방법을 그대로 안내할 것: **머신을 깨운 채 · 사람이 자리를 비우고 · 그 사이 커밋·리빌드 없이 · 데몬 생존**

## 상태 확인

```
cd index.html/web && npm run idle:sensor:status     # 예약 작업 상태
cd index.html/web && npm run stage3:brief           # 스윕 한 줄 브리핑 + 큐
cat index.html/test-results/stage3/daemon.lock      # pid 생존 확인
```
