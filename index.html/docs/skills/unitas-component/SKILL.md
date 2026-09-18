---
name: unitas-component
description: Build or change UI in the UNITAS Next.js app (web/) — cards, dialogs, widgets, sections, module pages — against the two shipped surfaces, the token system, the 20-locale copy pipeline and the live-data truth contract, instead of inventing a new visual language or a second way to do something the repo already does.
---

# UNITAS component work

Use this for any change under `web/` that a visitor can see. The goal is speed without drift: a new component should look and behave like it shipped alongside the existing ones on day one, and it should not leave 14 locales empty or a guard uncovered.

**Binding order.** `CLAUDE.md` §0 (Codex v41.0, 제1~16장) → `docs/process/IMPECCABLE_TASTE.md` (15 rules, some machine-enforced) → this skill → external design skills (`frontend-design`, `ui-ux-pro-max`, `ui-styling`, `design-system`, `brand`). **When an external design skill conflicts with the doctrine, the doctrine wins** — those skills have never measured this repo. Two of their standard recommendations are actively wrong here: "add `backdrop-filter` for premium glass" and "remove ALL-CAPS eyebrow labels."

⚠ **`CLAUDE.md`'s own component prose has drifted and is not a reliable reference for this work.** Measured 2026-09-18: it says "next-intl (6 locales)" in two places (there are 20), it says no migration has been applied live while its own Known-gaps section lists three that were, and it describes `POST /api/u-ai/insight` as the live burn/refund path although that route does not exist on disk. Obey its *laws* (§0 below, 제13장, 제16장) and treat its *descriptions* as history. The same applies to `IMPECCABLE_TASTE.md`'s line-number citations — resolve them by grepping the named selector or token, never by opening the cited line.

---

## 0. Non-obvious ground rules that silently waste an hour

**You cannot see your work on a plain load.** The whole app is sealed behind a server-side funnel gate (`web/middleware.ts` → `resolveGateVerdict` in `web/lib/gate/funnelGate.ts`), which rewrites a sealed visitor onto `/<locale>/gateway` with an empty body. There is no env bypass — `UNITAS_GATE_BYPASS` was deleted in REV-24. Open your component at:

```
/${locale}?sovereign_auth=${SOVEREIGN_AUTH_TOKEN}&splash=0&dev=skip
```

The token helper is `tests/web-cinema-e2e/_sovereignToken.js`; `tests/web-cinema-e2e/_rev25Home.js` is the canonical opener a new home spec should reuse. **Never edit `funnelGate.ts` and never reintroduce a bypass** because your component "isn't rendering."

**All in-app navigation comes from `@/i18n/navigation`** — `Link`, `useRouter`, `redirect`, `usePathname`, `getPathname`. `from 'next/link'` has zero occurrences in `web/`. `next/navigation` is reserved for `notFound()`. Because `localePrefix` is `'as-needed'`, a raw `next/link href='/u-pay'` silently drops the visitor into the default locale and breaks 19 of 20 — and typecheck, vitest and build all stay green.

**TypeScript only under `web/`.** Never add a `.js`/`.jsx` file there (scripts under `web/scripts/` are `.mjs`/`.ts`). Playwright specs stay plain `.js` only because they live in `index.html/tests/`, outside the fence.

**No eighth stylesheet.** `web/app/` holds exactly 7 sheets — `globals.css`, `quantum-white.css`, `quantum-white-rev19.css`, `splash.css`, `unitas-hub.css`, `unitas-wordmark.css`, `waitlist.css` — and `rev15FixedLayerGuard.test.ts` scans that hardcoded list. A new sheet is invisible to it, so rule 1 quietly stops being enforced for everything inside. Add rules to the sheet that owns the surface: `globals.css` (dark), `quantum-white-rev19.css` (white), `unitas-hub.css` (hub grammar).

**One test file per concern**, at `web/__tests__/<area>/<name>.test.ts`, never sharing mutable fixtures across files (CLAUDE.md, module-level test isolation). A new module gets at least a registry-shape test following `__tests__/modules/module-registry.test.ts`.

**Porting a legacy asset** into `web/`: copy it into `web/public/` (never import or symlink back to the repo root), leave the legacy original untouched, add a `// ported from /assets/...` lineage comment, and reimplement legacy DOM in TS/React — never `dangerouslySetInnerHTML`.

---

