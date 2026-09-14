import { describe, expect, it } from 'vitest';
import {
  SOVEREIGN_MASTER_HEADER,
  looksLikeCapsule,
  normalizeMasterCredential,
  readMasterCredential,
  verifyMasterKey,
  verifyMasterKeyRequest,
} from '../../lib/sovereign/masterKey';
import { signSovereignSession } from '../../lib/sovereignAuth';

// REV-24 MISSION 2 -- the Sovereign Master Key. Pure helpers only; no
// fixtures shared with other __tests__/** files (CLAUDE.md "Module-level
// test isolation").

const TOKEN = 'rev24-master-token-under-test';
const SECRET = `${TOKEN}::unitas-sovereign-hmac-v1`;
const NOW = 1_800_000_000;

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe('normalizeMasterCredential', () => {
  it('passes a bare credential through, trimmed', () => {
    expect(normalizeMasterCredential('  abc  ')).toBe('abc');
  });

  it('strips a Bearer scheme in any casing', () => {
    expect(normalizeMasterCredential('Bearer abc')).toBe('abc');
    expect(normalizeMasterCredential('bearer  abc ')).toBe('abc');
    expect(normalizeMasterCredential('BEARER abc')).toBe('abc');
  });

  it('is empty for anything absent or blank', () => {
    expect(normalizeMasterCredential(null)).toBe('');
    expect(normalizeMasterCredential(undefined)).toBe('');
    expect(normalizeMasterCredential('')).toBe('');
    expect(normalizeMasterCredential('   ')).toBe('');
  });
});

describe('readMasterCredential', () => {
  it('prefers the covert header', () => {
    const h = headers({ [SOVEREIGN_MASTER_HEADER]: 'from-header', authorization: 'Bearer from-auth' });
    expect(readMasterCredential(h)).toBe('from-header');
  });

  it('falls back to Authorization so a monitor that can only set that still works', () => {
    expect(readMasterCredential(headers({ authorization: 'Bearer from-auth' }))).toBe('from-auth');
  });

  it('is empty when the request offers nothing -- the public path', () => {
    expect(readMasterCredential(headers({ 'user-agent': 'Mozilla/5.0' }))).toBe('');
    expect(readMasterCredential(null)).toBe('');
    expect(readMasterCredential(undefined)).toBe('');
  });
});

describe('looksLikeCapsule', () => {
  it('recognises the v1.<exp>.<64 hex> shape and nothing else', () => {
    expect(looksLikeCapsule(`v1.${NOW}.${'a'.repeat(64)}`)).toBe(true);
    expect(looksLikeCapsule(`v2.${NOW}.${'a'.repeat(64)}`)).toBe(false);
    expect(looksLikeCapsule(`v1.${NOW}.${'a'.repeat(63)}`)).toBe(false);
    expect(looksLikeCapsule(`v1.${NOW}.${'A'.repeat(64)}`)).toBe(false);
    expect(looksLikeCapsule(TOKEN)).toBe(false);
    expect(looksLikeCapsule('')).toBe(false);
  });
});

describe('verifyMasterKey -- the signed capsule path', () => {
  it('accepts a capsule signed with the live secret', async () => {
    const capsule = await signSovereignSession(NOW + 3600, SECRET);
    const check = await verifyMasterKey(capsule, SECRET, TOKEN, NOW);
    expect(check).toEqual({ ok: true, via: 'capsule', expiresAt: NOW + 3600 });
  });

  it('accepts it through a Bearer scheme too', async () => {
    const capsule = await signSovereignSession(NOW + 3600, SECRET);
    expect((await verifyMasterKey(`Bearer ${capsule}`, SECRET, TOKEN, NOW)).ok).toBe(true);
  });

  it('rejects an EXPIRED capsule', async () => {
    const capsule = await signSovereignSession(NOW - 1, SECRET);
    expect(await verifyMasterKey(capsule, SECRET, TOKEN, NOW)).toEqual({
      ok: false,
      via: 'reject',
      expiresAt: null,
    });
  });

  it('rejects a capsule signed with a DIFFERENT secret -- rotation revokes', async () => {
    const capsule = await signSovereignSession(NOW + 3600, 'some-other-secret');
    expect((await verifyMasterKey(capsule, SECRET, TOKEN, NOW)).ok).toBe(false);
  });

  it('rejects a capsule whose expiry was tampered with', async () => {
    const capsule = await signSovereignSession(NOW + 60, SECRET);
    const [, , sig] = capsule.split('.');
    expect((await verifyMasterKey(`v1.${NOW + 999_999}.${sig}`, SECRET, TOKEN, NOW)).ok).toBe(false);
  });
});

