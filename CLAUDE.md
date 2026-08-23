# UNITAS — Sovereign Ecosystem

Two codebases live in this repo. Know which one you're touching before you edit:

- **`/web`** — the active Next.js 14 (App Router) + Supabase app. TypeScript, Tailwind, next-intl (6 locales), Framer Motion, R3F. This is where all new feature work happens.
- **repo root** (`index.html`, `assets/`, `pages/`, `scripts/build-pages.mjs`) — the legacy static site. Read-only unless a task explicitly targets it; do not port static-site patterns into `/web` or vice versa.

## TypeScript-only

All application code under `/web` is TypeScript (`.ts`/`.tsx`). Never add a `.js`/`.jsx` file to `/web` — if a tool or config file conflicts with this, convert it rather than adding a JS sibling. The legacy root site is vanilla JS and stays that way; it is not being migrated.

## Zero-Trust identity: 1 person = 1 account

Enforced in Postgres, not the client (see `supabase/migrations/20260823000000_zero_trust_identity.sql`):

- `profiles.phone_verified` can only flip to `true` via the `handle_phone_verified()` trigger firing off Supabase Auth's own `auth.users.phone_confirmed_at` — never a direct client PATCH (`protect_profile_identity()` reverts any top-level client attempt).
- A verified phone number is unique across all non-deleted profiles (`profiles_phone_verified_unique_idx`). Unverified/null phones don't collide, so signup isn't blocked before verification.
- `spend_coins()` refuses to run for any account with `phone_verified = false`. Any new coin-spending path must call `spend_coins()` (or a function with the same guard) — never debit `wallets.balance` directly from application code.
- Soft delete (`profiles.deleted_at`) anonymizes and excludes the row from the uniqueness index, so the phone number can be legitimately re-registered later. Never hard-delete a profile with ledger history — `coin_ledger` rows reference it and must survive as an audit trail.

## U-Coin ledger audit compliance

`public.wallets` + `public.coin_ledger` (`supabase/migrations/20260828000000_wallets_and_ledger.sql`) are the only source of truth for balances. Rules that must hold for every change in this area:

- **Never write `wallets.balance` directly.** All debits go through `spend_coins(p_module, p_amount)`, all credits through `credit_coins(p_user_id, p_amount, p_stripe_payment_intent_id)`. Both are `SECURITY DEFINER`, both append a `coin_ledger` row in the same transaction as the balance change — that pairing is the audit trail. A balance change with no matching ledger row is a bug.
- `coin_ledger` is append-only. Never `UPDATE` or `DELETE` a ledger row; corrections are new rows (`kind = 'refund'`, etc.), never edits to history.
- The `module` check constraint on `coin_ledger` and the whitelist inside `spend_coins()` must stay in sync — extending one without the other breaks either legitimate spends or the audit trail's referential meaning. Add new modules via a new migration (see the "additive migrations" note below), not by editing `spend_coins()` in place inside an already-applied file.
- `credit_coins()` is `service_role`-only (webhook path) and idempotent on `stripe_payment_intent_id` — don't relax either constraint when touching payments.

## Migrations

Every file under `supabase/migrations/` in this repo carries a "NOT YET APPLIED" header — none has been run against the live project yet. Keep it that way until told otherwise: **new changes get a new, additively-timestamped migration file**, never an edit to an existing one, even pre-apply. This keeps the sequence replayable and matches the convention already established across the existing files.

## Session hygiene / token efficiency

- Don't re-read a file you just wrote or edited — the tool result already confirms the change.
- Prefer `Grep`/`Glob` over reading whole directories when you only need one symbol or file.
- Run `/compact` proactively once a task's exploration phase is done and you're moving into pure editing — there's no reason to carry full file dumps from the research phase into a long implementation phase. `.claude/settings.json` also sets `autoCompactEnabled`/`autoCompactWindow` low so this happens automatically even if it isn't triggered manually.
- This repo already has a rich, existing design system (motion/glow card shells, coin-gated entry modals, the 11-ecosystem + 5-module catalogs in `web/lib/ecosystems.ts` / `web/lib/modules.ts`). Read the closest existing analogous component before building a new one from scratch.
- Long-term project context lives in this session's auto-memory (the `memory/` directory + `MEMORY.md` index), not a separate "claude-mem" MCP server — that memory system already is the persistent-context mechanism for this project; there is nothing extra to install.

