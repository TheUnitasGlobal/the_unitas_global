// Self-healing budget for the route-level error screens (owner instruction
// 2026-09-07, item 1). When `app/[locale]/error.tsx` or `app/global-error.tsx`
// catches a fault they no longer sit on the "Sovereign Core Error" screen
// waiting for a tap on Retry: they call Next's `reset()` themselves after a
// short beat, so a transient fault (a hydration race, a lost GPU context, a
// feed that answered garbage once) heals with no visitor action and the
// error screen is never actually seen. The budget below is what stops that
// from becoming a reload storm when the fault is persistent: a scope may
// self-heal at most `SELF_HEAL_MAX_ATTEMPTS` times inside one
// `SELF_HEAL_WINDOW_MS` window; past that the screen stays up with its manual
// Retry / Home controls.
//
// Pure maths in `planSelfHeal()` so the policy is unit-testable; the
// sessionStorage record keeps the count across the remount that `reset()`
// causes (module state does not survive a root-level remount).

export const SELF_HEAL_MAX_ATTEMPTS = 2;
export const SELF_HEAL_WINDOW_MS = 30_000;
/** Beat before the automatic reset -- long enough for the faulting effect
 *  cleanup / GPU restore to settle, short enough to read as "nothing happened". */
export const SELF_HEAL_DELAY_MS = 900;

const STORAGE_PREFIX = 'unitas.selfheal.';

export interface SelfHealRecord {
  count: number;
  /** Epoch ms of the first attempt in the current window. */
  at: number;
}

/**
 * Pure: given the stored record (or null) and the current time, decide
 * whether another automatic reset is allowed and what to store next.
 */
export function planSelfHeal(
  record: SelfHealRecord | null,
  now: number,
  maxAttempts = SELF_HEAL_MAX_ATTEMPTS,
  windowMs = SELF_HEAL_WINDOW_MS,
): { allowed: boolean; next: SelfHealRecord } {
  const fresh = !record || !Number.isFinite(record.at) || now - record.at > windowMs || now < record.at;
  const count = fresh ? 0 : Math.max(0, Math.floor(record!.count) || 0);
  if (count >= maxAttempts) {
    return { allowed: false, next: { count, at: fresh ? now : record!.at } };
  }
  return { allowed: true, next: { count: count + 1, at: fresh ? now : record!.at } };
}

function readRecord(scope: string): SelfHealRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + scope);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SelfHealRecord>;
    if (typeof parsed.count !== 'number' || typeof parsed.at !== 'number') return null;
    return { count: parsed.count, at: parsed.at };
  } catch {
    return null;
  }
}

function writeRecord(scope: string, record: SelfHealRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(record));
  } catch {
    /* storage blocked -- the in-memory decision still holds for this render */
  }
}

/**
 * Claim one automatic reset for `scope`. Returns true when the caller may
 * reset now (and the attempt has been recorded), false when the budget for
 * the current window is spent.
 */
export function claimSelfHealAttempt(scope: string, now = Date.now()): boolean {
  const { allowed, next } = planSelfHeal(readRecord(scope), now);
  writeRecord(scope, next);
  return allowed;
}

/** Forget a scope's record (a successful, stable render after healing). */
export function clearSelfHealRecord(scope: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_PREFIX + scope);
  } catch {
    /* no-op */
  }
}
