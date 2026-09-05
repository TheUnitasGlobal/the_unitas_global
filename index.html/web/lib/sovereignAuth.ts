// Sovereign founder authentication (owner instruction 2026-09-04, item 4).
//
// Replaces the retired `?dev=true` / `?key=<client-side secret>` bypass with a
// server-verified token gate:
//
//   1. The founder opens any page with `?sovereign_auth=<token>`.
//   2. middleware.ts (Edge) compares the token against SOVEREIGN_AUTH_TOKEN
//      in constant time. On a match it mints an HMAC-SHA256-signed, expiring
//      session cookie (HttpOnly -- JavaScript can never read or forge it),
//      plus a non-HttpOnly hint cookie the client uses ONLY to decide whether
//      to ask the server. It then 303-redirects to the same URL with the token
//      stripped, so the secret never lingers in history / referrers / logs.
//   3. Client code (lib/foundersGate.ts) calls GET /api/sovereign/verify,
//      which validates the signed cookie server-side. Founder-only UI -- the
//      sealed-screen "enter main site" door, the debug panel -- renders only
//      on a `founder: true` answer. Nothing in the bundle can grant it.
//   4. middleware.ts also fail-closes every route under the sovereign
//      prefixes (`isSovereignProtectedPath`) with a bodiless 404 unless the
//      signed cookie verifies -- routes that don't exist for the public.
//
// Isomorphic + Edge-safe: only Web Crypto (`crypto.subtle`) and TextEncoder,
// which exist in the Edge runtime, Node >= 18 and every browser. Pure
// helpers are unit-tested in __tests__/gate/sovereignAuth.test.ts.

export const SOVEREIGN_AUTH_PARAM = 'sovereign_auth';

/**
 * Default founder token (owner-specified). SOVEREIGN_AUTH_TOKEN in the
 * environment overrides it without a code change; rotating either value
 * invalidates every outstanding session (the signing secret derives from it
 * unless SOVEREIGN_AUTH_SIGNING_SECRET is set explicitly).
 */
export const SOVEREIGN_AUTH_TOKEN_DEFAULT = 'unitas_master_dooyeong_2026_secure_key';

/** HttpOnly, signed session -- the only thing the server trusts. */
export const SOVEREIGN_SESSION_COOKIE = 'unitas_sovereign';
/** Client-visible hint ("a session might exist, go ask the server"). */
export const SOVEREIGN_HINT_COOKIE = 'unitas_sovereign_hint';
export const SOVEREIGN_HINT_VALUE = '1';
/** 30 days. */
export const SOVEREIGN_SESSION_TTL_SEC = 60 * 60 * 24 * 30;

const SESSION_VERSION = 'v1';
const REVOKE_VALUES = new Set(['off', 'revoke', 'logout', '0']);

export type SovereignParamVerdict = 'grant' | 'revoke' | 'reject' | 'none';

type EnvLike = Record<string, string | undefined>;

export function resolveSovereignToken(env: EnvLike = process.env): string {
  const fromEnv = env.SOVEREIGN_AUTH_TOKEN?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : SOVEREIGN_AUTH_TOKEN_DEFAULT;
}

export function resolveSovereignSigningSecret(env: EnvLike = process.env): string {
  const explicit = env.SOVEREIGN_AUTH_SIGNING_SECRET?.trim();
  if (explicit && explicit.length > 0) return explicit;
  return `${resolveSovereignToken(env)}::unitas-sovereign-hmac-${SESSION_VERSION}`;
}

/** Constant-time string comparison (no early exit on the first mismatch). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const length = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < length; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/** What a `?sovereign_auth=` value asks for. Fail-closed on anything odd. */
export function evaluateSovereignParam(search: string, token: string): SovereignParamVerdict {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || '');
  } catch {
    return 'none';
  }
  const raw = params.get(SOVEREIGN_AUTH_PARAM);
  if (raw === null) return 'none';
  const value = raw.trim();
  if (REVOKE_VALUES.has(value.toLowerCase())) return 'revoke';
  if (value.length === 0) return 'reject';
  return timingSafeEqualString(value, token) ? 'grant' : 'reject';
}

/** Same URL minus the auth param (other params -- ?splash=0, ?dev=skip -- survive). */
export function stripSovereignParam(url: URL): URL {
  const clean = new URL(url.toString());
  clean.searchParams.delete(SOVEREIGN_AUTH_PARAM);
  return clean;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

function sessionMessage(expiresAtSec: number): string {
  return `unitas-sovereign|${SESSION_VERSION}|${expiresAtSec}`;
}

/** Mints `v1.<expiresAtSec>.<hmac-sha256 hex>`. */
export async function signSovereignSession(expiresAtSec: number, secret: string): Promise<string> {
  const exp = Math.floor(expiresAtSec);
  const sig = await hmacHex(secret, sessionMessage(exp));
  return `${SESSION_VERSION}.${exp}.${sig}`;
}

export interface SovereignSessionCheck {
  ok: boolean;
  /** Unix seconds, only meaningful when `ok`. */
  expiresAt: number | null;
}

/** Verifies a session cookie value: shape, signature (constant-time), expiry. */
export async function verifySovereignSession(
  value: string | null | undefined,
  secret: string,
  nowSec: number = Date.now() / 1000,
): Promise<SovereignSessionCheck> {
  if (!value || typeof value !== 'string') return { ok: false, expiresAt: null };
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== SESSION_VERSION) return { ok: false, expiresAt: null };
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || !/^\d+$/.test(parts[1])) return { ok: false, expiresAt: null };
  if (exp <= nowSec) return { ok: false, expiresAt: null };
  if (!/^[0-9a-f]{64}$/.test(parts[2])) return { ok: false, expiresAt: null };
  try {
    const expected = await hmacHex(secret, sessionMessage(exp));
    return timingSafeEqualString(expected, parts[2])
      ? { ok: true, expiresAt: exp }
      : { ok: false, expiresAt: null };
  } catch {
    return { ok: false, expiresAt: null };
  }
}

/** Reads one cookie out of a raw `Cookie` header / `document.cookie` string. */
export function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    return trimmed.slice(name.length + 1);
  }
  return null;
}

/**
 * Routes that exist ONLY for a verified founder. Everything under
 * `/api/sovereign/` except the public boolean `verify` endpoint, plus a
 * `/sovereign` segment directly under any locale (or at the root) reserved
 * for future founder consoles. middleware.ts answers 404 for anyone else.
 */
export function isSovereignProtectedPath(pathname: string): boolean {
  if (pathname.startsWith('/api/sovereign/')) {
    return pathname !== '/api/sovereign/verify';
  }
  return /^\/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?\/)?sovereign(?:\/|$)/.test(pathname);
}
