// REV-26 -- the service worker's runtime contract, and the real-device render
// probe (founder directive 2026-09-14).
//
// TWO THINGS ARE PINNED HERE.
//
// 1. THE WORKER. REV-25 reported that the service worker was "serving
//    `_next/static` from its own cache". That was WRONG, and the wrong
//    diagnosis would have produced the wrong fix. `public/sw.js` caches
//    nothing at all -- it purges Cache Storage on activate and its fetch
//    handler was `event.respondWith(fetch(event.request))`, a pure
//    re-issue. Re-issuing is what took every request out of the page's scope
//    (so `page.route` saw zero) and what cost a worker hop per asset.
//
//    Measured on the built app, median of five loads, before and after:
//
//                          SW active (was)   SW active (now)   SW blocked
//      worker hop / asset        5.2ms            0.3ms            0
//      worker hop, 32 assets   139.2ms           22.1ms            0
//      load                    316.0ms          286.7ms        275.6ms
//      Cache Storage keys           []               []             []
//
//    The handler still answers navigations -- Chrome's `beforeinstallprompt`
//    algorithm requires a fetch handler to exist, and an EMPTY one is the
//    anti-pattern Chrome names by hand. Only Next's content-hashed, immutable
//    output falls through.
//
// 2. THE PROBE. A headless browser on a build machine cannot answer what a
//    real Safari with a real GPU does; REV-25's 363ms WebKit frames measured a
//    CPU rasteriser, not the product. `?diag=1` arms a founder-only instrument
//    that a real device runs on the real page. What is testable HERE is the
//    fence around it: a visitor must never see it, never download it, and the
//    founder must get a real reading.
const { test, expect } = require('@playwright/test');
const { reachReleasedHome } = require('./_rev25Home');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');

test.describe.configure({ timeout: 120_000 });

test.describe('REV-26 -- the service worker keeps its contract at runtime', () => {
  test('it controls the page and caches absolutely nothing', async ({ page }) => {
    await reachReleasedHome(page);
    const sw = await page.evaluate(async () => {
      const controlled = 'serviceWorker' in navigator ? Boolean(navigator.serviceWorker.controller) : false;
      let keys = [];
      try {
        keys = await caches.keys();
      } catch {
        keys = ['<cache storage unavailable>'];
      }
      return { controlled, keys };
    });
    expect(sw.controlled, 'the worker must control the page -- the install prompt depends on it').toBe(true);
    expect(sw.keys, 'this project deploys every revision; an offline cache would serve stale bundles').toEqual([]);
  });

  test('immutable build output is not re-issued through the worker', async ({ page }) => {
    await reachReleasedHome(page);
    const timing = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource').filter((r) => r.name.includes('/_next/static/'));
      const hops = entries.map((r) => (r.workerStart ? r.fetchStart - r.workerStart : 0));
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        assets: entries.length,
        // `workerStart` is only exposed where Resource Timing Level 2 is.
        measurable: entries.some((r) => typeof r.workerStart === 'number'),
        hopTotal: Number(hops.reduce((a, b) => a + b, 0).toFixed(1)),
        hopMax: Number(Math.max(0, ...hops).toFixed(1)),
        navWorkerStart: nav ? Number((nav.workerStart || 0).toFixed(1)) : 0,
      };
    });
    test.skip(!timing.measurable || timing.assets === 0, 'this engine does not expose PerformanceResourceTiming.workerStart');
    console.log(`[REV-26] ${timing.assets} static assets · worker hop total ${timing.hopTotal}ms · max ${timing.hopMax}ms · nav workerStart ${timing.navWorkerStart}ms`);
    // Before the change this measured 139.2ms across 32 assets, ~5.2ms each.
    // A re-issue costs milliseconds; a plain event dispatch costs a fraction
    // of one. The budget is per-asset so it does not depend on how many
    // chunks a future build emits.
    const perAsset = timing.assets > 0 ? timing.hopTotal / timing.assets : 0;
    expect(perAsset, `the worker must not re-issue immutable output (${perAsset.toFixed(2)}ms per asset)`).toBeLessThan(2);
  });

  test('the worker file itself still declares a fetch handler', async ({ page }) => {
    // Served, not read from disk: this is the text the browser receives.
    const res = await page.request.get('/sw.js');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("addEventListener('fetch'");
    expect(body, 'an empty fetch handler is the anti-pattern Chrome names; this one answers').toContain('event.respondWith(');
    expect(body).toContain('_next/static/');
    for (const forbidden of ['caches.open', '.addAll(', '.put(']) {
      expect(body.includes(forbidden), `sw.js must not call ${forbidden}`).toBe(false);
    }
  });
});

