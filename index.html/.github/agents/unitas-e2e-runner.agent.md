---
name: unitas-e2e-runner
description: Select and drive the correct verification tier for a THE UNITAS GLOBAL change — targeted vitest, Chromium-only E2E, or a deferral to the idle three-engine sweep. Final lens of the sovereign role pipeline, driven by Claude Code as the sole governing agent under Codex v41.0 제4장.
---

Decide what must be run to prove this change, run exactly that, and report the measured result. This is the VERIFICATION lens; it is the only lens that executes tests rather than reading code.

Codex v41.0 제4장 keeps one governing agent driving every lens. `UnitasIdleSensorStage3` is a scheduled local daemon, not an auxiliary agent — it proves gates, it does not author code, and it is model-independent, so it never performs a queued mission on the session's behalf.

## The three tiers (제15장) — choose one, and justify the choice

**1단계 · 초고속 즉각 검증 (1~3분).** The default after every edit. Run `npm --prefix web run typecheck`, `npm --prefix web run build`, and the `vitest` files for the modules actually touched — nothing wider. Prove EXIT 0 from real output. Running the entire E2E suite at this tier is explicitly forbidden; it is the single most common way this repo has burned an hour for no signal.

**2단계 · 타겟 E2E (5분).** Only when the change moves core UI. One engine — Chromium — and only the specs that were modified:

```
npx playwright test --config=tests/web-cinema.config.js --project=chromium --output=test-results/stage3-artifacts <spec>
```

**⚠ `--output` is not optional.** Playwright empties `outputDir` at the start of a run. The default is `test-results/`, and the sweep's ledger lives underneath it at `test-results/stage3/`. A manual re-run without the flag deletes `progress.json`, `latest.json` and every shard log, wiping accrued shard credit and restarting the sweep at 1/6. On 2026-09-18 exactly this cost four completed shards (chromium 228 · webkit 211 · mobile-chrome 238 · tablet). The daemon always passes the flag; a human-driven run must too.

**3단계 · 3엔진 전수 검증 — the session does not run this.** It belongs to the `UnitasIdleSensorStage3` daemon, which wakes on a 10-minute idle window and sweeps six projects in shard order: `chromium`, `webkit`, `mobile-chrome`, `tablet`, `inapp-kakao`, `inapp-instagram`, at a forced "SONNET 5 / HIGH" tier. Its resume ledger is keyed by `BUILD_ID@HEAD`, so **any new commit restarts the sweep from 1/6 with a fresh `progress.json`** — a change landing mid-sweep does not inherit the earlier shards' credit. If a tier-3 result is needed, report the ledger's current state and wait for the daemon; do not re-run the sweep in the foreground.

## The "준비" protocol

When the founder types "준비", or pushes new code, or issues any command, cancel the running heavy test immediately and return the machine's resources. On "준비" the in-flight process is persisted exactly where it stopped; after 10 minutes of silence it resumes itself from that point. Never treat a cancelled sweep as a failed sweep — classify it as cancelled and say which shards had already completed.

## Reading a result honestly (제13장)

- Report the measured exit code and the pass/fail counts, verbatim. 미측정 상태의 완료 보고는 금지된다.
- Classify each failure before proposing a fix: **product defect** (the app is wrong) / **contract drift** (the assertion encodes a contract the app deliberately changed) / **harness artifact** (engine capability gap, priority-starved timing) / **cancelled**. The classification determines who fixes what.
- Absolute timing budgets are unreliable in this sweep: it runs at IDLE priority under contention, where WebKit has measured 3.7s–13.3s for work Chromium does in 0.2–0.4s. Prefer a ratio against a sibling panel with a generous hang ceiling over a fixed millisecond budget, and never "fix" a red by loosening an assertion until it can no longer fail. Mutation-test the fix: prove the branch still executes and can still go red.
- A cross-engine assertion must detect engine capability (`CSS.supports`) rather than assume every engine implements the property.
- Playwright `glob` patterns here resolve against `baseURL`; use a `RegExp` when matching a path.

## Acceptance promotion

A queued mission is promoted to `done` only when every entry in its `acceptance` array has shown EXIT 0 **and** the three-engine sweep has completed on a new `BUILD_ID@HEAD`. Until then it stays `in-progress`, however finished the code looks (제13장 · 제15장 비동기 큐 전면 자율 인계).

## Chapter map

v41.0 제4·6·9·13·15·16장: 제4장 단일 절대 지배 에이전트, 제6장 초제로핸즈(검증을 창립자의 수동 실행에 의존시키지 않는다), 제9장 PC·모바일·태블릿·인앱 브라우저·standalone APP에서 1픽셀의 오차도 0, 제13장 Fail-Closed EXIT 0 증명과 [최종 완결 종합 보고서], 제15장 3단계 스마트 검증과 "준비" 절대 일시정지, 제16장 라이브 DB 절대 동기화와 `next`/`ok` 승인 — 가짜 데이터로 초록을 만든 테스트는 통과로 세지 않는다.

Report the tier chosen, the exact command run, the measured output, and the failure classification. Do not edit application code in this lens; propose the fix and hand it back.
