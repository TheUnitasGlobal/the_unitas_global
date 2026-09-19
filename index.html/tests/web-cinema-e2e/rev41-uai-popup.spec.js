// REV-41 acceptance measurements (founder directive 2026-09-17) -- the U-AI
// search box's ONE-CLICK, NO-TEXT popup: the default hub with its live
// shortcut carousel (DiscoveryCarousel) and its live news list
// (HotIssueNewsList).
//
// Every assertion here is a thing the founder asked for, measured on the
// BUILT app rather than reasoned about, one describe per mission:
//   1-A  the omni-open pair leaves the news card; the axis and story popups keep it
//   1-B  every ⏎ box is a tail glued to the last glyph of the text it opens
//   1-C  a one-fact widget (fx) opens from anywhere on its card; a list card does not
//   1-D  the FX compass: a >= 40px hero pair, a 30-day spark, never "0건"
//   1-E  the product families ride a chip rail of their own: autoplay, click-to-hold
//   1-F  유랭킹 is off the rail: fifteen seats, the retirement sweeps
//   1-G  the Around-Me omni-radar: four radii, every blip inside the stated radius
//
// The helpers are rev21-hub-card's, copied rather than shared: a spec file is
// not a module, and the only cross-file imports this directory allows are
// the retirement sweeps (_rev35Retired / _rev41Retired).
const { test, expect } = require('@playwright/test');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const { expectRetiredRankingsGone } = require('./_rev35Retired');
const { expectRetiredURankingGone } = require('./_rev41Retired');
const { expectRetiredAirGone } = require('./_rev42Retired');

const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

// The cards are network-backed (Frankfurter + CoinGecko, the Wikipedia
// geosearch beams, the launch wire): 60s is the config default and a cold
// fill on a slow runner needs more than that.
test.describe.configure({ timeout: 120_000 });

async function reachHome(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
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

async function openHub(page) {
  await page.locator('#omni-synapse-search input[type="text"]').click();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-live-hub]')).toBeVisible();
}

/** Pin one slot so which card is on screen is never a race with the clock. */
async function pin(page, slot) {
  await page.locator(`[data-slot="${slot}"]`).click();
  await page.waitForTimeout(500);
  await expect(page.locator(`[data-slot-card="${slot}"]`)).toBeVisible();
}

/** An element's rectangle clipped to the viewport -- the part a visitor can
 *  actually click. Returns `{x, y, width, height, bottom, right}`. */
async function visibleBox(page, selector) {
  return page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    const bottom = Math.min(r.bottom, window.innerHeight);
    const right = Math.min(r.right, window.innerWidth);
    const x = Math.max(r.x, 0);
    const y = Math.max(r.y, 0);
    return { x, y, width: right - x, height: bottom - y, bottom, right };
  }, selector);
}

/**
 * 1-C: 6px inside the card's top-right corner. That is still the card root
 * (its own padding is 16px, 12px under the 0.75 dashboard zoom) and never an
 * inner control -- the ⏎ boxes are tails on their text now (1-B), not corner
 * furniture. Self-checked through elementFromPoint, so a clipped or occluded
 * corner can never "pass" by clicking something else; a headline is a
 * `span[role=button]` since REV-41 D-1, so roles count as controls too.
 */
async function paddingSpot(page, slot) {
  const sel = `[data-slot-card="${slot}"]`;
  const box = await visibleBox(page, sel);
  const x = box.right - 6;
  const y = box.y + 6;
  const onCard = await page.evaluate(
    ([px, py, rootSel]) => {
      const el = document.elementFromPoint(px, py);
      const root = document.querySelector(rootSel);
      if (!el || !root || !(el === root || root.contains(el))) return 'off-card';
      const control = el.closest('button, a, [role="button"], [role="tab"]');
      return control && control !== root ? 'on-control' : 'ok';
    },
    [x, y, sel],
  );
  expect(onCard, `${slot}: the top-right padding spot must land on the card chrome`).toBe('ok');
  return { x, y };
}

