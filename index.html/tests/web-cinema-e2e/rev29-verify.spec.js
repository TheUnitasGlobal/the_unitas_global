// REV-29 acceptance measurements (founder directive 2026-09-15).
//
// Every assertion here is a thing the founder asked for, measured on the
// BUILT app rather than reasoned about: the news rail rolling on the
// shortcut rail's own clock with no badges (M2.1), one theme per box (M2.2),
// one main popup + a story popup (M2.3), the direct-only block with the
// unified "다른 곳에서 열기" label (M2.4), the new-products slot (M3), the
// UNITAS hub tile + popup (M4), the plate-less wordmark (M5.1), the
// one-line attach menu with equal icon boxes (M5.2), the rolling / armed
// attach toggle (M5.3), the 20% larger glass + placeholder and the finer
// focus ring (M1), and the keyboard-only-on-the-box rule (M1, touch).
const { test, expect } = require('@playwright/test');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const { collapseSovereignPanel, walkCurtain, settleSurface } = require('./_rev25Home');

const FOUNDER_URL = `/?sovereign_auth=${TOKEN}&splash=0&dev=skip`;

async function founderHome(page) {
  await collapseSovereignPanel(page);
  await page.goto(FOUNDER_URL, { waitUntil: 'domcontentloaded' });
  await walkCurtain(page);
  await settleSurface(page);
}

const input = (page) => page.locator('#omni-synapse-search input[type="text"]');

async function openEmptyPopup(page) {
  await input(page).click();
  await expect(page.locator('[data-news-scope="empty-only"]')).toBeVisible();
}

test.describe('REV-29 M1 -- the search box', () => {
  test('the glass and the placeholder are 20% larger; the focus ring is finer', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'measured on chromium + mobile-chrome; WebKit rasterises at 500ms+/frame');
    await founderHome(page);
    const before = await page.evaluate(() => {
      const glass = document.querySelector('#omni-synapse-search .qw-search-glass');
      const box = document.querySelector('#omni-synapse-search input[type="text"]');
      const r = glass.getBoundingClientRect();
      return { w: r.width, h: r.height, font: parseFloat(getComputedStyle(box).fontSize), vw: document.documentElement.clientWidth };
    });
    const zoom = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.dashboard-zoom')).zoom || '1'));
    const expectedGlass = (before.vw / zoom >= 640 ? 24 : 19.2) * zoom;
    expect(Math.abs(before.w - expectedGlass)).toBeLessThan(0.6);
    expect(Math.abs(before.h - expectedGlass)).toBeLessThan(0.6);
    // clamp(12px, 1.2px + 3.375vw, 22.8px): x1.2 of the REV-21 clamp. `vw`
    // resolves against the layout viewport itself -- measured on a Pixel 7:
    // 412px -> 15.1px, i.e. NOT divided by the `.dashboard-zoom` factor the
    // way the glass's bounding box is.
    const expectedFont = Math.min(22.8, Math.max(12, 1.2 + 0.03375 * before.vw));
    expect(Math.abs(before.font - expectedFont)).toBeLessThan(0.6);

    await input(page).click();
    await page.waitForTimeout(400);
    const ring = await page.evaluate(() => getComputedStyle(document.querySelector('#omni-synapse-search')).boxShadow);
    // The white surface ring: 4px / 0.10, never the old 6px / 0.14.
    expect(ring).toContain('0px 0px 0px 4px');
    expect(ring).not.toContain('0px 0px 0px 6px');
  });

  test('touch: a tap on a theme box dismisses the keyboard (blurs the box) while the popup stays open', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch-only contract');
    await founderHome(page);
    await input(page).tap();
    await expect(page.locator('[data-news-scope="empty-only"]')).toBeVisible();
    expect(await page.evaluate(() => document.activeElement === document.querySelector('#omni-synapse-search input[type="text"]'))).toBe(true);
    await page.locator('[data-news-axes] [data-axis]').first().tap();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.activeElement === document.querySelector('#omni-synapse-search input[type="text"]'))).toBe(false);
    await expect(page.locator('[data-news-scope="empty-only"]')).toBeVisible();
    // A tap back in the box is the ONE way the keyboard returns.
    await input(page).tap();
    expect(await page.evaluate(() => document.activeElement === document.querySelector('#omni-synapse-search input[type="text"]'))).toBe(true);
  });
});

