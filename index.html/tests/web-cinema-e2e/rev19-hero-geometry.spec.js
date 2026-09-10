const { test, expect } = require('@playwright/test');

// REV-19 SPEC.md §2 + §5 + §6 + §7 -- typography optics and vertical rhythm
// of the released Quantum White home, measured in real pixels: the centre
// of "IT" sits on the gold hairline's centre, nav -> UNITAS equals UNITAS ->
// search bar (ink-based), the footer is glass (no dark band), and the
// watermark rests near-invisible but reveals on a copy gesture.

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
  await page.waitForTimeout(800);
}

async function geometry(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('#unitas-nav').getBoundingClientRect();
    const h1 = document.querySelector('.qw-hero-wrap h1');
    const hb = h1.getBoundingClientRect();
    const zoom = parseFloat(getComputedStyle(document.querySelector('.dashboard-zoom')).zoom || '1');
    const f = parseFloat(getComputedStyle(h1).fontSize) * zoom; // screen px
    const text = h1.querySelector('.qw-title-word').firstChild;
    const it = document.createRange();
    it.setStart(text, 2);
    it.setEnd(text, 4);
    const itr = it.getBoundingClientRect();
    const search = document.querySelector('#omni-synapse-search').getBoundingClientRect();
    // Cinzel 700: line top -> cap top 0.064em, line top -> baseline 0.77em (docs/rev19/measure)
    const capTop = hb.top + 0.064 * f;
    const baseline = hb.top + 0.77 * f;
    return {
      h1Cx: hb.left + hb.width / 2,
      itCx: itr.left + itr.width / 2,
      A: capTop - nav.bottom,
      B: search.top - baseline,
    };
  });
}

// Headless WebKit renders the home's WebGL layers in software: rAF frames
// take 350-700ms, so every Playwright "stable" check crawls. Triple budget.
test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
});

test.describe('REV-19 hero geometry', () => {
  test('"IT" is centred on the hairline and nav->UNITAS equals UNITAS->search bar', async ({ page }) => {
    await reachHome(page);
    const g = await geometry(page);
    expect(Math.abs(g.itCx - g.h1Cx)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.A - g.B)).toBeLessThanOrEqual(1.5);
    expect(g.A).toBeGreaterThan(20);
  });

  test('footer is a translucent glass slab with gold headers, not a dark band', async ({ page }) => {
    await reachHome(page);
    const f = await page.locator('#site-footer').evaluate((el) => {
      const cs = getComputedStyle(el);
      const h3 = getComputedStyle(el.querySelector('h3'));
      const a = getComputedStyle(el.querySelector('a'));
      return { bg: cs.backgroundImage, blur: cs.backdropFilter || cs.webkitBackdropFilter, h3: h3.color, link: a.color };
    });
    expect(f.bg).toContain('linear-gradient');
    expect(f.blur).toContain('blur');
    expect(f.h3).toBe('rgb(138, 109, 20)');
    expect(f.link).toBe('rgb(42, 44, 51)');
  });

  test('watermark rests at 7% and reveals on a copy gesture, then fades back', async ({ page }) => {
    await reachHome(page);
    const mark = page.locator('.qw-watermark');
    expect(await mark.evaluate((el) => parseFloat(getComputedStyle(el).opacity))).toBeCloseTo(0.07, 2);
    await page.evaluate(() => {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('.qw-cluster-title'));
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, clipboardData: new DataTransfer() }));
    });
    await expect(mark).toHaveAttribute('data-reveal', '1');
    await expect(mark).toHaveAttribute('data-reveal-kind', 'copy');
    await expect(mark).toHaveAttribute('data-reveal', '0', { timeout: 5_000 });
  });
});
