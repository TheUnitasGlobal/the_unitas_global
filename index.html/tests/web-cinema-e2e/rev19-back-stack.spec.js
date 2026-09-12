const { test, expect } = require('@playwright/test');

// REV-19 SPEC.md §1 -- the deep modal history stack. Every popup parks one
// same-document history entry (lib/history/modalStack.ts) so the device
// back gesture closes surfaces ONE AT A TIME in reverse order of opening,
// and only with nothing left open does a press on the main home reach
// ExitGuard's sentinel buffer (the exit confirm).

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

async function reachHome(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
      // Pin the locale: a fresh context has no saved preference and the
      // locale-restore effect would otherwise bounce /ko to the default.
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

const stack = (page) => page.evaluate(() => (history.state || {}).unitasModalStack || []);

// Headless WebKit renders the home's WebGL layers in software: rAF frames
// take 350-700ms, so every Playwright "stable" check crawls. Triple budget.
test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
});

test.describe('REV-19 deep modal history stack', () => {
  test('cluster pop-out (L1) + Entry Gate (L2) close one per back press; the third press opens the exit confirm', async ({ page }) => {
    await reachHome(page);
    await page.evaluate(() => document.querySelectorAll('.qw-cluster-card')[0].click());
    await page.waitForSelector('.qw-tile', { timeout: 15_000 });
    await page.waitForTimeout(300);
    expect(await stack(page)).toHaveLength(1);

    await page.evaluate(() => document.querySelector('.qw-tile').click());
    await page.waitForSelector("[data-view='entry']", { timeout: 10_000 });
    await page.waitForTimeout(300);
    expect(await stack(page)).toHaveLength(2);

    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-view='entry']")).toHaveCount(0);
    await expect(page.locator('.qw-popout-panel')).toHaveCount(1);
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);

    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('.qw-popout-panel')).toHaveCount(0);
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
    expect(await stack(page)).toHaveLength(0);

    await page.goBack();
    await expect(page.locator('#exit-guard-title')).toBeVisible({ timeout: 5_000 });
  });

  test('closing a pop-out with the X walks its entry off the stack, so the next back press is the exit confirm, not a dead press', async ({ page }) => {
    await reachHome(page);
    await page.evaluate(() => document.querySelectorAll('.qw-cluster-card')[0].click());
    await page.waitForSelector('.qw-popout-panel', { timeout: 15_000 });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await expect(page.locator('.qw-popout-panel')).toHaveCount(0);
    await page.waitForTimeout(600);
    expect(await stack(page)).toHaveLength(0);
    await page.goBack();
    await expect(page.locator('#exit-guard-title')).toBeVisible({ timeout: 5_000 });
  });

  test('a ranking detail modal opened over the search hub is its own level above the hub', async ({ page }) => {
    await reachHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('.relative.z-30 button')).find((x) => x.textContent.includes('유네스코'));
      b && b.click();
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const r = document.querySelector('.relative.z-30 [role="button"]');
      r && r.click();
    });
    await expect(page.locator('#global-ranking-detail-title')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);
    const before = await stack(page);
    expect(before.length).toBeGreaterThanOrEqual(2);
    expect(before[before.length - 1]).toMatch(/^modal:global-ranking-detail-title/);
    await expect(page.locator('[data-discovery-links]')).toBeVisible();

    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#global-ranking-detail-title')).toHaveCount(0);
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
    expect((await stack(page)).length).toBe(before.length - 1);
  });

  // REV-20 §3 replaced REV-19's live-hub card wall with the 22-slot discovery
  // carousel (DiscoveryCarousel.tsx keeps `data-live-hub`, but the card is now
  // `[data-slot-card]`), and REV-20 §2 deleted UNITAS Shorts outright -- so the
  // shorts half of this level test is gone, replaced by a guard proving the
  // retired surface cannot come back as an unmanaged history level.
  test('the discovery carousel deep dive opens as a level and closes on back', async ({ page }) => {
    await reachHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    await page.waitForTimeout(600);
    await expect(page.locator('[data-live-hub]')).toBeVisible();

    // The rail auto-rotates, so pin a slot of each kind by holding its chip --
    // a free-running carousel would make WHICH deep modal opens a race.
    const openActive = () =>
      page.evaluate(() => {
        const b = document.querySelector('[data-slot-card] button[aria-label]');
        b && b.click();
      });

    // A news slot opens the news deep modal -- and ONLY that one.
    await page.locator('[data-slot="game"]').click();
    await page.waitForTimeout(300);
    await openActive();
    await expect(page.locator('#hub-deep-title')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#feed-deep-title')).toHaveCount(0);
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#hub-deep-title')).toHaveCount(0);
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);

    // A REV-20 feed slot opens the feed deep modal -- and ONLY that one.
    await page.locator('[data-slot="history"]').click();
    await page.waitForTimeout(300);
    await openActive();
    await expect(page.locator('#feed-deep-title')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#hub-deep-title')).toHaveCount(0);
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#feed-deep-title')).toHaveCount(0);
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);

    // REV-20 §2: the shorts rail and its modal are retired, not hidden.
    await expect(page.locator('[data-short]')).toHaveCount(0);
    await expect(page.locator('#unitas-short-title')).toHaveCount(0);
  });
});
