const { test, expect } = require('@playwright/test');

// REV-15 cluster pop-out regression guard (SPEC.md §4, §6-4), UPDATED
// REV-17 (docs/rev17/SPEC.md §5, §9-4): permanent proof that the four
// Singularity Core cluster pop-outs (Cognitive Core / Live Services /
// Lock-in Network / Enterprise Rails, 16+5+8+3 = 32 modules total) render
// every module tile with a real icon and non-empty riddle copy, with the
// title sitting to the medallion's right and no content spilling out of
// the tile. REV-15's original three field defects (mobile grid collapse,
// desktop last-row clipping, tile content collapse) are unchanged and
// still guarded below; the kind-badge/coin-chip tile interior and its
// single-column mobile list were retired REV-17 (SPEC.md §5.3) in favour
// of a center-aligned riddle tile and a 2-column mobile grid.
//
// `__tests__/quantumWhite/clusters.test.ts` proves every module HAS an
// icon/riddle/scenario translation at the data layer; this file proves the
// pop-out actually RENDERS them, reachably, in a real layout.

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

/** Fixed rendering order + module counts, mirrored from
 *  `lib/quantumWhite/clusters.ts`'s `CLUSTER_ORDER`/`EXPECTED_COUNTS`
 *  (also asserted at the data layer in `__tests__/quantumWhite/clusters.test.ts`). */
const CLUSTERS = [
  { index: 0, key: 'cognitive', moduleCount: 16 },
  { index: 1, key: 'live', moduleCount: 5 },
  { index: 2, key: 'lockin', moduleCount: 8 },
  { index: 3, key: 'enterprise', moduleCount: 3 },
];

/** Reaches the released Quantum White home via the founder door, with the
 *  debug console pre-collapsed so it never intercepts a click. */
async function reachHome(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
    } catch {
      /* no-op */
    }
  });
  await page.goto(`/en?sovereign_auth=${TOKEN}&splash=0`);
  await enterButton(page).click();
  await skipButton(page).click();
  await expect(page.getByRole('heading', { name: 'COMING SOON' })).toBeVisible({ timeout: 15_000 });
  await enterButton(page).click();
  await page.waitForSelector('.qw-cluster-card', { timeout: 30_000 });
  // The curtain (`.cs-root`) unmounts only after its own exit transition
  // completes (up to ~1s, longer under WebKit's slower frame pacing) --
  // wait for it to actually be gone rather than a fixed delay, so a later
  // cluster-card click never races a still-present (if fully transparent)
  // curtain still occupying the accessibility tree.
  await expect(page.locator('.cs-root')).toHaveCount(0, { timeout: 15_000 });
}

/** Reads geometry + content coverage for every tile in the currently open pop-out. */
async function inspectOpenPopout(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.qw-popout-panel');
    const body = panel.querySelector('.qw-popout-body');
    const grid = panel.querySelector('.qw-tile-grid');
    const tiles = Array.from(grid.querySelectorAll('.qw-tile'));

    const panelRect = panel.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const cols = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().x))).size;

    const tileReports = tiles.map((t) => {
      const medallion = t.querySelector('.qw-tile-medallion');
      const title = t.querySelector('.qw-tile-title');
      const riddle = t.querySelector('.qw-tile-riddle');
      const cue = t.querySelector('.qw-tile-cue');
      const tileRect = t.getBoundingClientRect();
      const medallionRect = medallion.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const cueRect = cue.getBoundingClientRect();
      return {
        hasIcon: Boolean(medallion.querySelector('svg')),
        hasRiddle: Boolean(riddle && riddle.textContent.trim().length > 0),
        noKindBadge: !t.querySelector('.qw-tile-kind'),
        noCoinChip: !t.querySelector('.qw-upay-chip'),
        titleRightOfMedallion: titleRect.left >= medallionRect.right - 1,
        cueWithinTile: cueRect.bottom <= tileRect.bottom + 0.5,
      };
    });

    return {
      panelWithinViewport: panelRect.top >= -1 && panelRect.bottom <= window.innerHeight + 1,
      gridWidthRatio: gridRect.width / bodyRect.width,
      cols,
      tileCount: tiles.length,
      allHaveIcon: tileReports.every((r) => r.hasIcon),
      allHaveRiddle: tileReports.every((r) => r.hasRiddle),
      noneHaveKindBadge: tileReports.every((r) => r.noKindBadge),
      noneHaveCoinChip: tileReports.every((r) => r.noCoinChip),
      allTitlesRightOfMedallion: tileReports.every((r) => r.titleRightOfMedallion),
      allCuesWithinTile: tileReports.every((r) => r.cueWithinTile),
    };
  });
}

