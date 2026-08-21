# THE UNITAS GLOBAL workspace

Before implementation, consult `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md` for the workspace operational baseline and distinguish user-supplied business claims from repository-verified contracts.

## Delivery protocol

Every implementation task must follow this order:

1. Inspect the owning file and nearby test.
2. Make the smallest focused edit.
3. Run the narrowest executable validation.
4. Run `npm run build:pages` when module/catalog files change.
5. Run `npm test` before declaring the task complete.
6. Deploy only through the checked-in scripts and GitHub Actions.

## Architecture

- `index.html` is the public browser entry point.
- `config/modules.json` is the source of truth for revenue module pages and Stripe module names.
- `pages/` is generated output. Do not hand-edit generated module pages.
- Stripe secret keys and Price IDs are server-side Supabase secrets only.
- Browser code may use only the Supabase URL and anon key.
- Checkout requests send a module name to `create-checkout-session`; never accept a client-supplied amount or Price ID.

## Agent collaboration

- Copilot owns integration and final validation.
- Claude Code is used for implementation review and risk analysis through `scripts/agent-review.ps1`.
- Gemini is used for independent UX/content review through `scripts/agent-review.ps1`.
- Agents must not print or commit API keys, access tokens, or `.env` contents.
- If an external agent CLI is unavailable, report it and continue with local validation.
