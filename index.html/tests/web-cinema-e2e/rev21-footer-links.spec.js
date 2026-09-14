const { test, expect } = require('@playwright/test');
const path = require('path');

// REV-21 SPEC.md §6 -- the footer's 12 institutional links. Every link opens
// the shared SiteArticle as an INLINE modal (URL unchanged, section index,
// Escape closes, the exit confirm never appears); privacy / cookies carry
// the registry-generated disclosures; the "open the full page" route
// renders the same article on the Quantum White surface (F-1); and a link
// clicked BEFORE React has hydrated is captured by the head bootstrap and
// still opens the modal (F-2) instead of routing into the dark document.

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const KO = require(path.join(__dirname, '..', '..', 'docs', 'rev21', 'i18n', 'sitepages', 'ko.json'));
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

const LINKS = [
  ['company', 'about'],
  ['company', 'careers'],
  ['company', 'press'],
  ['legal', 'patent-notice'],
  ['legal', 'compliance'],
  ['legal', 'security'],
  ['legal', 'privacy'],
  ['legal', 'cookies'],
  ['legal', 'terms'],
  ['support', 'help-center'],
  ['support', 'contact'],
  ['support', 'system-status'],
];

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

const footerLink = (page, group, slug) => page.locator(`#site-footer a[data-site-link="${group}/${slug}"]`);
// Both hosts label their heading `site-page-title` (the aria + E2E contract),
// so every assertion is scoped to ONE host -- a bare `#site-page-title` would
// be ambiguous in any frame where a dialog sits over its own route.
const modalTitle = (page) => page.locator('article[data-site-host="modal"] #site-page-title');
const routeTitle = (page) => page.locator('article[data-site-host="route"] #site-page-title');

async function openFromFooter(page, group, slug) {
  const link = footerLink(page, group, slug);
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(modalTitle(page)).toBeVisible({ timeout: 5_000 });
}

async function closeWithEscape(page) {
  await page.keyboard.press('Escape');
  // REV-26: this is a SYNCHRONISATION timeout, not a performance budget, and
  // 5s was not one on every engine. The render probe measured this harness's
  // WebKit rasterising the released page at ~555ms per frame (34.7x its own
  // floor, GPU-less), so five seconds buys about NINE frames there -- Escape ->
  // React state -> unmount does not reliably fit. The assertion is unchanged;
  // only the patience is. On a real device this resolves in one frame.
  await expect(modalTitle(page)).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(250);
}

// Headless WebKit renders this page in software: rAF frames take 350-700ms, so
// every Playwright actionability check crawls. An earlier revision guessed at
// that range and tripled the budget; REV-26's render probe now MEASURES it --
// `page 555ms vs floor 16ms (34.69x)` on this harness -- and one test here
// walks all twelve links, opening and closing a modal each time. Twelve
// open/close cycles at ~0.5s a frame does not fit in three minutes once the
// Escape wait is allowed the time that engine actually needs (REV-26 raised it
// from 5s, which was about nine frames there, to 20s).
//
// This is patience for a slow HARNESS, not tolerance for a slow PRODUCT: every
// assertion in the file is unchanged, and on a real device each of these steps
// resolves in one frame.
test.beforeEach(async ({ browserName }) => {
  if (browserName === 'webkit') test.setTimeout(360_000);
});

