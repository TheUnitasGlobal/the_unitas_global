const { test, expect } = require('@playwright/test');

// Page-level coin gate for the 16 coin-gated module routes
// (web/app/[locale]/(gated)/layout.tsx). On-demand only:
//   npx playwright test --config=tests/web-cinema.config.js module-gate
//
// Without Supabase env vars on the test server the gate fail-closes for
// everyone -- which is exactly the property under test: a direct hit on a
// gated route must NOT render module content, it must 307 to /{locale}/locked.
// The founder `?dev=true` bypass is the one way through.

const GATED_PATH = '/en/arche';

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
    expect((await res.text()).trim()).toBe('');
  });

  test('founder ?dev=true bypass reaches the real module page', async ({ page, context }) => {
    // ?dev=true persists the `unitas_dev` cookie (lib/foundersGate.ts); prime it
    // so the gate layout lets the request through on the server.
    await context.addCookies([
      { name: 'unitas_dev', value: '1', url: 'http://127.0.0.1:3123' },
    ]);

    await page.goto(GATED_PATH, { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/en/arche');
    await expect(page.locator('main.isolate')).toBeVisible();
  });
});
