/**
 * Site-wide mutual-exclusion gate: at most ONE popup / modal / function-window
 * open at a time across the whole app. Pure, framework-agnostic, and safe to
 * unit-test in the node env -- no React, no DOM.
 *
 * Design (mirrors the vanilla-JS pattern the root static site uses for its
 * overlay coordination): a single module-level `owner` slot plus a listener
 * set. `acquire` / `release` / `isBlockedFor` resolve SYNCHRONOUSLY within one
 * event handler, so a click that hands off from one surface to another (e.g.
 * closing the balance panel and opening Charge Coins in the same tick) never
 * races a React re-render.
 *
 * The React binding is `components/ui/useGatedSurface.ts`.
 */

export type GateId = string;

type Listener = () => void;

let owner: GateId | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Current gate owner id, or `null` when nothing holds the gate. */
export function getGateOwner(): GateId | null {
  return owner;
}

/**
 * Try to take the gate for `id`. Returns `true` if `id` now holds it (either it
 * just acquired it, or it already held it -- acquiring is idempotent). Returns
 * `false` without side effects if a *different* surface currently holds it.
 */
export function acquireGate(id: GateId): boolean {
  if (owner !== null && owner !== id) return false;
  if (owner === id) return true;
  owner = id;
  emit();
  return true;
}

/** Release the gate, but only if `id` is the current owner (no-op otherwise). */
export function releaseGate(id: GateId): void {
  if (owner !== id) return;
  owner = null;
  emit();
}

/** Force the gate open for `id`, evicting any current owner. Use sparingly -- for
 *  deliberate hand-offs where the new surface must win (search hub -> module modal). */
export function forceGate(id: GateId): void {
  if (owner === id) return;
  owner = id;
  emit();
}

/** True when some OTHER surface holds the gate and `id` is therefore blocked. */
export function isGateBlockedFor(id: GateId): boolean {
  return owner !== null && owner !== id;
}

/** Subscribe to owner changes. Returns an unsubscribe fn. */
export function subscribeGate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: drop the owner and every listener. Never call from app code. */
export function __resetGateForTests(): void {
  owner = null;
  listeners.clear();
}