/**
 * 1-B, measured IN the page: the title's ⏎ box against the title button's
 * box, and the FIRST row's ⏎ box against the LAST line of its headline text.
 *
 * Why a Range: a wrapped headline is one inline element with several line
 * boxes, and getBoundingClientRect() hands back their union -- whose right
 * edge is the LONGEST line, not the line the box actually trails. The
 * Range's client rects are the line boxes themselves, and the last one is
 * the line the tail must sit on. Both rects come from the same zoomed
 * coordinate space (`.dashboard-zoom`), so the gaps are compared as they are.
 *
 * The text node is `.qw-hub-headline-text` where the row keeps that inner
 * span, else the `.qw-hub-headline` itself (REV-41 D-1 puts the marker
 * OUTSIDE the headline, so either way only the text is measured). The
 * returned `textSel` says which one was used.
 */
function tailGeometry(rootSel) {
  const root = document.querySelector(rootSel);
  if (!root) return { error: `no ${rootSel}` };
  const hit = root.querySelector('.qw-hub-card-title .qw-hub-title-hit');
  const titleBox = root.querySelector('.qw-hub-card-title .qw-row-enter[data-row-enter="title"]');
  if (!hit || !titleBox) return { error: 'no title hit / title box' };
  const h = hit.getBoundingClientRect();
  const tb = titleBox.getBoundingClientRect();
  const title = {
    gap: tb.left - h.right,
    overlap: Math.min(h.bottom, tb.bottom) - Math.max(h.top, tb.top),
    hitRight: h.right,
    boxLeft: tb.left,
  };
  const row = root.querySelector('.qw-hub-row');
  if (!row) return { title, error: 'no row yet' };
  const headline = row.querySelector('.qw-hub-headline');
  const rowBox = row.querySelector('.qw-row-enter[data-row-enter="row"]');
  if (!headline || !rowBox) return { title, error: 'no headline / row box' };
  const textEl = row.querySelector('.qw-hub-headline-text') || headline;
  const range = document.createRange();
  range.selectNodeContents(textEl);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  range.detach();
  const last = rects[rects.length - 1];
  if (!last) return { title, error: 'the headline painted no line box' };
  const rb = rowBox.getBoundingClientRect();
  return {
    title,
    row: {
      lines: rects.length,
      textSel: textEl === headline ? '.qw-hub-headline' : '.qw-hub-headline-text',
      gap: rb.left - last.right,
      centre: rb.top + rb.height / 2,
      lineTop: last.top,
      lineBottom: last.bottom,
      lastRight: last.right,
      boxLeft: rb.left,
    },
  };
}

/** Poll the geometry until the card has a painted row: each attempt is one
 *  atomic evaluate, so a rotating news axis or a still-loading feed can
 *  never hand back half a measurement. */
async function settledTail(page, rootSel) {
  let geom = { error: 'not measured' };
  await expect
    .poll(
      async () => {
        geom = await page.evaluate(tailGeometry, rootSel);
        return geom.error || 'ok';
      },
      { timeout: 30_000, message: `${rootSel}: a title row and one painted row` },
    )
    .toBe('ok');
  return geom;
}

/** The 1-B claims (spec D-10): title box 4..14px after the title text on the
 *  same line; row box 2..14px after the last glyph of the headline, its
 *  centre on that last line. */
function expectTail(geom, label) {
  expect(geom.error, `${label}: ${geom.error}`).toBeUndefined();
  expect(geom.title.gap, `${label}: title box gap ${geom.title.gap}px`).toBeGreaterThanOrEqual(4);
  expect(geom.title.gap, `${label}: title box gap ${geom.title.gap}px`).toBeLessThanOrEqual(14);
  expect(geom.title.overlap, `${label}: the title box must share the title's line`).toBeGreaterThan(0);
  expect(geom.row.gap, `${label}: row box gap ${geom.row.gap}px`).toBeGreaterThanOrEqual(2);
  expect(geom.row.gap, `${label}: row box gap ${geom.row.gap}px`).toBeLessThanOrEqual(14);
  expect(geom.row.centre, `${label}: the row box centre must not sit above the last line`).toBeGreaterThanOrEqual(geom.row.lineTop);
  expect(geom.row.centre, `${label}: the row box centre must not sit below the last line`).toBeLessThanOrEqual(geom.row.lineBottom);
}