test.describe('REV-29 M2 -- the news rail is the shortcut rail', () => {
  test('M2.1/M2.2: 22 one-theme chips, rolling on the 7s clock with the same progress fill, no badges', async ({ page }) => {
    await founderHome(page);
    await openEmptyPopup(page);
    const axes = page.locator('[data-news-axes] [data-axis]');
    await expect(axes.first()).toBeVisible();
    expect(await axes.count()).toBe(22);
    for (const key of ['welfare', 'health', 'security', 'conflict']) {
      await expect(page.locator(`[data-news-axes] [data-axis="${key}"]`)).toHaveCount(1);
    }
    const labels = await axes.allInnerTexts();
    for (const label of labels) {
      expect(label, `"${label}" still fused`).not.toMatch(/[·・]/);
      expect(label, `"${label}" carries a count badge`).not.toMatch(/\d/);
    }
    expect(await axes.evaluateAll((els) => els.every((el) => el.classList.contains('qw-hub-chip')))).toBe(true);
    // REV-34 M1-E: every chip carries the one strip glyph (HubDot) and no
    // lucide picture any more.
    expect(await axes.evaluateAll((els) => els.every((el) => el.querySelector('.qw-hub-dot') && !el.querySelector('svg')))).toBe(true);
    // The identical progress fill the shortcut rail's active chip carries.
    const fill = await page.evaluate(() => {
      const news = document.querySelector('[data-news-axes] [data-active="1"] .qw-hub-progress');
      const rail = document.querySelector('.qw-hub-strip:not([data-news-axes]) [data-active="1"] .qw-hub-progress');
      if (!news || !rail) return null;
      const n = getComputedStyle(news);
      const r = getComputedStyle(rail);
      return { newsName: n.animationName, railName: r.animationName, newsDur: n.animationDuration, railDur: r.animationDuration, newsH: n.height, railH: r.height };
    });
    expect(fill, 'both rails must carry a progress fill').not.toBeNull();
    expect(fill.newsName).toBe(fill.railName);
    expect(fill.newsDur).toBe(fill.railDur);
    expect(fill.newsH).toBe(fill.railH);
    expect(await page.locator('[data-news-axes]').getAttribute('data-rotating')).toBe('1');
  });

  test('M2.3: one card, one main popup with a vertical list, and a story popup', async ({ page }) => {
    await founderHome(page);
    await openEmptyPopup(page);
    // The old horizontal headline rail and the deeper toggle are gone.
    expect(await page.locator('[data-news-rail]').count()).toBe(0);
    expect(await page.locator('[data-news-deeper-toggle]').count()).toBe(0);
    const card = page.locator('[data-news-card]');
    await expect(card).toBeVisible();
    await expect(card).not.toHaveAttribute('role', 'button');
    // REV-34 M1-C: one click on the title text opens the main popup.
    const title = card.locator('.qw-hub-card-title .qw-hub-title-hit');
    await title.click();
    const modal = page.locator('[data-news-modal]');
    await expect(modal).toBeVisible();
    // The list is vertical: every row's left edge is the same.
    const rows = modal.locator('[data-news-item]');
    await expect.poll(async () => rows.count(), { timeout: 30_000 }).toBeGreaterThan(0);
    const lefts = await rows.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);
    await expect(modal.locator('[data-news-more]')).toHaveCount(1);
    // REV-34 M1-C: every row also carries a ⏎ box (`.qw-row-enter`), so the
    // headline is addressed by its own class rather than "the row's button".
    await expect(rows.first().locator('.qw-row-enter[data-row-enter="row"]')).toHaveCount(1);
    await rows.first().locator('.qw-hub-headline').click();
    const story = page.locator('[data-news-story]');
    await expect(story).toBeVisible();
    await expect(story.locator('[data-news-open-original]')).toBeVisible();
  });

  test('M2.4 / REV-31: the omni-open pair closes the news block -- sources row directly above the platform row, one identical title', async ({ page }) => {
    await founderHome(page);
    await openEmptyPopup(page);
    const block = page.locator('[data-news-block] [data-omni-open]').first();
    await expect(block).toBeVisible();

    // REV-31 M1: the lens grid is gone from the shipped DOM, everywhere.
    expect(await page.locator('[data-explore-deeper]').count(), 'the Explore Deeper block').toBe(0);
    expect(await page.locator('[data-deeper-theme]').count(), 'a lens tile').toBe(0);
    expect(await page.locator('[data-omni-swarm]').count(), 'the swarm field').toBe(0);

    const sources = block.locator('[data-omni-row="sources"]');
    const platforms = block.locator('[data-omni-row="platforms"]');
    await expect(sources).toBeVisible();
    await expect(platforms).toBeVisible();

    // REV-31 M2/M3: neither row is ever an empty titled line.
    expect(await sources.locator('a[data-omni-source]').count()).toBeGreaterThan(0);
    expect(await platforms.locator('a[data-omni-platform]').count()).toBeGreaterThan(0);
    for (const id of ['wikipedia', 'wikidata']) {
      await expect(sources.locator('[data-omni-source="' + id + '"]')).toBeVisible();
    }
    for (const id of ['googleSearch', 'bingSearch']) {
      await expect(platforms.locator('[data-omni-platform="' + id + '"]')).toBeVisible();
    }

    // REV-31 M2: the sources row sits DIRECTLY above the platform row, and
    // the two headings are the same box down to the pixel.
    const geom = await block.evaluate((el) => {
      const s = el.querySelector('[data-omni-row="sources"]');
      const p = el.querySelector('[data-omni-row="platforms"]');
      const ls = s.querySelector('.qw-section-label');
      const lp = p.querySelector('.qw-section-label');
      const a = getComputedStyle(ls);
      const b = getComputedStyle(lp);
      const ra = ls.getBoundingClientRect();
      const rb = lp.getBoundingClientRect();
      return {
        sourcesFirst: Boolean(s.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING),
        adjacent: s.nextElementSibling === p,
        sourcesTop: Math.round(s.getBoundingClientRect().top),
        platformsTop: Math.round(p.getBoundingClientRect().top),
        fontSize: [a.fontSize, b.fontSize],
        color: [a.color, b.color],
        weight: [a.fontWeight, b.fontWeight],
        transform: [a.textTransform, b.textTransform],
        tracking: [a.letterSpacing, b.letterSpacing],
        family: [a.fontFamily, b.fontFamily],
        gap: [a.columnGap, b.columnGap],
        height: [Math.round(ra.height), Math.round(rb.height)],
      };
    });
    console.log('[REV-31 M2] omni-open title pair', JSON.stringify(geom));
    expect(geom.sourcesFirst, 'the sources row must come first in the DOM').toBe(true);
    expect(geom.adjacent, 'the sources row must be the immediate previous sibling').toBe(true);
    expect(geom.platformsTop).toBeGreaterThan(geom.sourcesTop);
    for (const key of ['fontSize', 'color', 'weight', 'transform', 'tracking', 'family', 'gap', 'height']) {
      expect(geom[key][0], 'the two titles must share ' + key).toBe(geom[key][1]);
    }
  });
});

