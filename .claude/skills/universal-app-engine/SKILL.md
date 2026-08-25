---
name: universal-app-engine
description: Engine-selection governance for building any interactive app type (quiz, battle, simulation, animation, game, special effects) in /web — decides which combination of R3F/Three.js, Supabase Realtime broadcast/presence, Framer Motion, GSAP, and Matter.js to reach for, and how to wire them without violating existing i18n/coin-gating/audio/Low-Memory rules. Use whenever a new interactive module is requested, before writing any component code.
---

# Universal app engine governance

This is the "which top-tier engine(s) do I reach for" decision layer for `/web`. It does
not replace [`unitas-component`](../unitas-component/SKILL.md) (component/design-system
conventions) or [`autonomous-research`](../autonomous-research/SKILL.md) (verification
loop for anything with real risk of being wrong first try) — use all three together: this
skill picks the engines, `unitas-component` shapes the component, `autonomous-research`
verifies it.

## Before writing anything

Read the closest existing analog first, per `unitas-component`'s own rule. For engine
wiring specifically, the reusable primitives already exist — do not reinvent them:

| Need | Reach for | Existing reference |
|---|---|---|
| 3D/WebGL, shaders, special effects | React Three Fiber + Three.js (already a dependency) | `web/components/canvas/Scene.tsx`, `NeuralShader.tsx` |
| Deferring a heavy client-only chunk past hydration | `next/dynamic(..., { ssr: false })` | `web/components/canvas/SceneLazy.tsx` |
| Live battle/quiz/game messaging (moves, answers, presence) | Supabase Realtime broadcast/presence | `web/lib/realtime/gameChannel.ts` |
| Live balance/row watching (not this — see next row) | Supabase Realtime `postgres_changes` | `web/components/wallet/WalletProvider.tsx` |
| React-state-driven UI motion (hover, tap, layout, glow) | Framer Motion (already a dependency) | any `web/components/modules/**` component |
| Imperative timeline/scroll-triggered sequences | GSAP | none yet — this skill is the first authority |
| Physics-based simulation/interaction (gravity, collisions, ragdoll, drag) | Matter.js | `web/lib/physics/matterEngine.ts` |
| Supabase browser client | `getSupabaseBrowserClient()` | `web/lib/supabase/client.ts` |

## Decision matrix — app type → engine combination

Pick the smallest combination that satisfies the request. Pulling in every engine for
every app is over-engineering and directly fights Low-Memory Armor (bigger bundle, slower
per-turn `next build` gate) — justify each engine you add.

| App type | 3D/R3F | Realtime | Framer Motion | GSAP | Matter.js |
|---|---|---|---|---|---|
| Quiz (single player) | rarely | no | yes (transitions, feedback) | no | no |
| Quiz (live/multiplayer) | rarely | yes (broadcast) | yes | no | no |
| 1v1 battle/duel | maybe (arena visuals) | yes (broadcast + presence) | yes | maybe (hit-impact timelines) | maybe (knockback/impact) |
| Simulation (physical) | maybe (render layer) | no unless shared/multiplayer | no | no | yes |
| Simulation (data/system, non-physical) | no | maybe | yes | maybe (sequenced reveals) | no |
| Pure animation/special-effects showcase | yes | no | yes | yes (complex timelines) | maybe |
| Game (arcade/physics-based) | maybe | yes if multiplayer | no | no | yes |
| Game (turn-based/board) | no | yes (broadcast + presence) | yes | no | no |

When unsure, start with the fewest engines that satisfy the golden path, ship, and only
add another engine if a concrete requirement (not speculative future-proofing) needs it —
consistent with CLAUDE.md's "don't design for hypothetical future requirements" rule.

## Framer Motion vs. GSAP

Both are installed; they are not interchangeable, and using the wrong one for a task adds
either fighting-the-framework friction or unnecessary imperative code:

- **Framer Motion** — anything driven by React state/props: hover/tap/drag gestures,
  `whileInView` reveals, layout transitions, the cursor-tilt/glow-follow patterns already
  established in `unitas-component`. Default choice for all component-level motion.
- **GSAP** — only when the sequence is imperative and not naturally expressible as React
  state (a multi-step scroll-triggered timeline, precise frame-by-frame choreography
  across unrelated DOM nodes, a special-effects intro sequence). Scope every GSAP
  animation with `gsap.context()` tied to a ref, and call `.revert()` in the `useEffect`
  cleanup function — an un-reverted GSAP context is a leaked set of tweens/listeners, the
  same class of bug `matterEngine.ts`'s `destroy()` and Realtime's `unsubscribe()` guard
  against. Never let GSAP and Framer Motion animate the same property on the same element.

## Wiring rules (do not violate)

- **SSR safety.** R3F content follows `Scene.tsx`'s mount-guard pattern; anything using
  Matter.js's `Render` (touches `canvas`/`document` at module-eval time indirectly through
  usage) or GSAP's `ScrollTrigger`/DOM plugins must be a client component and, if the
  import itself is heavy, deferred via `next/dynamic({ ssr: false })` like `SceneLazy.tsx`.
- **Realtime cleanup.** Every `createGameChannel()` call must have a matching
  `.unsubscribe()` in the component's `useEffect` cleanup — same discipline
  `WalletProvider.tsx` already follows for its `postgres_changes` subscription.
- **Physics cleanup.** Every `createMatterEngine()` call must have a matching `.destroy()`
  call on unmount.
- **Coin-gating.** If the app/module is paid content, entry must call the `spend_coins`
  RPC per root `CLAUDE.md`'s U-Coin ledger rules — never gate purely on client state, and
  never write `wallets.balance` directly regardless of which rendering engine is involved.
- **i18n.** Any new UI copy (quiz prompts, battle status text, game instructions) ships in
  all six locale files in the same pass, per `unitas-component` and root `CLAUDE.md`.
- **Audio.** Sound effects (hit impacts, quiz correct/incorrect, ambient game loop) go
  through `useSpatialAudio()`, never a raw `<audio>` element, matching the rest of the app.
- **No standing processes.** A Realtime channel, a Matter.js runner, and a GSAP ticker are
  all technically "always running" while mounted — that's fine (they're tied to component
  lifecycle, not a background daemon), but none may be started outside a component's
  mount/unmount lifecycle, and none may survive past the interaction that started them
  (e.g. leaving a game room must unsubscribe/destroy, not just hide the UI).
- **No git commit/push/deploy.** This skill, like `autonomous-research`, never runs
  `git commit`/`push`/deploy itself. Checkpointing for `/web` stays owned by the existing
  Stop hook in `.claude/settings.json`.

## When the ask is bigger than one component

Same scaffold as `unitas-component`: pure-logic module (engine setup/teardown, e.g. a new
`web/lib/games/<name>.ts` composing `gameChannel.ts` and/or `matterEngine.ts`) +
presentational component + page, under `web/components/modules/` or a new
`web/components/games/` directory if the surface area is large enough to warrant its own
namespace. Verify with the `autonomous-research` gate (`typecheck` + `build`, plus a
targeted Playwright check for the interactive path) before considering it done.
