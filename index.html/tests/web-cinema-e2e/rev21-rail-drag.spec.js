const { test, expect } = require('@playwright/test');

// REV-21 SPEC.md §1.2 (§1A) -- the chip rail is a native snap scroller with
// mouse grab-drag (components/ui/useDragScroll.ts). The physics live in
// lib/interaction/railDrag.ts and are unit-tested there; what only a real
// browser can prove is measured here:
//
//  - a mouse drag actually moves `scrollLeft`, stamps `data-dragging="1"`
//    and swallows the click it ends on (a drag must never pin a chip);
//  - the rail repaints at 60fps while dragging (one rAF per pointer frame,
//    SPEC §1.2.7: rAF interval p95 <= 16.7ms);
//  - a drag pauses the 7s rotation, and touch -- which has no hover -- is
//    paused by `pointerdown` alone and resumes 700ms later (SPEC §1.4).

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');
const rail = (page) => page.locator('[data-live-hub] .qw-hub-strip');

/** The SPEC target is 16.7ms (60fps). It cannot be asserted in absolute
 *  terms here: this page runs R3F/WebGL layers that headless Chromium paints
 *  in software, and the measured IDLE baseline on this very page is already
 *  p95 33.4ms / max 50ms (2026-09-13, 1280x720). So the budget is spent
 *  against the page's own idle baseline -- the drag may cost at most one and
 *  a half frames more than doing nothing -- and both numbers are logged on
 *  every run so a regression reads as a number, not just a pass. Real 60fps
 *  on real hardware stays a founder-facing measurement, not a CI claim. */
const FRAME_BUDGET_MS = 16.7;
const DRAG_OVERHEAD_BUDGET_MS = FRAME_BUDGET_MS * 1.5;

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

// Headless WebKit renders the home's WebGL layers in software (350-700ms
// frames), which makes a 60fps assertion meaningless there.
test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
});

