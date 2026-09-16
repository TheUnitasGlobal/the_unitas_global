// REV-33 acceptance measurements (founder directive 2026-09-15).
//
// Three claims, each measured on the BUILT app rather than reasoned about:
//
//   M1  the route paints deep space and dark glass, and does it WITHOUT the
//       blur the swarm block forbids -- so the look is new and the frame
//       budget is untouched;
//   M2  a finger travels inside the field instead of scrolling the page, a
//       drag that begins on a node travels rather than absorbing it, and the
//       document never zooms;
//   M3  a subject walked once is never fetched again -- across a RELOAD,
//       which is the tier localStorage adds and memory cannot.
const { test, expect } = require('@playwright/test');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const { collapseSovereignPanel, walkCurtain, settleSurface } = require('./_rev25Home');

const FOUNDER_URL = `/?sovereign_auth=${TOKEN}&splash=0&dev=skip`;
/** Q2283 = Microsoft: six Wikidata dimensions, reliably populated. */
const SUBJECT = '/ko/omni-swarm?qid=Q2283&q=Microsoft&splash=0';

async function founderHome(page) {
  await collapseSovereignPanel(page);
  await page.goto(FOUNDER_URL, { waitUntil: 'domcontentloaded' });
  await walkCurtain(page);
  await settleSurface(page);
}

async function founderRoute(page, path) {
  await founderHome(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await walkCurtain(page).catch(() => {});
  await settleSurface(page).catch(() => {});
}

/**
 * THE CLOCK. Every test here crosses the pre-launch curtain before it can see
 * the field at all, which alone costs about fifty seconds on this harness,
 * and the live field then waits on Wikidata. Playwright's 60 s default was
 * written for a page that is simply there. This is a CLOCK, not a weakened
 * budget: not one assertion below is relaxed, and nothing is tolerated here
 * that is not tolerated elsewhere in the suite (same reasoning as the REV-28
 * WebKit clock).
 */
test.beforeEach(({}, testInfo) => {
  testInfo.setTimeout(150_000);
});

/** Wait until the panel has stopped loading, and report where it landed. */
async function swarmState(page, timeout = 45_000) {
  const panel = page.locator('[data-omni-swarm-panel]');
  await expect(panel).toBeVisible();
  await expect.poll(async () => panel.getAttribute('data-swarm-state'), { timeout }).not.toBe('loading');
  return panel.getAttribute('data-swarm-state');
}

test.describe('REV-33 M1 -- visual transcendence', () => {
  test('the route floats in deep space, painted by static gradients only', async ({ page }) => {
    await founderRoute(page, SUBJECT);

    const space = await page.evaluate(() => {
      const el = document.querySelector('[data-omni-swarm-page="page"]');
      if (!el) return null;
      const before = getComputedStyle(el, '::before');
      const after = getComputedStyle(el, '::after');
      return {
        nebula: before.backgroundImage,
        nebulaAnimation: before.animationName,
        grain: after.backgroundImage,
        grainAnimation: after.animationName,
        grainBlend: after.mixBlendMode,
        hostAnimation: getComputedStyle(el).animationName,
      };
    });
    expect(space, 'the route root').not.toBeNull();
    console.log('[REV-33 M1] deep space', JSON.stringify({ ...space, nebula: space.nebula.slice(0, 90), grain: space.grain.slice(0, 90) }));

    // A cosmos, built from stacked radial gradients -- the house idiom.
    expect(space.nebula).toContain('radial-gradient');
    expect(space.grain).toContain('radial-gradient');
    expect(space.grainBlend).toBe('screen');

    // ...and it costs nothing: nothing in this block animates.
    for (const [what, value] of [['the nebula', space.nebulaAnimation], ['the grain', space.grainAnimation], ['the page', space.hostAnimation]]) {
      expect(value, `${what} must not run an animation`).toBe('none');
    }
  });

  test('the chrome is glass, and the field obeys the no-blur doctrine', async ({ page }) => {
    await founderRoute(page, SUBJECT);
    const state = await swarmState(page);

    const skins = await page.evaluate(() => {
      const read = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          background: cs.backgroundImage,
          border: cs.borderTopWidth,
          shadow: cs.boxShadow,
          blur: `${cs.backdropFilter || 'none'}|${cs.webkitBackdropFilter || 'none'}`,
          filter: cs.filter,
          animation: cs.animationName,
        };
      };
      return {
        console: read('.qw-swarm-console'),
        panel: read('.qw-swarm-panel--page'),
        field: read('.qw-swarm'),
        frame: read('.qw-swarm-frame'),
      };
    });
    console.log('[REV-33 M1] skins', JSON.stringify(skins));

    // Glass by layering: a gradient ground plus an inner bevel, on the chrome.
    for (const key of ['console', 'panel']) {
      expect(skins[key], `${key} is present`).not.toBeNull();
      expect(skins[key].background, `${key} wears the glass ramp`).toContain('gradient');
      expect(skins[key].shadow, `${key} wears the inset bevel`).toContain('inset');
    }

    // THE DOCTRINE. The field and its frame are the two boxes the swarm block
    // names; neither may blur, filter, or animate.
    if (state === 'ready') {
      for (const key of ['field', 'frame']) {
        expect(skins[key], `${key} is present`).not.toBeNull();
        expect(skins[key].blur, `${key} must never blur`).toBe('none|none');
        expect(skins[key].filter, `${key} must never filter`).toBe('none');
        expect(skins[key].animation, `${key} must not run an animation loop`).toBe('none');
      }
    }
  });
});

