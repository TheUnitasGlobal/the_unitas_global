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
  test('back @ text clears the text (popup stays), back again closes the popup, back leaves the bar, back opens the exit confirm', async ({ page }) => {
    await reachHome(page);
    await input(page).click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    expect(await stack(page)).toEqual([expect.stringMatching(/^search:focus/)]);

    await page.keyboard.type('서울');
    await page.waitForTimeout(700);
    await expect(page.locator('.qw-search-dropdown')).toHaveAttribute('data-search-level', '3');
    await expect(page.locator('#omni-synapse-search')).toHaveAttribute('data-typing', '1');
    expect(await stack(page)).toHaveLength(3);
    // §13: the typing popup carries no ladder and no nested shortcut strip
    await expect(page.locator('.qw-search-dropdown [data-live-hub]')).toHaveCount(0);
    await expect(page.locator('.qw-search-dropdown [data-discovery="curiosity"]')).toBeVisible();
    const labelSize = await page.locator('.qw-search-dropdown .qw-discovery-label').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(labelSize).toBeGreaterThanOrEqual(14);

    await page.goBack();
    await page.waitForTimeout(500);
    await expect(input(page)).toHaveValue('');
    await expect(page.locator('.qw-search-dropdown')).toHaveAttribute('data-search-level', '2');
    await expect(page.locator('#omni-synapse-search')).toHaveAttribute('data-typing', '0');
    expect(await stack(page)).toHaveLength(2);

    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('.qw-search-dropdown')).toHaveCount(0);
    await expect(page.locator('[data-live-hub]')).toBeVisible();
    expect(await stack(page)).toHaveLength(1);

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

  test('the Enter key reads bold at rest and flares while typing', async ({ page }) => {
    await reachHome(page);
    const key = page.locator('#omni-synapse-search .qw-enter-key');
    const rest = await key.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { opacity: parseFloat(cs.opacity), borderWidth: parseFloat(cs.borderTopWidth), borderColor: cs.borderTopColor, animation: cs.animationName };
    });
    expect(rest.opacity).toBeGreaterThanOrEqual(0.7);
    // 2 CSS px inside the 0.75 zoom tree snaps to one device pixel, which
    // Chromium reports back as 1.33 CSS px -- anything above the old 1px
    // hairline (0.67 after the same snap) proves the bold ring.
    expect(rest.borderWidth).toBeGreaterThanOrEqual(1.3);
    expect(rest.borderColor).toBe('rgb(11, 92, 255)');
    expect(rest.animation).toBe('none');
    await input(page).click();
    await page.keyboard.type('x');
    await page.waitForTimeout(200);
    const typing = await key.evaluate((el) => getComputedStyle(el).animationName);
    expect(typing).toBe('qw-enter-flux');
  });
});
