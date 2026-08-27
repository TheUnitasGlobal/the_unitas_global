# UNITAS — Sovereign Ecosystem

Two codebases live in this repo. Know which one you're touching before you edit:

- **`/web`** — the active Next.js 14 (App Router) + Supabase app. TypeScript, Tailwind, next-intl (6 locales), Framer Motion, R3F. This is where all new feature work happens.
- **repo root** (`index.html`, `assets/`, `pages/`, `scripts/build-pages.mjs`) — the legacy static site. Read-only unless a task explicitly targets it; do not port static-site patterns into `/web` or vice versa.

## Output language & standing approval protocol (owner instruction 2026-08-26)

- **All conversational output to the user** — result reports, explanations, guidance, status messages — **must be 100% Korean**, with the sole exceptions of source code, command syntax, file paths, and technical proper nouns (library/tool/service names), which stay untranslated. Zero exceptions, no reverting to English after long gaps or context resets. See also the `feedback-respond-in-korean` memory (auto-memory `MEMORY.md` index).
- **Bare "ok"/"OK" as standing pipeline authorization**: when Claude Code asks a commit/deploy-readiness question (e.g. "커밋 및 배포를 진행할까요?") and the user's entire reply is just "ok" or "OK" with nothing else, that is a blanket approval to run the full chain autonomously and without pausing to ask again: `npm --prefix web run typecheck` → `npm --prefix web run build` (fail-closed — stop and report in Korean on any failure, do not proceed past it) → `git add` → `git commit` → `git push origin main` → Vercel production deploy (`vercel --prod`).
  - **Permission-layer note**: as of owner decision 2026-08-26, `.claude/settings.json`'s `permissions.allow` list already includes `Bash(git push*)` and `Bash(vercel --prod*)` (moved out of `ask`), so the harness itself no longer shows a separate approval popup for these commands — the owner explicitly chose this over leaving them in `ask`, understanding it applies to *all* future invocations of these commands, not just ones following "ok" (the permission engine matches on command pattern only, with no concept of preceding chat text). A broad substring wildcard `Bash(*deploy*)` was briefly added alongside these and then removed the same day (2026-08-26) after an automated security review flagged it as an unanchored substring match that could bypass approval for *any* command merely containing the word "deploy" anywhere, regardless of what it actually did — well beyond what the owner authorized. The pipeline only ever needs `vercel --prod`, so the narrower, anchored `Bash(vercel --prod*)` covers the real use case without the bypass risk. `git push --force*`/`-f*` stay in `deny` regardless. Given this, the "ok" rule above is now the *only* checkpoint before a push/deploy actually runs — treat it accordingly and don't fire the chain speculatively without that explicit word.

## TypeScript-only

All application code under `/web` is TypeScript (`.ts`/`.tsx`). Never add a `.js`/`.jsx` file to `/web` — if a tool or config file conflicts with this, convert it rather than adding a JS sibling. The legacy root site is vanilla JS and stays that way; it is not being migrated.

## Cross-archiving guide (legacy root ↔ /web)

Extends the root/`/web` split above. When a legacy asset (image, copy, animation pattern) is ported into `/web`:

- **Copy, never link.** Duplicate the file into `web/public/` (or reimplement the pattern as a typed component) — never `import`/symlink/reference a path back into the repo root. The two codebases must be able to diverge without either breaking the other.
- **Never delete or modify the legacy original.** Root stays read-only (see top of this file); a port is an addition, not a migration. The legacy file remains the historical/brand source of truth even after `/web` has its own copy.
- **Record lineage at the port site.** Add a one-line comment at the top of the new `/web` file naming the legacy source path (e.g. `// ported from /assets/logo-glow.png`) so a future audit can trace which `/web` assets originated from the legacy site without diffing two trees by hand.
- **Reimplement, don't transliterate.** Legacy vanilla-JS DOM patterns get rewritten idiomatically in TypeScript/React per the TypeScript-only rule above — never pasted in as inline scripts or `dangerouslySetInnerHTML`.

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

