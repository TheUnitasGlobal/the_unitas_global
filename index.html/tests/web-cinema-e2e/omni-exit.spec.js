const { test, expect } = require('@playwright/test');

// Round-10 omni-channel doctrine (owner instruction 2026-09-05):
//   item 3 -- a refresh parked on a pre-launch SUB-VIEW (gate / cinema /
//             sealed) re-renders that view in place, no intro splash;
//   item 4 -- no exit/logout popup on entry, ever;
//   item 6 -- the sealed screen's 'X' tunnels straight into the exit engine
//             (online channel here: a fresh tab is closed, else previous page,
//             else an in-place refresh -- never a dead-end, never about:blank).
// web/lib/exit/appExit.ts, web/components/interaction/ExitGuard.tsx,
// web/lib/splash/splashTimeline.ts, web/lib/pwa/installPrompt.ts.

const splash = (page) => page.getByTestId('intro-splash');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const exitDialog = (page) => page.locator('#exit-guard-title');

test.describe('sub-view refresh keeps the current view (no logo page)', () => {
  test('cold load shows the splash; a refresh on the gate does not', async ({ page }) => {
    await page.goto('/en');
    await expect(splash(page)).toBeVisible();
    await expect(splash(page)).toHaveCount(0, { timeout: 8000 });
    await expect(enterButton(page)).toBeVisible();

    const phase = await page.evaluate(() => sessionStorage.getItem('unitas_cinema_phase'));
    expect(phase).toBe('gate');

    await page.reload();
    const flag = await page.evaluate(() => document.documentElement.getAttribute('data-splash'));
    expect(flag).toBe('off');
    await expect(splash(page)).toHaveCount(0, { timeout: 3000 });
    await expect(enterButton(page)).toBeVisible();
  });

  test('a refresh on the sealed Coming-Soon screen lands back on it, splash-free', async ({ page }) => {
    await page.goto('/en?splash=0');
    await page.evaluate(() => sessionStorage.setItem('unitas_cinema_phase', 'sealed'));
    // Drop the URL opt-out so ONLY the sub-view gate is in play.
    await page.goto('/en');
    const flag = await page.evaluate(() => document.documentElement.getAttribute('data-splash'));
    expect(flag).toBe('off');
    await expect(splash(page)).toHaveCount(0, { timeout: 3000 });
    // Sealed screen: the 'X' close control is present, the gate button is not.
    await expect(page.locator('button[aria-label]').filter({ has: page.locator('svg.lucide-x') })).toBeVisible({
      timeout: 5000,
    });
    expect(await page.evaluate(() => document.documentElement.dataset.cinemaPhase)).toBe('sealed');
  });
});

test.describe('no popup on entry', () => {
  test('nothing opens the exit/logout confirm on load, on the gate, or on the sealed screen', async ({ page }) => {
    await page.goto('/en?splash=0');
    await expect(enterButton(page)).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(exitDialog(page)).toHaveCount(0);

    await page.evaluate(() => sessionStorage.setItem('unitas_cinema_phase', 'sealed'));
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(exitDialog(page)).toHaveCount(0);
    // Not even a synthetic popstate: the guard is not armed under the curtain.
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate', { state: null })));
    await page.waitForTimeout(300);
    await expect(exitDialog(page)).toHaveCount(0);
  });
});

test.describe("sealed screen 'X' tunnels straight into the exit engine", () => {
  test('online channel: one tap returns to the previous page, with no confirm and no blank page', async ({ page }) => {
    // A stand-in for "the search page the visitor came from".
    await page.goto('/en/company/about?splash=0');
    const previousUrl = page.url();
    await page.evaluate(() => sessionStorage.setItem('unitas_cinema_phase', 'sealed'));
    await page.goto('/en?splash=0');
    const closeX = page.locator('button[aria-label]').filter({ has: page.locator('svg.lucide-x') }).first();
    await expect(closeX).toBeVisible({ timeout: 5000 });

    // Clicking triggers `history.go(-1)` synchronously inside the gesture --
    // Playwright may report the element detaching mid-click; that IS the exit.
    await closeX.dispatchEvent('click');
    await page.waitForURL(previousUrl, { timeout: 5000 });
    expect(page.url()).toBe(previousUrl);
    expect(page.url()).not.toContain('about:blank');
    await expect(exitDialog(page)).toHaveCount(0);
  });

  // The single-entry "fresh tab" branch (window.close() honoured by Chromium
  // when the session history holds one document) cannot be reproduced under
  // Playwright -- its pages always start on a real about:blank entry, so the
  // planner correctly picks history-back instead. That branch is covered by
  // the pure planner unit tests in web/__tests__/exit/appExit.test.ts.
});