test.describe('REV-21 §6 footer links', () => {
  test('all 12 links open the inline article without changing the URL; Escape closes; no exit confirm', async ({ page }) => {
    await reachHome(page);
    const before = page.url();
    for (const [group, slug] of LINKS) {
      await openFromFooter(page, group, slug);
      await expect(modalTitle(page)).toHaveText(KO[`${slug}.title`]);
      expect(page.url()).toBe(before);
      const article = page.locator(`article[data-site-page="${slug}"][data-site-host="modal"]`);
      await expect(article).toHaveCount(1);
      expect(await article.locator('section.qw-site-article-section').count()).toBeGreaterThanOrEqual(4);
      await expect(article.locator('[data-site-toc]')).toBeVisible();
      await expect(article.locator('.qw-site-article-updated time')).toHaveText(KO[`${slug}.updated`]);
      await expect(page.locator('#exit-guard-title')).toHaveCount(0);
      await closeWithEscape(page);
      expect(page.url()).toBe(before);
    }
    // The footer's Korean nomenclature is unchanged (Footer.legal = 법률 안내).
    await expect(page.locator('#site-footer h3').nth(1)).toHaveText('법률 안내');
  });

  test('legal pages carry the disclaimer, company / support pages the corporate notice', async ({ page }) => {
    await reachHome(page);
    await openFromFooter(page, 'legal', 'terms');
    await expect(page.locator('article[data-site-page="terms"] .qw-site-article-disclaimer')).toHaveCount(1);
    await expect(page.locator('article[data-site-page="terms"] .qw-site-article-notice')).toHaveCount(0);
    await closeWithEscape(page);
    await openFromFooter(page, 'company', 'about');
    await expect(page.locator('article[data-site-page="about"] .qw-site-article-notice')).toHaveCount(1);
    await expect(page.locator('article[data-site-page="about"] .qw-site-article-disclaimer')).toHaveCount(0);
    await closeWithEscape(page);
  });

  test('privacy discloses the registry: every fetched operator with its calling side, and the browser storage ledger', async ({ page }) => {
    await reachHome(page);
    await openFromFooter(page, 'legal', 'privacy');
    const article = page.locator('article[data-site-page="privacy"]');
    const thirdParty = article.locator('[data-site-registry="third-party"] li');
    const storage = article.locator('[data-site-registry="storage"] li');
    const cookies = article.locator('[data-site-registry="cookies"] li');
    expect(await thirdParty.count()).toBeGreaterThanOrEqual(20);
    expect(await storage.count()).toBeGreaterThanOrEqual(30);
    expect(await cookies.count()).toBeGreaterThanOrEqual(5);
    await expect(article.locator('[data-site-registry="cookies"]')).toContainText('unitas_sovereign');
    await expect(article.locator('[data-site-registry="third-party"]')).toContainText('Microsoft');
    await expect(article.locator('[data-site-registry="storage"]')).toContainText('unitas.sitePage.open.v1');
    // every operator row links to the real operator, new tab, no referrer
    const anchors = article.locator('[data-site-registry="third-party"] li a');
    expect(await anchors.count()).toBe(await thirdParty.count());
    expect(await anchors.first().getAttribute('rel')).toContain('noopener');
    // the sticky section index scrolls the bounded body (F-11), URL still unchanged
    const before = page.url();
    const body = article.locator('[data-site-article-body]');
    const top0 = await body.evaluate((el) => el.scrollTop);
    await article.locator('[data-site-toc] button').last().click();
    // POLLED, not a fixed 700ms wait. A scroll is animated, and on this
    // harness's WebKit a frame costs ~555ms -- 700ms is barely one. The claim
    // is the same (the index scrolls the bounded body); it is just allowed to
    // arrive at the engine's own pace.
    await expect
      .poll(async () => body.evaluate((el) => el.scrollTop), { timeout: 20_000 })
      .toBeGreaterThan(top0);
    expect(page.url()).toBe(before);
    await closeWithEscape(page);
  });

  test('cookie policy discloses the two on-device ledgers (storage keys + cookies), not the operators', async ({ page }) => {
    await reachHome(page);
    await openFromFooter(page, 'legal', 'cookies');
    const article = page.locator('article[data-site-page="cookies"]');
    await expect(article.locator('[data-site-registry="storage"]')).toHaveCount(1);
    await expect(article.locator('[data-site-registry="cookies"]')).toHaveCount(1);
    await expect(article.locator('[data-site-registry="third-party"]')).toHaveCount(0);
    await closeWithEscape(page);
  });

  test('"open the full page" renders the same article on the Quantum White surface (F-1) and back returns home', async ({ page }) => {
    await reachHome(page);
    await openFromFooter(page, 'legal', 'terms');
    await page.locator('article[data-site-page="terms"] .qw-site-article-actions a').click();
    await page.waitForURL(/\/ko\/legal\/terms$/, { timeout: 15_000 });
    await expect(page.locator('article[data-site-page="terms"][data-site-host="route"]')).toBeVisible({ timeout: 15_000 });
    await expect(routeTitle(page)).toHaveText(KO['terms.title']);
    expect(await page.locator('html').getAttribute('data-unitas-surface')).toBe('quantum-white');
    await expect(page.locator('article[data-site-host="route"] [data-site-toc]')).toBeVisible();
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
    // The dialog closed on the click itself, so the route never shares the
    // `site-page-title` id with it -- and the mirror did not survive either.
    await expect(page.locator('article[data-site-host="modal"]')).toHaveCount(0);
    await expect(page.locator('#site-page-title')).toHaveCount(1);
    expect(await page.evaluate(() => sessionStorage.getItem('unitas.sitePage.open.v1'))).toBeNull();
    await page.goBack();
    await page.waitForURL(/\/ko(\?.*)?$/, { timeout: 15_000 });
    await expect(page.locator('#site-footer')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
  });

  test('a language switch keeps the open article (F-7)', async ({ page }) => {
    await reachHome(page);
    await openFromFooter(page, 'legal', 'privacy');
    const beforeKo = page.url();
    // the mirror is written the moment the page opens
    expect(await page.evaluate(() => sessionStorage.getItem('unitas.sitePage.open.v1'))).toBe(JSON.stringify({ group: 'legal', slug: 'privacy' }));
    await closeWithEscape(page);
    expect(await page.evaluate(() => sessionStorage.getItem('unitas.sitePage.open.v1'))).toBeNull();
    expect(page.url()).toBe(beforeKo);
  });

  // REV-25 follow-up (measured 2026-09-14). This test SKIPPED on all three
  // engines, every run, since it was written -- and a skip is an unmeasured
  // claim. It held every `_next/static/*.js` chunk for three seconds and then
  // called `page.reload()`, but on a reload those chunks never reach
  // `page.route` at all:
  //
  //   as the spec ran      chunk requests seen by page.route: 0
  //                        service worker controlling the page: TRUE
  //   with SW blocked      chunk requests seen by page.route: 26  (held)
  //                        but `__unitasSiteLinkLive` was STILL true at click
  //                        time -- Next's immutable chunks come back from the
  //                        HTTP cache, and a cache hit is not routable either.
  //
  // So React was always already live and the test always stepped aside.
  //
  // A FIRST LOAD in a page that has never run is a different thing: nothing is
  // cached for it, the route holds every chunk, and the pre-hydration window is
  // real and long. Measured on this build, with the founder cookies already in
  // the context and the chunks held for four seconds:
  //
  //     261ms  footer=12  live=false     <- the footer is in the SSR HTML
  //    ...
  //   4164ms  footer=12  live=false     <- ~3.9s of genuine pre-hydration
  //   4476ms  footer=12  live=true      <- React takes over
  //
  // and a click inside that window parks `{group:'legal',slug:'terms'}` in
  // `__unitasPendingSitePage`, mirrors it to sessionStorage, and once React
  // arrives the modal opens on `data-site-page="terms"` with the URL unchanged.
  // That is the whole F-2 contract, and it now runs instead of skipping.
  test.describe('F-2 pre-hydration capture', () => {
    // The PWA service worker serves `_next/static` from its own cache, and a
    // worker-mediated request is outside `page.route` entirely (measured
    // above). Blocking workers is what puts the chunk hold back in control.
    test.use({ serviceWorkers: 'block' });

    // REV-26 M2: one link per GROUP, not one link. The head bootstrap carries
    // its own copy of the group/slug table (SITE_LINK_BOOTSTRAP embeds
    // SLUGS_BY_GROUP), so a group that fell out of that table would still pass
    // a single-link test while routing real visitors into the dark document.
    for (const [group, slug, titleKey] of [
      ['company', 'about', 'about.title'],
      ['legal', 'terms', 'terms.title'],
      ['support', 'contact', 'contact.title'],
    ]) {
      test(`a ${group}/${slug} link clicked BEFORE hydration is captured by the head bootstrap and still opens the modal (F-2)`, async ({ page, context }) => {
        // Establish the founder session on the ordinary page...
        await reachHome(page);

        // ...then do the real work on a page that has never loaded anything, so
        // every chunk is a cache miss and the hold actually holds.
        const cold = await context.newPage();
        await cold.addInitScript(() => {
          try {
            sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
            localStorage.setItem('unitas_locale_pref', 'ko');
          } catch {
            /* no-op */
          }
        });
        let holding = true;
        await cold.route(/\/_next\/static\/.*\.js(\?.*)?$/, async (route) => {
          if (holding) await new Promise((resolve) => setTimeout(resolve, 4_000));
          await route.continue();
        });
        await cold.goto('/ko?splash=0&dev=skip', { waitUntil: 'commit' });

        // The footer is server-rendered, so it is there long before React is.
        await cold.waitForFunction(() => document.querySelectorAll('a[data-site-link]').length > 0, null, { timeout: 15_000 });
        const captured = await cold.evaluate(
          ([g, sl]) => {
            const a = document.querySelector(`a[data-site-link="${g}/${sl}"]`);
            if (!a) return { ok: false, why: `no ${g}/${sl} link in the server-rendered footer` };
            const live = Boolean(window.__unitasSiteLinkLive);
            a.click();
            let mirrored = null;
            try {
              mirrored = sessionStorage.getItem('unitas.sitePage.open.v1');
            } catch {
              /* no-op */
            }
            return { ok: true, live, parked: window.__unitasPendingSitePage || null, mirrored };
          },
          [group, slug],
        );

        expect(captured.ok, captured.why).toBe(true);
        expect(captured.live, 'the window under test is BEFORE hydration -- if React is already live the test proves nothing').toBe(false);
        expect(captured.parked, 'the head bootstrap must park the request instead of letting the anchor navigate').toEqual({ group, slug });
        expect(captured.mirrored, 'and mirror it to sessionStorage (F-7)').toBe(JSON.stringify({ group, slug }));

        // Let React arrive and consume what the bootstrap parked.
        holding = false;
        await expect(modalTitle(cold)).toBeVisible({ timeout: 30_000 });
        await expect(modalTitle(cold)).toHaveText(KO[titleKey]);
        expect(cold.url(), 'the visitor never left the home document').toMatch(/\/ko(\?.*)?$/);
        expect(await cold.locator('html').getAttribute('data-unitas-surface')).toBe('quantum-white');
        await expect(cold.locator('#exit-guard-title')).toHaveCount(0);
        await cold.close();
      });
    }
  });
});
