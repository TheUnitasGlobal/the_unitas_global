# Workspace Context: THE UNITAS GLOBAL

Always consult the repository root `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md` for the operational baseline. The root archive distinguishes user-supplied enterprise claims from repository-verified implementation contracts.

Core invariants:

- `config/modules.json` owns the revenue module catalog.
- Checkout sends only an allowed module name to `create-checkout-session`.
- Never expose Stripe secrets or Price IDs to browser code.
- Preserve the 40-language selector and global LTR UI baseline.
- Run focused tests first, then `npm test` before completion.
- Treat U-Pay and Gaia-Tax as named protocols/modules unless a verified implementation is added to the catalog and server contract.