## 1. First decide which surface you are on

Two surfaces ship. They are not themes of one system; the white one re-keys a whole token family.

- **Dark** — the default. Every route except the ones below.
- **Quantum White** — `html[data-unitas-surface='quantum-white']`, stamped by `useSurfaceScope()` / `<SurfaceScope>` (`web/components/layout/SurfaceScope.tsx`) from a `useLayoutEffect`, i.e. after hydration. Exactly two React call sites: `web/components/home/quantum/QuantumWhiteHome.tsx` (the home page) and `web/components/layout/renderSitePage.tsx` (`/company`, `/legal`, `/support`). (There is one deliberate hand-stamp outside React — the blocking inline bootstrap in `web/lib/pwa/installPrompt.ts` sets the attribute pre-paint on a released-cinema home path so the white surface does not flash dark. Do not delete it.)

`SurfaceScope` is also the **CSS loader** for four of the seven sheets (`quantum-white.css`, `quantum-white-rev19.css`, `unitas-wordmark.css`, `unitas-hub.css`). The always-on three come from the root layout (`globals.css`, `splash.css`, `waitlist.css`).

**Read the rule as an inverse: only the home page and the `/company` `/legal` `/support` site pages are white. Every other route is dark** — that includes `/omni-swarm`, `/u-ai`, `/u-key`, `/u-pay`, `/u-signature`, `/gateway`, `/locked`, the four `/sovereign/*` subroutes, **and all 16 coin-gated module routes** under `app/[locale]/(gated)/`. On a dark route, `--qw-ink` / `--qw-line` / `--qw-blue` / `--qw-gold` / `--qw-glass` **do not exist** and resolve to nothing — the component renders unstyled with no error. What a dark route may consume: `--qw-card-*`, `--u-wl-*`, the four motion tokens, a route-local token family, and Tailwind `void` / `quantum` / `accent` / `neon`.

Never stamp `data-unitas-surface` by hand **from a React component** — the hook's unmount handover (it only clears the attribute if it still holds its own value) is what survives client navigation. (The header comment in `quantum-white.css` still claims the sheet is imported once from `QuantumWhiteHome`; that is stale since the site-page extraction.)

**The white-surface paint vocabulary**, declared under the surface prefix in `web/app/quantum-white.css`: `--qw-bg`, `--qw-bg-2`, `--qw-ink`, `--qw-ink-2`, `--qw-ink-3`, `--qw-line`, `--qw-line-strong`, `--qw-line-card`, `--qw-blue`, `--qw-blue-soft`, `--qw-blue-deep`, `--qw-gold`, `--qw-gold-deep`, `--qw-glass`, `--qw-glass-solid`, plus `--qw-card-border-w`, `--qw-card-shadow-rest`, `--qw-card-shadow-hover` and `--qw-lum-pct` (the `color-mix()` luminance channel that replaced the banned `body { filter }`). Use these instead of inventing `rgba(10,10,12,.08)` literals.

**On the home surface there is a second gate after the funnel: the curtain.** A home component gates expensive work on `useCurtainReleased()` (`web/components/home/quantum/useCurtainReleased.ts`) — `if (!released) return;` before ambient audio, timers and network, as `QuantumWhiteHome`, `SingularityCoreGrid` and `SovereignWatermark` do. Fetching on mount burns network behind an opaque curtain and lands your first frame while the cinema is still playing.

## 2. Read the right analog — several of the obvious ones are archived