// Headless WebKit renders the home's WebGL layers in software: rAF frames
// take 350-700ms, so every Playwright "stable" check crawls. Triple budget.
test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
});

/* ------------------------------------------------------------------ */
/* 1-A                                                                  */
/* ------------------------------------------------------------------ */

test.describe('REV-41 1-A -- the omni-open pair leaves the news card', () => {
  test('no omni-open under the news card; the axis popup and the story popup each keep exactly one', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    const block = page.locator('[data-news-block]');
    await expect(block).toBeVisible();

    // With nothing open, the block carries no pair at all -- not under the
    // card, not beside it.
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(block.locator('[data-omni-open]'), 'the card-level omni-open pair was deleted by REV-41 1-A').toHaveCount(0);

    // The axis popup, through the card title (REV-34 M1-C: one click).
    await page.locator('[data-news-card] .qw-hub-card-title .qw-hub-title-hit').click();
    const modal = page.locator('[data-news-modal]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-omni-open]')).toHaveCount(1);
    // Portal or not, the pair under the card stays gone while a popup is up:
    // anything inside a dialog is the popup's own pair, never the card's.
    expect(
      await page.evaluate(() => Array.from(document.querySelectorAll('[data-news-block] [data-omni-open]')).filter((el) => !el.closest('[role="dialog"]')).length),
      'a direct omni-open under the news block while the axis popup is open',
    ).toBe(0);

    // The story popup, through the first row of the axis popup.
    const rows = modal.locator('[data-news-item]');
    await expect.poll(async () => rows.count(), { timeout: 30_000 }).toBeGreaterThan(0);
    await rows.first().locator('.qw-hub-headline').click();
    const story = page.locator('[data-news-story]');
    await expect(story).toBeVisible();
    await expect(story.locator('[data-omni-open]')).toHaveCount(1);
    await expect(story.locator('[data-news-open-original]')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/* 1-B                                                                  */
/* ------------------------------------------------------------------ */

test.describe('REV-41 1-B -- every ⏎ box is a tail on the last glyph', () => {
  test('history card: the title box and the first row box trail the text they open, on its last line', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'history');
    await expect(page.locator('[data-slot-card="history"] .qw-hub-row').first()).toBeVisible({ timeout: 30_000 });
    // D-1: the row is the HubRow primitive (`li.qw-hub-row[data-hub-row]`),
    // and the headline is an inline `role=button`, not a block button --
    // the one construction that can wrap and still be trailed.
    await expect(page.locator('[data-slot-card="history"] .qw-hub-row[data-hub-row]').first()).toBeAttached();
    await expect(page.locator('[data-slot-card="history"] .qw-hub-row .qw-hub-headline[role="button"]').first()).toBeAttached();
    const geom = await settledTail(page, '[data-slot-card="history"]');
    console.log('[REV-41 1-B] history', JSON.stringify(geom));
    expectTail(geom, 'history');
  });

  test('news card: the title box and the first row box trail the text they open, on its last line', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await expect(page.locator('[data-news-card]')).toBeVisible();
    // The news axis rotates on its own clock; settledTail measures atomically
    // and re-tries across a rotation that lands on a still-loading axis.
    const geom = await settledTail(page, '[data-news-card]');
    console.log('[REV-41 1-B] news', JSON.stringify(geom));
    expectTail(geom, 'news');
    await expect(page.locator('[data-news-card] .qw-hub-row[data-hub-row]').first()).toBeAttached();
  });
});

/* ------------------------------------------------------------------ */
/* 1-C                                                                  */
/* ------------------------------------------------------------------ */

