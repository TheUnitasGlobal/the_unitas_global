const { test, expect } = require('@playwright/test');

// Round 18 (owner instruction 2026-09-06, "모바일 앱 블랙 스크린 렌더링 프리즈
// 긴급 패치"): on a PHONE / TABLET app the FINAL exit dialog opens over a
// pre-collapsed sentinel buffer, so a hardware back press leaves the document
// at once (the OS finishes the activity) instead of being swallowed by a
// sentinel; and the second 종료 collapses the WHOLE same-document stack in one
// hop before terminating in place. The App channel is emulated the way round
// 17 did it: `matchMedia` is patched so `(display-mode: standalone)` matches
// and the desktop-app query `(hover: hover) and (pointer: fine)` does not.
// web/lib/exit/appExit.ts, web/components/interaction/ExitGuard.tsx.

const MARKER = 'unitasExitGuard';
const DEPTH = 'unitasExitDepth';
const SENTINEL_DEPTH = 12;

const exitDialog = (page) => page.locator('#exit-guard-title');
const sealedX = (page) => page.locator('button[aria-label]').filter({ has: page.locator('svg.lucide-x') }).first();
/** The exit confirm dialog itself (the site's audio gate is ALSO a
 *  role="dialog", parked beneath the curtain -- scope by the title). */
const exitPanel = (page) => page.locator('[role="dialog"]', { has: page.locator('#exit-guard-title') });
/** The dialog's confirm (red) button -- the last button inside the dialog. */
const confirmButton = (page) => exitPanel(page).locator('button').last();
/** The dialog's 취소 button -- the first button inside the dialog. */
const cancelButton = (page) => exitPanel(page).locator('button').first();

const readStack = (page) =>
  page.evaluate(
    ({ marker, depth }) => {
      const state = window.history.state;
      const nav = window.navigation;
      return {
        length: window.history.length,
        sentinelDepth: state && state[marker] ? Number(state[depth]) || 1 : 0,
        sameDocumentIndex: nav && nav.currentEntry ? nav.currentEntry.index : -1,
        terminated: document.documentElement.hasAttribute('data-unitas-terminated'),
        url: location.href,
      };
    },
    { marker: MARKER, depth: DEPTH },
  );

// Chromium only. The mechanics were verified by hand on Playwright's WebKit
// too (it exposes the Navigation API: collapse -> index 0, 취소 -> depth 12,
// back -> depth 11), but headless WebKit on this machine intermittently loses
// its WebGL context when the main site's 3D scene mounts behind the curtain
// ("WebGL: context lost" -> three.js `getShaderPrecisionFormat` on null ->
// root error boundary), which tears the page down mid-test. The behaviours
// asserted here are Android-app semantics anyway: an iOS home-screen app has
// no hardware back button and exposes no close path at all.
test.skip(({ browserName }) => browserName === 'webkit', 'headless WebKit WebGL context-loss flake; Android-app semantics');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const native = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      if (query.includes('display-mode: standalone')) {
        return { matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false };
      }
      if (query.includes('pointer: fine')) {
        return { matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false };
      }
      return native(query);
    };
  });
});

/** Land on the sealed Coming-Soon screen as an installed phone app, with the
 *  sentinel buffer parked by a first activation gesture. */
async function openSealedApp(page) {
  await page.goto('/en?splash=0');
  await page.evaluate(() => sessionStorage.setItem('unitas_cinema_phase', 'sealed'));
  await page.reload();
  await expect(sealedX(page)).toBeVisible({ timeout: 8000 });
  // First genuine gesture parks the buffer (12 deep) under the page.
  await page.mouse.click(5, 5);
  await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 3000 }).toBe(SENTINEL_DEPTH);
}

test.describe('App channel: final exit dialog pre-collapses the back buffer (round 18)', () => {
  test('step 1 keeps the buffer (back is swallowed); step 2 collapses it to the real entry while the dialog stays open', async ({ page }) => {
    await openSealedApp(page);
    const siteUrl = page.url();

    // 'X 종료' on the App channel opens the two-step confirm (round 17).
    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });

    // Step 1: the buffer is intact -- a back traversal lands on a sentinel
    // and the visitor stays on the site with the dialog still open.
    expect((await readStack(page)).sentinelDepth).toBe(SENTINEL_DEPTH);
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await page.waitForTimeout(400);
    expect(page.url()).toBe(siteUrl);
    await expect(exitDialog(page)).toBeVisible();

    // Step 1 -> step 2: the tap's activation tops the buffer up, then the
    // FINAL dialog opens over a collapsed buffer (same-document traversal).
    await confirmButton(page).click();
    await expect(exitDialog(page)).toBeVisible();
    await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 3000 }).toBe(0);
    const collapsed = await readStack(page);
    expect(collapsed.terminated).toBe(false);
    expect(collapsed.url).toBe(siteUrl);
    // Chromium exposes the Navigation API: the app sits on the document's
    // FIRST entry. (WebKit may lack it -- then -1 is the documented fallback.)
    expect([0, -1]).toContain(collapsed.sameDocumentIndex);
    // The dialog is still the final one -- nothing re-rendered underneath.
    await expect(exitDialog(page)).toBeVisible();
  });

  test('on the final dialog a hardware back press LEAVES the document at once -- no shroud, no extra gesture', async ({ page }) => {
    await openSealedApp(page);
    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });
    await confirmButton(page).click();
    await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 3000 }).toBe(0);

    // Under Playwright the entry beneath the app's launch entry is the
    // harness's about:blank -- the stand-in for "the OS finishes the
    // activity": the traversal must actually leave the site.
    await page.goBack({ waitUntil: 'commit' });
    await expect.poll(() => page.url(), { timeout: 5000 }).toBe('about:blank');
  });

  test('취소 on the final dialog re-parks the full buffer from its own gesture', async ({ page }) => {
    await openSealedApp(page);
    const siteUrl = page.url();
    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });
    await confirmButton(page).click();
    await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 3000 }).toBe(0);

    await cancelButton(page).click();
    await expect(exitDialog(page)).toHaveCount(0, { timeout: 3000 });
    await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 3000 }).toBe(SENTINEL_DEPTH);
    // ...and a back press is swallowed again: still on the site.
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await page.waitForTimeout(400);
    expect(page.url()).toBe(siteUrl);
  });

  test('the second 종료 terminates in place with the WHOLE stack collapsed on the tap itself', async ({ page }) => {
    await openSealedApp(page);
    const siteUrl = page.url();
    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });
    await confirmButton(page).click();
    await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 3000 }).toBe(0);

    // Final 종료: shell kill (none) -> window.close (refused, multi-entry) ->
    // terminate in place, synchronously inside the tap.
    await confirmButton(page).click();
    await expect.poll(async () => (await readStack(page)).terminated, { timeout: 3000 }).toBe(true);
    const done = await readStack(page);
    expect(done.url).toBe(siteUrl);
    expect(done.sentinelDepth).toBe(0);
    expect([0, -1]).toContain(done.sameDocumentIndex);
    // The terminal shroud is opaque black and on top of everything.
    const shroud = await page.evaluate(() => {
      const el = document.elementFromPoint(Math.floor(innerWidth / 2), Math.floor(innerHeight / 2));
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    expect(shroud).toBe('rgb(0, 0, 0)');
    // The very next back press ends the app (leaves the document).
    await page.goBack({ waitUntil: 'commit' });
    await expect.poll(() => page.url(), { timeout: 5000 }).toBe('about:blank');
  });
});