test.describe('REV-33 M2 -- zero-friction travel', () => {
  test('the stage refuses the browser gestures that would fight it', async ({ page }) => {
    await founderRoute(page, SUBJECT);
    if ((await swarmState(page)) !== 'ready') test.skip(true, 'live Wikidata returned no modules this run');

    const gate = await page.evaluate(() => {
      const stage = document.querySelector('[data-swarm-stage]');
      const field = document.querySelector('.qw-swarm');
      if (!stage || !field) return null;
      const cs = getComputedStyle(stage);
      return {
        stageTouch: cs.touchAction,
        fieldTouch: getComputedStyle(field).touchAction,
        // Read by PROPERTY NAME: this WebKit does not expose the camelCase
        // `overscrollBehaviorX` on the CSSOM object at all (it answers
        // `undefined`), though it honours the declaration. An engine that
        // cannot report it reports '' here rather than crashing the probe.
        overscroll: cs.getPropertyValue('overscroll-behavior-x') || '',
        clipped: cs.overflow,
      };
    });
    console.log('[REV-33 M2] gate', JSON.stringify(gate));
    expect(gate, 'the stage').not.toBeNull();
    // `none` is what makes a one-finger drag reach us instead of scrolling.
    expect(gate.stageTouch).toBe('none');
    // REV-24 left `pan-y` on the field, which is exactly what had to stop.
    expect(gate.fieldTouch).toBe('none');
    // `overscroll-behavior` is belt-and-braces; `touch-action` above is the
    // contract. Assert it only where the engine will tell us.
    if (gate.overscroll) expect(gate.overscroll).toBe('contain');
    expect(gate.clipped).toBe('hidden');
  });

  test('zoom, travel and fit -- and the page never moves while the field does', async ({ page }) => {
    await founderRoute(page, SUBJECT);
    if ((await swarmState(page)) !== 'ready') test.skip(true, 'live Wikidata returned no modules this run');

    const stage = page.locator('[data-swarm-stage]');
    const field = page.locator('[data-swarm-stage] > .qw-swarm');
    const vars = () =>
      field.evaluate((el) => ({
        x: Number(getComputedStyle(el).getPropertyValue('--vx') || 0),
        y: Number(getComputedStyle(el).getPropertyValue('--vy') || 0),
        z: Number(getComputedStyle(el).getPropertyValue('--vz') || 1),
      }));

    // A fitted field has nowhere to travel, by construction.
    expect((await vars()).z).toBeCloseTo(1, 3);

    await page.locator('[data-swarm-zoom-in]').click();
    await page.locator('[data-swarm-zoom-in]').click();
    const zoomed = await vars();
    console.log('[REV-33 M2] zoomed', JSON.stringify(zoomed));
    expect(zoomed.z).toBeGreaterThan(1);

    // Travel. The page must not scroll a single pixel while the field moves.
    const box = await stage.boundingBox();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 70, box.y + box.height / 2 - 40, { steps: 8 });
    await page.mouse.up();

    const travelled = await vars();
    console.log('[REV-33 M2] travelled', JSON.stringify(travelled));
    expect(Math.abs(travelled.x) + Math.abs(travelled.y), 'the field moved').toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY), 'the document stayed put').toBe(scrollBefore);

    // Fit returns to the identity exactly.
    await page.locator('[data-swarm-reset]').click();
    const fitted = await vars();
    expect(fitted).toEqual({ x: 0, y: 0, z: 1 });
    await expect(page.locator('[data-swarm-reset]')).toBeDisabled();
  });

  test('a drag that begins on a node travels, and never absorbs it', async ({ page }) => {
    await founderRoute(page, SUBJECT);
    if ((await swarmState(page)) !== 'ready') test.skip(true, 'live Wikidata returned no modules this run');

    await page.locator('[data-swarm-zoom-in]').click();
    const node = page.locator('.qw-swarm-node[data-swarm-absorb="1"]').first();
    if ((await node.count()) === 0) test.skip(true, 'no absorbable node in this field');

    const before = await page.locator('[data-swarm-crumb-current]').textContent();
    const nb = await node.boundingBox();
    await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2);
    await page.mouse.down();
    await page.mouse.move(nb.x + nb.width / 2 + 60, nb.y + nb.height / 2 + 30, { steps: 8 });
    await page.mouse.up();

    // The subject is unchanged: that drag was travel, not an absorption.
    await expect(page.locator('[data-swarm-crumb-current]')).toHaveText(before);
    // And the field really did move, so this was a travel rather than a
    // gesture the field ignored altogether.
    const moved = await page
      .locator('[data-swarm-stage] > .qw-swarm')
      .evaluate((el) => Math.abs(Number(getComputedStyle(el).getPropertyValue('--vx') || 0)) + Math.abs(Number(getComputedStyle(el).getPropertyValue('--vy') || 0)));
    expect(moved, 'the drag travelled').toBeGreaterThan(0);
  });

  /**
   * Deliberately a SEPARATE page. Proving "a tap still absorbs" on the page
   * that just dragged would prove two things at once and tell us nothing
   * about which one broke -- which is exactly what happened the first time
   * this suite ran.
   */
  test('a still tap on a node absorbs it, and the trail keeps the way back', async ({ page }) => {
    await founderRoute(page, SUBJECT);
    if ((await swarmState(page)) !== 'ready') test.skip(true, 'live Wikidata returned no modules this run');

    const node = page.locator('.qw-swarm-node[data-swarm-absorb="1"]').first();
    if ((await node.count()) === 0) test.skip(true, 'no absorbable node in this field');

    const before = await page.locator('[data-swarm-crumb-current]').textContent();
    await node.click();
    await expect
      .poll(async () => page.locator('[data-swarm-crumb-current]').textContent(), { timeout: 30_000 })
      .not.toBe(before);
    await expect(page.locator('[data-swarm-crumb="0"]'), 'the previous subject stays reachable').toBeVisible();
  });
});