## Cryptographic ownership & metadata integrity

Single source of truth for "which modules exist," plus tamper-evidence for what actually ships, live in `/web`:

- **`web/lib/module-registry.ts`** aggregates the pre-existing typed catalogs (`ecosystems.ts`'s 11 ecosystems, `modules.ts`'s 5 B2C + 3 B2B modules) additively into one `MODULE_REGISTRY` list — neither source catalog is replaced.
- **`web/scripts/validate-module-registry.mjs`** runs as `prebuild` (so on every `next build`, and therefore every Stop-hook checkpoint that touches `web/`): fails closed if a registered module has no matching `app/[locale]/<route>` folder, or vice versa. Keeps the catalog and the routed app from silently drifting apart as modules are added.
- **`web/scripts/ownership-fingerprint.mjs`** runs as `postbuild`: hashes every file under `public/` (SHA-256), aggregates them into one build fingerprint, and writes `public/ownership-manifest.json` with THE UNITAS GLOBAL OÜ's ownership/license metadata, the source git commit, and a timestamp. Deliberately metadata-only, not a visible watermark (croppable/bypassable and hurts the product's aesthetics).
- **`web/scripts/verify-integrity.mjs`** (`npm run verify:integrity`) re-derives the same aggregate hash over a *deployed* `public/` and compares it against the committed manifest — a mismatch or missing manifest means the artifact was modified outside the build pipeline. Deliberately **not** wired into pre/postbuild: running it in the same pass that just regenerated the manifest would always trivially pass and prove nothing. Run it manually or from CI against a live deploy.
- **`web/middleware.ts`** sets `X-Unitas-Owner` / `X-Unitas-License` response headers on every page navigation the matcher allows through — the page-navigation complement to the manifest's static-asset coverage.
- **"Real-time sync" in practice**: because `prebuild`/`postbuild` run inside `npm --prefix web run build`, which the Stop hook already runs on every turn that changes `web/`, the registry validation and ownership fingerprint are regenerated and checked at every checkpoint sync automatically — no separate cron or watcher needed. `verify:integrity` stays a distinct, manual/CI-triggered check against what's actually live, by design (see above).

## Module-level test isolation

`vitest` (`web/vitest.config.ts`) is the test runner, added specifically so each module's tests run isolated from every other module's:

- One test file per module/concern under `web/__tests__/<area>/<name>.test.ts` (e.g. `__tests__/modules/module-registry.test.ts`). Never share mutable fixtures or mocks across files — vitest's default per-file worker isolation (`test.isolate`, left at its default `true`) means a bug or a broken mock in one module's test can't cascade into another's.
- `npm --prefix web run test` (`vitest run`) executes the suite once and exits — no watch mode, per the Low-Memory Armor rule against long-lived processes.
- **Deliberately not wired into the Stop hook.** The hook's gate is `tsc --noEmit` + `next build` only (see below); adding the test suite there would tax every single checkpoint turn, not just ones touching tested code. Run `npm --prefix web run test` by hand (or from CI) when changing a module that has tests — the Stop hook stays the fast fail-closed gate it was designed to be, not a full CI pipeline.
- New modules should get a registry-shape test at minimum (uniqueness of `key`/`route`, correct `coinGated` per tier) following the `module-registry.test.ts` pattern — deeper per-module tests (business logic, Supabase interaction mocks) are added as that module's logic grows, not speculatively upfront.

## Session hygiene / token efficiency

