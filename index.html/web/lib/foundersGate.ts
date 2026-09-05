// Client-side half of the sovereign founder gate (owner instruction
// 2026-09-04, item 4). The retired `?dev=true` / `?key=<secret>` /
// localStorage "granted" flags are GONE -- nothing in this bundle can decide
// that a visitor is the founder. Only the server can, by verifying the
// HMAC-signed HttpOnly cookie that middleware.ts mints for a correct
// `?sovereign_auth=<token>` (see lib/sovereignAuth.ts).
//
// What lives here is the tiny client protocol around that:
//   - `hasSovereignHint()`  -- is the non-HttpOnly hint cookie present? Used
//     ONLY to avoid a network round-trip for the public (no hint -> no call).
//     A forged hint just earns the forger a `founder: false` answer.
//   - `verifySovereignFounder()` -- GET /api/sovereign/verify, memoised for
//     the page lifetime so the curtain, the debug panel and any other
//     founder-only surface share one request.
//   - `revokeSovereignFounder()` -- DELETE /api/sovereign/verify.
//
// "Fail-closed" = anything missing, malformed, offline or erroring resolves
// to `founder: false` (gate stays shut). Founder QA shortcuts (`?dev=skip`,
// `?dev=replay`) are honoured by ComingSoonCinema ONLY after this verifies.

import {
  SOVEREIGN_AUTH_PARAM,
  SOVEREIGN_HINT_COOKIE,
  SOVEREIGN_HINT_VALUE,
  readCookieValue,
} from './sovereignAuth';

export { SOVEREIGN_AUTH_PARAM, SOVEREIGN_HINT_COOKIE };

export const SOVEREIGN_VERIFY_ENDPOINT = '/api/sovereign/verify';

/** Window CustomEvent (detail = phase) the curtain fires on every phase change. */
export const CINEMA_PHASE_EVENT = 'unitas:cinema-phase';

export interface SovereignVerification {
  founder: boolean;
  /** Unix seconds; null unless `founder`. */
  expiresAt: number | null;
}

const NOT_FOUNDER: SovereignVerification = { founder: false, expiresAt: null };

/** Pure: does this cookie string carry the hint? (unit-testable, no DOM) */
export function cookieHasSovereignHint(cookie: string): boolean {
  return readCookieValue(cookie || '', SOVEREIGN_HINT_COOKIE) === SOVEREIGN_HINT_VALUE;
}

/** Live browser read. SSR-safe (false on the server). */
export function hasSovereignHint(): boolean {
  if (typeof document === 'undefined') return false;
  return cookieHasSovereignHint(document.cookie);
}

let inflight: Promise<SovereignVerification> | null = null;

/**
 * Asks the server whether the current browser holds a valid founder session.
 * Skips the request entirely when there is no hint cookie (the public path),
 * unless `force` is set. Memoised per page load; `resetSovereignCache()`
 * drops the memo (after a revoke).
 */
export function verifySovereignFounder(force = false): Promise<SovereignVerification> {
  if (typeof window === 'undefined') return Promise.resolve(NOT_FOUNDER);
  if (!force && !hasSovereignHint()) return Promise.resolve(NOT_FOUNDER);
  if (inflight) return inflight;

  inflight = fetch(SOVEREIGN_VERIFY_ENDPOINT, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(async (res) => {
      if (!res.ok) return NOT_FOUNDER;
      const body = (await res.json()) as Partial<SovereignVerification>;
      return body.founder === true
        ? { founder: true, expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : null }
        : NOT_FOUNDER;
    })
    .catch(() => NOT_FOUNDER);

  return inflight;
}

export function resetSovereignCache(): void {
  inflight = null;
}

/** Founder sign-out: clears the signed session + hint cookies server-side. */
export async function revokeSovereignFounder(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch(SOVEREIGN_VERIFY_ENDPOINT, {
      method: 'DELETE',
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    /* offline -- the cookies simply expire on their own */
  }
  resetSovereignCache();
}
