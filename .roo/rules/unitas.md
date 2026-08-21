# THE UNITAS GLOBAL Roo Code rules

- Read `.github/copilot-instructions.md` before implementation.
- `index.html` is the browser entry point.
- `config/modules.json` owns the revenue module catalog.
- Run `npm run build:pages` after catalog changes.
- Run `npm test` before completion.
- Use `npm run release` for the unified release path.
- Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `PRICE_ID_*` in browser code.
- Do not hand-edit generated files under `pages/` or `site-dist/`.
- Keep API keys in environment variables or VS Code secret storage only.
