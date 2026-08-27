# Module spec: <name>

Fill in every field before wiring this into `web/lib/ecosystems.ts` or
`web/lib/modules.ts`. See `modules/README.md` for the full checklist.

## Catalog entry

| Field        | Value | Notes |
|--------------|-------|-------|
| `key`        |       | lowercase, matches route folder name |
| `route`      |       | usually same as `key` |
| `messageKey` |       | i18n namespace key, must exist in all 6 `web/messages/*.json` files |
| `coinCost`   |       | integer, 1 U-Coin = 1 EUR, keep 1-5 for accessibility (see `web/lib/currency.ts`) |
| `color`      |       | hex, primary theme accent |
| `glow`       |       | hex, secondary glow/highlight |
| `sfx`        |       | key into the audio engine's per-module SFX presets |

## Route

- `web/app/[locale]/<key>/page.tsx`
- Engine needed (see `universal-app-engine` skill's selection matrix):
  GSAP / Matter.js / R3F / none — pick one, don't default to R3F for
  everything.

## Coin gating

- What action inside this module spends coins, and how much?
- Confirm it calls `spend_coins(p_module, p_amount)` — never a direct
  `wallets.balance` write.
- Does entry require a paid check on direct navigation (module pages
  currently do **not** re-verify payment on direct nav — see the known-gaps
  note in `CLAUDE.md`)? If this module needs that guarantee, say so
  explicitly rather than silently assuming the entry-modal gate is enough.

## i18n

- [ ] en
- [ ] ko
- [ ] ja
- [ ] zh
- [ ] es
- [ ] et

## Open questions

<!-- anything still undecided before this goes from spec to real code -->
