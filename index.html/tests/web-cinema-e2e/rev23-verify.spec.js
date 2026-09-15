// REV-23 acceptance measurements (founder directive 2026-09-13).
//
// Every assertion here is a thing the founder asked for, measured on the
// BUILT app rather than reasoned about: the sealed funnel, the wordmark's
// paint, the news strip's scope, two-step activation, the attach dropdown,
// the de-prefixed news axes, and the hero geometry REV-20 pinned to 0.02px
// (which M4 must not have moved).
const { test, expect } = require('@playwright/test');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const { collapseSovereignPanel, walkCurtain, settleSurface } = require('./_rev25Home');

const FOUNDER_URL = `/?sovereign_auth=${TOKEN}&splash=0&dev=skip`;

async function founderHome(page) {
  // REV-25 M2 (founder directive 2026-09-13): this helper was CHROMIUM-DESKTOP
  // only, and REV-23/REV-24 were signed off on chromium alone -- so two
  // revisions of test defects sat here unmeasured. Measured 2026-09-14, all
  // three of them:
  //   - the founder's debug console (z-450, 272px at left 16) covers the
  //     search bar on a 412px viewport, so every click on the bar lands on the
  //     panel -> collapse it before the first paint;
  //   - a touch viewport still shows the entry curtain after `dev=skip`
  //     (`.cs-root`, opacity 1, pointer-events auto, full screen) -> walk it;
  //   - `page.evaluate(() => document.fonts.ready)` returns a FontFaceSet,
  //     which WebKit refuses to serialise, so the wait never waited and the
  //     hero was measured on fallback metrics (A=-83.6 vs A=74.22 settled --
  //     and 74.22/74.20 is what BOTH engines report once settled);
  //   - the white surface is stamped by client JS after hydration and the
  //     whole quantum-white token layer hangs off it, so a skin read before
  //     it sees the wrong radius.
  await collapseSovereignPanel(page);
  await page.goto(FOUNDER_URL, { waitUntil: 'domcontentloaded' });
  await walkCurtain(page);
  await settleSurface(page);
}

test.describe('REV-23 M1 -- the funnel is sealed at the edge', () => {
  test('a plain visitor is redirected to the funnel and never receives the main interface', async ({ browser }) => {
    const ctx = await browser.newContext();
    for (const path of ['/', '/ko', '/ko/company/about', '/u-ai']) {
      // The seal itself: a 307 onto the gateway, uncacheable, varying on the
      // two inputs the verdict actually depends on.
      const hop = await ctx.request.get(path, { maxRedirects: 0 });
      expect(hop.status(), path).toBe(307);
      expect(hop.headers()['x-unitas-gate'], path).toBe('seal');
      expect(hop.headers()['location'], path).toMatch(/\/[a-z]{2}\/gateway/);
      expect(hop.headers()['cache-control'], path).toContain('no-store');
      expect(hop.headers()['vary'], path).toMatch(/Cookie/i);
      // And what the visitor ends up holding carries no main-site markup.
      const res = await ctx.request.get(path);
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      expect(html, `${path} leaked the search bar`).not.toContain('id="omni-synapse-search"');
      expect(html, `${path} leaked the hero`).not.toContain('qw-title-word');
      expect(html, `${path} is not the gateway`).toContain('data-unitas-gateway');
    }
    await ctx.close();
  });

  test('the sealed funnel hydrates cleanly -- no React fallback re-render', async ({ page }) => {
    // The rewrite this replaced threw React #418 + #423 on every sealed load
    // and fell back to a full client render, which wiped the pre-paint
    // `data-splash` stamp. Any page error here is that class of defect back.
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    expect(errors, errors.join(' | ')).toEqual([]);
    // The funnel is what rendered, and the main interface is still absent.
    expect(await page.locator('[data-unitas-gateway]').count()).toBe(1);
    expect(await page.locator('#omni-synapse-search').count()).toBe(0);
  });

  test('an indexer still gets the real page, so the SEO corpus survives', async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });
    const res = await ctx.request.get('/');
    expect(res.headers()['x-unitas-gate']).toBe('pass');
    expect(await res.text()).toContain('qw-title-word');
    await ctx.close();
  });

  test('the founder session passes', async ({ page }) => {
    await founderHome(page);
    await expect(page.locator('#omni-synapse-search')).toBeVisible();
  });
});

