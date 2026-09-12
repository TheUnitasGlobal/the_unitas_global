const { test, expect } = require('@playwright/test');

// REV-20 SPEC.md §12 D-6 (founder ruling 2026-09-11): the post-submit U-AI
// hyper-search tower is DialogTower's `fullscreen` variant -- true viewport
// top -> bottom at z-[120], which otherwise sits over #unitas-nav's z-50 and
// leaves the nav dead (no home/logo, no language switch) for as long as the
// tower is open. This spec proves the fix: while the fullscreen tower is
// open, the nav is still the topmost hit-test target over its own rectangle
// (not the tower's backdrop/panel), and it reverts the instant the tower
// closes -- so every OTHER tower (nav-anchored: shortcut ladder, ranking
// modal, legal notice) is provably unaffected by this z-index bump.

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');
const input = (page) => page.locator('#omni-synapse-search input[type="text"]');

async function reachHome(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
      localStorage.setItem('unitas_locale_pref', 'ko');
    } catch {
      /* no-op */
    }
  });
  await page.goto(`/ko?sovereign_auth=${TOKEN}&splash=0`);
  await enterButton(page).click();
  await skipButton(page).click();
  await expect(page.getByRole('heading', { name: /coming soon/i })).toBeVisible({ timeout: 15_000 });
  await enterButton(page).click();
  await page.waitForSelector('.qw-cluster-card', { timeout: 30_000 });
  await expect(page.locator('.cs-root')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
});

test.describe('REV-20 fullscreen search tower vs. nav layering', () => {
  test('the nav stays the topmost hit-test target while the fullscreen tower is open, and the flag clears on close', async ({ page }) => {
    await reachHome(page);

    // Before: no fullscreen flag, nav answers hit-tests at its own rect.
    expect(await page.evaluate(() => document.body.hasAttribute('data-fullscreen-tower-open'))).toBe(false);

    await input(page).click();
    await page.keyboard.type('서울');
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');

    await expect(page.locator('#uai-search-result-title')).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => document.body.hasAttribute('data-fullscreen-tower-open'))).toBe(true);

    const nav = page.locator('#unitas-nav');
    await expect(nav).toBeVisible();

    const { navZ, towerZ, topElementIsNavOrAbove } = await page.evaluate(() => {
      const navEl = document.getElementById('unitas-nav');
      const towerPanel = document.querySelector('[role="dialog"][aria-labelledby="uai-search-result-title"]');
      const rect = navEl.getBoundingClientRect();
      const x = rect.left + Math.min(24, rect.width / 2);
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        navZ: parseFloat(getComputedStyle(navEl).zIndex),
        towerZ: towerPanel ? parseFloat(getComputedStyle(towerPanel.parentElement).zIndex) : null,
        topElementIsNavOrAbove: !!hit && (hit === navEl || navEl.contains(hit)),
      };
    });

    // The nav's own rectangle answers the hit-test as the nav itself (a
    // logo/link click there works), not the tower's backdrop swallowing it.
    expect(topElementIsNavOrAbove).toBe(true);
    expect(navZ).toBeGreaterThan(towerZ ?? 0);

    // Close the tower (Escape, same as the toolbar close) -- the flag and
    // the elevated z-index must both revert; a leaked flag would wrongly
    // elevate the nav forever, over every future nav-anchored tower too.
    await page.keyboard.press('Escape');
    await expect(page.locator('#uai-search-result-title')).toHaveCount(0, { timeout: 8_000 });
    expect(await page.evaluate(() => document.body.hasAttribute('data-fullscreen-tower-open'))).toBe(false);
  });
});
