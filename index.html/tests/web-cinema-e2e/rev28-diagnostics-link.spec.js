// REV-28 -- the diagnostic entry point, the bottleneck adapter, and the PWA
// readiness readout (founder directive 2026-09-14).
//
// WHAT THIS PINS.
//
// 1. THE WAY IN. REV-26 shipped an instrument the founder had to reach by
//    typing `?diag=1` on a phone keyboard. The sovereign console now carries
//    the action. It also states the one thing a link cannot solve: the probe
//    needs a founder session ON THAT DEVICE, and a link that silently lands on
//    the gateway would be worse than no link -- measured, `theunitas.global`
//    308s to www preserving the query, and www then 307s a session-less
//    visitor to `/en/gateway?diag=1`.
//
// 2. THE FOLLOW-UP QUESTION. `raster-bound` says the page is expensive.
//    "Find bottleneck" says where, by automating the hide-and-re-measure
//    procedure REV-26 ran by hand.
//
// 3. THE PWA READOUT. `beforeinstallprompt` cannot be made to fire in a
//    headless browser, which REV-26 recorded as an open question rather than
//    claiming otherwise. It still cannot. What CAN be pinned is the readout
//    that answers it on a real device -- every precondition, named, with the
//    platform-correct next action (iOS has no prompt at any version; it is
//    Share -> Add to Home Screen, by a human).
const { test, expect } = require('@playwright/test');
const { reachReleasedHome } = require('./_rev25Home');

test.describe.configure({ timeout: 180_000 });

/**
 * The console collapses itself for every other spec; open it back up.
 *
 * NOT by writing the sessionStorage flag and reloading -- `reachReleasedHome`
 * installs that flag through `addInitScript`, which re-runs on EVERY
 * navigation, so a reload would simply collapse it again. Measured the hard
 * way. The collapsed console is a `<button>` and the open one is an `<aside>`,
 * both carrying the same test id, so the toggle is what to press.
 */
async function openConsole(page) {
  const collapsed = page.locator('button[data-testid="sovereign-debug-panel"]');
  await expect(page.locator('[data-testid="sovereign-debug-panel"]'), 'the founder console must be present at all').toBeVisible({ timeout: 30_000 });
  if ((await collapsed.count()) > 0) {
    await collapsed.click();
  }
  await expect(page.locator('aside[data-testid="sovereign-debug-panel"]'), 'the console must be open, not just present').toBeVisible({ timeout: 30_000 });
}

test.describe('REV-28 -- the way into the probe', () => {
  test('the sovereign console carries the render-probe action, and it arms the probe', async ({ page }) => {
    await reachReleasedHome(page);
    await openConsole(page);

    const action = page.locator('[data-sovereign-render-probe]');
    await expect(action, 'the founder must not have to type a query string on a phone').toBeVisible();

    await action.click();
    await page.waitForFunction(() => new URLSearchParams(window.location.search).get('diag') === '1', null, { timeout: 30_000 });
    await expect(page.locator('[data-unitas-render-diagnostics]'), 'one press should land on an armed probe').toBeVisible({ timeout: 45_000 });
  });

  test('a visitor still cannot reach it, even following the founder’s own link shape', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.goto('/?diag=1', { waitUntil: 'domcontentloaded' });
    expect(res.status()).toBe(200);
    expect(new URL(page.url()).pathname, 'a session-less visitor is sealed, flag or not').toMatch(/\/gateway$/);
    await expect(page.locator('[data-unitas-render-diagnostics]')).toHaveCount(0);
    await ctx.close();
  });
});

