---
name: autonomous-research
description: Runs a bounded, hypothesis-driven self-correction cycle for /web changes — observe, hypothesize, make the smallest experiment, verify against typecheck/build (and Playwright for UI), log the result, decide keep/revert/escalate. Use for building themed interactive modules (quiz, battle, simulation, animation, game, effects), non-obvious bug diagnosis, or any change worth verifying empirically rather than assuming correct. Not for trivial one-line edits or anything outside /web.
---

# Autonomous research cycle

This skill operationalizes [`web/program.md`](../../../web/program.md) — read that file first if
it hasn't been read yet this session; it is the protocol, this file is how to execute it.
Do not restate or re-derive the protocol here; follow it.

## When to invoke this

A task that has a real chance of being wrong on the first attempt and is worth verifying
before calling it done: a new interactive module, a non-obvious bug fix, a change to
shared logic (module registry, coin-gating, motion/audio wiring) with room for regressions
elsewhere. Skip it for trivial, obviously-correct edits (a copy fix, a single style tweak)
— running a 5-phase cycle on those is overhead, not rigor.

## Steps

1. **Observe.** Grep/Glob/Read only the files actually relevant to the task — do not
   sweep whole directories. State what the current behavior/code actually is before
   proposing a change.

2. **Hypothesize.** State the one-sentence falsifiable hypothesis per `program.md`
   phase 2. If you can't state what would prove this wrong, you're not ready for step 3.

3. **Experiment.** Make the smallest change via `Edit`/`Write` that tests the hypothesis.

4. **Measure — run the gate, in order, from repo root:**
   ```bash
   npm --prefix web run typecheck
   npm --prefix web run build
   ```
   If the change is UI/interaction-facing, also drive a targeted check through the
   Playwright MCP plugin (`playwright@claude-plugins-official`) against the affected
   route only — don't run a broad suite. Close the browser session when the check is
   done; nothing from this step stays running after the cycle ends.

   If a gate step fails: read the actual error, revise the hypothesis or the experiment
   to address what the error says, and re-run the gate. **Hard cap: 3 attempts total**
   for one hypothesis. On the 3rd failure, revert the change to the last known-good state
   and log the cycle as `reverted` — do not attempt a 4th variation.

5. **Log.** Append one entry to `web/research-log.md` using the template in
   `program.md` (create the file with a one-line header if it doesn't exist yet).
   Never edit or delete a prior entry — corrections are new entries.

## Hard limits (do not override, even under a compelling reason mid-cycle)

- No `git commit` / `git push` / deploy command is ever run by this skill. The repo's
  existing Stop hook owns checkpointing for `/web` changes; this skill only edits files
  and runs local verification.
- No long-lived process is left running at the end of a cycle — no `next dev`,
  `tsc --watch`, or open Playwright session survives past the cycle that started it.
- All locale files move together for any UI-copy change (`en`, `es`, `et`, `ja`, `ko`,
  `zh` under `web/messages/`) — a cycle isn't `kept` until every locale has a real
  translation.
- Never write `wallets.balance` directly or bypass `spend_coins()` — see root
  `CLAUDE.md`'s U-Coin ledger section before any experiment near billing.
- Stop at 3 gate-failure attempts per hypothesis. Escalate to the user instead of guessing
  a 4th time.
