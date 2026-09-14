// REV-25 MISSION 3 -- the Sovereign Master Key, whole lifecycle (founder
// directive 2026-09-13).
//
// REV-24 proved the key OPENS things. What it never proved is the other half
// of "Fail-Proof": that the credential is a real cryptographic object with an
// expiry and a signature that cover their own claims, that a forgery of any
// shape is indistinguishable from no credential at all, and that the promotion
// chain the founder actually lives in -- header -> session cookie -> console
// on the cookie alone -> revoke -> sealed again -- closes.
//
// The capsules here are MINTED IN THIS FILE from the local development secret
// (`_sovereignToken.js` + the documented derivation in lib/sovereignAuth.ts),
// against the local `next start` on 127.0.0.1. No production secret is read,
// used or printed: the point is to exercise the algorithm, and the algorithm
// is the same one production runs.
const crypto = require('crypto');
const { test, expect } = require('@playwright/test');

test.describe.configure({ timeout: 120_000 });
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');

const KEY_HEADER = 'x-unitas-signature';
const SESSION_COOKIE = 'unitas_sovereign';
const HINT_COOKIE = 'unitas_sovereign_hint';

// Mirrors resolveSovereignSigningSecret(): an explicit secret wins, otherwise
// it is derived from the master token. Keep this in step with
// web/lib/sovereignAuth.ts if the derivation ever changes.
const SIGNING_SECRET = (process.env.SOVEREIGN_AUTH_SIGNING_SECRET || '').trim() || `${TOKEN}::unitas-sovereign-hmac-v1`;

const nowSec = () => Math.floor(Date.now() / 1000);

/** `v1.<expiresAtSec>.<hmac-sha256 hex>` -- the session-cookie format. */
function mintCapsule(expiresAtSec, secret = SIGNING_SECRET) {
  const exp = Math.floor(expiresAtSec);
  const sig = crypto.createHmac('sha256', secret).update(`unitas-sovereign|v1|${exp}`).digest('hex');
  return `v1.${exp}.${sig}`;
}

/** One probe from a context that has never been anywhere. */
async function virgin(browser, path, headers) {
  const ctx = await browser.newContext();
  try {
    const res = await ctx.request.get(path, { maxRedirects: 0, headers });
    return { status: res.status(), gate: res.headers()['x-unitas-gate'], location: res.headers()['location'] };
  } finally {
    await ctx.close();
  }
}