test.describe('REV-29 M3 -- the new-products theme', () => {
  test('rides the shortcut rail second, right after the weather', async ({ page }) => {
    await founderHome(page);
    await openEmptyPopup(page);
    const chips = page.locator('[data-live-hub] .qw-hub-strip [data-slot]');
    await expect(chips.first()).toBeVisible();
    expect(await chips.nth(1).getAttribute('data-slot')).toBe('newProducts');
    // REV-35 M1 (D-1): sixteen seats -- 유랭킹 took the world ranking's seat
    // twelve and the module-ranking seat was removed outright.
    expect(await chips.count()).toBe(16);
    expect(await chips.nth(12).getAttribute('data-slot')).toBe('uRanking');
  });
});

test.describe('REV-29 M4 -- the UNITAS master tile and hub', () => {
  // REV-34 M4-A/B: the hub is now UNITAS SQUARE -- twenty fixed themes on
  // the roll and in the popup; the six REV-29/32 panels keep their DOM keys
  // (D-10) and the default panel is theme 1, 유랭킹 (`rankings`).
  test('one pack in the ⏎ key box, a twenty-icon roll, and a centred popup with twenty themes', async ({ page }) => {
    await founderHome(page);
    const toggle = page.locator('[data-unitas-hub-toggle]');
    await expect(toggle).toBeVisible();
    const boxes = await page.evaluate(() => {
      const enter = document.querySelector('#omni-synapse-search .qw-enter-key').getBoundingClientRect();
      const attach = document.querySelector('#omni-synapse-search [data-attach-toggle]').getBoundingClientRect();
      const hub = document.querySelector('#omni-synapse-search [data-unitas-hub-toggle]').getBoundingClientRect();
      return { dw: Math.abs(enter.width - hub.width), dh: Math.abs(enter.height - hub.height), order: attach.left < hub.left, icons: document.querySelectorAll('[data-unitas-hub-toggle] .qw-attach-roll-icon').length };
    });
    expect(boxes.dw).toBeLessThanOrEqual(1);
    expect(boxes.dh).toBeLessThanOrEqual(1);
    expect(boxes.order, 'the hub tile is the rightmost box').toBe(true);
    expect(boxes.icons).toBe(21); // REV-34: twenty square themes + the wrap duplicate of theme 1
    await toggle.click();
    const hub = page.locator('[role="dialog"] [data-unitas-hub]');
    await expect(hub).toBeVisible();
    expect(await toggle.getAttribute('data-active')).toBe('1');
    // Centred: the dialog's centre sits on the viewport centre.
    const centred = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-labelledby="unitas-hub-title"]').getBoundingClientRect();
      return Math.abs(d.left + d.width / 2 - document.documentElement.clientWidth / 2);
    });
    expect(centred).toBeLessThan(2);
    const tabs = hub.locator('[data-hub-tab-btn]');
    expect(await tabs.count()).toBe(20); // REV-34 M4-A: twenty square themes
    await expect(hub).toHaveAttribute('data-unitas-square', '');
    expect(await hub.locator('[data-square-tab]').count()).toBe(20);
    // The default panel is 유랭킹 (theme 1, DOM key `rankings`).
    await expect(hub.locator('[data-hub-panel="rankings"] [data-hub-rankings]')).toBeVisible();
    await hub.locator('[data-hub-tab-btn="exchange"]').click();
    await expect(hub.locator('[data-hub-exchange]')).toBeVisible();
    await expect(hub.locator('[data-hub-packs] [data-pack]').first()).toBeVisible();
    await hub.locator('[data-hub-tab-btn="shorts"]').click();
    await expect(hub.locator('[data-unitas-shorts] [data-short]').first()).toBeVisible();
    await hub.locator('[data-hub-tab-btn="rankings"]').click();
    // REV-34 M4-C: the rankings panel is the U-Rankings rail (no world tab).
    await expect(hub.locator('[data-hub-rankings] [data-urank-rail] [data-urank]').first()).toBeVisible();
    expect(await hub.locator('[data-hub-ranking-tab]').count()).toBe(0);
    await hub.locator('[data-hub-tab-btn="rooms"]').click();
    await expect(hub.locator('[data-hub-rooms] [data-room]').first()).toBeVisible();
    expect(await hub.locator('[data-hub-rooms] [data-room]').count()).toBe(22);
    await hub.locator('[data-hub-tab-btn="social"]').click();
    await expect(hub.locator('[data-hub-social] [data-social-app]').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(hub).toHaveCount(0);
    expect(await toggle.getAttribute('data-active')).toBe('0');
  });

  test('the exchange buys a pack on this device and the rooms send a message', async ({ page }) => {
    await founderHome(page);
    await page.locator('[data-unitas-hub-toggle]').click();
    const hub = page.locator('[role="dialog"] [data-unitas-hub]');
    // REV-34 M4-A: the square no longer opens on the exchange -- pick it.
    await hub.locator('[data-hub-tab-btn="exchange"]').click();
    await expect(hub.locator('[data-hub-exchange]')).toBeVisible();
    const before = await hub.locator('[data-hub-credits] strong').innerText();
    // Pin the pack first: a live `[data-verdict="ok"]` locator would re-resolve
    // to the NEXT buyable pack the moment this one flips to "owned".
    const packId = await hub.locator('[data-hub-packs] [data-pack]:has(.qw-hubx-buy[data-verdict="ok"])').first().getAttribute('data-pack');
    const buy = hub.locator(`[data-hub-packs] [data-pack="${packId}"] .qw-hubx-buy`);
    await buy.click();
    await expect(buy).toHaveAttribute('data-verdict', 'owned');
    const after = await hub.locator('[data-hub-credits] strong').innerText();
    expect(after).not.toBe(before);
    await expect(hub.locator('[data-hub-trade]').first()).toBeVisible();
    await hub.locator('[data-hub-tab-btn="rooms"]').click();
    await hub.locator('[data-hub-room-input]').fill('hello from the measurement');
    await hub.locator('[data-hub-room-send]').click();
    await expect(hub.locator('[data-hub-msg][data-mine="1"]')).toHaveCount(1);
  });
});