test.describe('REV-23 M4 -- the hyper wordmark', () => {
  // REV-29 M5.1 (founder directive 2026-09-15) DESTROYED the glass plate:
  // the mark is pure gradient text now. The gradient / rim / transparent-fill
  // half of this contract stands; the plate half is inverted.
  test('the hero is a gradient-filled, rimmed mark as pure text -- no plate (REV-29 M5.1)', async ({ page }) => {
    await founderHome(page);
    const word = page.locator('.qw-hero-wrap h1 .qw-title-word');
    await expect(word).toBeVisible();
    const paint = await word.evaluate((el) => {
      const cs = getComputedStyle(el);
      const plate = getComputedStyle(el.closest('h1'), '::before');
      return {
        fill: cs.webkitTextFillColor || cs.color,
        stroke: cs.webkitTextStrokeWidth,
        bgImage: cs.backgroundImage,
        clip: cs.webkitBackgroundClip || cs.backgroundClip,
        plateContent: plate.content,
        plateRadius: plate.borderRadius,
      };
    });
    // A transparent fill + a text-clipped background IS the gradient mark.
    expect(paint.fill).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    // Two background layers (the sheen + the gradient) means two clip values.
    expect(paint.clip.split(',').map((v) => v.trim())).toContain('text');
    expect(paint.bgImage).toContain('gradient');
    expect(parseFloat(paint.stroke)).toBeGreaterThan(0);
    // REV-29 M5.1: the plate is gone -- the pseudo-element paints nothing.
    expect(paint.plateContent).toBe('none');
  });

  test('REV-20 hero symmetry is untouched: |A - B| stays under 1.5px', async ({ page }) => {
    await founderHome(page);
    const delta = await page.evaluate(() => {
      const h1 = document.querySelector('.qw-hero-wrap h1');
      const bar = document.querySelector('#omni-synapse-search');
      const nav = document.querySelector('#unitas-nav');
      if (!h1 || !bar || !nav) return null;
      // `.dashboard-zoom` uses CSS `zoom`, so getBoundingClientRect comes
      // back SCALED while getComputedStyle('fontSize') does not. Every
      // font-derived offset therefore has to be scaled before it can be
      // subtracted from a rect -- getting that wrong is a ~90px phantom.
      const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--unitas-zoom')) || 0.75;
      const size = parseFloat(getComputedStyle(h1).fontSize);
      const hr = h1.getBoundingClientRect();
      // Cinzel 700 metrics (REV-19 §7): cap top 0.064em, baseline 0.77em.
      const capTop = hr.top + size * 0.064 * zoom;
      const baseline = hr.top + size * 0.77 * zoom;
      const A = (capTop - nav.getBoundingClientRect().bottom) / zoom;
      const B = (bar.getBoundingClientRect().top - baseline) / zoom;
      return { A, B, delta: Math.abs(A - B) };
    });
    expect(delta, 'hero geometry could not be measured').not.toBeNull();
    expect(delta.delta, `A=${delta.A} B=${delta.B}`).toBeLessThan(1.5);
  });
});

test.describe('REV-23 M2 -- the U-AI popup', () => {
  test('M2.1: the live-news strip belongs to the EMPTY box and nothing else', async ({ page }) => {
    await founderHome(page);
    const input = page.locator('#omni-synapse-search input[type="text"]');
    await input.click();
    await expect(page.locator('[data-news-scope="empty-only"]')).toBeVisible();
    await input.type('seoul', { delay: 30 });
    await expect(page.locator('[data-news-scope="empty-only"]')).toHaveCount(0);
  });

  test('M2.3: one click on a card title selects, it does not open', async ({ page }) => {
    await founderHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    const title = page.locator('.qw-hub-card-title .qw-two-step-hit').first();
    await expect(title).toBeVisible();
    await title.click();
    await expect(title).toHaveAttribute('data-selected', '1');
    // Nothing opened on that first click -- the whole point of the change.
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });

  test('M2.3: the top-right shortcut arrow is gone from the card', async ({ page }) => {
    await founderHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    const card = page.locator('[data-slot-card]').first();
    await expect(card).toBeVisible();
    // The container is no longer a giant button.
    await expect(card).not.toHaveAttribute('role', 'button');
  });
});

test.describe('REV-23 M3 -- shortcuts and news, separated', () => {
  test('M3.2: no "전체" chip, and no axis label carries the world prefix', async ({ page }) => {
    await founderHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    const axes = page.locator('[data-news-axes] [data-axis]');
    await expect(axes.first()).toBeVisible();
    expect(await page.locator('[data-news-axes] [data-axis="all"]').count()).toBe(0);
    expect(await page.locator('[data-news-axes] [data-axis="world"]').count()).toBe(0);
    const labels = await axes.allInnerTexts();
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label, `"${label}" still carries the world prefix`).not.toMatch(/^(세계|World |世界|全球)/);
    }
  });

  test('M3.1: the shortcut rail carries no news wire', async ({ page }) => {
    await founderHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    await expect(page.locator('[data-slot-card]').first()).toBeVisible();
    expect(await page.locator('[data-slot-kind="news"]').count()).toBe(0);
  });
});

test.describe('REV-23 M5 -- the action pair', () => {
  test('the three shortcuts open as an anchored dropdown, never a bottom sheet', async ({ page }) => {
    await founderHome(page);
    const toggle = page.locator('[data-attach-toggle]');
    await toggle.click();
    const menu = page.locator('[data-attach-menu]');
    await expect(menu).toBeVisible();
    const pos = await menu.evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe('absolute');
    await expect(page.locator('[data-attach-item="file"]')).toBeVisible();
    await expect(page.locator('[data-attach-item="video"]')).toBeVisible();
    await expect(page.locator('[data-attach-item="sketch"]')).toBeVisible();
  });

  test('the enter key and the shortcut toggle share one box', async ({ page }) => {
    await founderHome(page);
    const boxes = await page.evaluate(() => {
      const enter = document.querySelector('#omni-synapse-search .qw-enter-key');
      const attach = document.querySelector('#omni-synapse-search .qw-attach-toggle');
      if (!enter || !attach) return null;
      const e = enter.getBoundingClientRect();
      const a = attach.getBoundingClientRect();
      return { dw: Math.abs(e.width - a.width), dh: Math.abs(e.height - a.height) };
    });
    expect(boxes, 'the action pair could not be measured').not.toBeNull();
    expect(boxes.dw).toBeLessThanOrEqual(1);
    expect(boxes.dh).toBeLessThanOrEqual(1);
  });
});