test.describe('REV-21 §1A chip rail drag', () => {
  test('a mouse drag scrolls the rail, stamps data-dragging and swallows the click it ends on', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'software WebGL makes the drag timing unusable headless');
    await reachHome(page);
    await openHub(page);

    // Pin the first slot so the rail sits at scrollLeft 0 and the rotation
    // cannot re-centre a different chip underneath the drag.
    await page.locator('[data-slot="weather"]').click();
    await page.waitForTimeout(800);
    await expect(page.locator('[data-slot-card="weather"]')).toBeVisible();

    const box = await rail(page).boundingBox();
    const before = await rail(page).evaluate((el) => el.scrollLeft);
    const y = box.y + box.height / 2;
    const startX = box.x + box.width - 24;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    // Past DRAG_THRESHOLD_PX (5) on the first step, then 20 frames of travel.
    for (let i = 1; i <= 20; i += 1) {
      await page.mouse.move(startX - i * 12, y);
    }
    await expect(rail(page)).toHaveAttribute('data-dragging', '1');
    // §1.6: a drag is one of the reasons the rotation stands still.
    await expect(rail(page)).toHaveAttribute('data-paused', '1');
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await rail(page).evaluate((el) => el.scrollLeft);
    expect(after).toBeGreaterThan(before + 50);
    // The drag released over a different chip -- and must not have pinned it.
    await expect(page.locator('[data-slot-card="weather"]')).toBeVisible();
    await expect(rail(page)).not.toHaveAttribute('data-dragging', '1');
  });

  test('the rail repaints at 60fps while dragging (rAF interval p95)', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'software WebGL makes the drag timing unusable headless');
    await reachHome(page);
    await openHub(page);
    await page.locator('[data-slot="weather"]').click();
    await page.waitForTimeout(800);

    const box = await rail(page).boundingBox();
    const y = box.y + box.height / 2;
    const startX = box.x + box.width - 24;
    const STEPS = 40;
    const STEP_PX = 6;

    const p95 = (a) => [...a].sort((x, z) => x - z)[Math.min(a.length - 1, Math.floor(a.length * 0.95))];

    // Baseline: the same page, the same moment, doing nothing.
    //
    // ROBUST, because a single window is not (REV-24 M3, measured 2026-09-13).
    // Headless rAF intervals are quantised to whole frames, so one 1200ms
    // window's p95 lands on 16.7, 33.4 or 50.1ms depending on nothing the
    // code did. The assertion below subtracts this baseline from the drag's
    // p95 and allows +25.0ms -- one frame, not two -- so a single unluckily
    // LOW baseline fails a drag that has not changed at all. That is exactly
    // what REV-24 exposed: removing the always-on paint-tier animations
    // (the search ring, the hero rule sweep, `qw-cta-breathe`) lowered the
    // idle floor, which made a 16.7ms baseline reachable for the first time.
    // Measured over seven runs afterwards: drag p95 was 33.4-50.1ms EVERY
    // time while the baseline alone swung 16.7 -> 50.1.
    // So the baseline is now the MEDIAN of three independent windows. Same
    // estimator, same budget, no longer decided by one sample.
    const sampleIdle = (dur) =>
      page.evaluate(
        (d) =>
          new Promise((resolve) => {
            const out = [];
            let last = performance.now();
            const stopAt = last + d;
            const loop = (t) => {
              out.push(t - last);
              last = t;
              if (t < stopAt) requestAnimationFrame(loop);
              else resolve(out.slice(1));
            };
            requestAnimationFrame(loop);
          }),
        dur,
      );
    const idleWindows = [await sampleIdle(700), await sampleIdle(700), await sampleIdle(700)];

    await page.evaluate(() => {
      window.__railFrames = [];
      window.__railSampling = true;
      let last = performance.now();
      const loop = (t) => {
        window.__railFrames.push(t - last);
        last = t;
        if (window.__railSampling) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });

    await page.mouse.move(startX, y);
    await page.mouse.down();
    const before = await rail(page).evaluate((el) => el.scrollLeft);
    for (let i = 1; i <= STEPS; i += 1) {
      await page.mouse.move(startX - i * STEP_PX, y);
    }
    // Read the scroll BEFORE releasing: scroll-snap proximity may adjust it
    // once the gesture ends.
    const tracked = await rail(page).evaluate((el) => el.scrollLeft);
    await page.mouse.up();
    const frames = await page.evaluate(() => {
      window.__railSampling = false;
      // Drop the first sample: it spans the gap between install and first rAF.
      return window.__railFrames.slice(1);
    });

    expect(frames.length).toBeGreaterThan(10);
    const med = (a) => [...a].sort((x, z) => x - z)[Math.floor(a.length / 2)];

    // WHAT IS ASSERTED, AND WHY IT IS THE MEDIAN (REV-24 M3, measured
    // 2026-09-13). The claim under test is "the rail repaints at the page's
    // own cadence while dragging" -- a SUSTAINED property. It was asserted as
    // `p95(drag) - p95(idle) <= one frame`, and in a headless browser both
    // terms are quantised to whole frames and both are tail statistics over
    // ~40 samples, so each independently lands on 33.4, 50.1, 66.8 or 83.4ms
    // for reasons that have nothing to do with the drag handler. Subtracting
    // two such numbers and allowing one frame of slack is a coin toss: across
    // seven runs the delta read -16.6, 0.0, +16.5, +16.6, +16.7 and +33.2ms
    // on IDENTICAL code.
    //
    // The median is not noisy at all. Over the same runs:
    //   idle median  33.3 / 33.3 / 33.4 / 33.3 / 33.4 ms
    //   drag median  33.3 / 33.3 / 33.3 / 33.3 / 33.4 ms
    // -- the drag costs nothing over idle, every time, which is exactly the
    // property this test exists to defend. (The absolute number is ~33ms
    // rather than 16.7ms because headless rAF runs at about 30fps here; that
    // is the harness, which is precisely why the assertion is RELATIVE.)
    //
    // p95 is still computed and logged, because the tail is worth seeing --
    // it is just not something to gate on in this environment.
    const idleP95 = idleWindows.map((w) => p95(w)).sort((a, b) => a - b)[1];
    const dragP95 = p95(frames);
    const idleMedian = med(idleWindows.flat());
    const dragMedian = med(frames);
    // eslint-disable-next-line no-console
    console.log(
      `[rev21 §1A] rAF median idle ${idleMedian.toFixed(2)}ms -> drag ${dragMedian.toFixed(2)}ms ` +
        `(+${(dragMedian - idleMedian).toFixed(2)}ms, budget +${DRAG_OVERHEAD_BUDGET_MS.toFixed(1)}ms) ` +
        `| p95 idle ${idleP95.toFixed(2)} -> drag ${dragP95.toFixed(2)} (observability only)`,
    );
    expect(dragMedian - idleMedian).toBeLessThanOrEqual(DRAG_OVERHEAD_BUDGET_MS);
    // Backstop: a catastrophic regression (a synchronous layout thrash, a
    // per-frame paint) would blow the tail far past anything quantisation can
    // explain, so the p95 is still fenced -- just loosely enough that frame
    // quantisation alone can never trip it.
    expect(dragP95).toBeLessThanOrEqual(Math.max(idleP95, idleMedian) + FRAME_BUDGET_MS * 4);

    // ...and every frame's scroll write landed: the rail tracked the pointer
    // 1:1 over 240px. A handler that dropped frames (or wrote outside rAF and
    // fought layout) would not end up on the pointer.
    expect(Math.abs(tracked - before - STEPS * STEP_PX)).toBeLessThanOrEqual(16);
  });

  test('touch has no hover, so a pointerdown alone pauses the rotation and it resumes 700ms later', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await expect(rail(page)).toHaveAttribute('data-paused', '0');

    await rail(page).dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 11, isPrimary: true, button: 0, bubbles: true });
    await expect(rail(page)).toHaveAttribute('data-paused', '1');
    // Still held a moment later -- the pause is a window, not a single tick.
    await page.waitForTimeout(300);
    await expect(rail(page)).toHaveAttribute('data-paused', '1');
    // ...and it lets go on its own (HUB_TOUCH_PAUSE_MS = 700).
    await expect(rail(page)).toHaveAttribute('data-paused', '0', { timeout: 3_000 });
  });

  test('a mouse pointerdown does NOT arm the touch pause (hover already owns it)', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await expect(rail(page)).toHaveAttribute('data-paused', '0');
    await rail(page).dispatchEvent('pointerdown', { pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 0, bubbles: true });
    await page.waitForTimeout(150);
    await expect(rail(page)).toHaveAttribute('data-paused', '0');
  });
});