test.describe('REV-25 M3 -- the master key is a real credential', () => {
  test('a freshly minted capsule walks the funnel and opens the hidden console', async ({ browser }) => {
    const capsule = mintCapsule(nowSec() + 3600);
    expect(capsule, 'the capsule must be the documented shape').toMatch(/^v1\.\d+\.[0-9a-f]{64}$/);

    const sealed = await virgin(browser, '/');
    expect(sealed.status, 'baseline: a stranger is sealed').toBe(307);
    expect(sealed.gate).toBe('seal');

    const passed = await virgin(browser, '/', { [KEY_HEADER]: capsule });
    expect(passed.status, 'a signed capsule must pass the funnel').toBe(200);
    expect(passed.gate).toBe('pass');

    // The console lives behind a 404 fence, so "opens" means it stops being
    // absent. `/sovereign`, not `/en/sovereign`: localePrefix is 'as-needed'
    // and `/en/*` 307s before the gate is ever consulted (REV-24 measured).
    const shut = await virgin(browser, '/sovereign');
    expect(shut.status, 'the console must not exist for the public').toBe(404);
    const open = await virgin(browser, '/sovereign', { [KEY_HEADER]: capsule });
    expect(open.status, 'the console must open on the capsule alone').toBe(200);
    expect(open.gate).toBe('pass');
  });

  test('an EXPIRED capsule is sealed exactly like a stranger', async ({ browser }) => {
    const stale = mintCapsule(nowSec() - 60);
    const res = await virgin(browser, '/', { [KEY_HEADER]: stale });
    expect(res.status, 'an expired capsule must not pass').toBe(307);
    expect(res.gate).toBe('seal');
    expect((await virgin(browser, '/sovereign', { [KEY_HEADER]: stale })).status).toBe(404);
  });

  test('the EXPIRY is signed -- extending it by hand kills the capsule', async ({ browser }) => {
    const valid = mintCapsule(nowSec() + 60);
    const [, , sig] = valid.split('.');
    const extended = `v1.${nowSec() + 99999}.${sig}`;
    const res = await virgin(browser, '/', { [KEY_HEADER]: extended });
    expect(res.status, 'a re-dated capsule must not pass').toBe(307);
    expect(res.gate).toBe('seal');
  });

  test('one flipped character kills a capsule', async ({ browser }) => {
    const valid = mintCapsule(nowSec() + 3600);
    const flipped = valid.slice(0, -1) + (valid.endsWith('a') ? 'b' : 'a');
    expect(flipped).not.toBe(valid);
    const res = await virgin(browser, '/', { [KEY_HEADER]: flipped });
    expect(res.status).toBe(307);
    expect(res.gate).toBe('seal');
  });

  test('a capsule signed with the wrong secret is sealed', async ({ browser }) => {
    const forged = mintCapsule(nowSec() + 3600, 'not-the-unitas-signing-secret');
    const res = await virgin(browser, '/', { [KEY_HEADER]: forged });
    expect(res.status, 'only OUR secret may mint a key').toBe(307);
    expect(res.gate).toBe('seal');
  });

  test('forgeries of every shape are indistinguishable from no credential', async ({ browser }) => {
    const valid = mintCapsule(nowSec() + 3600);
    const forgeries = [
      ['empty', ''],
      ['whitespace', '   '],
      ['the token, one char longer', `${TOKEN}x`],
      ['the token, one char shorter', TOKEN.slice(0, -1)],
      ['the token, wrong case', TOKEN.toUpperCase()],
      ['the token with an inner space', TOKEN.replace('_', ' ')],
      ['capsule shape, random signature', `v1.${nowSec() + 3600}.${'f'.repeat(64)}`],
      ['capsule with uppercase hex', valid.toUpperCase()],
      ['capsule with a negative expiry', `v1.-1.${valid.split('.')[2]}`],
      ['capsule with a float expiry', `v1.${nowSec() + 60}.5.${valid.split('.')[2]}`],
      ['a v2 capsule', valid.replace(/^v1\./, 'v2.')],
      ['Bearer nonsense', 'Bearer nonsense'],
      ['a very long value', 'a'.repeat(4096)],
      ['a JSON payload', JSON.stringify({ founder: true })],
    ];
    for (const [name, value] of forgeries) {
      const res = await virgin(browser, '/', { [KEY_HEADER]: value });
      expect(res.status, name).toBe(307);
      expect(res.gate, name).toBe('seal');
      // And the response is byte-for-byte the ordinary sealed answer: the
      // redirect target must not leak that a credential was even offered.
      expect(res.location, name).toBe((await virgin(browser, '/')).location);
    }
  });

  test('THE LIFECYCLE: header -> session -> console on the cookie alone -> revoke -> sealed', async ({ browser }) => {
    const ctx = await browser.newContext();
    const capsule = mintCapsule(nowSec() + 3600);

    // 1. Sealed, like anyone.
    const before = await ctx.request.get('/', { maxRedirects: 0 });
    expect(before.status()).toBe(307);
    expect((await ctx.cookies()).find((c) => c.name === SESSION_COOKIE)).toBeUndefined();

    // 2. One keyed navigation promotes the context to a founder session.
    const keyed = await ctx.request.get('/', { maxRedirects: 0, headers: { [KEY_HEADER]: capsule } });
    expect(keyed.status()).toBe(200);
    const cookies = await ctx.cookies();
    const session = cookies.find((c) => c.name === SESSION_COOKIE);
    expect(session, 'the key must mint a session').toBeTruthy();
    expect(session.httpOnly, 'the session must stay out of JavaScript').toBe(true);
    expect(session.value, 'the minted session is itself a signed capsule').toMatch(/^v1\.\d+\.[0-9a-f]{64}$/);
    expect(cookies.find((c) => c.name === HINT_COOKIE), 'the readable hint rides along').toBeTruthy();

    // 3. The console now opens with NO header at all -- which is the whole
    //    point: prefetches, service-worker fetches and form posts cannot
    //    carry a custom header, and they must not lock the founder out.
    const console1 = await ctx.request.get('/sovereign', { maxRedirects: 0 });
    expect(console1.status(), 'the cookie alone must reach the console').toBe(200);
    expect(console1.headers()['x-unitas-gate']).toBe('pass');
    expect((await ctx.request.get('/ko', { maxRedirects: 0 })).status()).toBe(200);
    expect((await (await ctx.request.get('/api/sovereign/verify')).json()).founder).toBe(true);

    // 4. Revoking clears it, and the funnel closes behind the founder.
    await ctx.request.get('/?sovereign_auth=revoke', { maxRedirects: 0 });
    expect((await ctx.cookies()).find((c) => c.name === SESSION_COOKIE)?.value || '').toBe('');
    const after = await ctx.request.get('/', { maxRedirects: 0 });
    expect(after.status(), 'after revoke the founder is a stranger again').toBe(307);
    expect(after.headers()['x-unitas-gate']).toBe('seal');
    expect((await ctx.request.get('/sovereign', { maxRedirects: 0 })).status()).toBe(404);
    await ctx.close();
  });

  test('both credential shapes open the same door', async ({ browser }) => {
    const capsule = mintCapsule(nowSec() + 3600);
    for (const [name, credential] of [
      ['capsule', capsule],
      ['raw token', TOKEN],
      ['capsule as Bearer', `Bearer ${capsule}`],
    ]) {
      const res = await virgin(browser, '/sovereign', name === 'capsule as Bearer' ? { authorization: credential } : { [KEY_HEADER]: credential });
      expect(res.status, name).toBe(200);
      expect(res.gate, name).toBe('pass');
    }
  });

  test('a real browser navigation with the key renders the console, not the gateway', async ({ browser }) => {
    const capsule = mintCapsule(nowSec() + 3600);
    const ctx = await browser.newContext({ extraHTTPHeaders: { [KEY_HEADER]: capsule } });
    const page = await ctx.newPage();
    await page.goto('/sovereign', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-unitas-gateway]'), 'the founder must never see the funnel').toHaveCount(0);
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 20_000 });
    await ctx.close();
  });

  test('the gate cannot be switched off by an environment variable any more', async () => {
    // REV-24 deleted UNITAS_GATE_BYPASS. This is the standing guard: a future
    // edit that reintroduces an all-or-nothing kill switch fails here.
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..', 'web');
    const files = ['middleware.ts', path.join('lib', 'gate', 'funnelGate.ts')];
    for (const rel of files) {
      // Comments are allowed to REMEMBER the flag -- both files document why
      // it is gone, and that record is worth keeping. What must not exist is
      // code that reads one.
      const code = fs
        .readFileSync(path.join(root, rel), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[^\n]*\/\/[^\n]*$/gm, '');
      expect(/UNITAS_GATE_BYPASS/.test(code), `${rel} must not READ a bypass env`).toBe(false);
      expect(/isGateBypassed/.test(code), `${rel} must not resurrect isGateBypassed`).toBe(false);
      expect(/process\.env\.[A-Z_]*BYPASS/.test(code), `${rel} must not read any bypass env`).toBe(false);
    }
  });
});
