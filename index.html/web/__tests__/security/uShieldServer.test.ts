import { describe, expect, it } from 'vitest';
import {
  U_SHIELD_BUCKET_A_SCORE,
  U_SHIELD_DEV_SECRET,
  U_SHIELD_MIN_SCORE,
  U_SHIELD_TOKEN_VERSION,
  bucketForScore,
  isValidUShieldNonce,
  mintUShieldToken,
  parseUShieldToken,
  resolveUShieldSecret,
  verifyUShieldToken,
} from '../../lib/security/uShieldServer';

// Pure/async-crypto helpers only -- no fixtures shared with other
// __tests__/** files (see CLAUDE.md "Module-level test isolation"). Node's
// global Web Crypto (globalThis.crypto.subtle) backs every HMAC here, same
// as lib/sovereignAuth.ts, so these run under plain vitest with no DOM.

const SECRET = 'test-u-shield-secret';
const NONCE = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'; // 32 hex chars -> well inside 16-64

describe('bucketForScore', () => {
  it('buckets A at/above 0.7, B from 0.35 up to (not including) 0.7, null below', () => {
    expect(bucketForScore(U_SHIELD_BUCKET_A_SCORE)).toBe('A');
    expect(bucketForScore(1)).toBe('A');
    expect(bucketForScore(0.9)).toBe('A');
    expect(bucketForScore(U_SHIELD_MIN_SCORE)).toBe('B');
    expect(bucketForScore(0.69999)).toBe('B');
    expect(bucketForScore(0.34999)).toBe(null);
    expect(bucketForScore(0)).toBe(null);
  });

  it('rejects non-finite input', () => {
    expect(bucketForScore(Number.NaN)).toBe(null);
    expect(bucketForScore(Number.POSITIVE_INFINITY)).toBe(null);
  });
});

describe('isValidUShieldNonce', () => {
  it('accepts 16-64 char [A-Za-z0-9_-] strings', () => {
    expect(isValidUShieldNonce(NONCE)).toBe(true);
    expect(isValidUShieldNonce('a'.repeat(16))).toBe(true);
    expect(isValidUShieldNonce('a'.repeat(64))).toBe(true);
    expect(isValidUShieldNonce('Az09_-'.repeat(6))).toBe(true); // 36 chars, valid charset
  });

  it('rejects too short, too long, wrong type and bad characters', () => {
    expect(isValidUShieldNonce('a'.repeat(15))).toBe(false);
    expect(isValidUShieldNonce('a'.repeat(65))).toBe(false);
    expect(isValidUShieldNonce(NONCE + '.')).toBe(false);
    expect(isValidUShieldNonce(NONCE.slice(0, 20) + ' '.repeat(12))).toBe(false);
    expect(isValidUShieldNonce(12345)).toBe(false);
    expect(isValidUShieldNonce(null)).toBe(false);
    expect(isValidUShieldNonce(undefined)).toBe(false);
  });
});

describe('resolveUShieldSecret -- domain-separated from the founder session, fail-closed in production', () => {
  it('prefers an explicit signing secret', () => {
    expect(resolveUShieldSecret({ SOVEREIGN_AUTH_SIGNING_SECRET: ' explicit ' })).toBe('explicit');
  });

  it('falls back to the founder token, domain-suffixed', () => {
    expect(resolveUShieldSecret({ SOVEREIGN_AUTH_TOKEN: 'founder-token' })).toBe(
      'founder-token::unitas-sovereign-hmac-v1',
    );
  });

  it('returns null (fail-closed) in production with neither secret configured', () => {
    expect(resolveUShieldSecret({ VERCEL_ENV: 'production' })).toBe(null);
  });

  it('falls back to the fixed dev secret outside production', () => {
    expect(resolveUShieldSecret({})).toBe(U_SHIELD_DEV_SECRET);
    expect(resolveUShieldSecret({ VERCEL_ENV: 'preview' })).toBe(U_SHIELD_DEV_SECRET);
  });
});

describe('parseUShieldToken -- shape only, no crypto', () => {
  it('rejects a founder-style 3-part session token outright', async () => {
    // Same dot-separated shape family as lib/sovereignAuth.ts signSovereignSession
    // ('v1.<exp>.<64-hex>') -- must never be mistaken for a 6-part U-Shield token.
    const founderStyle = `v1.${Math.floor(Date.now() / 1000) + 3600}.${'a'.repeat(64)}`;
    expect(parseUShieldToken(founderStyle)).toBe(null);
    expect(await verifyUShieldToken(founderStyle, { secret: SECRET })).toBe(false);
  });

  it('rejects the wrong version prefix, non-digit timestamps, a bad bucket, a bad nonce and a bad hex length', () => {
    const good = `${U_SHIELD_TOKEN_VERSION}.1000.2000.B.${NONCE}.${'a'.repeat(64)}`;
    expect(parseUShieldToken(good)).not.toBeNull();
    expect(parseUShieldToken(good.replace(U_SHIELD_TOKEN_VERSION, 'usig2'))).toBe(null);
    expect(parseUShieldToken(`${U_SHIELD_TOKEN_VERSION}.abc.2000.B.${NONCE}.${'a'.repeat(64)}`)).toBe(null);
    expect(parseUShieldToken(`${U_SHIELD_TOKEN_VERSION}.1000.2000.C.${NONCE}.${'a'.repeat(64)}`)).toBe(null);
    expect(parseUShieldToken(`${U_SHIELD_TOKEN_VERSION}.1000.2000.B.short.${'a'.repeat(64)}`)).toBe(null);
    expect(parseUShieldToken(`${U_SHIELD_TOKEN_VERSION}.1000.2000.B.${NONCE}.${'a'.repeat(63)}`)).toBe(null);
    expect(parseUShieldToken(`${U_SHIELD_TOKEN_VERSION}.1000.2000.B.${NONCE}.${'g'.repeat(64)}`)).toBe(null);
  });

  it('rejects expiresAt <= issuedAt and any non-6-part string', () => {
    expect(parseUShieldToken(`${U_SHIELD_TOKEN_VERSION}.2000.1000.B.${NONCE}.${'a'.repeat(64)}`)).toBe(null);
    expect(parseUShieldToken(`${U_SHIELD_TOKEN_VERSION}.1.2.3.4`)).toBe(null);
    expect(parseUShieldToken('')).toBe(null);
    expect(parseUShieldToken(undefined)).toBe(null);
    expect(parseUShieldToken(12345)).toBe(null);
  });
});

