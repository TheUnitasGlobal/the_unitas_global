---
name: unitas-component
description: Rapid, v0-style generation of new UI components (cards, modals, module engines, dynamic sections) for the UNITAS /web Next.js app, matching the existing motion/glow design system exactly instead of inventing a new visual language per component.
---

# UNITAS component generation

Use this when asked to build a new card, modal, section, or interactive widget in `web/`. The goal is speed without visual drift: every new component should look like it shipped alongside the existing ones on day one.

## Before writing anything

Read the closest existing analog first — don't design from scratch:

- **Hover-tilt glow card** (grid, module, or protocol tile) → `web/components/cards/EcosystemCard.tsx`, `LiveServiceCard.tsx`, or `B2BProtocolCard.tsx`
- **Coin-gated entry / confirmation modal** → `web/components/interaction/EcosystemEntryModal.tsx` or `ModuleQuestModal.tsx`
- **Generic dialog shell** → `web/components/ui/Modal.tsx`
- **Nav / header control** → `web/components/nav/*.tsx`
- **Wallet-aware component** → consume `useWallet()` from `web/components/wallet/WalletProvider.tsx`, never fetch balance/profile another way

Copy the *structure* (props shape, effect wiring, className scaffolding) of the nearest analog, then change only what the new component actually needs to differ on (color theme, copy, icon, interaction).

## Design system tokens (non-negotiable)

- **Colors**: `bg-void` (near-black background), `text-accent` / `border-accent` (cyan brand accent), `text-neon` (secondary highlight), `bg-quantum` (modal surface). Per-module/ecosystem accent colors come from `lib/ecosystems.ts` (`color`/`glow`) or a card's own constant (e.g. `SILVER` in `LiveServiceCard.tsx`) — never hardcode a new hex for an existing module.
- **Card shell anatomy**, in this order: grid-texture background (`backgroundImage: linear-gradient(...) 1px, transparent 1px` pattern), a 2px top shimmer strip (`linear-gradient(90deg, transparent, color, glow, color, transparent)`), icon + serif title header, description, footer row with a cost/status badge.
- **Motion**: Framer Motion `useMotionValue`/`useSpring` for cursor-tilt (`rotateX`/`rotateY`), `useMotionTemplate` for the glow-follow radial gradient, `whileInView`/`viewport={{ once: true }}` for scroll-in, `whileTap={{ scale: 0.96–0.97 }}`.
- **Audio**: hover/click SFX go through `useSpatialAudio()` (`web/components/audio/SpatialAudioProvider.tsx`), panned by grid index — never add a raw `<audio>` element.
- **Typography**: `font-serif` for headings (glow-text utility class for hero-level text), uppercase tracked-out labels (`text-[10px] uppercase tracking-widest`) for badges/eyebrows.

## Copy and i18n — every component ships with translations, not English fallbacks

1. Add new keys under a purpose-named namespace in `web/messages/en.json` (reuse an existing namespace — `B2C`, `EntryModal`, `Ecosystems`, `Wallet` — before inventing a new one).
2. Mirror the same keys into **all** of `es.json`, `et.json`, `ja.json`, `ko.json`, `zh.json` in the same change, with real translations (not copies of the English text). A key present in `en.json` but missing elsewhere is a bug, not a follow-up.
3. Consume via `useTranslations('Namespace')` (client) or `getTranslations('Namespace')` (server component), matching how the nearest analog does it.

## Coin-gated interactions

Any new module/feature that costs U-Coin must call the `spend_coins` RPC (`supabase.rpc('spend_coins', { p_module, p_amount })`) before unlocking content — never just display a balance and navigate. Check `lib/ecosystems.ts` / `lib/modules.ts` for the module's registered `key`/`coinCost` rather than inventing new ones inline, and see `CLAUDE.md` for the ledger audit rules that govern this path.

## When the ask is bigger than one component

For a full new module page (quiz, simulation, calculator), scaffold it as: a small pure-logic module (no React) for the calculation/simulation itself, a thin presentational component that renders it, and a page file that wires translations + the presentational component together — mirroring `web/components/modules/` if it exists, or establishing that pattern if this is the first one. Keep the pure logic file unit-testable in isolation from React.
