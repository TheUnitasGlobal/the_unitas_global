const { test, expect } = require('@playwright/test');

// Page-level coin gate for the 16 coin-gated module routes
// (web/app/[locale]/(gated)/layout.tsx). On-demand only:
//   npx playwright test --config=tests/web-cinema.config.js module-gate
//
// Without Supabase env vars on the test server the gate fail-closes for
// everyone -- which is exactly the property under test: a direct hit on a
// gated route must NOT render module content, it must 307 to /{locale}/locked.
// The server-verified sovereign founder session is the one way through.

const TOKEN = 'unitas_master_dooyeong_2026_secure_key';
const GATED_PATH = '/en/arche?splash=0';

test.describe('page-level module coin gate', () => {
  test('direct navigation to a gated route redirects to the locked page', async ({ page }) => {
    const response = await page.goto(GATED_PATH, { waitUntil: 'domcontentloaded' });

    // Landed on /en/locked, not /en/arche.
    expect(page.url()).toContain('/en/locked');
    expect(response?.status()).toBe(200); // after following the 307

    // The lock panel rendered...
    await expect(page.getByText(/Access Sealed|Sign-In Required/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Return to Catalog/i })).toBeVisible();

    // ...and the module's own scene did NOT (its <main> uses `isolate`).
    await expect(page.locator('main.isolate')).toHaveCount(0);
  });

  test('the raw response for a gated route is a 307, carrying no module payload', async ({
    request,
  }) => {
    const res = await request.get(GATED_PATH, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/en/locked');
    // Next 14 answers a layout redirect() with its generic `__next_error__`
    // shell (the RSC tree ABOVE the throwing layout, for the client router).
    // The property that matters: nothing from the gated module itself --
    // its <main class="isolate"> scene or its title -- is in that body.
    const body = await res.text();
    expect(body).not.toMatch(/<main[^>]*isolate/);
    expect(body).not.toContain('ARCHE');
    expect(body).not.toContain('module_access_grants');
  });

  test('a forged legacy dev cookie no longer opens the gate', async ({ page, context }) => {
    await context.addCookies([{ name: 'unitas_dev', value: '1', url: 'http://127.0.0.1:3123' }]);
    await page.goto(GATED_PATH, { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/en/locked');
  });

  test('verified sovereign founder session reaches the real module page', async ({ page }) => {
    // The token visit makes middleware.ts mint the HMAC-signed HttpOnly
    // session cookie; the gate layout verifies it server-side.
    await page.goto(`/en?sovereign_auth=${TOKEN}&splash=0`);

    await page.goto(GATED_PATH, { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/en/arche');
    await expect(page.locator('main.isolate')).toBeVisible();
  });
});