- **Today's shipped card grammars**: `.qw-hub-card` (theme popups), `.qw-stream-card` (the eleven U-AI cards), `.qw-tier-card` (shortcut-ladder tiers). Live consumers: `components/home/DiscoveryCarousel.tsx`, `components/uai/stream/StreamCards.tsx`, `components/interaction/HotShortcutResultModal.tsx`. Adopt one of these three rather than inventing a fourth.
- **Reusable tilt/glow interaction core**: `web/components/motion/GlassTiltPanel.tsx` — the extracted form, and the only one that respects `useReducedMotion()`. Effectively unused, so adopting it needs no migration.
- **Dialog shells**: `web/components/ui/Modal.tsx` and `web/components/ui/DialogTower.tsx` (§4).
- **Coin-gated burn**: `web/components/upay/UPayGateway.tsx` + `web/lib/upay/oneClick.ts` (§6).
- **Wallet-aware**: consume `useWallet()` from `web/components/wallet/WalletProvider.tsx`; never read `wallets` another way.
- **Audio**: `useSpatialAudio()` (`web/components/audio/SpatialAudioProvider.tsx`) exposes exactly seven emitters — `playSpatialPing`, `playHoverSfx`, `playSearchFocusSfx`, `playQuestEnterSfx`, `playTypingTick`, `playEcosystemHover(theme, pan?)`, `playVaultSfx` — optionally panned by grid position. The shipped formula divides by the **last** index, not the count: `(index / (N - 1)) * 2 - 1`, so the pan spans the full −1…+1. (Its only three call sites are in the archived card family below; every live consumer calls `playHoverSfx()` with no pan.) The default context value is all no-ops, so calling one outside the provider is silent, never a crash. Never add a raw `<audio>` element, an eighth SFX, or a second provider under `[locale]` (the provider sits in the **root** layout so a locale switch does not tear down the AudioContext).
- **Home carousel slot**: a new discovery card is a **registry entry**, not a component. Add the key to `SlotKey` and register it in `DISCOVERY_ROTATION`, `SLOT_SOURCES`, `SLOT_PROVIDER` (+ `SLOT_QID` / `SLOT_ONE_TARGET` if applicable) in `web/lib/live/discoverySlots.ts`, then ship `Rev20.slots.<key>.title`/`.tag` in all 20 locales. `DiscoveryCarousel` reads `SLOT_PROVIDER[key].name` unguarded and throws at runtime for an unregistered key.

⚠ **`EcosystemCard.tsx` / `LiveServiceCard.tsx` / `B2BProtocolCard.tsx` are not on any shipped page.** They are imported only by `web/components/home/HomeContent.tsx`, and nothing imports `HomeContent` — `app/[locale]/page.tsx` renders `QuantumWhiteHome`. Their anatomy (18px grid texture, 2px top shimmer strip, serif title header, footer cost badge, cursor tilt) is still a valid **dark-route** grammar, but it is **square-cornered and hand-styled** — copying it onto the white surface yields a square card beside 16px-radius neighbours.

⚠ `EcosystemEntryModal.tsx` is the one hand-rolled overlay left (no `ModalPortal`, ESC without `isTop()`). Do not copy its structure. `ModuleQuestModal.tsx` is structurally correct but pre-REV-13 for error handling.

Copy the *structure* of the nearest correct analog (props shape, effect wiring, className scaffolding), then change only what must differ.

## 3. Tokens are the design system — do not re-describe them

**THE ONE CARD SKIN is four tokens, declared twice under the same names** — dark in `web/app/globals.css` `:root`, white in `web/app/quantum-white-rev19.css` under the surface prefix:
`--qw-card-line`, `--qw-card-radius` (16px on both), `--qw-card-bg`, `--qw-card-shadow`.
A card that hand-writes border/radius/background/shadow — including via Tailwind (`rounded-2xl border-white/10 bg-void/40`) — diverges on one surface. If you must introduce a genuinely new card class, add it to the white unification selector list in `quantum-white-rev19.css` in the same commit.

**Motion tokens live on the BARE `:root` of `globals.css`, once, and are deliberately not re-declared per surface:**
`--qw-ease: cubic-bezier(0.2, 0.8, 0.2, 1)`, `--qw-dur-fast: 0.18s`, `--qw-dur: 0.22s`, `--qw-dur-slow: 0.35s`.
Every new `transition`/`animation` references them (doctrine rule 7). ⚠ What is machine-enforced by `web/__tests__/quantumWhite/impeccableTaste.test.ts` is only that the four tokens **exist on the bare `:root`** with the plurality easing value — there is no scan for literal durations, so *usage* is review-enforced. Declaring them behind the white prefix makes them undefined on all eight dark routes and turns that guard red. Framer Motion spring default is `{ type: 'spring', stiffness: 220, damping: 22 }`; a different value needs a one-line comment saying why. **Do not bulk-replace the ~100 existing literal durations** — rule 7 binds new motion only.

A new white-surface `@keyframes` ships with its `@media (prefers-reduced-motion: reduce)` block in the same file (rule 8). ⚠ Rule 8's tab-hidden pause gate is **only reachable on the home page**: the CSS selector is compound (`html[data-page-hidden='1'][data-unitas-surface='quantum-white'] *`) and `data-page-hidden` is stamped by `QuantumWhiteHome` alone. On any other route, either accept that the animation runs while the tab is hidden and say so, or widen the selector and stamp the attribute from a shared effect — and ship a guard, or the compliance claim is unmeasured.

