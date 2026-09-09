// U-Shield token service -- SERVER side (REV-13, spec §6 + §10 item 16).
//
// Mints and verifies the short-lived attestation tokens handed to a visitor
// whose U-Signature behaviour cleared the floor. Design points:
//
//  - Web Crypto only (`crypto.subtle`, TextEncoder) -- the same primitives
//    lib/sovereignAuth.ts uses, so this works in Node route handlers, the
//    Edge runtime and vitest (Node >= 20 exposes globalThis.crypto.subtle).
//    lib/sovereignAuth.ts is FROZEN and keeps its `hmacHex` private, so the
//    pattern is re-implemented here rather than imported.
//  - DOMAIN SEPARATION from the founder session: the signing key is not the
//    raw secret but HMAC-SHA256(secret, 'unitas-usig-key-v1'), and the token
//    carries SIX dot-separated parts (`usig1.<issuedAt>.<expiresAt>.<bucket>.
//    <nonce>.<hex>`) versus the founder cookie's three (`v1.<exp>.<hex>`), so
//    neither token can ever be mistaken for -- or replayed as -- the other.
//  - FAIL-CLOSED configuration: in production (`VERCEL_ENV === 'production'`)
//    with neither SOVEREIGN_AUTH_SIGNING_SECRET nor SOVEREIGN_AUTH_TOKEN set,
//    `resolveUShieldSecret` returns null and the route answers 503; outside
//    production a fixed dev secret keeps local work unblocked.
//  - Verification is constant-time on the signature and checks shape, version,
//    bucket, nonce charset and expiry before trusting anything.
//
// Server-only: never import from a client component (it would drag env
// resolution into the bundle). Pure helpers are tested in
// __tests__/security/uShieldServer.test.ts.

export const U_SHIELD_TOKEN_VERSION = 'usig1';
/** Token lifetime -- long enough for one investment click, no longer. */
export const U_SHIELD_TOKEN_TTL_MS = 5 * 60 * 1000;
/** Score floor the route enforces (mirrors the client pre-filter). */
export const U_SHIELD_MIN_SCORE = 0.35;
/** Score at or above which a visitor lands in the trusted bucket. */
export const U_SHIELD_BUCKET_A_SCORE = 0.7;
/** Non-production fallback secret so `next dev` works without env vars. */
export const U_SHIELD_DEV_SECRET = 'unitas-usig-dev-secret';

const KEY_DERIVATION_LABEL = 'unitas-usig-key-v1';
const SOVEREIGN_HMAC_SUFFIX = 'unitas-sovereign-hmac-v1';
const TOKEN_PARTS = 6;
const NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const DIGITS_RE = /^\d{1,16}$/;

/** 'A' = high-confidence human (>= .7), 'B' = acceptable (>= .35). */
export type UShieldBucket = 'A' | 'B';

type EnvLike = Record<string, string | undefined>;

/** Buckets a validated score; null below the floor. */
export function bucketForScore(score: number): UShieldBucket | null {
  if (!Number.isFinite(score)) return null;
  if (score >= U_SHIELD_BUCKET_A_SCORE) return 'A';
  if (score >= U_SHIELD_MIN_SCORE) return 'B';
  return null;
}

/** True for a well-formed client nonce (also safe inside a dot-separated token). */
export function isValidUShieldNonce(nonce: unknown): nonce is string {
  return typeof nonce === 'string' && NONCE_RE.test(nonce);
}

/**
 * Secret resolution (spec §10 item 16). Order:
 *   1. SOVEREIGN_AUTH_SIGNING_SECRET (explicit)
 *   2. `${SOVEREIGN_AUTH_TOKEN}::unitas-sovereign-hmac-v1` (same derivation
 *      shape as the founder session; domain separation happens in the key
 *      derivation step, not here)
 *   3. production with neither -> null (route fails closed with 503)
 *   4. anything else -> the fixed dev secret
 */
