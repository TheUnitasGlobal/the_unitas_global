// REV-25 MISSION 2 -- cross-browser (WebKit) and mobile-viewport coverage
// (founder directive 2026-09-13).
//
// REV-24 shipped on 142 CHROMIUM measurements and nothing else: Safari and a
// phone viewport were unmeasured, and an unmeasured surface is not a passing
// one. This file states the invariants that must hold on EVERY project in
// tests/web-cinema.config.js -- chromium, webkit and Pixel 7 -- and it is
// deliberately written as invariants rather than as numbers, because a budget
// copied from a desktop run is not evidence about a phone.
//
// The numbers are printed anyway (console.log), so a future revision can see
// what each engine actually measured rather than re-deriving it.
const { test, expect } = require('@playwright/test');
const { reachReleasedHome } = require('./_rev25Home');

// Reaching the released home costs a three-step curtain walk on a touch
// viewport and WebKit paces frames slower than Chromium; 60s is the config
// default and it is not enough for either.
test.describe.configure({ timeout: 120_000 });

test.describe('REV-25 M2 -- the funnel behaves identically on every engine', () => {
  test('a stranger is sealed and lands on the gateway', async ({ page, browserName }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res.status(), `${browserName}: the sealed page still renders`).toBe(200);
    await expect(page.locator('[data-unitas-gateway]')).toHaveCount(1);
    expect(new URL(page.url()).pathname, `${browserName}: sealed traffic lands on a gateway`).toMatch(/\/gateway$/);
  });

  test('the founder walks through to the released home', async ({ page, browserName }) => {
    await reachReleasedHome(page);
    await expect(page.locator('[data-unitas-gateway]')).toHaveCount(0);
    await expect(page.locator('#omni-synapse-search')).toBeVisible();
    expect(await page.locator('html').getAttribute('data-unitas-surface'), browserName).toBe('quantum-white');
  });
});

