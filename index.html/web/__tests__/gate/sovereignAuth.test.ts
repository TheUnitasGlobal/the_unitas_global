import { describe, expect, it } from 'vitest';
import {
  SOVEREIGN_AUTH_PARAM,
  SOVEREIGN_AUTH_TOKEN_DEFAULT,
  evaluateSovereignParam,
  isSovereignProtectedPath,
  readCookieValue,
  resolveSovereignSigningSecret,
  resolveSovereignToken,
  signSovereignSession,
  stripSovereignParam,
  timingSafeEqualString,
  verifySovereignSession,
} from '../../lib/sovereignAuth';

// Pure helpers only -- no fixtures shared with other __tests__/** files
// (see CLAUDE.md "Module-level test isolation").
const TOKEN = SOVEREIGN_AUTH_TOKEN_DEFAULT;
const SECRET = resolveSovereignSigningSecret({});

describe('sovereign auth -- token param', () => {
  it('uses the owner token by default and honours the env override', () => {
    expect(resolveSovereignToken({})).toBe('unitas_master_dooyeong_2026_secure_key');
    expect(resolveSovereignToken({ SOVEREIGN_AUTH_TOKEN: ' rotated ' })).toBe('rotated');
    expect(resolveSovereignToken({ SOVEREIGN_AUTH_TOKEN: '' })).toBe(TOKEN);
  });

  it('grants only on an exact token match', () => {
    expect(evaluateSovereignParam(`?${SOVEREIGN_AUTH_PARAM}=${TOKEN}`, TOKEN)).toBe('grant');
    expect(evaluateSovereignParam(`?a=1&${SOVEREIGN_AUTH_PARAM}=${TOKEN}&b=2`, TOKEN)).toBe('grant');
    expect(evaluateSovereignParam(`?${SOVEREIGN_AUTH_PARAM}=${TOKEN}x`, TOKEN)).toBe('reject');
    expect(evaluateSovereignParam(`?${SOVEREIGN_AUTH_PARAM}=${TOKEN.toUpperCase()}`, TOKEN)).toBe('reject');
    expect(evaluateSovereignParam(`?${SOVEREIGN_AUTH_PARAM}=`, TOKEN)).toBe('reject');
  });

  it('never grants on the retired dev/key params', () => {
    expect(evaluateSovereignParam('?dev=true', TOKEN)).toBe('none');
    expect(evaluateSovereignParam('?key=sovereign-64-023911', TOKEN)).toBe('none');
    expect(evaluateSovereignParam('', TOKEN)).toBe('none');
  });

  it('recognises revoke values and tolerates malformed input', () => {
    expect(evaluateSovereignParam(`?${SOVEREIGN_AUTH_PARAM}=off`, TOKEN)).toBe('revoke');
    expect(evaluateSovereignParam(`?${SOVEREIGN_AUTH_PARAM}=REVOKE`, TOKEN)).toBe('revoke');
    expect(() => evaluateSovereignParam('%%%', TOKEN)).not.toThrow();
  });

  it('strips only the auth param from a URL', () => {
    const url = new URL(`https://www.theunitas.global/ko?${SOVEREIGN_AUTH_PARAM}=${TOKEN}&splash=0`);
    expect(stripSovereignParam(url).toString()).toBe('https://www.theunitas.global/ko?splash=0');
    // original untouched
    expect(url.searchParams.get(SOVEREIGN_AUTH_PARAM)).toBe(TOKEN);
  });

  it('compares in constant time semantics (equality only)', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
    expect(timingSafeEqualString('abc', 'ab')).toBe(false);
    expect(timingSafeEqualString('', '')).toBe(true);
  });
});

describe('sovereign auth -- signed session', () => {
  it('round-trips a freshly signed session', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const cookie = await signSovereignSession(exp, SECRET);
    expect(cookie).toMatch(/^v1\.\d+\.[0-9a-f]{64}$/);
    const check = await verifySovereignSession(cookie, SECRET);
    expect(check).toEqual({ ok: true, expiresAt: exp });
  });

  it('rejects tampering, wrong secret, expiry and garbage', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const cookie = await signSovereignSession(exp, SECRET);
    const [v, e, sig] = cookie.split('.');

    // signature bit-flip
    const flipped = `${sig.slice(0, -1)}${sig.endsWith('0') ? '1' : '0'}`;
    expect((await verifySovereignSession(`${v}.${e}.${flipped}`, SECRET)).ok).toBe(false);
    // expiry extended without re-signing
    expect((await verifySovereignSession(`${v}.${Number(e) + 999}.${sig}`, SECRET)).ok).toBe(false);
    // different secret (token rotated)
    expect((await verifySovereignSession(cookie, `${SECRET}-rotated`)).ok).toBe(false);
    // expired
    const stale = await signSovereignSession(Math.floor(Date.now() / 1000) - 5, SECRET);
    expect((await verifySovereignSession(stale, SECRET)).ok).toBe(false);
    // shape
    for (const bad of ['', 'v1', 'v1.abc.def', 'granted', 'v2.1.' + 'a'.repeat(64), undefined, null]) {
      expect((await verifySovereignSession(bad, SECRET)).ok).toBe(false);
    }
  });

  it('derives the signing secret from the token unless set explicitly', () => {
    expect(resolveSovereignSigningSecret({})).toContain(TOKEN);
    expect(resolveSovereignSigningSecret({ SOVEREIGN_AUTH_SIGNING_SECRET: 'x' })).toBe('x');
    expect(resolveSovereignSigningSecret({ SOVEREIGN_AUTH_TOKEN: 'other' })).not.toBe(
      resolveSovereignSigningSecret({}),
    );
  });
});

describe('sovereign auth -- cookies + protected routes', () => {
  it('reads a cookie by exact name only', () => {
    expect(readCookieValue('a=1; unitas_sovereign_hint=1; b=2', 'unitas_sovereign_hint')).toBe('1');
    expect(readCookieValue('not_unitas_sovereign_hint=1', 'unitas_sovereign_hint')).toBeNull();
    expect(readCookieValue('', 'unitas_sovereign_hint')).toBeNull();
  });

  it('fences the sovereign prefixes and leaves everything else public', () => {
    expect(isSovereignProtectedPath('/api/sovereign/console')).toBe(true);
    expect(isSovereignProtectedPath('/api/sovereign/verify')).toBe(false);
    expect(isSovereignProtectedPath('/sovereign')).toBe(true);
    expect(isSovereignProtectedPath('/ko/sovereign/panel')).toBe(true);
    expect(isSovereignProtectedPath('/en')).toBe(false);
    expect(isSovereignProtectedPath('/en/company/about')).toBe(false);
    expect(isSovereignProtectedPath('/api/u-ai/trend')).toBe(false);
  });
});
