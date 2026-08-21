# THE UNITAS GLOBAL MASTER ARCHIVE

Status: workspace operational baseline
Last synchronized: 2026-08-21

This archive consolidates business and technical parameters explicitly supplied in the current workspace conversation and the locally indexed sessions available to Copilot. It is an operational reference, not a legal opinion, government filing, patent status determination, or source of payment secrets.

## Enterprise Identity

- Corporate identity: THE UNITAS GLOBAL OÜ
- Jurisdiction: Estonia
- Registry code: 17479878 (user-supplied; verify against the official Estonian registry before relying on it)
- Address: Sepapaja tn 6, Tallinn (user-supplied; verify before publication)

## Intellectual Property And Protocols

- USPTO reference: Patent Pending #64/023,911 (user-supplied; do not represent as granted)
- U-Signature Protocol (user-supplied proprietary protocol name)
- Sovereign Codex 22 System (user-supplied system name)
- Named modules supplied across sessions: Arche, Arena, Score, Fate, Codex22, U-Pay, Gaia-Tax
- Complete 22-module roster: not present in the locally available session history or repository catalog; do not invent missing module names

## Verified Repository Contracts

- Browser entry point: `index.html`
- Revenue catalog source of truth: `config/modules.json`
- Current catalog modules: Arche, Arena, Score, Fate, Codex22
- Generated revenue pages: `pages/`; regenerate with `npm run build:pages`
- Checkout Edge Function: `create-checkout-session`
- Browser checkout payload: `{ "module": "<allowed module name>" }`
- Client must never send a Stripe Price ID or amount
- Stripe secret keys, webhook secrets, and Price IDs remain server-side Supabase secrets
- Supabase browser configuration may contain only the project URL and anon key
- Playwright is configured through `playwright.config.js` and `@playwright/test`
- Supabase CLI is available through the checked-in npm dependency
- Local checkout fixture/server is isolated from production: `tests/fixtures/stripe-checkout-session.json` and `scripts/mock-checkout-server.mjs`

## Localization Baseline

- Supported language codes: en, ko, ja, zh, km, es, pt, fr, de, ar, ru, hi, vi, id, it, tr, th, nl, pl, uk, sv, ro, hu, cs, el, da, fi, no, sw, ha, am, yo, zu, ig, ff, so, qu, gn, ay, om
- Selector labels use code plus native/local name
- Workspace UI direction baseline: LTR for every locale
- Arabic and other locale content must not force global RTL layout
- Existing authored translations are preserved; explicit fallback locale objects are allowed where a full translation is not yet authored

## Agent And Automation Baseline

- Copilot owns integration and final validation
- Claude and Gemini reviews run through `scripts/agent-review.ps1` when their CLIs are available
- Continue configuration: `.continue/config.yaml`
- Roo rules: `.roo/rules/unitas.md`
- Project-local toolkit manifest: `config/agent-toolkit.json`
- Project agent skills: `.agents/skills/`
- Local source tool checkouts: `.agent-tools/` (ignored by Git)
- Agent setup: `npm run setup:agents -- -InstallProjectSkills`
- Never print, commit, or embed API keys, access tokens, `.env` contents, Stripe secrets, or Price IDs

## Fiscal And Automation Rules

- U-Pay is a user-supplied protocol name. The verified implementation is the authenticated Supabase `create-checkout-session` function backed by the server-side Stripe catalog.
- Gaia-Tax is a user-supplied module/protocol name. No corresponding module or endpoint is currently present in `config/modules.json` or the Supabase functions directory.
- Zero-cost automation means local tests, mock checkout fixtures, and local agent tooling only. It does not make production Stripe billing, hosted AI services, cloud sync, or legal services free.
- Production deployment remains gated by configured Supabase project secrets and the checked-in deployment scripts.

## Synchronization Sources

- Current workspace files and tests
- `.github/copilot-instructions.md`
- `.continue/config.yaml`
- `.roo/rules/unitas.md`
- Locally indexed sessions for this workspace, including sessions updated 2026-08-20 and 2026-08-21
- User-provided Multi-Chat Omni-Sync attachment

## Change Control

Changes to this archive must preserve the distinction between user-supplied business claims, repository-verified implementation contracts, and unresolved requirements. Any new revenue module must first be added to `config/modules.json`, then generated with `npm run build:pages`, tested, and wired to a server-side price lookup.
