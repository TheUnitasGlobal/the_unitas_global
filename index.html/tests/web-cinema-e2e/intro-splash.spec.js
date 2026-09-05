const { test, expect } = require('@playwright/test');

// 3-second cinematic intro splash (web/components/splash/CinematicIntroSplash.tsx,
// owner instruction 2026-09-04, item 3). Forced on every cold load, on every
// device (all three configured projects), above the pre-launch curtain; must
// release the page by itself within ~3.5s.

const splash = (page) => page.getByTestId('intro-splash');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();

test.describe('cinematic intro splash', () => {
  test('is forced on a cold load, spells UNITAS, then releases the gate', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/en');

    await expect(splash(page)).toBeVisible();
    await expect(page.locator('.sp-letter')).toHaveCount(6);
    await expect(page.locator('.sp-letter')).toHaveText(['U', 'N', 'I', 'T', 'A', 'S']);
    await expect(page.locator('.sp-corp')).toHaveText('THE UNITAS GLOBAL OÜ');
    await expect(page.locator('.sp-mark svg')).toHaveCount(1);

    // Unmounts after DURATION (3000ms) + EXIT (450ms).
    await expect(splash(page)).toHaveCount(0, { timeout: 6000 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(3000);

    // The entry gate beneath is now interactive.
    await expect(enterButton(page)).toBeVisible();
    await enterButton(page).click();
    await expect(page.getByRole('button', { name: /skip/i })).toBeVisible({ timeout: 5000 });
  });

  test('?splash=0 hides it before first paint (QA/E2E escape hatch)', async ({ page }) => {
    await page.goto('/en?splash=0');
    const flag = await page.evaluate(() => document.documentElement.getAttribute('data-splash'));
    expect(flag).toBe('off');
    await expect(splash(page)).toBeHidden();
    await expect(enterButton(page)).toBeVisible();
  });

  test('PWA bootstrap is wired on every route', async ({ page }) => {
    await page.goto('/en/company/about?splash=0');
    const wired = await page.evaluate(() => ({
      prompt: '__unitasPwaPrompt' in window,
      manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '',
      trigger: document.querySelectorAll('[data-pwa-install]').length,
    }));
    expect(wired.prompt).toBe(true);
    expect(wired.manifest).toMatch(/^\/manifest\.json\?v=v2-final-symmetry\./);
    expect(wired.trigger).toBeGreaterThan(0);
  });
});
