const { test, expect } = require('@playwright/test');

// REV-19 SPEC.md §1 -- the deep modal history stack. Every popup parks one
// same-document history entry (lib/history/modalStack.ts) so the device
// back gesture closes surfaces ONE AT A TIME in reverse order of opening,
// and only with nothing left open does a press on the main home reach
// ExitGuard's sentinel buffer (the exit confirm).

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const { expectRetiredRankingsGone } = require('./_rev35Retired');
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

  // REV-35 M1 (D-1/D-4/D-8): the REV-21 world-ranking slot, its deep modal
  // and its rank-detail popup are DELETED, not hidden -- the carousel's seat
  // twelve is now `uRanking`, whose card body is the compact U-Rankings rail
  // (URankingsShorts, `data-urank-variant="compact"`). Tapping a rail card
  // opens the U-Ranking deep modal (`#uranking-deep-title`, the FULL rail)
  // AND, one commit later, the entry popup (`#unitas-urank-title`) on top of
  // it: the compact rail delegates the tap through `onSelect` because the
  // rotating card body may never own a popup, and the deep modal applies
  // `initialOpenId` in a post-mount effect so its own history layer parks
  // FIRST. Two levels above the hub, unwound one per back press. The D-8
  // zero sweep (_rev35Retired.js) runs with the hub open AND with both
  // ranking layers open.
  test('a U-Ranking entry popup opened from the carousel card stacks above the U-Ranking deep modal', async ({ page }) => {
    await reachHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    await page.waitForTimeout(600);
    await page.locator('[data-slot="uRanking"]').click();
    await page.waitForTimeout(400);
    const card = page.locator('[data-slot-card="uRanking"][data-slot-kind="uRanking"]');
    await expect(card).toBeVisible();
    // The card body IS the compact rail: twelve cards and nothing else --
    // no module filter chips, and no product-family tab rail either (the
    // slot declares no `tabs`; nothing sits between the title row and it).
    const compactRail = card.locator('[data-unitas-urankings][data-urank-variant="compact"] [data-urank-rail]');
    await expect(compactRail).toBeVisible();
    await expect(compactRail.locator('[data-urank]')).toHaveCount(12);
    await expect(card.locator('[data-urank-filter]')).toHaveCount(0);
    await expect(card.locator('[role="tablist"]')).toHaveCount(0);
    await expectRetiredRankingsGone(page);

    await card.locator('[data-urank-rail] [data-urank]').first().click();
    await expect(page.locator('#uranking-deep-title')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#unitas-urank-title')).toBeVisible({ timeout: 5_000 });
    await expectRetiredRankingsGone(page);
    // POLLED, not a fixed 300ms settle. The two dialogs park one after the
    // other (the entry popup opens one commit after the deep modal, by
    // design) and each park costs a frame; at ~600ms a frame on this
    // harness's WebKit, 300ms is not even one. The claim is unchanged --
    // three levels, in this order -- it is just allowed to arrive.
    await expect.poll(async () => (await stack(page)).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
    const before = await stack(page);
    expect(before.length).toBeGreaterThanOrEqual(3);
    expect(before[before.length - 1]).toMatch(/^modal:unitas-urank-title/);
    expect(before[before.length - 2]).toMatch(/^modal:uranking-deep-title/);
    // REV-21 M5b (bc99f93) replaced REV-19's [data-discovery-links] strip with
    // the omni-open block on every U-AI popup; same contract, new hook.
    await expect(page.locator('[data-omni-open]').first()).toBeVisible();

    // Back closes the entry popup only; the deep modal (and the hub) stay.
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#unitas-urank-title')).toHaveCount(0);
    await expect(page.locator('#uranking-deep-title')).toBeVisible();
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
    expect((await stack(page)).length).toBe(before.length - 1);

    // Inside the deep modal the rail is the hub panel verbatim (full
    // variant): a card reopens the entry popup as a level of its own.
    await page.locator('[data-slot-modal="uRanking"] [data-urank-rail] [data-urank]').nth(1).click();
    await expect(page.locator('#unitas-urank-title')).toBeVisible({ timeout: 5_000 });
    await page.goBack();
    await page.waitForTimeout(500);
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#uranking-deep-title')).toHaveCount(0);
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
  // open a deep dive (REV-34 M1-C: one click on it), and M3.1 removed the
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
    // REV-34 M1-C: one click on the title text opens it (the two-step
    // select was retired on the strip).
    const openActive = async () => {
      const title = page.locator('[data-slot-card] .qw-hub-card-title .qw-hub-title-hit');
      await expect(title).toBeVisible({ timeout: 20_000 });
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