export function resolveUShieldSecret(env: EnvLike = process.env): string | null {
  const explicit = env.SOVEREIGN_AUTH_SIGNING_SECRET?.trim();
  if (explicit && explicit.length > 0) return explicit;
  const token = env.SOVEREIGN_AUTH_TOKEN?.trim();
  if (token && token.length > 0) return `${token}::${SOVEREIGN_HMAC_SUFFIX}`;
  if (env.VERCEL_ENV === 'production') return null;
  return U_SHIELD_DEV_SECRET;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacRaw(keyBytes: Uint8Array<ArrayBuffer>, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

/**
 * Derived signing key = HMAC-SHA256(secret, 'unitas-usig-key-v1'). Even if
 * the founder session and U-Shield share the same root secret, their MACs
 * are computed under unrelated keys.
 */
async function deriveKey(secret: string): Promise<Uint8Array<ArrayBuffer>> {
  const raw = await hmacRaw(new TextEncoder().encode(secret), KEY_DERIVATION_LABEL);
  return new Uint8Array(raw);
}

function tokenMessage(issuedAt: number, expiresAt: number, bucket: UShieldBucket, nonce: string): string {
  return `${U_SHIELD_TOKEN_VERSION}|${issuedAt}|${expiresAt}|${bucket}|${nonce}`;
}

/** Constant-time string comparison (no early exit on the first mismatch). */
function timingSafeEqualString(a: string, b: string): boolean {
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

export interface MintOptions {
  /** Unix ms; defaults to Date.now(). */
  now?: number;
  /** Defaults to U_SHIELD_TOKEN_TTL_MS. */
  ttlMs?: number;
  /** Defaults to resolveUShieldSecret(); throws if that is null. */
  secret?: string;
}

export interface MintedUShieldToken {
  token: string;
  issuedAt: number;
  expiresAt: number;
  bucket: UShieldBucket;
}

/**
 * Mints `usig1.<issuedAt>.<expiresAt>.<bucket>.<nonce>.<hex>` (unix ms).
 * Throws on an invalid nonce or a missing secret -- callers (the route)
 * validate first and translate failures into fail-closed responses.
 */
export async function mintUShieldToken(
  bucket: UShieldBucket,
  nonce: string,
  options: MintOptions = {},
): Promise<MintedUShieldToken> {
  if (!isValidUShieldNonce(nonce)) throw new Error('u-shield: invalid nonce');
  const secret = options.secret ?? resolveUShieldSecret();
  if (!secret) throw new Error('u-shield: unconfigured');
  const issuedAt = Math.floor(options.now ?? Date.now());
  const ttl = Math.max(1000, Math.floor(options.ttlMs ?? U_SHIELD_TOKEN_TTL_MS));
  const expiresAt = issuedAt + ttl;
  const key = await deriveKey(secret);
  const sig = toHex(await hmacRaw(key, tokenMessage(issuedAt, expiresAt, bucket, nonce)));
  return {
    token: `${U_SHIELD_TOKEN_VERSION}.${issuedAt}.${expiresAt}.${bucket}.${nonce}.${sig}`,
    issuedAt,
    expiresAt,
    bucket,
  };
}

export interface UShieldTokenParts {
  issuedAt: number;
  expiresAt: number;
  bucket: UShieldBucket;
  nonce: string;
  signature: string;
}

/**
 * Shape-only parse (no crypto). Rejects anything that is not exactly six
 * parts with the `usig1` prefix -- a three-part founder session can never
 * pass, whatever it contains.
 */
export function parseUShieldToken(token: unknown): UShieldTokenParts | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > 256) return null;
  const parts = token.split('.');
  if (parts.length !== TOKEN_PARTS) return null;
  const [version, issuedRaw, expiresRaw, bucketRaw, nonce, signature] = parts as [
    string, string, string, string, string, string,
  ];
  if (version !== U_SHIELD_TOKEN_VERSION) return null;
  if (!DIGITS_RE.test(issuedRaw) || !DIGITS_RE.test(expiresRaw)) return null;
  if (bucketRaw !== 'A' && bucketRaw !== 'B') return null;
  if (!NONCE_RE.test(nonce)) return null;
  if (!HEX64_RE.test(signature)) return null;
  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) || expiresAt <= issuedAt) {
    return null;
  }
  return { issuedAt, expiresAt, bucket: bucketRaw, nonce, signature };
}

export interface VerifyOptions {
  /** Unix ms; defaults to Date.now(). */
  now?: number;
  /** Defaults to resolveUShieldSecret(); a null secret verifies nothing. */
  secret?: string;
}

/**
 * Verifies shape, expiry and signature (constant-time). Async because Web
 * Crypto is async; resolves `false` on every failure and never throws.
 */
export async function verifyUShieldToken(
  token: unknown,
  options: VerifyOptions = {},
): Promise<boolean> {
  try {
    const parts = parseUShieldToken(token);
    if (!parts) return false;
    const now = options.now ?? Date.now();
    if (now >= parts.expiresAt) return false;
    // Reject tokens "issued" in the future beyond clock-skew tolerance.
    if (parts.issuedAt > now + 120_000) return false;
    const secret = options.secret ?? resolveUShieldSecret();
    if (!secret) return false;
    const key = await deriveKey(secret);
    const expected = toHex(
      await hmacRaw(key, tokenMessage(parts.issuedAt, parts.expiresAt, parts.bucket, parts.nonce)),
    );
    return timingSafeEqualString(expected, parts.signature);
  } catch {
    return false;
  }
}