**Glass is one layer.** On the white surface only `#unitas-nav` (`--qw-nav-blur`) and one viewport-fixed modal backdrop (`.qw-popout-backdrop`) carry `backdrop-filter`. Every in-flow panel builds glass from `--u-wl-glass` + `--u-wl-edge`, or 0.94–0.97 opaque ground + `box-shadow`, with `backdrop-filter: none` explicit. A new in-flow panel selector must be appended to the `it.each` list in `web/__tests__/quantumWhite/rev21OneLayer.test.ts` or the rule is not actually enforced for it.
- ⚠ `--qw-modal-blur` is declared but has **zero consumers** — authoring against it is dead on arrival. Reuse `.qw-popout-backdrop`.
- ⚠ Six existing blurs are **shipped and correct**, not violations — do not "clean them up." Five live in dark-route sheets: `.logo-hologram`, `.cs-glass`, `.nav-glass` (`globals.css`), `.u-mail-inner` and the claim toast (`waitlist.css`). The sixth, `.u-wl-card-inner` (`unitas-hub.css`), is a **grandfathered exception that does paint on the white surface** — `unitas-hub.css` is loaded only by `SurfaceScope`. Never cite it as precedent for a new white-surface panel.
- ⚠ `--u-wl-*` flips to its light values only under the **compound** selector `html[data-unitas-surface='quantum-white'][data-cinema-phase='released']`. If a panel must be light the moment the surface stamps, build it on `--qw-card-*` / `--qw-ink` / `--qw-line` instead.

**Rule 1, the most expensive mistake in this repo:** never declare `filter`, `backdrop-filter`, `-webkit-backdrop-filter`, `transform`, `perspective`, `will-change`, `contain`, `translate`, `rotate` or `scale` (non-`none`) on `html`, `body` or `.dashboard-zoom`. Any one of them makes that element the containing block for **every** `position: fixed` descendant site-wide — curtain, nav, every portaled dialog, `ExitGuard` — at once. One `body { filter }` once drew a 1702px curtain on a 667px viewport. Guarded across all seven sheets by `rev15FixedLayerGuard.test.ts`.

**Tailwind extends exactly four colors** — `void #030305`, `quantum #0f1016`, **`accent` = GOLD `#d4af37`**, **`neon` = the cyan `#00f3ff`** (the previous version of this skill had these two backwards) — and two families: `sans` = JetBrains Mono, `serif` = Cinzel. There is no `bg-silver`, no `text-ink`, no spacing or radius extension; a utility invented outside these compiles to nothing. Content globs cover only `app/`, `components/`, `lib/` — classes written anywhere else under `web/` are purged. No raw hex in `.tsx` for a color a token already names (rule 10).

**Fonts are fixed at the root layout and nowhere else** (`next/font/google`, one file). Only **Cinzel 400/700** and **JetBrains Mono 300/400/700** are loaded — asking for `font-semibold` on a serif heading has no matching face, silently synthesises a faux-bold, and breaks the measured Cinzel cap-height arithmetic behind `--qw-title-cap-ratio`. No new webfonts (rule 9).

**Focus rings are per-class and hand-written.** There is no `--qw-focus-*` token, no a11y guard anywhere in the suite, and no review lens will catch a missing one. Write the `:focus-visible` rule next to the class definition, matching the nearest sibling, and keep interactive elements real `<button>`/`<a>` — `GlassTiltPanel.tsx` models the Enter/Space handling for a div-based surface.

**Zoom.** `.dashboard-zoom { zoom: 0.75 }` wraps nav + page content (`app/[locale]/layout.tsx`). Inside that tree, any layout value derived from a **screen-pixel measurement** must be divided by `var(--unitas-zoom, 0.75)`; `vw`/`svh` are *not* divided by zoom. Content rendered through `ModalPortal` / `DialogTower` escapes the tree and must **not** be divided. Leave `html, body { overflow-x: hidden }` alone — it is the measured backstop for `zoom` leaking a pre-zoom width into `scrollWidth`.

