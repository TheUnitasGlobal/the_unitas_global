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

  // REV-21 §1.3: the world-ranking widget is now the carousel's `worldRanking`
  // slot. Tapping a rank row on the card opens the ranking deep modal AND,
  // one tick later, the identical rank-detail popup on top of it -- two
  // levels above the hub, parked in that order (deep modal first, detail on
  // top) even though React mounts the nested dialog's effect first.
  test('a ranking detail modal opened from the carousel card stacks above the ranking deep modal', async ({ page }) => {
    await reachHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    await page.waitForTimeout(600);
    await page.locator('[data-slot="worldRanking"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-slot-card="worldRanking"]')).toBeVisible();
    await page.evaluate(() => {
      const row = document.querySelector('[data-slot-card="worldRanking"] .qw-hub-headline');
      row && row.click();
    });
    await expect(page.locator('#ranking-deep-title')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#global-ranking-detail-title')).toBeVisible({ timeout: 5_000 });
    // POLLED, not a fixed 300ms settle. The two dialogs park one after the
    // other (REV-21 §1.3) and each park costs a frame; at ~600ms a frame on
    // this harness's WebKit, 300ms is not even one. The claim is unchanged --
    // three levels, in this order -- it is just allowed to arrive.
    await expect.poll(async () => (await stack(page)).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
    const before = await stack(page);
    expect(before.length).toBeGreaterThanOrEqual(3);
    expect(before[before.length - 1]).toMatch(/^modal:global-ranking-detail-title/);
    expect(before[before.length - 2]).toMatch(/^modal:ranking-deep-title/);
    // REV-21 M5b (bc99f93) replaced REV-19's [data-discovery-links] strip with
    // the 14-lens Explore Deeper block on every U-AI popup; same contract, new hook.
    await expect(page.locator('[data-omni-open]').first()).toBeVisible();

    // Back closes the detail only; the deep modal (and the hub) stay.
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#global-ranking-detail-title')).toHaveCount(0);
    await expect(page.locator('#ranking-deep-title')).toBeVisible();
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
    expect((await stack(page)).length).toBe(before.length - 1);

    // Inside the deep modal the embedded panel is the old widget verbatim:
    // a theme chip switches the list, a row reopens the detail.
    await page.evaluate(() => {
      const r = document.querySelector('[data-global-rankings="embedded"] [data-rank="2"]');
      r && r.click();
    });
    await expect(page.locator('#global-ranking-detail-title')).toBeVisible({ timeout: 5_000 });
    await page.goBack();
    await page.waitForTimeout(500);
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#ranking-deep-title')).toHaveCount(0);
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
  });

  // REV-20 §3 replaced REV-19's live-hub card wall with the discovery
  // carousel (DiscoveryCarousel.tsx keeps `data-live-hub`, but the card is now
  // `[data-slot-card]`), and REV-20 §2 deleted UNITAS Shorts outright -- so the
  // shorts half of this level test is gone, replaced by a guard proving the
  // retired surface cannot come back as an unmanaged history level.
  //
  // REV-23 changed two things here: M2.3 made the card TITLE the only way to
  // open a deep dive (two clicks, not one anywhere), and M3.1 removed the
  // nine news slots from this rail entirely -- so the news deep modal
  // (`#hub-deep-title`) no longer exists to be a level. What remains is the
  // feed deep modal, plus a guard that the retired news modal stays gone.
  test('the discovery carousel deep dive opens as a level and closes on back', async ({ page }) => {
    await reachHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    await page.waitForTimeout(600);
    await expect(page.locator('[data-live-hub]')).toBeVisible();

    // The rail auto-rotates, so pin the slot by holding its chip -- a
    // free-running carousel would make WHICH deep modal opens a race.
    const openActive = async () => {
      const title = page.locator('[data-slot-card] .qw-hub-card-title .qw-two-step-hit');
      await expect(title).toBeVisible({ timeout: 20_000 });
      await title.click();
      await title.click();
    };

    // M3.1: the nine RSS news slots are off this rail, and so is their modal.
    await expect(page.locator('[data-slot="game"]')).toHaveCount(0);
    await expect(page.locator('#hub-deep-title')).toHaveCount(0);

    // A feed slot opens the feed deep modal -- and ONLY that one.
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
