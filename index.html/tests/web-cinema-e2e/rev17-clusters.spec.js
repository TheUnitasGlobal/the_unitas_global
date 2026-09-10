const { test, expect } = require('@playwright/test');

// REV-17 SPEC.md §4: the four Singularity Core cards render an abstract
// sigil instead of an orbit-dot ring whose dot COUNT doubled as an
// unintentional module counter, and neither the card nor its copy ever
// names a module count in digits or number words.

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

test.describe('REV-17 Singularity Core cluster cards', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('all 4 cards render a sigil <svg>, no orbit dots, and no digit/"modules" text anywhere in the card', async ({
    page,
  }) => {
    await reachHome(page);
    await page.locator('.qw-cluster-card').first().scrollIntoViewIfNeeded();

    const report = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.qw-cluster-card'));
      return cards.map((card) => {
        const sigil = card.querySelector('.qw-cluster-sigil svg');
        const dots = card.querySelectorAll('.qw-cluster-dot').length;
        const text = card.textContent || '';
        const titleEl = card.querySelector('.qw-cluster-title');
        return {
          hasSigil: Boolean(sigil),
          dots,
          hasDigit: /\d/.test(text),
          mentionsModules: /modules?/i.test(text),
          titleFontPx: titleEl ? parseFloat(getComputedStyle(titleEl).fontSize) : 0,
          height: card.getBoundingClientRect().height,
        };
      });
    });

    expect(report.length).toBe(4);
    for (const card of report) {
      expect(card.hasSigil).toBe(true);
      expect(card.dots).toBe(0);
      expect(card.hasDigit).toBe(false);
      expect(card.mentionsModules).toBe(false);
      // REV-17 title promotion (SPEC.md §4.3): real rendered size, past the
      // REV-15 effective ~14.4px (1.2rem inside .dashboard-zoom's 0.75 scale).
      expect(card.titleFontPx).toBeGreaterThan(15);
      // Same overall footprint band as before (no layout shift regression).
      expect(card.height).toBeGreaterThan(150);
      expect(card.height).toBeLessThan(280);
    }
  });

  test('each of the 4 sigils renders visually distinct markup', async ({ page }) => {
    await reachHome(page);
    const markups = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.qw-cluster-sigil svg')).map((svg) => svg.outerHTML),
    );
    expect(markups.length).toBe(4);
    expect(new Set(markups).size).toBe(4);
  });
});