test.describe('REV-17 cluster pop-out -- mobile (2-column curiosity grid)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const cluster of CLUSTERS) {
    test(`${cluster.key}: every tile has an icon + riddle, no kind badge/coin chip, title right of medallion`, async ({
      page,
    }) => {
      await reachHome(page);
      await page.evaluate((i) => document.querySelectorAll('.qw-cluster-card')[i].click(), cluster.index);
      await page.waitForSelector('.qw-popout-panel .qw-tile', { timeout: 15_000 });
      await page.waitForTimeout(900);

      const report = await inspectOpenPopout(page);
      expect(report.tileCount).toBe(cluster.moduleCount);
      expect(report.panelWithinViewport).toBe(true);
      // REV-17 (SPEC.md §5.3): a 2-column grid, not the REV-15 single
      // full-width list row (whose own layout bug this file used to guard).
      if (cluster.moduleCount >= 2) {
        expect(report.cols).toBe(2);
      }
      expect(report.gridWidthRatio).toBeGreaterThan(0.85);
      expect(report.allHaveIcon).toBe(true);
      expect(report.allHaveRiddle).toBe(true);
      expect(report.noneHaveKindBadge).toBe(true);
      expect(report.noneHaveCoinChip).toBe(true);
      expect(report.allTitlesRightOfMedallion).toBe(true);
      expect(report.allCuesWithinTile).toBe(true);

      await page.keyboard.press('Escape');
      await expect(page.locator('.qw-popout-panel')).toHaveCount(0);
    });
  }
});

test.describe('REV-17 cluster pop-out -- desktop (multi-column grid)', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  for (const cluster of CLUSTERS) {
    test(`${cluster.key}: every tile has an icon + riddle, no kind badge/coin chip, title right of medallion`, async ({
      page,
    }) => {
      await reachHome(page);
      await page.evaluate((i) => document.querySelectorAll('.qw-cluster-card')[i].click(), cluster.index);
      await page.waitForSelector('.qw-popout-panel .qw-tile', { timeout: 15_000 });
      await page.waitForTimeout(900);

      const report = await inspectOpenPopout(page);
      expect(report.tileCount).toBe(cluster.moduleCount);
      expect(report.panelWithinViewport).toBe(true);
      // Desktop media query (SPEC.md §4.1, unchanged): `minmax(196px, 1fr)`
      // in an 840px-ish grid body fits several columns.
      if (cluster.moduleCount >= 3) {
        expect(report.cols).toBeGreaterThanOrEqual(3);
      }
      expect(report.gridWidthRatio).toBeGreaterThan(0.9);
      expect(report.allHaveIcon).toBe(true);
      expect(report.allHaveRiddle).toBe(true);
      expect(report.noneHaveKindBadge).toBe(true);
      expect(report.noneHaveCoinChip).toBe(true);
      expect(report.allTitlesRightOfMedallion).toBe(true);
      expect(report.allCuesWithinTile).toBe(true);

      await page.keyboard.press('Escape');
      await expect(page.locator('.qw-popout-panel')).toHaveCount(0);
    });
  }

  test('the last row of the largest cluster (Cognitive Core, 16 modules) is reachable by scrolling', async ({ page }) => {
    await reachHome(page);
    await page.evaluate(() => document.querySelectorAll('.qw-cluster-card')[0].click());
    await page.waitForSelector('.qw-popout-panel .qw-tile', { timeout: 15_000 });
    await page.waitForTimeout(900);

    const result = await page.evaluate(() => {
      const grid = document.querySelector('.qw-tile-grid');
      const hadScrollRoom = grid.scrollHeight > grid.clientHeight;
      grid.scrollTop = grid.scrollHeight;
      const tiles = Array.from(grid.querySelectorAll('.qw-tile'));
      const last = tiles[tiles.length - 1];
      const gridRect = grid.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      return {
        hadScrollRoom,
        lastFullyVisible: lastRect.top >= gridRect.top - 1 && lastRect.bottom <= gridRect.bottom + 1,
      };
    });

    // Pre-REV-15, the grid had no scroll room at all (`items-start` left
    // its height unconstrained) -- the last row was permanently clipped by
    // the panel's own `overflow-hidden`, with no scroll gesture able to
    // reach it. Both must now hold: there IS a scrollable region, and
    // scrolling it all the way actually surfaces the last tile.
    expect(result.hadScrollRoom).toBe(true);
    expect(result.lastFullyVisible).toBe(true);
  });
});

test.describe('REV-15 flag contrast', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('the nav language dropdown renders every flag with a visible ink hairline', async ({ page }) => {
    await reachHome(page);

    const trigger = page.locator('#unitas-nav button[aria-expanded]').first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.waitForSelector('.z-\\[140\\]', { timeout: 5_000 });
    await page.waitForTimeout(300);

    const flags = await page.evaluate(() => {
      const menu = document.querySelector('.z-\\[140\\]');
      const swatches = Array.from(menu.querySelectorAll('.u-flag'));
      return swatches.map((el) => getComputedStyle(el).boxShadow);
    });

    expect(flags.length).toBe(20);
    // SPEC.md §3.2: the Quantum White scope re-keys `--u-flag-ring` to an
    // ink hairline (rgba(10, 10, 12, 0.45)) for exactly this dropdown --
    // the pre-REV-15 default was a white 20% ring, ~1:1 contrast and
    // effectively invisible against the near-white panel background.
    for (const shadow of flags) {
      expect(shadow).toContain('rgba(10, 10, 12, 0.45)');
    }
  });
});
