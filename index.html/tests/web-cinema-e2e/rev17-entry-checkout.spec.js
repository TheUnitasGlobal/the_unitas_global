const { test, expect } = require('@playwright/test');

// REV-17 SPEC.md §6: the module detail panel is promoted from a side
// slide-over into a second VIEW of the same pop-out panel
// (`data-view="entry"`) -- a scenario/guide/legal-notice stack on top, a
// sticky U-Pay zone on the bottom, and the CTA reads "Enter" / "입장하기"
// instead of "Invest now".

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

async function reachHome(page, locale = 'en') {
  await page.addInitScript((loc) => {
    try {
      sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
      // A fresh context has no saved language preference, and the app's
      // own locale-restore effect (lib/i18n/localePreference.ts,
      // unrelated to REV-17) then redirects a manually-typed non-default
      // locale root back to the default ('/') on first paint. Seed the
      // preference so a `/ko` visit actually stays on `/ko`.
      localStorage.setItem('unitas_locale_pref', loc);
    } catch {
      /* no-op */
    }
  }, locale);
  await page.goto(`/${locale}?sovereign_auth=${TOKEN}&splash=0`);
  await enterButton(page).click();
  await skipButton(page).click();
  await expect(page.getByRole('heading', { name: /coming soon/i })).toBeVisible({ timeout: 15_000 });
  await enterButton(page).click();
  await page.waitForSelector('.qw-cluster-card', { timeout: 30_000 });
  await expect(page.locator('.cs-root')).toHaveCount(0, { timeout: 15_000 });
}

async function openFirstEntryGate(page) {
  await page.evaluate(() => document.querySelectorAll('.qw-cluster-card')[0].click());
  await page.waitForSelector('.qw-tile', { timeout: 15_000 });
  await page.evaluate(() => document.querySelector('.qw-tile').click());
  await page.waitForSelector("[data-view='entry']", { timeout: 10_000 });
  // The panel narrows through a 0.28s max-width transition that only starts
  // on the next rendering frame -- on a software-rendered headless run the
  // frame can arrive 300-450ms after the attribute flips (measured
  // 2026-09-10, REV-19), so wait for the narrowed value itself instead of a
  // fixed delay.
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('.qw-popout-panel');
      return !!panel && parseFloat(getComputedStyle(panel).maxWidth) <= 648;
    },
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(150);
}

test.describe('REV-17 Entry Gate view', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('opens as a second panel view with a narrowed max-width and the shared header showing a back button + module identity', async ({
    page,
  }) => {
    await reachHome(page);
    await openFirstEntryGate(page);

    const panel = page.locator('.qw-popout-panel');
    await expect(panel).toHaveAttribute('data-view', 'entry');
    const maxWidth = await panel.evaluate((el) => getComputedStyle(el).maxWidth);
    // Narrowed from the grid view's 4xl (896px) toward --qw-entry-max-w
    // (640px); a few px of tolerance for subpixel/DPI rounding, not a
    // pixel-perfect equality check.
    expect(parseFloat(maxWidth)).toBeLessThanOrEqual(648);
    expect(parseFloat(maxWidth)).toBeGreaterThan(600);

    await expect(page.locator('.qw-entry-back')).toBeVisible();
    await expect(page.locator('.qw-entry-ident h2')).toBeVisible();
  });

  test('renders a 16:9 stage placeholder tagged with the module id, a scenario, a usage guide and a 4-item legal notice + link', async ({
    page,
  }) => {
    await reachHome(page);
    await openFirstEntryGate(page);

    const report = await page.evaluate(() => {
      const stage = document.querySelector('.qw-entry-stage');
      const rect = stage.getBoundingClientRect();
      const guide = document.querySelectorAll('.qw-entry-guide li');
      const notice = document.querySelectorAll('.qw-entry-notice li');
      const link = document.querySelector('.qw-entry-legal-link');
      const scenario = document.querySelector('.qw-entry-scenario-text');
      return {
        aspect: rect.width / rect.height,
        videoSlot: stage.getAttribute('data-video-slot'),
        guideCount: guide.length,
        noticeCount: notice.length,
        // REV-19 §12: the notice's Terms / Privacy affordances are buttons
        // that open the inline legal modal over the gate (no routing away);
        // an anchor with an href is the pre-REV-19 shape.
        hasLink: Boolean(link && (link.getAttribute('href') || link.tagName === 'BUTTON')),
        scenarioText: scenario ? scenario.textContent.trim() : '',
      };
    });

    // 16:9 (1.78) is the un-clamped target; on a short viewport `max-height`
    // (SPEC.md §6.3's `min(34vh, 300px)`) wins over the ratio before width
    // does (both `width: 100%` and `max-height` are explicit, so CSS
    // `aspect-ratio` has no free dimension left to solve for) -- widening
    // the box past 16:9 is expected there, collapsing toward a sliver is not.
    expect(report.aspect).toBeGreaterThan(1.6);
    expect(report.aspect).toBeLessThan(3);
    expect(report.videoSlot).toMatch(/^(ecosystem|lifeos|b2c|lockin|b2b):/);
    expect(report.guideCount).toBe(3);
    expect(report.noticeCount).toBe(4);
    expect(report.hasLink).toBe(true);
    expect(report.scenarioText.length).toBeGreaterThan(10);
  });

  test('the U-Pay zone stays sticky within the viewport and its CTA reads "Enter" (en)', async ({ page }) => {
    await reachHome(page, 'en');
    await openFirstEntryGate(page);

    const payReport = await page.evaluate(() => {
      const pay = document.querySelector('.qw-entry-pay');
      const btn = document.querySelector('.qw-upay-btn');
      const rect = pay.getBoundingClientRect();
      return {
        position: getComputedStyle(pay).position,
        bottomWithinViewport: rect.bottom <= window.innerHeight + 1,
        label: btn.textContent.trim(),
        state: btn.getAttribute('data-state'),
      };
    });
    expect(payReport.position).toBe('sticky');
    expect(payReport.bottomWithinViewport).toBe(true);
    expect(payReport.label).toBe('Enter');
    expect(payReport.state).toBe('idle');
  });

  test('the U-Pay zone CTA reads "입장하기" (ko)', async ({ page }) => {
    await reachHome(page, 'ko');
    await openFirstEntryGate(page);
    // A retrying assertion, not a one-shot read: the button can briefly
    // show a stale pre-hydration/locale-bundle-fetch label on the very
    // first module interaction of a fresh page.
    await expect(page.locator('.qw-upay-btn').first()).toHaveText('입장하기', { timeout: 5_000 });
  });

  test('back returns to the tile grid view and the hash reverts to the cluster-only surface', async ({ page }) => {
    await reachHome(page);
    await openFirstEntryGate(page);
    await page.locator('.qw-entry-back').click();
    await page.waitForTimeout(300);

    await expect(page.locator('.qw-popout-panel')).toHaveAttribute('data-view', 'grid');
    await expect(page.locator('.qw-tile-grid')).toBeVisible();
    const hash = await page.evaluate(() => location.hash);
    expect(hash).toMatch(/^#core\/cognitive$/);
  });
});
