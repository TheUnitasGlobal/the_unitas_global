const { test, expect } = require('@playwright/test');

// REV-19 SPEC.md §12 -- Terms / Privacy (and every institutional page)
// open as an INLINE modal over the current screen, never routing away:
// from the footer, and from the Entry Gate's legal notice (a third level
// above the pop-out + gate). Korean nomenclature: "고지" is gone.

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

// Headless WebKit renders the home's WebGL layers in software: rAF frames
// take 350-700ms, so every Playwright "stable" check crawls. Triple budget.
test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
});

test.describe('REV-19 inline legal modal', () => {
  test('footer Terms link opens the inline modal without changing the URL; back closes it', async ({ page }) => {
    await reachHome(page);
    const before = page.url();
    await page.locator('#site-footer a[data-site-link="legal/terms"]').click();
    await expect(page.locator('#site-page-title')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#site-page-title')).toHaveText('이용약관');
    expect(page.url()).toBe(before);
    await expect(page.locator('#site-footer h3').nth(1)).toHaveText('법률 안내');
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#site-page-title')).toHaveCount(0);
    expect(page.url()).toBe(before);
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
  });

  test('Entry Gate legal notice opens the modal as a third level over the pop-out and gate', async ({ page }) => {
    await reachHome(page);
    await page.evaluate(() => document.querySelectorAll('.qw-cluster-card')[0].click());
    await page.waitForSelector('.qw-tile', { timeout: 15_000 });
    await page.evaluate(() => document.querySelector('.qw-tile').click());
    await page.waitForSelector("[data-view='entry']", { timeout: 10_000 });
    await expect(page.locator('.qw-entry-notice .qw-entry-eyebrow')).toHaveText('공지사항');
    await expect(page.locator('.qw-entry-notice')).not.toContainText('고지');
    const before = page.url();
    await page.locator('.qw-entry-legal-links button').last().click();
    await expect(page.locator('#site-page-title')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#site-page-title')).toHaveText('개인정보 처리방침');
    expect(page.url()).toBe(before);
    const depth = await page.evaluate(() => ((history.state || {}).unitasModalStack || []).length);
    expect(depth).toBe(3);
    // Escape closes ONLY the topmost dialog (the legal notice); the Entry
    // Gate and pop-out beneath stay open.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await expect(page.locator('#site-page-title')).toHaveCount(0);
    await expect(page.locator("[data-view='entry']")).toBeVisible();
    await expect(page.locator('.qw-popout-panel')).toHaveCount(1);
    expect(await page.evaluate(() => ((history.state || {}).unitasModalStack || []).length)).toBe(2);
    // ... and the back gesture does the same from a re-opened notice.
    await page.locator('.qw-entry-legal-links button').first().click();
    await expect(page.locator('#site-page-title')).toHaveText('이용약관', { timeout: 5_000 });
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#site-page-title')).toHaveCount(0);
    await expect(page.locator("[data-view='entry']")).toBeVisible();
  });
});