test.describe('REV-29 M5 -- wordmark and the attach shortcuts', () => {
  test('M5.1: the plate is gone -- pure gradient text, still centred', async ({ page }) => {
    await founderHome(page);
    const mark = await page.evaluate(() => {
      const h1 = document.querySelector('.qw-hero-wrap h1');
      const before = getComputedStyle(h1, '::before');
      const word = getComputedStyle(h1.querySelector('.qw-title-word'));
      return { content: before.content, display: before.display, clip: word.webkitBackgroundClip || word.backgroundClip, fill: word.webkitTextFillColor, image: word.backgroundImage };
    });
    expect(mark.content === 'none' || mark.display === 'none', 'no plate behind the word').toBe(true);
    // Two gradient layers (the top light + the sapphire body) -> two clips.
    expect(String(mark.clip).split(',').map((v) => v.trim()).every((v) => v === 'text')).toBe(true);
    expect(mark.fill).toBe('rgba(0, 0, 0, 0)');
    expect(mark.image).toContain('linear-gradient');
  });

  test('M5.2: three equal icon boxes, one-line labels that never wrap', async ({ page }) => {
    await founderHome(page);
    await page.locator('[data-attach-toggle]').click();
    const menu = page.locator('[data-attach-menu]');
    await expect(menu).toBeVisible();
    const rows = await menu.evaluate((el) => {
      const items = Array.from(el.querySelectorAll('[data-attach-item]'));
      return items.map((it) => {
        const icon = it.querySelector('.qw-attach-item-icon').getBoundingClientRect();
        const label = it.querySelector('.qw-attach-item-label');
        const cs = getComputedStyle(label);
        const lines = Math.round(label.getBoundingClientRect().height / parseFloat(cs.lineHeight));
        return { w: Math.round(icon.width), h: Math.round(icon.height), nowrap: cs.whiteSpace, lines, font: parseFloat(cs.fontSize) };
      });
    });
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => `${r.w}x${r.h}`)).size).toBe(1);
    for (const r of rows) {
      expect(r.nowrap).toBe('nowrap');
      expect(r.lines).toBe(1);
      expect(r.font).toBeGreaterThanOrEqual(13 * 0.74); // 13px under the 0.75 dashboard zoom, never shrunk further
    }
  });

  test('M5.3: the roll is a one-icon window on every device, and a pick stops it on that icon and arms the toggle', async ({ page }) => {
    await founderHome(page);
    const window_ = await page.evaluate(() => {
      const track = getComputedStyle(document.querySelector('[data-attach-toggle] .qw-attach-roll-track'));
      const roll = document.querySelector('[data-attach-toggle] .qw-attach-roll').getBoundingClientRect();
      return { display: track.display, w: roll.width, h: roll.height };
    });
    expect(window_.display).toBe('flex');
    expect(Math.abs(window_.w - window_.h)).toBeLessThan(1); // one icon, square window
    await page.locator('[data-attach-toggle]').click();
    await page.locator('[data-attach-item="sketch"]').click();
    const toggle = page.locator('[data-attach-toggle]');
    await expect(toggle).toHaveAttribute('data-active', '1');
    await expect(toggle).toHaveAttribute('data-attach-active', 'sketch');
    const stopped = await page.evaluate(() => {
      const track = document.querySelector('[data-attach-toggle] .qw-attach-roll-track');
      const cs = getComputedStyle(track);
      return { stop: track.getAttribute('data-stop'), anim: cs.animationName, transform: cs.transform };
    });
    expect(stopped.stop).toBe('1');
    expect(stopped.anim).toBe('none');
    // translateY(-40px) under the 0.75 zoom = matrix(1,0,0,1,0,-40) in CSS px.
    expect(stopped.transform).toMatch(/matrix\(1, 0, 0, 1, 0, -40\)/);
    // The armed fill is the ⏎ key's own armed fill. It arrives through a
    // 250ms background-color transition (same as the ⏎ key's contract in
    // rev19-search-back), so it is read after the transition has settled --
    // while the sketch canvas the pick opened is still up.
    await page.mouse.move(2, 2);
    await page.waitForTimeout(450);
    const fills = await page.evaluate(() => {
      const attach = getComputedStyle(document.querySelector('[data-attach-toggle]'));
      return { bg: attach.backgroundColor, color: attach.color };
    });
    expect(fills.bg).toBe('rgb(11, 92, 255)');
    expect(fills.color).toBe('rgb(255, 255, 255)');
    // The arm lives exactly as long as the pick is meaningful: closing the
    // canvas with nothing attached releases it and the roll resumes.
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('data-active', '0');
    expect(await page.locator('[data-attach-toggle] .qw-attach-roll-track').getAttribute('data-stop')).toBe('0');
  });
});