**Typography conventions that stay:** `font-serif` for headings, uppercase tracked-out labels (`text-[10px] uppercase tracking-widest`) for badges/eyebrows, `.u-wl-eyebrow` ships `letter-spacing: 0.32em`. This is a founder-approved shipped convention — external skills tell you to remove it; do not.

## 4. Dialogs have a four-part contract

1. **Portal.** Render inside `<ModalPortal>` (`web/components/ui/ModalPortal.tsx`). It portals to `document.body`, outside `.dashboard-zoom`, and its `[data-unitas-portal]` wrapper is the **only** hook Quantum White uses to re-skin portaled dark utilities. A hand-rolled `createPortal` silently loses the white skin; a dialog left inside the zoom tree is clipped and every `getBoundingClientRect()` it reads is skewed.
2. **History.** Register with `useHistoryLayer(open, id, onBack, url?)` (`web/components/ui/useHistoryLayer.ts`), which drives the singleton stack in `web/lib/history/modalStack.ts`. **Never call `history.pushState` yourself** — the stack spreads the live `history.state` so Next 14.2's `__NA` keys and `ExitGuard`'s sentinel depth survive; overwriting them ejects the visitor from the site on the next back press.
3. **ESC.** `ExitGuard` owns one capture-phase `keydown` on `window`, resolved by the pure `resolveEscape()` in `web/lib/history/escapeController.ts`. Your dialog's own listener is a bubble-phase *fallback* and must open with exactly: `if (e.key !== 'Escape' || e.defaultPrevented) return;` then `if (!layer.isTop()) return;`. Without the first you double-close; without the second a nested dialog closes the wrong layer. A popup that owns no history layer (a menu) opts in by stamping `data-escape-local` instead. **Never add a `role`-based ESC hit-test** — that is what made ESC dead over the U-AI `role="listbox"` dropdown before REV-34.
4. **Mutual exclusion is a separate opt-in.** There is **no `UIGateProvider` and no `useUIGate`** in this repo — writing against them will not compile. The API is `web/lib/uiGate.ts` plus the hook `useGatedSurface(id, { lockScroll })` (`web/components/ui/useGatedSurface.ts`), called by the **trigger** component. `Modal` and `DialogTower` give you history but never touch the gate. Live ids: `nav:auth`, `nav:charge`, `nav:balance`, `nav:settings`, `nav:language`, `pwa:install-guide`, `exit-guard`, `qw-cluster`. Render a blocked trigger inert (`pointer-events-none opacity-50` + `aria-disabled`).

Shell choice: `Modal` (backdrop **does** close on click, no body-scroll lock, `layer='base'` z-200 / `'top'` z-680; pass a stable `labelledBy` so the history token is greppable) vs `DialogTower` (full-size shell at z-120, fixed toolbar with required `labels`, backdrop deliberately **not** wired to close, locks body overflow, `variant: 'nav-anchored' | 'fullscreen'`). The `fullscreen` variant sets `document.body[data-fullscreen-tower-open]`, which lifts `#unitas-nav` to z-125 — the flag must stay a body attribute, not a wider tower z-index.

⚠ The z-index ladder is hand-written Tailwind arbitrary values with **no token and no test**: 120 tower / 125 nav-over-tower / 130–140 language menu / 200 `Modal` base / 320 `InfoHint` / 390 watermark / 400 curtain / 450 founder console / 650 PWA sheet / 680 exit confirm / 700 intro splash. Do not invent a plausible number like `z-[500]` — reuse the shell that already owns the right level.