describe('verifyMasterKey -- the raw token path', () => {
  it('accepts the exact master token', async () => {
    expect(await verifyMasterKey(TOKEN, SECRET, TOKEN, NOW)).toEqual({
      ok: true,
      via: 'token',
      expiresAt: null,
    });
  });

  it('rejects a near-miss token', async () => {
    expect((await verifyMasterKey(`${TOKEN}x`, SECRET, TOKEN, NOW)).ok).toBe(false);
    expect((await verifyMasterKey(TOKEN.slice(0, -1), SECRET, TOKEN, NOW)).ok).toBe(false);
    expect((await verifyMasterKey(TOKEN.toUpperCase(), SECRET, TOKEN, NOW)).ok).toBe(false);
  });
});

describe('verifyMasterKey -- fail-closed', () => {
  it('rejects when nothing is offered, without needing a secret', async () => {
    expect((await verifyMasterKey('', SECRET, TOKEN, NOW)).ok).toBe(false);
    expect((await verifyMasterKey('   ', SECRET, TOKEN, NOW)).ok).toBe(false);
  });

  it('rejects EVERYTHING when the environment has no token and no secret', async () => {
    // The production posture with SOVEREIGN_AUTH_TOKEN unset: the master key
    // is fully disabled rather than running on a leaked default.
    const capsule = await signSovereignSession(NOW + 3600, SECRET);
    expect((await verifyMasterKey(capsule, null, null, NOW)).ok).toBe(false);
    expect((await verifyMasterKey(TOKEN, null, null, NOW)).ok).toBe(false);
  });

  it('rejects junk of every shape', async () => {
    for (const junk of ['null', 'undefined', '{}', 'v1..', 'v1.abc.def', '../../etc/passwd', '1']) {
      expect((await verifyMasterKey(junk, SECRET, TOKEN, NOW)).ok, junk).toBe(false);
    }
  });
});

describe('verifyMasterKeyRequest', () => {
  const env = { SOVEREIGN_AUTH_TOKEN: TOKEN };

  it('verifies a request carrying the covert header', async () => {
    const check = await verifyMasterKeyRequest(headers({ [SOVEREIGN_MASTER_HEADER]: TOKEN }), env);
    expect(check.ok).toBe(true);
    expect(check.via).toBe('token');
  });

  it('verifies a capsule minted against the derived signing secret', async () => {
    const capsule = await signSovereignSession(Math.floor(Date.now() / 1000) + 600, SECRET);
    const check = await verifyMasterKeyRequest(headers({ [SOVEREIGN_MASTER_HEADER]: capsule }), env);
    expect(check.ok).toBe(true);
    expect(check.via).toBe('capsule');
  });

  it('short-circuits an ordinary public request', async () => {
    expect(await verifyMasterKeyRequest(headers({ 'user-agent': 'Mozilla/5.0' }), env)).toEqual({
      ok: false,
      via: 'reject',
      expiresAt: null,
    });
  });

  it('fails closed in a production-shaped env with no token', async () => {
    const prod = { VERCEL_ENV: 'production' };
    expect((await verifyMasterKeyRequest(headers({ [SOVEREIGN_MASTER_HEADER]: TOKEN }), prod)).ok).toBe(false);
  });
});
