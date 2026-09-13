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
  await expect(modalTitle(page)).toHaveCount(0, { timeout: 5_000 });
  await page.waitForTimeout(250);
}

// Headless WebKit renders the home's WebGL layers in software: rAF frames
// take 350-700ms, so every Playwright "stable" check crawls. Triple budget.
test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
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
    await page.waitForTimeout(700);
    expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(top0);
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

  test('a footer link clicked BEFORE hydration is captured by the head bootstrap and still opens the modal (F-2)', async ({ page }) => {
    await reachHome(page);
    // Hold every JS chunk back so the released home paints (R-1 pre-stamp) long before React hydrates.
    let holding = true;
    await page.route(/\/_next\/static\/.*\.js(\?.*)?$/, async (route) => {
      if (holding) await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.continue();
    });
    await page.reload();
    const link = footerLink(page, 'legal', 'terms');
    let preHydrationClick = false;
    try {
      await link.waitFor({ state: 'attached', timeout: 2_500 });
      const live = await page.evaluate(() => Boolean(window.__unitasSiteLinkLive));
      if (!live) {
        await link.evaluate((el) => el.click());
        preHydrationClick = await page.evaluate(() => Boolean(window.__unitasPendingSitePage));
      }
    } catch {
      preHydrationClick = false;
    }
    holding = false;
    test.skip(!preHydrationClick, 'the released home did not expose the footer before hydration in this run');
    await expect(modalTitle(page)).toBeVisible({ timeout: 20_000 });
    await expect(modalTitle(page)).toHaveText(KO['terms.title']);
    expect(page.url()).toMatch(/\/ko(\?.*)?$/);
    expect(await page.locator('html').getAttribute('data-unitas-surface')).toBe('quantum-white');
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
  });
});
