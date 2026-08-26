# modules/ — pre-build design staging area

This directory is **not** an npm workspace, not a package, and is never imported
by `/web`. It exists so a new ecosystem/module can be *designed and reviewed as
a spec* before it is wired into the real catalogs, avoiding a half-finished
entry landing directly in `web/lib/ecosystems.ts` / `web/lib/modules.ts`.

Root `package.json` has no `workspaces` field and `.vercel/repo.json` pins
`"directory": "web"` — introducing an actual monorepo package here would
change how Vercel resolves the build. This directory is deliberately inert:
plain Markdown specs, read by a human or a future Claude/aider session, never
built or installed.

## Adding a new module

1. Copy `modules/TEMPLATE/module.spec.md` to `modules/<key>/module.spec.md` and
   fill it in.
2. Once the spec is settled, wire it for real:
   - Add one entry to `web/lib/ecosystems.ts` (11 B2C "Live Ecosystems" catalog)
     or `web/lib/modules.ts` (5 "Live Consumer Services" catalog) — match the
     existing `EcosystemTheme`/module interface shape exactly.
   - Add the route: `web/app/[locale]/<key>/page.tsx` (flat under the locale
     segment, matching the existing `echo`, `void`, `mirror`, ... pattern).
   - Add the i18n `messageKey` to **all six** locale files under
     `web/messages/` (`en`, `es`, `et`, `ja`, `ko`, `zh`) in the same pass —
     never leave a locale behind a key.
   - Any coin-gated action in the new module calls `spend_coins()` — never
     debits `wallets.balance` directly (see the Zero-Trust/U-Coin ledger
     rules in the repo's `CLAUDE.md`).
3. Delete the now-redundant `modules/<key>/module.spec.md` once step 2 has
   shipped — it was scaffolding for the design conversation, not documentation
   to maintain long-term. The catalog file and the route are the source of
   truth after that.
