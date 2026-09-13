const { test, expect } = require('@playwright/test');

// Page-level coin gate for the 16 coin-gated module routes
// (web/app/[locale]/(gated)/layout.tsx). On-demand only:
//   npx playwright test --config=tests/web-cinema.config.js module-gate
//
// Without Supabase env vars on the test server the gate fail-closes for
// everyone -- which is exactly the property under test: a direct hit on a
// gated route must NOT render module content, it must 307 to /{locale}/locked.
// The server-verified sovereign founder session is the one way through.
//
// REV-23 M1 layered a SECOND gate in front of this one. The pre-launch funnel
// gate (lib/gate/funnelGate.ts) seals an ordinary visitor at the edge, before
// the coin gate is ever consulted -- so a plain browser hitting /arche now
// lands on the funnel, not on /locked. That is strictly safer and it is what
// the first test below asserts. To keep testing the COIN gate itself, the
// second test drives it with an indexer user agent, which the funnel gate
// passes through (Codex ch.13) and the coin gate then fences exactly as
// before. Both layers are covered, in the order a request meets them.

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const GATED_PATH = '/en/arche?splash=0';

test.describe('page-level module coin gate', () => {
  test('REV-23: a plain visitor never even reaches the coin gate -- the funnel seals first', async ({ page }) => {
    const response = await page.goto(GATED_PATH, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200); // after following the 307
    expect(page.url()).toMatch(/\/gateway/);
    // The module's own scene is absent, which is the property that matters.
    await expect(page.locator('main.isolate')).toHaveCount(0);
    await expect(page.locator('[data-unitas-gateway]')).toHaveCount(1);
  });

  test('the coin gate still 307s to /locked, carrying no module payload', async ({ browser }) => {
    // An indexer passes the funnel gate (Codex ch.13) and therefore meets the
    // coin gate -- the only way to exercise this layer now that the funnel
    // seals ordinary traffic ahead of it.
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });
    const res = await ctx.request.get(GATED_PATH.replace(/^\/en\//, '/'), { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toMatch(/\/(en\/)?locked/);
    // Next 14 answers a layout redirect() with its generic `__next_error__`
    // shell (the RSC tree ABOVE the throwing layout, for the client router).
    // The property that matters: nothing from the gated module itself --
    // its <main class="isolate"> scene or its title -- is in that body.
    const body = await res.text();
    expect(body).not.toMatch(/<main[^>]*isolate/);
    expect(body).not.toContain('ARCHE');
    expect(body).not.toContain('module_access_grants');
    await ctx.close();
  });

  test('a forged legacy dev cookie opens neither gate', async ({ page, context }) => {
    await context.addCookies([{ name: 'unitas_dev', value: '1', url: 'http://127.0.0.1:3123' }]);
    await page.goto(GATED_PATH, { waitUntil: 'domcontentloaded' });
    // Sealed by the funnel gate; the module scene never renders either way.
    expect(page.url()).toMatch(/\/gateway/);
    await expect(page.locator('main.isolate')).toHaveCount(0);
  });

  test('verified sovereign founder session reaches the real module page', async ({ page }) => {
    // The token visit makes middleware.ts mint the HMAC-signed HttpOnly
    // session cookie; the gate layout verifies it server-side.
    await page.goto(`/en?sovereign_auth=${TOKEN}&splash=0`);

    await page.goto(GATED_PATH, { waitUntil: 'domcontentloaded' });
    expect(page.url()).toMatch(/\/(en\/)?arche/);
    await expect(page.locator('main.isolate')).toBeVisible();
  });
});