describe('mintUShieldToken / verifyUShieldToken -- round trip', () => {
  it('mints a well-formed 6-part token and verifies it', async () => {
    const now = 1_800_000_000_000;
    const minted = await mintUShieldToken('B', NONCE, { secret: SECRET, now });
    expect(minted.token).toMatch(
      new RegExp(`^${U_SHIELD_TOKEN_VERSION}\\.\\d+\\.\\d+\\.B\\.${NONCE}\\.[0-9a-f]{64}$`),
    );
    expect(minted.issuedAt).toBe(now);
    expect(minted.bucket).toBe('B');
    expect(minted.expiresAt).toBeGreaterThan(minted.issuedAt);

    const ok = await verifyUShieldToken(minted.token, { secret: SECRET, now: now + 1000 });
    expect(ok).toBe(true);
  });

  it('mints distinct tokens (and buckets) for A vs B at the same instant', async () => {
    const now = 1_800_000_000_000;
    const a = await mintUShieldToken('A', NONCE, { secret: SECRET, now });
    const b = await mintUShieldToken('B', NONCE, { secret: SECRET, now });
    expect(a.token).not.toBe(b.token);
    expect(a.bucket).toBe('A');
    expect(b.bucket).toBe('B');
  });

  it('fails a tampered signature (last hex nibble flipped)', async () => {
    const minted = await mintUShieldToken('A', NONCE, { secret: SECRET, now: 1_800_000_000_000 });
    const parts = minted.token.split('.');
    const sig = parts[5] as string;
    const flipped = `${sig.slice(0, -1)}${sig.endsWith('0') ? '1' : '0'}`;
    parts[5] = flipped;
    const tampered = parts.join('.');
    expect(await verifyUShieldToken(tampered, { secret: SECRET })).toBe(false);
  });

  it('fails when any other field is tampered without re-signing (bucket escalation attempt)', async () => {
    const minted = await mintUShieldToken('B', NONCE, { secret: SECRET, now: 1_800_000_000_000 });
    const escalated = minted.token.replace('.B.', '.A.');
    expect(await verifyUShieldToken(escalated, { secret: SECRET })).toBe(false);
  });

  it('fails an expired token even with a correct signature', async () => {
    const now = 1_800_000_000_000;
    const minted = await mintUShieldToken('B', NONCE, { secret: SECRET, now, ttlMs: 5000 });
    expect(await verifyUShieldToken(minted.token, { secret: SECRET, now: minted.expiresAt })).toBe(false);
    expect(await verifyUShieldToken(minted.token, { secret: SECRET, now: minted.expiresAt + 60_000 })).toBe(
      false,
    );
    // Still valid one millisecond before expiry.
    expect(await verifyUShieldToken(minted.token, { secret: SECRET, now: minted.expiresAt - 1 })).toBe(true);
  });

  it('fails when verified against the wrong secret', async () => {
    const minted = await mintUShieldToken('B', NONCE, { secret: SECRET, now: 1_800_000_000_000 });
    expect(await verifyUShieldToken(minted.token, { secret: 'wrong-secret' })).toBe(false);
  });

  it('fails closed when handed an empty/unresolved secret directly', async () => {
    const minted = await mintUShieldToken('B', NONCE, { secret: SECRET, now: 1_800_000_000_000 });
    expect(await verifyUShieldToken(minted.token, { secret: '' })).toBe(false);
  });

  it('rejects a token "issued" far in the future (beyond clock-skew tolerance)', async () => {
    const now = 1_800_000_000_000;
    const minted = await mintUShieldToken('B', NONCE, { secret: SECRET, now: now + 10 * 60_000 });
    expect(await verifyUShieldToken(minted.token, { secret: SECRET, now })).toBe(false);
  });

  it('never throws -- garbage input resolves false', async () => {
    await expect(verifyUShieldToken(undefined, { secret: SECRET })).resolves.toBe(false);
    await expect(verifyUShieldToken('not-a-token', { secret: SECRET })).resolves.toBe(false);
    await expect(verifyUShieldToken(null as unknown as string, { secret: SECRET })).resolves.toBe(false);
  });

  it('mint throws on an invalid nonce or a missing secret (callers validate first)', async () => {
    await expect(mintUShieldToken('B', 'too-short', { secret: SECRET })).rejects.toThrow();
    await expect(mintUShieldToken('B', NONCE, { secret: '' })).rejects.toThrow();
  });
});