test.describe('REV-25 M2 -- responsive typography and pixel alignment', () => {
  test('nothing on the released home scrolls sideways', async ({ page }, testInfo) => {
    await reachReleasedHome(page);
    const box = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScroll: document.body.scrollWidth,
    }));
    console.log(`[REV-25 M2][${testInfo.project.name}] document ${box.scrollWidth} / viewport ${box.clientWidth}`);
    // One pixel of slack for sub-pixel layout rounding; anything more is a
    // real overflow the visitor can drag.
    expect(box.scrollWidth, 'the document must not be wider than the viewport').toBeLessThanOrEqual(box.clientWidth + 1);
    expect(box.bodyScroll).toBeLessThanOrEqual(box.clientWidth + 1);
  });

  test('the hero title is optically centred and its glyph run is not clipped', async ({ page }, testInfo) => {
    await reachReleasedHome(page);
    const hero = await page.evaluate(() => {
      const h1 = document.querySelector('.qw-hero-wrap h1') || document.querySelector('h1');
      if (!h1) return null;
      const cs = getComputedStyle(h1);
      const r = h1.getBoundingClientRect();
      const parent = h1.parentElement.getBoundingClientRect();
      return {
        fontSizePx: parseFloat(cs.fontSize),
        lineHeight: cs.lineHeight,
        offset: r.left + r.width / 2 - (parent.left + parent.width / 2),
        // NOT `scrollWidth - clientWidth`: the wordmark carries an optical
        // `text-indent` and an invisible watermark run, so that difference is
        // 41px on a perfectly intact title (measured). What actually decides
        // whether a glyph is cut off is the overflow mode.
        overflow: `${cs.overflowX}/${cs.overflowY}`,
        left: r.left,
        right: window.innerWidth - r.right,
        width: Math.round(r.width),
        viewport: window.innerWidth,
      };
    });
    expect(hero, 'the released home must have a hero title').not.toBeNull();
    console.log(
      `[REV-25 M2][${testInfo.project.name}] hero ${hero.fontSizePx}px / ${hero.lineHeight} at ${hero.viewport}px viewport, box ${hero.width}px, centre offset ${hero.offset.toFixed(2)}px, overflow ${hero.overflow}`,
    );
    expect(Math.abs(hero.offset), 'the hero must sit on the optical centre line').toBeLessThanOrEqual(1.5);
    expect(hero.overflow, 'the wordmark must never be clipped by its own box').toBe('visible/visible');
    // Responsive typography: the type must actually respond to the viewport,
    // and the painted box must stay inside it at every width.
    expect(hero.fontSizePx).toBeGreaterThan(12);
    expect(hero.fontSizePx).toBeLessThan(hero.viewport);
    expect(hero.left, 'the wordmark must not hang off the left edge').toBeGreaterThanOrEqual(-1);
    expect(hero.right, 'the wordmark must not hang off the right edge').toBeGreaterThanOrEqual(-1);
  });

  test('the search bar is centred on the same axis as the hero, to the pixel', async ({ page }, testInfo) => {
    await reachReleasedHome(page);
    const axis = await page.evaluate(() => {
      const h1 = document.querySelector('.qw-hero-wrap h1') || document.querySelector('h1');
      const bar = document.querySelector('#omni-synapse-search');
      if (!h1 || !bar) return null;
      const a = h1.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      return {
        heroCentre: a.left + a.width / 2,
        barCentre: b.left + b.width / 2,
        barLeft: b.left,
        barRight: window.innerWidth - b.right,
        barWidth: Math.round(b.width),
      };
    });
    expect(axis).not.toBeNull();
    console.log(
      `[REV-25 M2][${testInfo.project.name}] bar ${axis.barWidth}px, gutters ${axis.barLeft.toFixed(1)} / ${axis.barRight.toFixed(1)}, axis delta ${(axis.barCentre - axis.heroCentre).toFixed(2)}px`,
    );
    expect(Math.abs(axis.barCentre - axis.heroCentre), 'hero and search bar must share one axis').toBeLessThanOrEqual(1.5);
    expect(Math.abs(axis.barLeft - axis.barRight), 'the bar must sit in symmetric gutters').toBeLessThanOrEqual(1.5);
    expect(axis.barLeft, 'the bar must keep a real gutter, never bleed to the edge').toBeGreaterThanOrEqual(4);
  });

  test('a modal opened on this viewport stays inside it', async ({ page }, testInfo) => {
    await reachReleasedHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').first().click();
    await page.waitForTimeout(500);
    await page.locator('[data-slot="unitasRanking"]').first().click();
    await expect(page.locator('[data-slot-card="unitasRanking"]')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => {
      const row = document.querySelector('[data-slot-card="unitasRanking"] .qw-hub-headline');
      if (row) row.click();
    });
    await expect(page.locator('#ranking-deep-title')).toBeVisible({ timeout: 15_000 });
    const fit = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const r = dialog.getBoundingClientRect();
      return {
        left: r.left,
        right: window.innerWidth - r.right,
        width: Math.round(r.width),
        viewport: window.innerWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    console.log(`[REV-25 M2][${testInfo.project.name}] dialog ${fit.width}px in ${fit.viewport}px, gutters ${fit.left.toFixed(1)} / ${fit.right.toFixed(1)}`);
    expect(fit.left, 'a dialog must not hang off the left edge').toBeGreaterThanOrEqual(-1);
    expect(fit.right, 'a dialog must not hang off the right edge').toBeGreaterThanOrEqual(-1);
    expect(fit.overflow, 'opening a dialog must not make the page draggable sideways').toBeLessThanOrEqual(1);
  });

  test('the swarm field lays out inside its frame at this viewport', async ({ page }, testInfo) => {
    await reachReleasedHome(page);
    // A synthetic field, so this holds on every engine with no live data:
    // the stylesheet alone must place a node by transform, inside the box,
    // with no animation running.
    const probe = await page.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.style.width = '320px';
      const field = document.createElement('div');
      field.className = 'qw-swarm';
      field.style.setProperty('--qw-swarm-accent', '#38bdf8');
      for (const [x, y, d] of [
        [50, 50, 1],
        [17, 83, 2],
        [83, 17, 3],
      ]) {
        const node = document.createElement('button');
        node.className = 'qw-swarm-node';
        node.style.left = `${x}%`;
        node.style.top = `${y}%`;
        node.style.setProperty('--d', String(d));
        node.textContent = 'node';
        field.appendChild(node);
      }
      wrap.appendChild(field);
      document.body.appendChild(wrap);
      const fr = field.getBoundingClientRect();
      const nodes = Array.from(field.querySelectorAll('.qw-swarm-node')).map((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          animation: cs.animationName,
          transformed: cs.transform !== 'none',
          position: cs.position,
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
        };
      });
      const out = {
        fieldWidth: Math.round(fr.width),
        fieldHeight: Math.round(fr.height),
        fieldAnimation: getComputedStyle(field).animationName,
        nodes,
        bounds: { left: fr.left, right: fr.right, top: fr.top, bottom: fr.bottom },
      };
      wrap.remove();
      return out;
    });
    console.log(`[REV-25 M2][${testInfo.project.name}] swarm field ${probe.fieldWidth}x${probe.fieldHeight}`);
    expect(probe.fieldAnimation, 'the field must not run an animation loop').toBe('none');
    expect(probe.fieldHeight, 'the field must reserve real height at this width').toBeGreaterThan(80);
    for (const n of probe.nodes) {
      expect(n.animation, 'a node must not run an animation loop').toBe('none');
      expect(n.position).toBe('absolute');
      expect(n.transformed, 'a node must be placed by transform').toBe(true);
      // Centres stay inside the field, with a node-radius of slack for the
      // centring translate.
      expect(n.cx).toBeGreaterThanOrEqual(probe.bounds.left - 1);
      expect(n.cx).toBeLessThanOrEqual(probe.bounds.right + 1);
      expect(n.cy).toBeGreaterThanOrEqual(probe.bounds.top - 1);
      expect(n.cy).toBeLessThanOrEqual(probe.bounds.bottom + 1);
    }
  });

  test('the nav fits a touch viewport without spilling out of it', async ({ page, isMobile }, testInfo) => {
    test.skip(!isMobile, 'this is a touch-viewport rule');
    await reachReleasedHome(page);
    // MEASURED (Pixel 7, 412px): the nav lays out at 549 CSS px and is scaled
    // to fit -- getBoundingClientRect 412 / clientWidth 549 = 0.75. That is a
    // deliberate strategy and it works: the document never scrolls sideways.
    // What this test defends is the consequence: scaled or not, every control
    // must still be reachable inside the viewport, and none may be flattened
    // below the 24 CSS px minimum height a finger needs (WCAG 2.5.8 AA).
    const nav = await page.evaluate(() => {
      const el = document.querySelector('#unitas-nav');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const controls = [...el.querySelectorAll('button, a')]
        .map((c) => {
          const cr = c.getBoundingClientRect();
          return {
            label: (c.getAttribute('aria-label') || c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22),
            w: +cr.width.toFixed(1),
            h: +cr.height.toFixed(1),
            left: +cr.left.toFixed(1),
            right: +(window.innerWidth - cr.right).toFixed(1),
            hidden: cr.width === 0 || cr.height === 0 || getComputedStyle(c).visibility === 'hidden',
          };
        })
        .filter((c) => !c.hidden);
      const stripEl = el.querySelector('.nav-scroll');
      return {
        scale: +(r.width / el.clientWidth).toFixed(3),
        layoutWidth: el.clientWidth,
        paintedWidth: Math.round(r.width),
        viewport: window.innerWidth,
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        strip: stripEl
          ? { scrollWidth: stripEl.scrollWidth, clientWidth: stripEl.clientWidth, overflowX: getComputedStyle(stripEl).overflowX }
          : { scrollWidth: 0, clientWidth: 0, overflowX: 'none' },
        controls,
      };
    });
    expect(nav, 'the released home must have a nav').not.toBeNull();
    console.log(
      `[REV-25 M2][${testInfo.project.name}] nav ${nav.layoutWidth}px zoomed ${nav.scale} -> ${nav.paintedWidth}px in ${nav.viewport}px, strip ${nav.strip.scrollWidth}/${nav.strip.clientWidth} ${nav.strip.overflowX}; controls ${JSON.stringify(nav.controls)}`,
    );
    expect(nav.docOverflow, 'the nav must not make the page draggable sideways').toBeLessThanOrEqual(1);
    // The menu cluster is a SWIPE STRIP by design (NavBar.tsx: "the only part
    // that swipe-scrolls", with its own edge hints), so a control past the
    // right edge is not a defect -- measured on a Pixel 7, Account Settings
    // sits at x 403.5 of a 412px viewport. What must hold is that such a
    // control is REACHABLE: the strip has to actually scroll.
    const beyond = nav.controls.filter((c) => c.right < -1);
    if (beyond.length > 0) {
      expect(nav.strip.overflowX, `${beyond.length} control(s) sit past the fold; the strip must swipe`).toMatch(/auto|scroll/);
      expect(nav.strip.scrollWidth, 'the strip must have somewhere to swipe to').toBeGreaterThan(nav.strip.clientWidth);
    }
    const flattened = nav.controls.filter((c) => c.h < 24);
    expect(flattened, 'no control may be shorter than a finger (WCAG 2.5.8 AA: 24px)').toEqual([]);
  });

  test('every nav target conforms to WCAG 2.5.8 AA, spacing exception included', async ({ page, isMobile }, testInfo) => {
    test.skip(!isMobile, 'this is a touch-viewport rule');
    await reachReleasedHome(page);
    // REV-25 follow-up. The first pass of this file reported the coin controls
    // as a width failure (`Charge Coins` paints 12x24) and filed it as a
    // founder design decision. That was HALF the rule. WCAG 2.5.8 AA lets an
    // undersized target pass when a 24px-diameter circle centred on it does
    // not intersect any other target's box, nor another undersized target's
    // circle -- and measured on this build it does not, on either phone.
    // The nav conforms. This test is the guard, so a future layout that
    // crowds those controls together fails here instead of shipping.
    const report = await page.evaluate(() => {
      const targets = [...document.querySelectorAll('#unitas-nav button, #unitas-nav a')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        })
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22),
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
            cx: r.left + r.width / 2,
            cy: r.top + r.height / 2,
            under: r.width < 24 || r.height < 24,
          };
        });
      const boxMeetsCircle = (b, c) => {
        const nx = Math.max(b.x, Math.min(c.cx, b.x + b.w));
        const ny = Math.max(b.y, Math.min(c.cy, b.y + b.h));
        return Math.hypot(nx - c.cx, ny - c.cy) < 12;
      };
      const violations = [];
      for (const t of targets) {
        if (!t.under) continue;
        for (const o of targets) {
          if (o === t) continue;
          if (boxMeetsCircle(o, t)) violations.push(`${t.label} (${t.w.toFixed(1)}x${t.h.toFixed(1)}) circle reaches ${o.label}`);
          else if (o.under && Math.hypot(o.cx - t.cx, o.cy - t.cy) < 24) violations.push(`${t.label} and ${o.label} circles intersect`);
        }
      }
      return { targets: targets.length, undersized: targets.filter((t) => t.under).map((t) => `${t.label} ${t.w.toFixed(1)}x${t.h.toFixed(1)}`), violations };
    });
    console.log(
      `[REV-25 M2][${testInfo.project.name}] WCAG 2.5.8: ${report.targets} nav targets, ${report.undersized.length} under 24x24 (${report.undersized.join(' | ') || 'none'}), ${report.violations.length} violation(s)`,
    );
    expect(report.targets, 'the nav must expose targets at all').toBeGreaterThan(0);
    expect(report.violations, 'WCAG 2.5.8 AA: an undersized target needs 24px of clearance').toEqual([]);
  });
});
