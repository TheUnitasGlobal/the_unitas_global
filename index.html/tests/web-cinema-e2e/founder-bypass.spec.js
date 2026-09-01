const { test, expect } = require('@playwright/test');

// Mobile re-verification of the founder bypass layer (owner instruction
// 2026-09-01, following the mobile-visibility fix in ComingSoonCinema.tsx --
// see the "MOBILE VISIBILITY FIX" comment there). Runs on every configured
// project (chromium/webkit/mobile-chrome via tests/web-cinema.config.js), so
// the mobile-chrome (Pixel 7) pass is the actual regression check: unlike
// __tests__/gate/foundersGate.test.ts (a pure-function unit test with no real
// browser storage), this exercises the live localStorage/cookie persistence
// and on-screen layout in an actual mobile viewport.

const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.getByRole('button', { name: /skip/i });
const founderEnterMainButton = (page) => page.getByRole('button', { name: /enter/i }).last();

test.describe('founder bypass -- mobile/PC parity', () => {
  test('sealed-screen founder door is visible with no scroll on this viewport', async ({ page }) => {
    await page.goto('/en?dev=true');
    await enterButton(page).click();
    await skipButton(page).click();

    await expect(page.getByRole('heading', { name: 'COMING SOON' })).toBeVisible({ timeout: 15_000 });

    // The founder-only entry button must be on-screen without scrolling --
    // this is the exact regression the "MOBILE VISIBILITY FIX" comment
    // describes (previously in-flow and pushed below the fold on short
    // mobile viewports; now pinned `absolute inset-x-0 bottom-24`).
    const btn = founderEnterMainButton(page);
    await expect(btn).toBeVisible();
    await expect(btn).toBeInViewport();
  });

  test('persisted grant (localStorage + cookie) survives a fresh navigation without ?dev=true', async ({
    page,
    context,
  }) => {
    // First visit primes the grant.
    await page.goto('/en?dev=true');
    await enterButton(page).click();

    const grant = await page.evaluate(() => window.localStorage.getItem('unitas_founder_bypass'));
    expect(grant).toBe('granted');
    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === 'unitas_dev' && c.value === '1')).toBe(true);

    // A brand-new tab in the same context (fresh sessionStorage -- so the
    // curtain's own PHASE_KEY can't carry the still-open first tab's
    // mid-cinema position forward -- but the same localStorage/cookies, i.e.
    // the real "closed the browser, came back later" shape), no query param
    // at all: storage/cookie alone must still resolve to founder mode and
    // start clean at the gate.
    const page2 = await context.newPage();
    await page2.goto('/en');
    await enterButton(page2).click();
    await skipButton(page2).click();
    await expect(founderEnterMainButton(page2)).toBeVisible({ timeout: 15_000 });
    await page2.close();
  });
});
