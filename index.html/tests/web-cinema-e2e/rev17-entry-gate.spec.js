const { test, expect } = require('@playwright/test');

// REV-17 SPEC.md §1, §2: the founder-only "founder · full sequential QA"
// caption is gone from the entry gate (M1), and the nav "UNITAS / App
// Download" CTA has a real, always-visible border instead of relying
// entirely on its pulse keyframe's animated box-shadow for an edge (M2-a).

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

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
  await expect(page.locator('.cs-root')).toHaveCount(0, { timeout: 15_000 });
}

test.describe('REV-17 entry gate -- founder QA caption removed', () => {
  test('the founder gate never shows the "founder / full sequential QA" caption', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
      } catch {
        /* no-op */
      }
    });
    await page.goto(`/en?sovereign_auth=${TOKEN}&splash=0`);
    await expect(enterButton(page)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500); // let the founder verification effect settle

    const gateText = await page.evaluate(() => document.body.innerText);
    expect(gateText).not.toMatch(/sequential\s+QA/i);

    // The ENTER button stays within the viewport even with the caption gone
    // (REV-15 §2.2's budget only got MORE headroom by removing it).
    const box = await enterButton(page).boundingBox();
    const viewport = page.viewportSize();
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  });
});

test.describe('REV-17 nav CTA border (SPEC.md §2)', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('the UNITAS App Download CTA renders a real border at rest, on the Quantum White home', async ({ page }) => {
    await reachHome(page);

    const style = await page.evaluate(() => {
      const cta = document.querySelector('#unitas-nav .unitas-install-cta');
      const cs = getComputedStyle(cta);
      const rect = cta.getBoundingClientRect();
      return { borderWidth: cs.borderTopWidth, borderStyle: cs.borderTopStyle, height: rect.height };
    });
    expect(parseFloat(style.borderWidth)).toBeGreaterThanOrEqual(1);
    expect(style.borderStyle).not.toBe('none');
    expect(style.height).toBeGreaterThanOrEqual(20);
  });

  test('the label reads at 9px or larger even on the compact mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await reachHome(page);
    const fontSize = await page.evaluate(() => {
      const label = document.querySelector('#unitas-nav .unitas-install-cta__label');
      return parseFloat(getComputedStyle(label).fontSize);
    });
    expect(fontSize).toBeGreaterThanOrEqual(9);
  });
});