## Low-Memory Armor (this is a low-spec dev machine)

- **Never start a long-lived watcher/dev process and leave it running unasked.** `next dev`, `tsc --watch`, `playwright test --ui`, etc. hold a Node process and a file watcher open indefinitely — each one is real, ongoing RAM/CPU pressure on a low-spec machine, not a one-time cost. Run one-shot commands (`next build`, `tsc --noEmit`, a single `playwright test` run) to verify work; if a dev server is genuinely needed to check a UI change, start it, do the check, and stop it again in the same turn rather than leaving it backgrounded.
- **Read narrowly.** Use `Grep`/`Glob` to find the right file and read only the relevant range (`offset`/`limit`) instead of ingesting whole directories or every file in a feature area "to be safe." This repo's memory files and CLAUDE.md exist so you don't need to re-derive context by re-reading everything each session.
- `.vscode/settings.json` caps `NODE_OPTIONS=--max-old-space-size=3072` for integrated-terminal processes and `typescript.tsserver.maxTsServerMemory` for the TS language server, and excludes `node_modules`/`.next`/`site-dist`/`test-results` from the file watcher and search indexer. Don't remove these to "fix" a false-positive missing-file issue — fix the underlying path instead.
- `web/next.config.mjs` is tuned for constrained memory (build worker, trimmed `onDemandEntries` buffer, disabled webpack cache in production builds, capped `cacheMaxMemorySize`). If a future Next.js upgrade adds `experimental.webpackMemoryOptimizations` (Next.js ≥ 15 only — this repo is on 14.2.x, confirmed via Context7, so it is *not* set here), that's the next lever to pull, not a webpack config rewrite.

## Automated git sync + lightweight self-healing gate (Stop hook)

`.claude/settings.json` runs this on every Stop event (whenever Claude Code finishes a turn) — by owner request, so work is durably checkpointed without a low-spec machine accumulating a large uncommitted working tree:

```bash
if [ -n "$(git status --porcelain -- web)" ]; then npm --prefix web run typecheck && npm --prefix web run build || exit 1; fi
git add . && git commit -m "feat: automated low-memory sovereign checkpoint sync" && git push origin main
```

This is the "automated UI error detection" layer, deliberately kept lightweight per owner decision 2026-08-23: **no Playwright / browser automation** was added for this (would pull in 100s of MB of browser binaries into `/web`, which directly fights the Low-Memory Armor goals above — root already has `@playwright/test`, but wired only to the legacy static site, not `/web`). Instead the gate is exactly `tsc --noEmit` + `next build`, which catches type errors, broken imports, and render-breaking mistakes across all 6 locales without installing anything new.

How it behaves:

- Only runs the verify step when `web/` actually has pending changes (`git status --porcelain -- web`) — a turn that only touched root/docs skips straight to commit, so the heavy `next build` isn't paid for turns that don't need it.
- **Fails closed**: if typecheck or build fails, `exit 1` stops the script before `git add`/`commit`/`push` ever run. Broken `/web` code cannot reach `origin/main` through this path — it's left uncommitted in the working tree for the next turn to fix.
- It is *detection*, not *auto-fix*: nothing in this hook edits code on failure. A standing "detect and automatically retry a fix" loop is a different, heavier kind of automation (perpetual background agent) that hasn't been requested — ask explicitly (e.g. via `/loop`) if that's wanted later.
- No-ops safely when there's nothing to commit (the trailing `&&` chain stops at the failed `git commit`).
- Every turn that changes `web/` now costs one `next build` (last measured: tens of seconds, 124 static pages/6 locales) in exchange for the push-safety guarantee above — this is a deliberate low-spec tradeoff (a slow verify beats a broken deploy), not an oversight.
- To disable: remove the `hooks.Stop` entry in `.claude/settings.json`, or ask Claude Code to do it.

## Known gaps (intentionally out of scope unless a task names them)

- Module pages do not currently re-verify that a visitor actually paid before rendering paid content on direct navigation (the coin spend happens in the entry modal, not as page-level middleware). Documented, not silently papered over — see the caveat comment in `20260828000000_wallets_and_ledger.sql`.
- i18n coverage for newly-added UI copy should extend to all six locales in `web/messages/*.json` (en, es, et, ja, ko, zh) in the same pass that adds the English strings — don't leave a locale file behind a key.
