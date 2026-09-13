const { test, expect } = require('@playwright/test');

// REV-19 SPEC.md §3 + §13 -- the U-AI search bar's four-level back
// routing: text cleared -> suggestion popup closed -> bar left -> exit
// confirm; plus the typing popup's composition (no ladder / no nested
// strip, enlarged keyword heading, discovery widgets) and the Enter key's
// typing state.

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

// Headless WebKit renders the home's WebGL layers in software: rAF frames
// take 350-700ms, so every Playwright "stable" check crawls. Triple budget.
test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
});

test.describe('REV-19 U-AI search back routing', () => {
  // REV-23 M2.4 collapsed the tail from four presses to three. The founder's
  // requirement is exact: from any popup depth, back unwinds in reverse order
  // of opening and ends [clear the box] -> [main home] -> [exit confirm]. The
  // separate `search:typing` history layer that used to sit between `text`
  // and `focus` is gone -- clearing the box also closes the dropdown, in one
  // press. The bar therefore owns TWO layers, not three.
  test('back clears the box (dropdown closes with it), back leaves the bar, back opens the exit confirm', async ({ page }) => {
    await reachHome(page);
    await input(page).click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    expect(await stack(page)).toEqual([expect.stringMatching(/^search:focus/)]);

    await page.keyboard.type('서울');
    await page.waitForTimeout(700);
    await expect(page.locator('.qw-search-dropdown')).toHaveAttribute('data-search-level', '3');
    await expect(page.locator('#omni-synapse-search')).toHaveAttribute('data-typing', '1');
    expect(await stack(page)).toHaveLength(2);
    // §13: the typing popup carries no ladder and no nested shortcut strip
    await expect(page.locator('.qw-search-dropdown [data-live-hub]')).toHaveCount(0);
    // REV-20 §4.4: signals + curiosity cards are gone from the typing
    // dropdown entirely -- they now inject into the post-submit fullscreen
    // stream instead (see rev20-fullscreen.spec.js).
    await expect(page.locator('.qw-search-dropdown [data-discovery="curiosity"]')).toHaveCount(0);
    await expect(page.locator('.qw-search-dropdown [data-discovery="signals"]')).toHaveCount(0);
    const labelSize = await page.locator('.qw-search-dropdown .qw-discovery-label').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(labelSize).toBeGreaterThanOrEqual(14);

    // M2.4 step 1 -- one press empties the box AND closes the dropdown, and
    // the base popup (with the live-news strip) is back.
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(input(page)).toHaveValue('');
    await expect(page.locator('.qw-search-dropdown')).toHaveCount(0);
    await expect(page.locator('#omni-synapse-search')).toHaveAttribute('data-typing', '0');
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    expect(await stack(page)).toHaveLength(1);

    // M2.4 step 2 -- the bar is left, the main home is what is on screen.
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-live-hub]')).toHaveCount(0);
    expect(await stack(page)).toHaveLength(0);
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);

    await page.goBack();
    await expect(page.locator('#exit-guard-title')).toBeVisible({ timeout: 5_000 });
  });

  test('a hand-emptied input restores the base widgets instantly (typing session ends)', async ({ page }) => {
    await reachHome(page);
    await input(page).click();
    await page.keyboard.type('a');
    await page.waitForTimeout(400);
    await expect(page.locator('.qw-search-dropdown')).toHaveCount(1);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(700);
    await expect(page.locator('.qw-search-dropdown')).toHaveCount(0);
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    expect(await stack(page)).toHaveLength(1);
  });

  // REV-23 M5 INVERTS this. The founder's instruction was to LOWER the enter
  // key's emphasis until it balances the three-shortcut toggle beside it: at
  // rest it is now the same quiet neutral box, and while typing it goes a
  // steady blue instead of running the 2.6s `qw-enter-flux` colour strobe.
  test('the Enter key rests quiet, matches the shortcut toggle, and arms without strobing', async ({ page }) => {
    await reachHome(page);
    const key = page.locator('#omni-synapse-search .qw-enter-key');
    const rest = await key.evaluate((el) => {
      const cs = getComputedStyle(el);
      const attach = getComputedStyle(document.querySelector('#omni-synapse-search .qw-attach-toggle'));
      return {
        opacity: parseFloat(cs.opacity),
        borderWidth: parseFloat(cs.borderTopWidth),
        borderColor: cs.borderTopColor,
        animation: cs.animationName,
        attachBorderWidth: parseFloat(attach.borderTopWidth),
        attachBorderColor: attach.borderTopColor,
      };
    });
    expect(rest.opacity).toBeGreaterThanOrEqual(0.7);
    expect(rest.animation).toBe('none');
    // The pair now shares one box: same rim weight, same rim colour.
    expect(rest.borderWidth).toBeCloseTo(rest.attachBorderWidth, 1);
    expect(rest.borderColor).toBe(rest.attachBorderColor);
    // Saturated blue is EARNED, never worn at rest.
    expect(rest.borderColor).not.toBe('rgb(11, 92, 255)');
    await input(page).click();
    await page.keyboard.type('x');
    // The armed fill arrives through a 250ms background-color transition;
    // reading it earlier returns the interpolating value, not the contract.
    await expect
      .poll(async () => key.evaluate((el) => getComputedStyle(el).backgroundColor), { timeout: 4_000 })
      .toBe('rgb(11, 92, 255)');
    expect(await key.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });
});
