# THE UNITAS GLOBAL Master Archive Rule

Before changing business, localization, automation, Supabase, or Stripe behavior, consult `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md` at the repository root.

The archive is an operational baseline, not a legal or payment secret store. Preserve these invariants:

- `config/modules.json` is the source of truth for revenue modules (`coinCost` is the canonical per-access price).
- Module access is gated by the `spend_coins` Postgres RPC (coin balance debit), not by Stripe subscriptions. `create-checkout-session`/`public.subscriptions` are deprecated and dormant.
- Coin purchases send only a bundle name to `create-coin-checkout-session`; browser never sends a coin amount or Price ID.
- Stripe secrets and Price IDs stay in Supabase secrets.
- Keep the 40 supported language codes and global LTR layout contract.
- Do not invent missing Sovereign Codex 22 module names.
- Validate narrowly, then run the repository test command before completion.