test.describe('REV-33 M3 -- the walked path is free forever', () => {
  test('a reload of a walked subject issues ZERO Wikidata requests', async ({ page }) => {
    // This is the only test in the suite that walks the pre-launch curtain
    // TWICE -- once to warm the cache and once in a fresh realm to prove the
    // second visit is free. A CLOCK, not a weakened budget: no assertion
    // below changes, and nothing is tolerated here that is not tolerated
    // elsewhere (same reasoning as the REV-28 WebKit clock).
    test.setTimeout(240_000);
    await founderRoute(page, SUBJECT);
    const state = await swarmState(page);
    if (state !== 'ready') test.skip(true, `live Wikidata returned no modules this run (state: ${state})`);

    // Everything the field needed is now in localStorage.
    const stored = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('unitas.swarm.cache.v1');
        if (!raw) return null;
        const blob = JSON.parse(raw);
        return { v: blob.v, keys: Object.keys(blob.entries || {}) };
      } catch {
        return null;
      }
    });
    console.log('[REV-33 M3] persisted', JSON.stringify(stored));
    expect(stored, 'the walked subject was persisted').not.toBeNull();
    expect(stored.keys.some((k) => k.startsWith('Q2283::'))).toBe(true);

    // Now watch the wire across a full reload.
    // Narrowed to the swarm's OWN call shape (`wbgetentities`) rather than
    // the whole of wikidata.org, so an unrelated leg on the page could never
    // make this pass or fail for the wrong reason.
    const wikidata = [];
    const listen = (req) => {
      const u = req.url();
      if (u.includes('wikidata.org') && u.includes('wbgetentities')) wikidata.push(u);
    };
    // A SECOND PAGE in the same context: it shares the origin's localStorage
    // and cookies but gets a brand-new JS realm, so the module Map and the
    // in-flight map are gone and only the persistent tier can answer. That is
    // a stricter proof than a reload and it does not have to re-walk the
    // curtain in a page that has already walked it.
    const fresh = await page.context().newPage();
    fresh.on('request', listen);
    await founderRoute(fresh, SUBJECT);
    await expect(fresh.locator('[data-omni-swarm-page="page"]'), `landed on ${fresh.url()}`).toBeVisible({ timeout: 30_000 });
    const second = await swarmState(fresh);
    fresh.off('request', listen);

    console.log(`[REV-33 M3] wikidata requests after reload: ${wikidata.length}`, JSON.stringify(wikidata.slice(0, 3)));
    expect(second, 'the field drew again from cache').toBe('ready');
    expect(wikidata, 'a walked subject must never be fetched twice').toHaveLength(0);
  });
});
