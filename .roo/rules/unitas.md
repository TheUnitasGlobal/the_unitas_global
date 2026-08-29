# THE UNITAS GLOBAL Roo Code rules

- **`.roo/rules/unitas-constitution.md`의 최상위 운영 헌법이 이 파일보다 상위다.** 충돌 시 헌법이 우선한다.
- Read `.github/copilot-instructions.md` before implementation.
- `index.html` is the browser entry point.
- `config/modules.json` owns the revenue module catalog.
- Run `npm run build:pages` after catalog changes.
- Run `npm test` before completion.
- Use `npm run release` for the unified release path.
- Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `PRICE_ID_*` in browser code.
- Do not hand-edit generated files under `pages/` or `site-dist/`.
- Keep API keys in environment variables or VS Code secret storage only.
- Module access is gated by coin balance (`spend_coins` RPC), not Stripe subscriptions. `create-checkout-session`/`public.subscriptions` are deprecated and dormant — do not wire new UI to them.
- New coin purchases go through `create-coin-checkout-session` (one-time Stripe payment); never let the browser dictate a coin amount or Price ID.