- Don't re-read a file you just wrote or edited — the tool result already confirms the change.
- Prefer `Grep`/`Glob` over reading whole directories when you only need one symbol or file.
- Run `/compact` proactively once a task's exploration phase is done and you're moving into pure editing — there's no reason to carry full file dumps from the research phase into a long implementation phase. `.claude/settings.json` sets `autoCompactEnabled`/`autoCompactWindow: 70000` so this happens automatically even if it isn't triggered manually (this is summarize-and-continue, the same shape as aider's `max-chat-history-tokens`, mirrored at the same 70000 value in `.aider.conf.yml` for dual-engine parity — see below).
- **`/clear` is a manual habit, not an automatable one, on either engine.** Neither Claude Code's hook system (discrete events only — PreToolUse, PostToolUse, Stop, etc., none of them "token count crossed N") nor aider's config schema exposes a trigger that fires a full context wipe at a token threshold — confirmed via Context7 for aider-ai/aider v0.86.2. Run `/clear` yourself (not `/compact`) when a work unit is genuinely done and the next task doesn't need this one's history — end of a feature, after a Stop-hook checkpoint lands, or when a session has drifted across several unrelated asks. `/compact`/auto-compact keep a summary; `/clear` doesn't — reach for it at a real milestone boundary, not mid-task.
- This repo already has a rich, existing design system (motion/glow card shells, coin-gated entry modals, the 11-ecosystem + 5-module catalogs in `web/lib/ecosystems.ts` / `web/lib/modules.ts`). Read the closest existing analogous component before building a new one from scratch.
- Long-term project context lives in this session's auto-memory (the `memory/` directory + `MEMORY.md` index), not a separate "claude-mem" MCP server — that memory system already is the persistent-context mechanism for this project; there is nothing extra to install.
- **Dual-engine parity (aider fallback):** `.aider.conf.yml` (repo root, gitignored via `.aider*`) is aider's config when it runs as the backup executor for whenever Claude Code itself is unavailable. It already loads this file (`read: [CLAUDE.md]`) so the constitution above — zero-capital 1-person automation, zero-compromise principles, sovereign SaaS philosophy, every rule in this document — applies there too without duplication. It also mirrors the Stop hook's fail-closed gate (`auto-commits: false`, `dirty-commits: false`, `auto-lint`/`auto-test` wired to the same `typecheck`/`build` commands, same order). One real gap: aider has no config-level timeout for that lint/test gate (its `timeout:` key only bounds LLM API calls, not local subprocesses) — documented as a limitation in the file itself rather than faked. Any future change to the Stop hook's gate commands or philosophy must be mirrored into `.aider.conf.yml` by hand in the same pass — it can't be, since aider ignores everything outside its own YAML except CLAUDE.md.
- **Agent context hygiene automation (owner-named supplementary task, 2026-08-26):** two harness-level mechanisms already deliver this without extra setup — (1) deferred tool schemas (`ToolSearch`) keep MCP/Playwright/etc. tool definitions out of context until a task actually needs them, so a session that never touches Playwright never pays for its schema; (2) delegate open-ended exploration spanning more than ~3 searches to the `Explore` subagent instead of reading files directly in the main thread — its reads/greps don't bloat the primary session's context, only its final report does. Neither needs configuring; the discipline is choosing to use them.
- Stop-hook checkpoint commits intentionally use one fixed, generic message (`feat: automated low-memory sovereign checkpoint sync`) rather than a per-turn generated summary — writing a bespoke message would require diffing and summarizing the change first, spending context on every single turn purely for a commit-log entry that `git log`/`git show` can already answer on demand.

## Low-Memory Armor (this is a low-spec dev machine)

- **Never start a long-lived watcher/dev process and leave it running unasked.** `next dev`, `tsc --watch`, `playwright test --ui`, etc. hold a Node process and a file watcher open indefinitely — each one is real, ongoing RAM/CPU pressure on a low-spec machine, not a one-time cost. Run one-shot commands (`next build`, `tsc --noEmit`, a single `playwright test` run) to verify work; if a dev server is genuinely needed to check a UI change, start it, do the check, and stop it again in the same turn rather than leaving it backgrounded.
- **Read narrowly.** Use `Grep`/`Glob` to find the right file and read only the relevant range (`offset`/`limit`) instead of ingesting whole directories or every file in a feature area "to be safe." This repo's memory files and CLAUDE.md exist so you don't need to re-derive context by re-reading everything each session.
- `.vscode/settings.json` caps `NODE_OPTIONS=--max-old-space-size=3072` for integrated-terminal processes and `typescript.tsserver.maxTsServerMemory` for the TS language server, and excludes `node_modules`/`.next`/`site-dist`/`test-results` from the file watcher and search indexer. Don't remove these to "fix" a false-positive missing-file issue — fix the underlying path instead.
- `web/next.config.mjs` is tuned for constrained memory (build worker, trimmed `onDemandEntries` buffer, disabled webpack cache in production builds, capped `cacheMaxMemorySize`). If a future Next.js upgrade adds `experimental.webpackMemoryOptimizations` (Next.js ≥ 15 only — this repo is on 14.2.x, confirmed via Context7, so it is *not* set here), that's the next lever to pull, not a webpack config rewrite.

## Automated git sync + lightweight self-healing gate (Stop hook)

`.claude/settings.json` runs this on every Stop event (whenever Claude Code finishes a turn) — by owner request, so work is durably checkpointed without a low-spec machine accumulating a large uncommitted working tree:

```bash
if [ -n "$(git status --porcelain -- web)" ]; then npm --prefix web run typecheck && npm --prefix web run build || exit 1; fi
git add . && git commit -m "feat: automated low-memory sovereign checkpoint sync" && git push origin main && echo "checkpoint: $(git rev-parse --short HEAD) pushed to origin/main"
```

This is the "automated UI error detection" layer, deliberately kept lightweight per owner decision 2026-08-23: **no Playwright / browser automation** was added for this (would pull in 100s of MB of browser binaries into `/web`, which directly fights the Low-Memory Armor goals above — root already has `@playwright/test`, but wired only to the legacy static site, not `/web`). Instead the gate is exactly `tsc --noEmit` + `next build`, which catches type errors, broken imports, and render-breaking mistakes across all 6 locales without installing anything new.

How it behaves:

- Only runs the verify step when `web/` actually has pending changes (`git status --porcelain -- web`) — a turn that only touched root/docs skips straight to commit, so the heavy `next build` isn't paid for turns that don't need it.
- **Fails closed**: if typecheck or build fails, `exit 1` stops the script before `git add`/`commit`/`push` ever run. Broken `/web` code cannot reach `origin/main` through this path — it's left uncommitted in the working tree for the next turn to fix.
- It is *detection*, not *auto-fix*: nothing in this hook edits code on failure. A standing "detect and automatically retry a fix" loop is a different, heavier kind of automation (perpetual background agent) that hasn't been requested — ask explicitly (e.g. via `/loop`) if that's wanted later.
- No-ops safely when there's nothing to commit (the trailing `&&` chain stops at the failed `git commit`).
- Every turn that changes `web/` now costs one `next build` (last measured: tens of seconds, 124 static pages/6 locales) in exchange for the push-safety guarantee above — this is a deliberate low-spec tradeoff (a slow verify beats a broken deploy), not an oversight.
- After a successful push, the hook echoes `checkpoint: <short-hash> pushed to origin/main` — a truthful, shell-only confirmation line (no `/cost`/`/usage` telemetry: those are host-UI slash commands and cannot be invoked from a hook's shell command).
- To disable: remove the `hooks.Stop` entry in `.claude/settings.json`, or ask Claude Code to do it.

## Known gaps (intentionally out of scope unless a task names them)

- Module pages do not currently re-verify that a visitor actually paid before rendering paid content on direct navigation (the coin spend happens in the entry modal, not as page-level middleware). Documented, not silently papered over — see the caveat comment in `20260828000000_wallets_and_ledger.sql`.
- i18n coverage for newly-added UI copy should extend to all six locales in `web/messages/*.json` (en, es, et, ja, ko, zh) in the same pass that adds the English strings — don't leave a locale file behind a key.