More traps:
- `historyLayer={false}` belongs to the exit confirm alone (it *is* the back gesture's destination). Copying it breaks the LIFO unwind.
- Call `beginNavigation()` (`web/lib/history/navigationLock.ts`) immediately before any `router.push/replace` issued while a dialog is open, or the unmount release's `history.go(-1)` cancels the navigation — the shipped "language never changes" bug.
- Mount sub-modals **unconditionally** and toggle each one's `open`; an `if/else` branch skips `AnimatePresence`'s exit transition. Gate each by kind so one slot cannot raise a second dialog.
- A host that remounts on a clock (a rotating carousel card) must **delegate** the open upward via an `onSelect`-style prop; a dialog rendered inside the rotating child dies mid-interaction.
- An `<input>` inside the search dropdown or shortcut strip needs `onMouseDown={(e) => e.stopPropagation()}` — those parents `preventDefault()` mousedown to stop a blur-unmount. Do not remove the parents' `preventDefault`.
- Do not add a third independent `document.body.style.overflow` writer; `DialogTower` and `useGatedSurface({ lockScroll: true })` already save/restore it and two owners strand the page unscrollable.
- Wrap a page/layout-level dialog in `<SovereignShield zone="…" resetKeys={[subject]}>` or a fault takes the whole route down.

## 5. Copy ships to 20 locales, through an applicator, in one commit

`web/messages/` holds **20** files: `de en es et fr hi id it ja km ko nl pl pt ru th tl tr vi zh`. The canonical order is `routing.locales` in `web/i18n/routing.ts` and it is positional in every applicator.

**Do not hand-edit the JSON.** The shipped pattern (rule 12 + rule 13):

1. Put new copy in a **new `Rev<NN>` namespace**. Legacy namespaces (`Nav`, `Home`, `Wallet`, `EntryModal`, `Ecosystems`, `UAI`, `B2C`, …) have **zero parity guard**, so copy added there can ship en-only with a green gate.
2. Write `web/scripts/apply-rev<NN>-i18n.mjs` by copying **`apply-rev41-i18n.mjs`** — it is the only one of the twelve that preserves the file's existing EOL (`const eol = raw.includes('\r\n') ? '\r\n' : '\n'`; the messages files are CRLF). Its shape: a positional `L(...)` that throws unless given exactly 20 strings, a flat map of dotted keys, a fail-closed validation loop (non-empty, no `[MISSING`, identical ICU token set as `en`) that runs **before** any write, then an additive `setDeep` merge, plus `--check` (exit 1 on drift).
3. Ship `web/__tests__/i18n/rev<NN>Parity.test.ts` in the same commit: exact key list (`toEqual`, not a floor), per-locale key set, ICU parity, no empty, no `[MISSING`, and a ≤8% byte-identical-to-`en` ceiling.
4. Consume with `useTranslations('Rev<NN>.subgroup')` (the dotted sub-namespace form is the current pattern). In a statically generated `[locale]` route call `setRequestLocale(locale)` first, then `await getTranslations({ locale, namespace: 'X' })` — the bare-string form only where the request locale is already scoped. Array-valued keys read with `t.raw(slug)`.

⚠ **Never run `npm run i18n:sync` to "fill in" the other 19.** It writes the literal `[MISSING:en] <text>` — a real, shippable-looking string that every parity spec rejects. Use it only to enumerate what needs translating.
⚠ **`Rev19`, `Rev20`, `Rev21` and `SitePages` are read-only outputs**, rebuilt wholesale (`messages[NS] = ns`) by `scripts/i18n/apply-rev19|20|21.mjs` from `docs/rev<NN>/i18n/<locale>.json`. A hand-added key there is destroyed on the next run. `SitePages` is the odd one out: its drafts live in `docs/rev21/i18n/sitepages/<locale>.json` and it is rebuilt only by `node scripts/i18n/apply-rev21.mjs --namespace SitePages --drafts docs/rev21/i18n/sitepages` — a bare `apply-rev21.mjs` rebuilds `Rev21` alone. `apply-rev21.mjs` also **silently substitutes English** for a whole locale whose draft is missing or invalid, printing only `FALLBACK(en)`.
⚠ Pasting English into all 20 to satisfy the key check fails the drift ceiling. Do not pad the waiver set to quiet it.
⚠ Keep engineering vocabulary — `doctrine`, `codex`, `constitution`, `Claude`, `Roo`, `Gemini`, `PowerShell`, `TypeScript`, `React`, `Next.js`, `Tailwind`, `Supabase`, `RPC`, `migration`, `USPTO`, `patent` — out of user copy in **every** locale. This is a convention, not a universal gate: it is machine-rejected only in `QuantumWhite` (`quantumWhiteParity.test.ts`) and, by a narrower regex, in `SitePages` (`rev21SitePagesParity.test.ts`). The new `Rev<NN>` spec you are about to write will **not** catch it unless you add the check yourself — and until you see it run, do not call it enforced (제13장).

## 6. Live data, honest states, and burning coins

**Four states, not three:** `'loading' | 'data' | 'empty' | 'unreadable'`. `empty` may only be claimed by a source that actually **answered** with nothing; a signed-out visitor, an absent RPC, an RLS refusal or a failed env shape is `unreadable`. Reuse the shipped DOM vocabulary so the E2E specs and the fail-open guard can see the new surface: `data-hub-loading="1"`, `data-hub-empty="1"`, `data-hub-unreadable="1"`, `[data-omni-radar][data-state]`, `data-fx-unreadable`, `data-hub-ledger` / `data-shorts-ledger`. Reference implementations: `components/home/hub/KnowledgeExchange.tsx`, `components/home/widgets/OmniRadar.tsx`, `SlotWidgetView.tsx`.

**No simulated data, ever** (제16장). Filling a gap with a plausible deterministic number is a fail-OPEN; `web/__tests__/square/failOpenRegression.test.ts` statically bans 11 attribute names and 12 exports from returning. `web/lib/square/pulse.ts` survives for SSR-vs-first-frame parity only — never to invent rows, counts or volumes.
⚠ `data-shorts-ledger="device"` is **not** fake data — it is the guest's real ledger, deliberately never merged with the account ledger. Keep it and keep the badge that says which ledger is in force.

**Supabase.** Four factories with four intentionally different contracts — `lib/supabase/client.ts` throws, `server.ts` throws, `serverComponent.ts` returns `null`, `middlewareClient.ts` returns `{ user: null }`. Converging them turns a fail-closed logout into a global 500. Both server factories install `fetch(..., { cache: 'no-store' })` because Next's Data Cache memoizes every PostgREST GET by URL — a bare `createClient` silently serves stale rows and **nothing tests this**. Decide "is it configured" by **shape**, via `web/lib/security/credentialShape.ts` (`validatePublicSupabaseEnv` / `selectServerSupabaseKey`) — never `Boolean(url && key)`, because `[SENSITIVE]` and `<paste-the-…>` are non-empty strings that 401 every call. App code must **never** import `web/scripts/credential-core.mjs` (it uses `Buffer.base64url`, absent from the browser/Edge polyfill, so it throws on correct keys).

**Coin gating** is four obligations, not one:
1. Burn with `supabase.rpc('spend_coins', { p_module, p_amount })` through `getSupabaseBrowserClient()`. `p_module` is **not** the registry `key` — it is `moduleAccessName(route)` (`web/lib/module-registry.ts`, which uppercases B2C keys) or `UPAY_UNIVERSAL_ACCESS['<kind>:<key>']`. Passing the raw key raises `Unknown module: …`. The DB whitelist is **33 literal names**, and only two files carry all 33: the migration — in *both* CHECK constraints (`coin_ledger_module_check`, `module_access_grants_module_check`) **and** the `p_module not in (...)` list inside the re-created `spend_coins()` body — and `DB_MODULE_WHITELIST` in `web/__tests__/gate/moduleAccess.test.ts`. `lib/upay/universal.ts` holds only the 16 universal-tier names; the other 17 are derived from the two catalogues through `moduleAccessName()`. So a new lock-in/b2b/lifeOS module touches all three; a new ecosystem/B2C module touches its catalogue, the migration and the test — never `universal.ts`.
2. Pre-check `module_access_grants` for a live row (`.gt('expires_at', now)`) and short-circuit, as `UPayGateway` does, so a visitor is not double-burned.
3. Put the paid page under `app/[locale]/(gated)/` and let the existing layout re-verify the 30-minute grant server-side. **Never** gate by conditionally omitting `{children}` (the child still renders and serialises its RSC payload — paid content leaks) or by a client-side `if (!hasGrant) return null`.
4. Map errors with `classifySpendError(error.message ?? '')` (`web/lib/upay/oneClick.ts`) to a localized reason. Never surface the raw PostgREST string.

⚠ **There is no refund path.** `refund_coins` is `service_role`-only and has zero callers. Design the flow so the burn happens last, on a path that can complete.

## 7. A new route is a registry + SEO obligation

Adding a folder under `app/[locale]/` (or `(gated)/`) passes typecheck and vitest and then fails `next build` in prebuild. `web/scripts/validate-module-registry.mjs` requires either a literal `{ key: '…', route: '…'` entry (in that order — it is a regex) in `web/lib/ecosystems.ts` or `web/lib/modules.ts`, or the folder name in its `INFRA_ROUTES` list with a comment saying why. Registering in `web/lib/module-registry.ts` instead is a silent no-op: it builds entries programmatically and contains no literal `route: '…'` string for the regex to find.

A new **public** route also belongs in `PUBLIC_ROUTES` (`web/lib/seo/routes.ts`) — and `web/__tests__/seo/routes.test.ts` pins `PUBLIC_ROUTES` at 18 and `GATED_MODULE_ROUTES` at 16, so that count moves in the same commit or the gate goes red with an unrelated-looking failure.

## 8. Ship the guard, then prove it

**Guards.** A new token family or selector family ships with a static guard in the same commit (rule 13): `web/__tests__/<area>/<name>.test.ts`, node environment, `readFileSync` + regex — asserting the new name exists and any retired name does not. Copy `rev15Tokens.test.ts` / `rev17Tokens.test.ts`, including their module-isolation header comment. A new in-flow panel selector also goes into `rev21OneLayer.test.ts`'s `it.each`.

⚠ **vitest here collects `__tests__/**/*.test.ts` only, in a node environment.** There are 128 `.test.ts` files and zero `.test.tsx`. A guard written as `.test.tsx`, or one that renders DOM, or one placed beside the component, **typechecks green and never runs**. Confirm the spec name actually appears in the test output before calling a rule enforced (제13장: no unmeasured completion reports).

**Gates**, from the ops root `index.html/`:

```bash
npm --prefix web run test -- __tests__/<area>   # inner loop, seconds
npm test                                        # the real gate: doctrine:verify → typecheck → test:unit → build:web
```

`npm --prefix web run test` alone is **not** the gate — it runs neither `sync-codex`, nor the module-registry validator, nor the build. (The module-registry validator fires only in `prebuild`; `sync-codex` fires in `prebuild` *and* in `doctrine:verify`.) For a UI change that needs E2E: build first, then `npm run test:e2e:chromium` grepped to the affected spec. Do not run webkit or the six-project sweep in-session — that belongs to the Stage-3 idle daemon. `npm --prefix web run lint` is dead weight (no eslint config or dependency exists) and will drop you into `next lint`'s setup prompt.

The **ops-root Stop hook** (`index.html/.claude/settings.json` — not the git toplevel's, which declares only a SessionStart hook) **runs typecheck + test + build automatically on a dirty `web/` tree and then commits and pushes to `origin/main`.** The gate is not advisory, and unfinished work left in the tree is published.

⚠ **A green `npm test` proves doctrine rules 1, 2 and 7 only.** The other twelve are review-enforced by `scripts/agent-review.ps1`, which no gate calls — it is the opt-in `npm run review:agents` (`-Lens plan|code|security|ux|e2e`, five stages in declared order, non-zero stops the pipeline, needs `ANTHROPIC_API_KEY`). Reporting "IMPECCABLE TASTE compliance verified" after a green suite is exactly the unmeasured completion report 제13장 forbids. Say which rules the run actually proved; if you self-checked the rest against the diff, say that.

## 9. When the ask is bigger than one component

The module-page pattern is **fully established** — 15 `<Name>Engine.tsx` files, a `lifeOs/` sub-tree, `ModuleLockPanel` and `ModulePlaceholderEngine` already ship. Do not invent a fresh shell. The measured three-file scaffold:

1. **Pure logic, no React**, in `web/lib/engines/<name>.ts` (e.g. `scoreApexRun`, `APEX_SCENARIO_OPTIONS`) — this is the file a node-environment vitest guard can actually cover.
2. **A `'use client'` engine component** `web/components/modules/<Name>Engine.tsx` taking `{ ecosystem: EcosystemTheme }`.
3. **The shared post-payment shell** `ModuleWorkspace({ ecosystem, children })`, which brings the themed header, the `Ecosystems.<messageKey>.*` i18n contract and the ecosystem colour wiring.

⚠ `ModuleWorkspace` deliberately does **not** re-verify payment — page-level re-verification belongs to `app/[locale]/(gated)/layout.tsx`. "Fixing" that inside the workspace duplicates the grant query on every ecosystem page and can double-render a redirect against the layout that already owns it.

⚠ A coin-gated module needs a **new timestamped file** under `supabase/migrations/` — never an edit to an existing one, and never apply it yourself (제16장: live DB mutation needs the founder's explicit `ok`).

Then walk §5 (20 locales), §6 (truth contract if it touches data), §7 (registry + SEO if it adds a route) and §8 (guard + gate) before reporting it done.