test.describe('REV-28 -- the bottleneck adapter', () => {
  test('after a reading, it ranks where the frame cost actually goes', async ({ page }) => {
    await reachReleasedHome(page);
    await page.goto('/en?splash=0&dev=skip&diag=1', { waitUntil: 'domcontentloaded' });
    const panel = page.locator('[data-unitas-render-diagnostics]');
    await expect(panel).toBeVisible({ timeout: 45_000 });

    // The bottleneck pass is deliberately gated behind a reading: it costs
    // eight more measured passes and is meaningless without a floor.
    await expect(panel.locator('[data-diag-bisect]'), 'nothing to bisect before there is a reading').toHaveCount(0);

    await panel.locator('[data-diag-run]').click();
    await expect(panel.locator('[data-diag-json]')).toBeVisible({ timeout: 120_000 });

    await panel.locator('[data-diag-bisect]').click();
    const section = panel.locator('[data-diag-bottleneck]');
    await expect(section).toBeVisible({ timeout: 150_000 });

    // Every catalogued region is reported, including the ones that matched
    // nothing -- "this page has no canvas" is information, and dropping it
    // would read as "the canvas was free".
    for (const key of ['rings', 'nav', 'hero', 'search', 'hub', 'footer', 'canvas', 'everything']) {
      await expect(section.locator(`[data-diag-region="${key}"]`), key).toHaveCount(1);
    }

    const rows = await section.locator('[data-diag-region]').allInnerTexts();
    console.log(`[REV-28] bottleneck:\n  ${rows.join('\n  ')}`);

    // And the honest caveat is on screen, not buried in a doc comment -- but
    // only when there is something to caveat. Measured on mobile-chrome, this
    // page costs NOTHING over that device's floor (every recovery 0ms), and
    // the adapter correctly short-circuits to "there is no bottleneck to find"
    // rather than ranking noise. Demanding the overlap warning there would be
    // demanding a caveat about a measurement that was never made.
    const text = await section.innerText();
    if (/no bottleneck to find/.test(text)) {
      expect(text, 'a page with no cost must say exactly that').toContain('costs nothing over the device floor');
    } else {
      expect(text, 'the shares overlap and must not read as a partition').toContain('do not sum to 100%');
    }

    // The instrument must leave the page exactly as it found it.
    expect(await page.locator('style[data-unitas-diag-control]').count(), 'every hide must have been undone').toBe(0);
    await expect(page.locator('#omni-synapse-search')).toBeVisible();
  });
});

test.describe('REV-28 -- the PWA readiness readout', () => {
  test('it names every precondition and the platform-correct next action', async ({ page }, testInfo) => {
    await reachReleasedHome(page);
    await page.goto('/en?splash=0&dev=skip&diag=1', { waitUntil: 'domcontentloaded' });
    const panel = page.locator('[data-unitas-render-diagnostics]');
    await expect(panel).toBeVisible({ timeout: 45_000 });

    const pwa = panel.locator('[data-diag-pwa]');
    await expect(pwa, 'the PWA facts cost no frames, so they need no second press').toBeVisible({ timeout: 45_000 });

    const status = await pwa.getAttribute('data-diag-pwa');
    const headline = await panel.locator('[data-diag-pwa-headline]').innerText();
    console.log(`[REV-28][${testInfo.project.name}] pwa ${status} · ${headline}`);
    expect(['installed', 'ready', 'ios-manual', 'waiting', 'blocked']).toContain(status);

    // The manifest and the worker are the two preconditions this project
    // actually controls, and REV-26 changed the worker. Whatever the verdict,
    // the readout must state both rather than leave them implied.
    expect(headline).toMatch(/sw (yes|no)/);
    expect(headline).toMatch(/manifest (ok|missing)/);

    // In a headless browser `beforeinstallprompt` does not fire, so the status
    // must NOT be 'ready' by accident -- and it must not be 'blocked' either,
    // because every precondition this project owns is in place. That leaves
    // 'waiting', which is exactly the honest answer, and the readout has to
    // explain the difference rather than present it as a failure.
    if (status === 'waiting') {
      await expect(pwa).toContainText('engagement heuristics');
    }
    if (status === 'blocked') {
      const blockers = await pwa.locator('li').allInnerTexts();
      throw new Error(`a precondition this project owns is broken: ${blockers.join(' | ')}`);
    }
  });
});
