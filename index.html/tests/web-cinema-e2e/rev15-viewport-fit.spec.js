const { test, expect } = require('@playwright/test');

// REV-15 single-viewport-fit matrix (SPEC.md §2, §6-4): every fixed
// pre-home screen (entry gate / cinematic ad / sealed coming-soon) must
// fit inside one viewport -- `scrollHeight <= clientHeight` on the
// screen's own panel -- across the locales with the longest strings and
// the viewports most likely to overflow (a short landscape phone; the
// smallest common portrait phones). This is the live-browser counterpart
// to the clamp() token math in SPEC.md §2.2-2.4; those tokens are static
// CSS, so only a real layout pass can prove they actually clear the
// worst-case copy in each locale.
//
// Owner instruction 2026-08-29 forbids scroll-locking `html`/`body` on any
// of these screens, so the panels keep their own `overflow-y-auto
// overscroll-contain` as a fail-safe -- these assertions check that the
// fail-safe never actually has to activate (a real user should never see a
// scrollbar or clipped content on this fixed-inset panel).
//
// Locale/viewport selection (kept intentionally small -- see CLAUDE.md's
// Low-Memory Armor doctrine against expensive matrices on this dev
// machine): `tl` has the longest AudioGate subtitle (147 chars) and cinema
// sub-caption (116 chars) of all 20 locales; `de`/`pl` are the next-longest
// Latin-script outliers; `en` is the baseline. `844x390` is the shortest
// common landscape phone aspect (this was the one REV-15's field
// measurement actually found overflowing, 14-28px, before the body{filter}
// fix); `375x667`/`360x640` are the shortest common portrait phones.
//
// A Playwright context `locale` matching the target's real BCP-47 tag is
// set per case (`de-DE` for `de`, etc.) so `navigator.language` resolves
// to that code and ComingSoonCinema.tsx's first-load auto-localization
// effect (it redirects to whatever locale `navigator.languages` matches
// among the 20 supported codes) leaves the requested URL locale alone --
// EXCEPT `tl`, which deliberately gets the non-matching `fil` tag instead:
// `routing.locales` has no `fil` entry, so detection finds nothing and the
// requested `/tl` URL sticks for the same reason.

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

const LOCALES = [
  { code: 'en', browserLocale: 'en-US' },
  { code: 'tl', browserLocale: 'fil' },
  { code: 'de', browserLocale: 'de-DE' },
  { code: 'pl', browserLocale: 'pl-PL' },
];

const VIEWPORTS = [
  { name: '375x667', viewport: { width: 375, height: 667 } },
  { name: '360x640', viewport: { width: 360, height: 640 } },
  { name: '844x390-landscape', viewport: { width: 844, height: 390 } },
  { name: '1366x768', viewport: { width: 1366, height: 768 } },
];

/** `scrollHeight` must never exceed `clientHeight` on the screen's own panel. */
async function assertNoOverflow(page, selector, label) {
  const { scrollH, clientH } = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return { scrollH: el ? el.scrollHeight : -1, clientH: el ? el.clientHeight : -1 };
  }, selector);
  expect(scrollH, `${label}: element "${selector}" not found`).toBeGreaterThanOrEqual(0);
  expect(scrollH, `${label} overflowed its viewport panel by ${scrollH - clientH}px`).toBeLessThanOrEqual(clientH + 1);
}

for (const vp of VIEWPORTS) {
  test.describe(`REV-15 viewport fit -- ${vp.name}`, () => {
    for (const locale of LOCALES) {
      test.describe(locale.code, () => {
        test.use({ viewport: vp.viewport, locale: locale.browserLocale });

        test(`gate + cinema + sealed fit one screen`, async ({ page }) => {
          await page.goto(`/${locale.code}?splash=0`, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('.cs-gate', { timeout: 20_000 });
          await page.waitForTimeout(400);
          await assertNoOverflow(page, '.cs-gate', `${vp.name}/${locale.code} gate`);

          await enterButton(page).click();
          await page.waitForSelector('.cs-cinema-body', { timeout: 20_000 });
          await page.waitForTimeout(600);
          await assertNoOverflow(page, '.cs-cinema-body', `${vp.name}/${locale.code} cinema`);

          await skipButton(page).click();
          await page.waitForSelector('.cs-sealed', { timeout: 20_000 });
          await page.waitForTimeout(600);
          await assertNoOverflow(page, '.cs-sealed', `${vp.name}/${locale.code} sealed`);
        });
      });
    }

    test.describe('en founder', () => {
      test.use({ viewport: vp.viewport, locale: 'en-US' });

      test('sealed door fits one screen without overlapping in-flow copy', async ({ page }) => {
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
        await page.waitForSelector('.cs-sealed[data-founder]', { timeout: 20_000 });
        await page.waitForTimeout(600);
        await assertNoOverflow(page, '.cs-sealed', `${vp.name}/en founder sealed`);
      });
    });
  });
}
