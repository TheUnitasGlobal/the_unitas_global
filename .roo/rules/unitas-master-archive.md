# THE UNITAS GLOBAL Master Archive Rule

Before changing business, localization, automation, Supabase, or Stripe behavior, consult `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md` at the repository root.

The archive is an operational baseline, not a legal or payment secret store. Preserve these invariants:

- `config/modules.json` is the source of truth for revenue modules.
- Browser checkout sends only a module name to `create-checkout-session`.
- Stripe secrets and Price IDs stay in Supabase secrets.
- Keep the 40 supported language codes and global LTR layout contract.
- Do not invent missing Sovereign Codex 22 module names.
- Validate narrowly, then run the repository test command before completion.
