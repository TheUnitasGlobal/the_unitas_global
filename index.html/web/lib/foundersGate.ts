// Fail-closed founder/developer bypass for the pre-launch "Coming Soon" gate.
//
// The public NEVER reaches the main interface: <ComingSoonCinema/> renders an
// opaque, non-dismissable overlay for everyone by default. Only the founder
// (for build/QA) gets through, via one of:
//   - URL param  ?dev=true  (or ?dev=1)
//   - URL param  ?key=<FOUNDER_BYPASS_SECRET>   (or ?bypass=<secret>)
//   - a persisted grant (localStorage / cookie) written after any of the above,
//     so the founder doesn't need to re-append the param on every navigation.
//
// "Fail-closed" = anything unrecognised, missing, or malformed resolves to
// `false` (gate stays shut). There is no server trust boundary here -- this is
// a soft pre-launch curtain, not an authorization system. Real access control
// lives in Supabase RLS / `spend_coins()` etc.

export const FOUNDER_BYPASS_STORAGE_KEY = 'unitas_founder_bypass';
export const FOUNDER_BYPASS_COOKIE = 'unitas_dev';
export const FOUNDER_BYPASS_GRANT_VALUE = 'granted';

// Rotating this value re-seals every browser that only had a param-based grant
// persisted. Deliberately not a real secret (it ships in the client bundle) --
// it only raises the bar above "guess ?dev=true".
export const FOUNDER_BYPASS_SECRET = 'sovereign-64-023911';

export interface FounderBypassInputs {
  /** `window.location.search`, e.g. "?dev=true". */
  search: string;
  /** `document.cookie`. */
  cookie: string;
  /** Current persisted grant value, or null. */
  storage: string | null;
}

function cookieHasGrant(cookie: string): boolean {
  return cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${FOUNDER_BYPASS_COOKIE}=1` || part === `${FOUNDER_BYPASS_COOKIE}=true`);
}

/** Pure predicate -- unit-tested in __tests__/gate/foundersGate.test.ts. */
export function evaluateFounderBypass({ search, cookie, storage }: FounderBypassInputs): boolean {
  if (storage === FOUNDER_BYPASS_GRANT_VALUE) return true;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || '');
  } catch {
    return cookieHasGrant(cookie || '');
  }

  const dev = params.get('dev');
  if (dev === 'true' || dev === '1') return true;

  if (params.get('key') === FOUNDER_BYPASS_SECRET) return true;
  if (params.get('bypass') === FOUNDER_BYPASS_SECRET) return true;

  return cookieHasGrant(cookie || '');
}

/** Reads the live browser environment. SSR-safe (returns false on the server). */
export function readFounderBypass(): boolean {
  if (typeof window === 'undefined') return false;
  let storage: string | null = null;
  try {
    storage = window.localStorage.getItem(FOUNDER_BYPASS_STORAGE_KEY);
  } catch {
    storage = null;
  }
  return evaluateFounderBypass({
    search: window.location.search,
    cookie: typeof document !== 'undefined' ? document.cookie : '',
    storage,
  });
}

/** Persists the grant (localStorage + a 1-year cookie) so it survives reloads. */
export function persistFounderBypass(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FOUNDER_BYPASS_STORAGE_KEY, FOUNDER_BYPASS_GRANT_VALUE);
  } catch {
    /* private mode / storage disabled -- cookie below still covers the session */
  }
  try {
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${FOUNDER_BYPASS_COOKIE}=1; path=/; max-age=${oneYear}; SameSite=Lax`;
  } catch {
    /* no-op */
  }
}

/** Clears a persisted grant (used by the ?dev=off escape hatch). */
export function revokeFounderBypass(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(FOUNDER_BYPASS_STORAGE_KEY);
  } catch {
    /* no-op */
  }
  try {
    document.cookie = `${FOUNDER_BYPASS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* no-op */
  }
}
