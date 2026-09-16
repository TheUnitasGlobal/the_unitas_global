const { test, expect } = require('@playwright/test');

// REV-34 MISSION 3 (SPEC.md §3.5, decision D-9) -- the Escape key mirrors
// the device back button.
//
// Before REV-34 Escape was routed ad hoc: ExitGuard opened the exit confirm
// whenever no dialog answered a hit-test, and every popup closed itself on
// its own bubble listener -- so over the suggestion listbox Escape was dead,
// and at search level 1 it opened the exit confirm OVER the still-open
// popup. lib/history/escapeController.ts now yields ONE verdict per press
// (ignore / close-local / dismiss-confirm / history-back / open-confirm), and
// `history-back` is a real `window.history.back()` -- the very traversal a
// phone's back button makes -- so the modal stack closes exactly the topmost
// layer. What is measured here is the ladder the founder asked for, on the
// built app: card -> tower -> clear text -> leave the bar -> main home ->
// exit confirm, plus the three surfaces that must NOT walk history (a
// `[data-escape-local]` menu, the hub over the bar, the confirm itself).
//
// Every close after an Escape is a popstate landing, so EVERY assertion
// after a press is a polled expect with a timeout -- never a synchronous
// read. The harness's WebKit lands a frame in 555-698ms (REV-28), hence the
// 600ms settle before any raw `stack()` evaluation (rev19-legal-modal L74).

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');
const input = (page) => page.locator('#omni-synapse-search input[type="text"]');

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

/** A popstate landing costs a frame; on this harness's WebKit that is over
 *  half a second. Settle before reading the raw history state. */
const settle = (page) => page.waitForTimeout(600);

// Headless WebKit renders the home's WebGL layers in software: rAF frames
// take 350-700ms, so every Playwright "stable" check crawls. Triple budget.
test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
});

test.describe('REV-34 M3 -- Escape mirrors the back ladder', () => {
  test('tower -> clear the box -> leave the bar -> main home -> exit confirm, one press each', async ({ page }) => {
    await reachHome(page);

    // Level 1: the focused bar parks `search:focus`.
    await input(page).click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    expect(await stack(page)).toEqual([expect.stringMatching(/^search:focus/)]);

    // Level 3: a typed query, then the fullscreen tower on Enter.
    await page.keyboard.type('서울');
    await page.waitForTimeout(700);
    await expect(page.locator('.qw-search-dropdown')).toHaveAttribute('data-search-level', '3');
    await page.keyboard.press('Enter');
    await expect(page.locator('#uai-search-result-title')).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => document.body.hasAttribute('data-fullscreen-tower-open'))).toBe(true);

    // Escape 1: the tower closes; the query is KEPT (closeSearchTower).
    await page.keyboard.press('Escape');
    await expect(page.locator('#uai-search-result-title')).toHaveCount(0, { timeout: 8_000 });
    await expect(input(page)).toHaveValue('서울');
    await expect.poll(() => page.evaluate(() => document.body.hasAttribute('data-fullscreen-tower-open')), { timeout: 8_000 }).toBe(false);

    // Escape 2: the box empties and the dropdown goes with it; the base
    // popup (the live hub) is back on one layer.
    await page.keyboard.press('Escape');
    await expect(input(page)).toHaveValue('', { timeout: 8_000 });
    await expect(page.locator('.qw-search-dropdown')).toHaveCount(0, { timeout: 8_000 });
    await expect(page.locator('#omni-synapse-search')).toHaveAttribute('data-typing', '0', { timeout: 8_000 });
    await expect(page.locator('[data-live-hub]')).toBeVisible({ timeout: 8_000 });
    await settle(page);
    expect(await stack(page)).toHaveLength(1);

    // Escape 3: the bar is left; the main home is on screen, no confirm.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-live-hub]')).toHaveCount(0, { timeout: 8_000 });
    await settle(page);
    expect(await stack(page)).toHaveLength(0);
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);

    // Escape 4: nothing left open on the released home -> the exit confirm.
    await page.keyboard.press('Escape');
    await expect(page.locator('#exit-guard-title')).toBeVisible({ timeout: 5_000 });
  });

  test('the hub over the bar: Escape closes the hub only', async ({ page }) => {
    await reachHome(page);
    await input(page).click();
    await page.waitForTimeout(500);
    await page.locator('[data-unitas-hub-toggle]').click();
    const hub = page.locator('[role="dialog"] [data-unitas-hub]');
    await expect(hub).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(hub).toHaveCount(0, { timeout: 8_000 });
    // The layer beneath (the focused bar + live hub) is untouched.
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
    await settle(page);
    expect(await stack(page)).toEqual([expect.stringMatching(/^search:focus/)]);
  });

  test('Escape on the exit confirm dismisses it (취소) and re-arms the sentinel', async ({ page }) => {
    await reachHome(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#exit-guard-title')).toBeVisible({ timeout: 5_000 });

    // dismiss-confirm: the visitor stays exactly where they were.
    await page.keyboard.press('Escape');
    await expect(page.locator('#exit-guard-title')).toHaveCount(0, { timeout: 5_000 });

    // close() refilled the sentinel buffer: the next back press is the
    // confirm again, not a dead press and not a navigation away.
    await page.goBack();
    await expect(page.locator('#exit-guard-title')).toBeVisible({ timeout: 5_000 });
  });

  test('the attach menu: Escape closes the menu only, with no history traversal', async ({ page }) => {
    await reachHome(page);
    await input(page).click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    await page.locator('[data-attach-toggle]').click();
    const menu = page.locator('[data-attach-menu]');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('data-escape-local', '');

    // close-local: the menu's own handler closes it (the menu is `hidden`,
    // never unmounted) and hands focus back to the toggle, so the search
    // popup beneath -- and its history layer -- do not move.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden({ timeout: 8_000 });
    await expect(page.locator('[data-attach-toggle]')).toBeFocused();
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
    await settle(page);
    expect(await stack(page)).toHaveLength(1);
  });
});