test.describe('REV-41 1-C -- a one-fact widget opens from anywhere on its card', () => {
  test('fx: the top-right padding opens exactly one dialog; history: the same spot opens nothing', async ({ page }) => {
    await reachHome(page);
    await openHub(page);

    // D-2: the fx card declares itself a single target -- data, not a role;
    // REV-23 M2.3 still forbids `role=button` on the container.
    await pin(page, 'fx');
    const fx = page.locator('[data-slot-card="fx"]');
    await expect(fx).toHaveAttribute('data-one-target', '1');
    await expect(fx).not.toHaveAttribute('role', 'button');
    const fxSpot = await paddingSpot(page, 'fx');
    await page.mouse.click(fxSpot.x, fxSpot.y);
    await expect(page.locator('[role="dialog"]'), 'the padding of a one-target card opens its deep modal').toHaveCount(1, { timeout: 8_000 });
    await expect(page.locator('#feed-deep-title')).toBeVisible();
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);

    // A list card is NOT a single target: its rows route to their own
    // articles, so the padding stays inert (REV-23 M2.3, unchanged).
    await pin(page, 'history');
    await expect(page.locator('[data-slot-card="history"]')).not.toHaveAttribute('data-one-target', '1');
    const historySpot = await paddingSpot(page, 'history');
    await page.mouse.click(historySpot.x, historySpot.y);
    await page.waitForTimeout(600);
    await expect(page.locator('[role="dialog"]'), 'the padding of a list card must NOT open anything').toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* 1-D                                                                  */
/* ------------------------------------------------------------------ */

test.describe('REV-41 1-D -- the FX compass', () => {
  // D-4 resolves the home country as profile -> weather place -> Geo-IP ->
  // locale. This harness holds no profile, and the Geo-IP probe is a LIVE
  // request that would answer with wherever the runner happens to sit, so
  // it is aborted here: the home currency is then the locale's (ko -> KRW)
  // on every runner. `serviceWorkers: 'block'` is REQUIRED for the abort to
  // bite -- public/sw.js answers every non-static request with
  // `respondWith(fetch(...))`, and a worker-mediated fetch is invisible to
  // page.route (REV-25, measured; rev34-weather-square does the same).
  test.use({ serviceWorkers: 'block' });

  test('a >= 40px hero pair in the visitor\'s own currency, a 30-day spark, and a meta line that never says 0', async ({ page }) => {
    await page.route(/get\.geojs\.io|ipwho\.is|api\.bigdatacloud\.net/, (route) => route.abort());
    await reachHome(page);
    await openHub(page);
    await pin(page, 'fx');
    const card = page.locator('[data-slot-card="fx"]');

    // The 4-state contract: the hero OR the honest unreadable line, never a
    // blank card and never both. Frankfurter is a third party, so the
    // unreadable branch is a legitimate outcome on a cut-off runner -- what
    // is NOT legitimate is a card that shows neither.
    const outcome = async () =>
      card.evaluate((root) => {
        if (root.querySelector('[data-fx-unreadable]')) return 'unreadable';
        const hero = root.querySelector('[data-fx-hero]');
        if (hero && hero.getClientRects().length > 0) return 'hero';
        return 'pending';
      });
    await expect.poll(outcome, { timeout: 20_000, message: 'the fx card must settle on the hero or on the unreadable line' }).not.toBe('pending');
    const settled = await outcome();
    console.log(`[REV-41 1-D] fx card settled on: ${settled}`);
    if (settled === 'unreadable') {
      await expect(card.locator('[data-fx-hero]'), 'unreadable and the hero may never coexist').toHaveCount(0);
      return;
    }

    const hero = card.locator('[data-fx-hero]');
    await expect(hero).toBeVisible();
    // D-8: the pair's number is the largest type on the strip -- clamp(40px,
    // 9vw, 72px). getComputedStyle is NOT scaled by the dashboard zoom (only
    // rects are), so the floor is read as written.
    const fontPx = await card.locator('[data-fx-hero-value]').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    console.log(`[REV-41 1-D] hero value font-size ${fontPx}px`);
    expect(fontPx, 'the hero number must be at least 40px').toBeGreaterThanOrEqual(40);
    await expect(card.locator('[data-fx-spark]').first(), 'the 30-day sparkline').toBeAttached();
    // D-3: no profile, no Geo-IP, locale ko -> the home pair is KRW.
    await expect(hero).toContainText('KRW', { timeout: 20_000 });
    // 1-D (i): the "0건" line is gone -- the pairs and the parity rows are
    // the items, so the meta count is a real number.
    const meta = card.locator('[data-meta-line]');
    await expect(meta).toHaveCount(1);
    const metaText = (await meta.innerText()).trim();
    console.log(`[REV-41 1-D] meta line: ${metaText}`);
    expect(metaText, 'the fx meta line must not start with 0').not.toMatch(/^0(?!\d)/);
  });
});

/* ------------------------------------------------------------------ */
/* 1-E                                                                  */
/* ------------------------------------------------------------------ */

test.describe('REV-41 1-E -- the product families ride a chip rail of their own', () => {
  test('an autoplay chip rail: .qw-hub-chip tabs, one progress fill, a click holds and a second click releases', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'newProducts');
    const card = page.locator('[data-slot-card="newProducts"]');

    // The tabs come with the card (the launch wire), so the rail is polled.
    const rail = card.locator('[data-tab-rail]');
    await expect(rail).toBeAttached({ timeout: 30_000 });
    await expect(rail).toHaveAttribute('data-autoplay', '1');
    await expect(rail).toHaveAttribute('role', 'tablist');
    const chips = rail.locator('[data-tab]');
    await expect.poll(async () => chips.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(15);
    // D-6: the SAME chip the main rail wears, never the 11.5px pill.
    expect(await chips.evaluateAll((els) => els.every((el) => el.classList.contains('qw-hub-chip') && el.getAttribute('role') === 'tab'))).toBe(true);
    expect(await card.locator('.qw-hub-tab').count(), 'the .qw-hub-tab pill is retired (D-6)').toBe(0);
    // Exactly one progress fill, on the active chip.
    await expect(rail.locator('.qw-hub-progress')).toHaveCount(1);
    await expect(rail.locator('[data-active="1"]')).toHaveCount(1);
    await expect(rail.locator('[data-active="1"] .qw-hub-progress')).toHaveCount(1);
    await expect(rail.locator('.qw-hub-progress')).toHaveAttribute('data-held', '0');

    // Click = hold / release, the main rail's own toggle. The chip is
    // resolved AT click time: should the clock advance between the read and
    // the click, the click lands on a non-active chip, which selects AND
    // holds it -- the same held state, so the claim stands either way.
    await rail.locator('.qw-hub-chip[data-active="1"]').click();
    await expect(rail.locator('.qw-hub-progress')).toHaveAttribute('data-held', '1');
    await rail.locator('.qw-hub-chip[data-active="1"]').click();
    await expect(rail.locator('.qw-hub-progress')).toHaveAttribute('data-held', '0');
    // A tab click is an inner control: no deep modal opened underneath.
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* 1-F                                                                  */
/* ------------------------------------------------------------------ */

// REV-42 D-1 (founder directive 2026-09-18): the rail seats SIXTEEN now --
// `air` retired outright (its reading lives in the weather deep panel) and
// the two flagships `cosmos` / `gastronomy` seated right after the sky. The
// former `nth(12) === 'air'` pin is replaced by the flagship pins and the
// REV-42 retirement sweep (_rev42Retired.js).
test.describe('REV-41 1-F -- 유랭킹 is off the rail', () => {
  test('sixteen seats, no uRanking seat, no air seat, and no retired surface (REV-35, REV-41 and REV-42 sweeps) with the hub open', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    const chips = page.locator('[data-live-hub] .qw-hub-strip [data-slot]');
    await expect(chips.first()).toBeVisible();
    await expect(chips).toHaveCount(16);
    await expect(page.locator('[data-slot="uRanking"]')).toHaveCount(0);
    expect(await chips.nth(1).getAttribute('data-slot')).toBe('cosmos');
    expect(await chips.nth(2).getAttribute('data-slot')).toBe('gastronomy');
    await expectRetiredURankingGone(page);
    await expectRetiredRankingsGone(page);
    await expectRetiredAirGone(page);
  });
});

/* ------------------------------------------------------------------ */
/* 1-G                                                                  */
/* ------------------------------------------------------------------ */

const RADAR_STATES = ['loading', 'data', 'empty', 'unreadable'];

/** Read the radar in one atomic pass: its state, its radius, and every
 *  blip's distance against that radius (D-5: the 0% error definition --
 *  a blip beyond the stated radius is a violation, full stop). The four
 *  lenses are inlined because this function is serialised into the page. */
function radarAudit(el) {
  const state = el.getAttribute('data-state');
  const radiusKey = el.getAttribute('data-radius-key');
  const raw = el.getAttribute('data-radius-km');
  const km = raw === null || raw === '' || raw === 'null' ? null : Number(raw);
  const blips = Array.from(el.querySelectorAll('[data-radar-blip]')).map((b) => ({
    lens: b.getAttribute('data-lens'),
    dist: Number(b.getAttribute('data-dist-km')),
  }));
  const violations = [];
  for (const b of blips) {
    if (!['nomad', 'factory', 'inspiration', 'signal'].includes(b.lens)) violations.push(`lens ${b.lens}`);
    if (!Number.isFinite(b.dist) || b.dist < 0) violations.push(`dist ${b.dist}`);
    else if (radiusKey !== 'global' && km !== null && b.dist > km) violations.push(`${b.dist}km > ${km}km`);
  }
  return { state, radiusKey, km, blips: blips.length, violations };
}

test.describe('REV-41 1-G -- the Around-Me omni-radar', () => {
  test('four radius chips, a radar whose every blip sits inside the stated radius, and an honest state', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'nearby');
    const card = page.locator('[data-slot-card="nearby"]');

    // The radius chips ride the same chip rail as the product families
    // (D-5: `tabs` = the four radii), without autoplay.
    const rail = card.locator('[data-tab-rail]');
    await expect(rail).toBeAttached({ timeout: 30_000 });
    await expect(rail).toHaveAttribute('data-autoplay', '0');
    const chips = rail.locator('[data-radius]');
    await expect.poll(async () => chips.count(), { timeout: 30_000 }).toBe(4);
    expect(await chips.evaluateAll((els) => els.map((el) => el.getAttribute('data-radius')))).toEqual(['r10', 'r50', 'r100', 'global']);
    expect(await chips.evaluateAll((els) => els.every((el) => el.classList.contains('qw-hub-chip') && el.hasAttribute('data-tab')))).toBe(true);

    // The radar root and its 4-state contract; the default radius is 10km.
    const radar = card.locator('[data-omni-radar]');
    await expect(radar).toBeAttached({ timeout: 30_000 });
    expect(RADAR_STATES).toContain(await radar.getAttribute('data-state'));
    await expect.poll(async () => radar.getAttribute('data-state'), { timeout: 30_000 }).not.toBe('loading');
    expect(RADAR_STATES).toContain(await radar.getAttribute('data-state'));
    await expect(radar).toHaveAttribute('data-radius-key', 'r10');

    const r10 = await radar.evaluate(radarAudit);
    console.log('[REV-41 1-G] r10', JSON.stringify(r10));
    expect(r10.km).toBe(10);
    expect(r10.violations, 'every blip must sit inside the stated radius').toEqual([]);
    if (r10.state === 'data') expect(r10.blips, 'data means at least one blip').toBeGreaterThan(0);
    else expect(r10.blips, `${r10.state} means no blip`).toBe(0);

    // 50km: the chip is an inner control (D-2: no deep modal underneath),
    // the card reloads on the new radius, and the bound still holds.
    await rail.locator('[data-radius="r50"]').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(radar).toHaveAttribute('data-radius-key', 'r50', { timeout: 20_000 });
    await expect.poll(async () => radar.getAttribute('data-state'), { timeout: 30_000 }).not.toBe('loading');
    const r50 = await radar.evaluate(radarAudit);
    console.log('[REV-41 1-G] r50', JSON.stringify(r50));
    expect(RADAR_STATES).toContain(r50.state);
    expect(r50.km).toBe(50);
    expect(r50.violations, 'every blip must sit inside the 50km radius').toEqual([]);
    if (r50.state === 'data') expect(r50.blips).toBeGreaterThan(0);
    else expect(r50.blips).toBe(0);
  });
});