test.describe('REV-26 -- the render probe is founder-only and costs nothing', () => {
  test('a visitor never sees it, flag or no flag', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/?diag=1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_500);
    expect(await page.locator('[data-unitas-render-diagnostics]').count(), 'the probe must not render for a visitor').toBe(0);
    await ctx.close();
  });

  test('the probe really is a SEPARATE chunk -- arming is what downloads it', async ({ page }) => {
    // The cost claim is that a visitor does not download the instrument. A
    // chunk-NAME check cannot prove that: production chunk names are content
    // hashes, so `/RenderDiagnostics/` would match nothing and the assertion
    // would pass vacuously. What CAN fail is a comparison: arming must pull at
    // least one script the unarmed load never asked for. If the probe were
    // bundled into the main chunk, this set would be empty.
    await reachReleasedHome(page);

    const chunksFor = async (url) => {
      const seen = new Set();
      const onRequest = (r) => {
        if (/\/_next\/static\/chunks\/.*\.js/.test(r.url())) seen.add(new URL(r.url()).pathname);
      };
      page.on('request', onRequest);
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(2_500);
      page.off('request', onRequest);
      return seen;
    };

    const unarmed = await chunksFor('/en?splash=0&dev=skip');
    const armed = await chunksFor('/en?splash=0&dev=skip&diag=1');
    const extra = [...armed].filter((p) => !unarmed.has(p));
    console.log(`[REV-26] unarmed ${unarmed.size} chunks · armed ${armed.size} · arming pulled ${extra.length} more`);
    expect(extra.length, 'arming must fetch code the unarmed page never fetched -- otherwise the probe ships to everyone').toBeGreaterThan(0);
  });

  test('the founder does not get it either, until the URL arms it', async ({ page }) => {
    await reachReleasedHome(page);
    await expect(page.locator('[data-unitas-render-diagnostics]'), 'no flag, no probe -- not even for the founder').toHaveCount(0);
  });

  test('armed, the founder gets a real reading with a control pass', async ({ page }) => {
    await reachReleasedHome(page);
    // Arm it on the page we are already authenticated on.
    await page.goto(`/en?splash=0&dev=skip&diag=1`, { waitUntil: 'domcontentloaded' });
    const panel = page.locator('[data-unitas-render-diagnostics]');
    await expect(panel, 'the founder session plus ?diag=1 must mount the probe').toBeVisible({ timeout: 30_000 });

    await panel.locator('[data-diag-run]').click();
    const json = panel.locator('[data-diag-json]');
    await expect(json).toBeVisible({ timeout: 90_000 });

    const report = JSON.parse(await json.innerText());
    console.log(`[REV-26] ${await panel.locator('[data-diag-headline]').innerText()}`);

    expect(report.schema).toBe('unitas.render-probe.v1');
    // The whole point of the instrument: a page reading AND a floor for this
    // device, measured in the same second, so the two can be compared.
    expect(report.reading.page.count, 'the page pass must collect frames').toBeGreaterThan(0);
    expect(report.reading.control.count, 'the CONTROL pass is what makes the page number mean anything').toBeGreaterThan(0);
    expect(report.device.userAgent).toBeTruthy();
    expect(['accelerated', 'raster-bound', 'software', 'main-thread-bound', 'unknown']).toContain(report.verdict.status);

    // And the portable claim REV-25 established, re-measured on the real page
    // through the shipped instrument rather than through a test-only snippet.
    expect(report.reading.framesScheduledWhileIdle, 'an idle page must not schedule animation frames').toBeLessThanOrEqual(2);

    // The probe must leave the page exactly as it found it.
    await expect(page.locator('#omni-synapse-search')).toBeVisible();
    expect(await page.locator('style[data-unitas-diag-control]').count(), 'the control stylesheet must be removed again').toBe(0);
  });

  test('the probe is reachable through the master key alone, with no cookie jar', async ({ browser }) => {
    // The founder on a second device: header in, diagnostics out.
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-unitas-signature': TOKEN } });
    const page = await ctx.newPage();
    await page.goto('/en?splash=0&dev=skip&diag=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-unitas-render-diagnostics]')).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });
});
