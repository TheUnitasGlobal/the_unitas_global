/**
 * Pure state machine for the site-wide "one surface at a time" interaction
 * gate (see components/ui/UIGateProvider.tsx). Kept framework-free so the
 * mutual-exclusion rules can be unit-tested in the node env without React or
 * jsdom -- the provider is a thin ref+state wrapper around these functions.
 *
 * Rule: while any popup / modal / function-window (a nav menu action, the
 * U-AI search hub, an 11/5/3-module entry modal, a B2B inquiry form, ...)
 * holds the gate, no other surface may acquire it. Nothing else can open or
 * be selected until the holder releases.
 */
export interface GateState {
  /** id of the single surface currently allowed to be open, or null when idle. */
  readonly activeId: string | null;
  /** whether document scroll should be frozen for the current holder. */
  readonly scrollLocked: boolean;
}

export const IDLE_GATE: GateState = { activeId: null, scrollLocked: false };

/**
 * Take the gate for `id`. No-op (returns the same reference) when another
 * surface already holds it -- callers detect the block by identity/`===`.
 * Re-acquiring with the same id is allowed and can update the scroll lock.
 */
export function acquireGate(state: GateState, id: string, lockScroll = false): GateState {
  if (state.activeId !== null && state.activeId !== id) return state;
  if (state.activeId === id && state.scrollLocked === lockScroll) return state;
  return { activeId: id, scrollLocked: lockScroll };
}

/** Release the gate only if `id` currently holds it; otherwise unchanged. */
export function releaseGate(state: GateState, id: string): GateState {
  if (state.activeId !== id) return state;
  return IDLE_GATE;
}

/** True when some OTHER surface holds the gate and `id` must stay closed. */
export function isGateBlocked(state: GateState, id: string): boolean {
  return state.activeId !== null && state.activeId !== id;
}
