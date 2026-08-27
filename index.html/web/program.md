# UNITAS Autonomous Research Program

**Status:** active protocol, invoked on demand — not a standing background process.
**Invoked via:** the `autonomous-research` skill (`.claude/skills/autonomous-research/SKILL.md`).
**Scope:** `/web` only. Never touches the legacy root static site.

## Purpose

This document specifies how Claude conducts a self-directed research cycle inside this
codebase — for building themed interactive modules (quiz, battle, simulation, animation,
game, effects), diagnosing a bug, or improving something that has no single obvious fix.
It is modeled on the tight, empirical iteration loop associated with serious ML research
practice (the style popularized by researchers like Andrej Karpathy): don't theorize in
the abstract — form a concrete, falsifiable claim, make the smallest change that tests it,
measure the result against a real gate, write down what happened, and only then decide
whether to keep it. No step is skipped, and no claim is treated as true until measured.

This is a *protocol*, not a vibe. Every cycle produces a log entry in
[`research-log.md`](research-log.md) that a future session (or a human) can read to see
exactly what was tried, why, and what happened — the same append-only, never-edit-history
discipline this repo already uses for `coin_ledger` (see root `CLAUDE.md`).

## The five phases

1. **Observe** — Read the actual current state of the relevant code before proposing
   anything. Use `Grep`/`Glob` narrowly (per `CLAUDE.md`'s Low-Memory Armor rules); do not
   re-derive context already sitting in `memory/` or `CLAUDE.md`. State what you found.

2. **Hypothesize** — Write one sentence of the form: "If I change X, then Y will happen,
   because Z." It must be falsifiable — a phase-4 measurement must be able to prove it
   wrong. Vague hypotheses ("this should improve performance") are not admissible; name
   the metric or check that would move.

3. **Experiment** — Make the smallest reversible change that tests the hypothesis. One
   variable at a time. Prefer a change you could `git diff` and understand in ten seconds
   over a sweeping rewrite — a rejected big change is expensive to unwind, a rejected small
   one is a one-line revert.

4. **Measure** — Run the verification gate (below) against the change. This is the step
   that turns a guess into a result. A hypothesis that hasn't been run through the gate is
   still just a hypothesis, not a finding.

5. **Log & decide** — Append one entry to `research-log.md` (template below) recording the
   hypothesis, what was actually done, the gate's result, and the decision: **kept**
   (verified, left in place), **reverted** (falsified or broke the gate, change undone and
   why), or **escalated** (gate passed but the result needs a human judgment call the
   protocol can't make — e.g. a design tradeoff, a scope question). Never edit or delete a
   prior log entry; a correction is a new entry.

## Verification gate

Exact commands, run from repo root, in order. All must pass before a change can be logged
as **kept**:

```bash
npm --prefix web run typecheck
npm --prefix web run build
```

If the change touches user-visible UI/interaction (not just logic/types), add a targeted
check via the Playwright MCP plugin (`playwright@claude-plugins-official`, already
installed at user scope) — navigate to the affected route and confirm the element/flow
renders and responds as hypothesized. This is an on-demand browser session driven through
the MCP tool for this one check, not an installed `@playwright/test` dependency in `/web`
and not a long-lived watcher — both are ruled out by `CLAUDE.md`'s Low-Memory Armor
section. Close out the check when done; nothing from this step should be left running.

No new gate step may be added silently. If a cycle needs a check beyond these two/three,
say so in the log entry rather than inventing an ad hoc pass/fail call.

## Self-correction bounds

When the gate fails, this is signal, not failure of the protocol — diagnose the actual
error output and revise the hypothesis or the experiment, then re-run the gate. This may
repeat, but is bounded:

- **Max 3 attempts** per hypothesis before stopping and logging as **reverted** with the
  last error attached. A fourth blind retry on the same hypothesis is not permitted —
  either the hypothesis was wrong, or the question needs to be escalated instead of
  guessed at again.
- Each retry must change something about the approach based on what the gate's error
  actually said. Re-running the identical change hoping for a different result is not a
  retry, it's a stall.
- A change is never left in a half-applied, gate-failing state at the end of a cycle.
  Failing the bound means revert to the last known-good state, then log.

## Hard constraints (inherited from root `CLAUDE.md` — this protocol cannot override them)

- TypeScript-only under `/web`; never introduce a `.js`/`.jsx` file here.
- Never write `wallets.balance` directly, never touch `coin_ledger` history in place, and
  never grant coin-spend without going through `spend_coins()` — see the Zero-Trust and
  U-Coin ledger sections of `CLAUDE.md` before any experiment near billing/auth.
- New Supabase schema changes are new, additively-timestamped migration files — never an
  edit to an already-written migration, pre- or post-apply.
- No long-lived watcher/dev process left running as a side effect of a cycle (`next dev`,
  `tsc --watch`, a Playwright session held open). Start it, check it, stop it, same turn.
- All six locale files (`web/messages/{en,es,et,ja,ko,zh}.json`) move together — a cycle
  that adds UI copy is not "kept" until every locale has a real translation, not a copy of
  the English string.
- This protocol does not commit or push. Staging/commit/push for `/web` changes is handled
  by the repository's existing Stop hook (`.claude/settings.json`) exactly as it already
  does for every other turn — a research cycle does not add, remove, or route around that
  behavior, and does not invoke deploy/push commands on its own.

## Log entry template

Append to `research-log.md`, most recent entry last:

```markdown
## YYYY-MM-DD — <short title>

**Hypothesis:** If I change X, then Y, because Z.
**Experiment:** <what was actually changed — file(s), one-line description>
**Gate result:** typecheck <pass/fail> · build <pass/fail> · (playwright check, if run: pass/fail/n-a)
**Attempts:** <1-3>
**Decision:** kept | reverted | escalated
**Notes:** <why — especially if reverted or escalated>
```

## Future scope — business-automation governance (design only, not implemented)

The owner has asked for this to stay at the design level for now: no lead-scraping,
marketing, or brief-generation code is written under this heading yet.

The intended shape, for when that changes: business-automation tasks would run through
this exact same five-phase protocol and the same gate — a "hypothesis" for a growth task
looks like "if I generate N outreach briefs from source X, conversion signal Y should move"
— logged to a separate `web/research-log-business.md` so technical and business cycles
stay legible independently. The governance boundary is the gate itself: no automation
cycle in this category is allowed to reach an external system (send an email, post to a
lead source, publish anything) without that step being named explicitly in the hypothesis
and confirmed by a human before it runs — the protocol can log and recommend, but
business-automation "kept" decisions with external side effects are not self-authorizing
the way an internal code experiment's are. This mirrors the same reasoning as the
no-push constraint above: internal, reversible, locally-verifiable changes can move through
the loop autonomously; anything visible outside this repo needs a human in the loop until
asked for otherwise.
