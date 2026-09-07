const { test, expect } = require('@playwright/test');

// Round 21 (owner instruction 2026-09-06, "모바일 앱 전용 2단계 안심 종료 안내
// 가이드 팝업 + about:blank 원복"): on a PHONE / TABLET app the exit is ONE
// confirm ("종료하시겠습니까?") and then the COMPLETION GUIDE --
// the exit engine terminates the app in place (session purge, React unmount,
// whole-stack collapse, sealed launch entry) and paints a floating
// glassmorphism card reading "Shutdown complete. Please close the app or
// browser safely." The document is NEVER navigated to about:blank (round 20
// reverted). A DESKTOP app window keeps the round-17 two-step confirm and its
// round-19 black shroud fallback (its window.close() genuinely closes it).
//
// The App channel is emulated the way rounds 17-20 did it: `matchMedia` is
// patched so `(display-mode: standalone)` matches; the desktop-app query
// `(hover: hover) and (pointer: fine)` matches only in the desktop describe.
// web/lib/exit/appExit.ts, web/lib/exit/exitConfirmFlow.ts,
// web/components/interaction/ExitGuard.tsx.

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
/** Round 21: the completion guide card painted by the exit engine. */
const guideCard = (page) => page.locator('[data-unitas-exit-guide]');
const guideTitle = (page) => page.locator('#unitas-exit-guide-title');

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
        frame: document.documentElement.getAttribute('data-unitas-terminal-frame'),
        url: location.href,
      };
    },
    { marker: MARKER, depth: DEPTH },
  );

// Chromium only. Headless WebKit on this machine intermittently loses its
// WebGL context when the main site's 3D scene mounts behind the curtain
// ("WebGL: context lost" -> three.js `getShaderPrecisionFormat` on null ->
// root error boundary), which tears the page down mid-test. The behaviours
// asserted here are Android-app semantics anyway: an iOS home-screen app has
// no hardware back button and exposes no close path at all.
test.skip(({ browserName }) => browserName === 'webkit', 'headless WebKit WebGL context-loss flake; Android-app semantics');

function patchMatchMedia(page, { finePointer }) {
  return page.addInitScript(
    ({ fine }) => {
      const native = window.matchMedia.bind(window);
      const stub = (query, matches) => ({
        matches,
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        onchange: null,
        dispatchEvent: () => false,
      });
      window.matchMedia = (query) => {
        if (query.includes('display-mode: standalone')) return stub(query, true);
        if (query.includes('pointer: fine')) return stub(query, fine);
        return native(query);
      };
    },
    { fine: finePointer },
  );
}

/** Land on the sealed Coming-Soon screen as an installed app. On a phone app
 *  the first activation gesture parks the sentinel buffer under the page. */
async function openSealedApp(page, { expectBuffer = true } = {}) {
  await page.goto('/en?splash=0');
  await page.evaluate(() => sessionStorage.setItem('unitas_cinema_phase', 'sealed'));
  await page.reload();
  await expect(sealedX(page)).toBeVisible({ timeout: 8000 });
  await page.mouse.click(5, 5);
  if (expectBuffer) {
    await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 3000 }).toBe(SENTINEL_DEPTH);
  } else {
    await page.waitForTimeout(300);
    expect((await readStack(page)).sentinelDepth).toBe(0);
  }
}

test.describe('PHONE / TABLET app: one confirm, then the completion guide (round 21)', () => {
  test.beforeEach(async ({ page }) => {
    await patchMatchMedia(page, { finePointer: false });
  });

  test("'X 종료' opens a SINGLE confirm -- no step indicator, no second question -- and back is swallowed while it is open", async ({ page }) => {
    await openSealedApp(page);
    const siteUrl = page.url();

    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });
    // The single minimal question (round 22 copy, en "Exit?"): no "1 / 2"
    // indicator, no logout question while signed out.
    await expect(exitDialog(page)).toHaveText(/^exit\?$/i);
    await expect(exitPanel(page)).not.toContainText(/Step \d of \d/);

    // The buffer is intact -- a back traversal lands on a sentinel and the
    // visitor stays on the site with the dialog still open.
    expect((await readStack(page)).sentinelDepth).toBe(SENTINEL_DEPTH);
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await page.waitForTimeout(400);
    expect(page.url()).toBe(siteUrl);
    await expect(exitDialog(page)).toBeVisible();
    expect((await readStack(page)).terminated).toBe(false);
  });

  test('취소 leaves the visitor exactly where they were, buffer re-parked', async ({ page }) => {
    await openSealedApp(page);
    const siteUrl = page.url();
    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });

    await cancelButton(page).click();
    await expect(exitDialog(page)).toHaveCount(0, { timeout: 3000 });
    await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 3000 }).toBe(SENTINEL_DEPTH);
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await page.waitForTimeout(400);
    expect(page.url()).toBe(siteUrl);
    expect((await readStack(page)).terminated).toBe(false);
    await expect(guideCard(page)).toHaveCount(0);
  });

  test('종료 terminates in place under the completion GUIDE: localized copy, tree purged, stack collapsed, launch URL sealed -- never about:blank', async ({ page }) => {
    await openSealedApp(page);
    const origin = new URL(page.url()).origin;
    await page.evaluate(() => sessionStorage.setItem('unitas_probe', '1'));

    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });
    await confirmButton(page).click();

    // The guide card is the terminal frame -- visible, with the locale's copy.
    await expect(guideCard(page)).toBeVisible({ timeout: 5000 });
    await expect(guideTitle(page)).toHaveText('Shutdown complete.');
    await expect(guideCard(page)).toContainText('Please close the app or browser safely.');
    // It is the centre-most thing on screen: the hit-test at the viewport
    // centre lands inside the guide frame, never on live app UI.
    const centreHit = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return el ? Boolean(el.closest('[data-unitas-shroud]')) : false;
    });
    expect(centreHit).toBe(true);

    // The document is still the app's document -- no navigation away.
    const done = await readStack(page);
    expect(done.terminated).toBe(true);
    expect(done.frame).toBe('guide');
    expect(done.url).not.toContain('about:blank');
    // Whole-stack collapse landed on the document's first entry and the
    // entry was sealed to the clean launch URL. English lives at the bare
    // root since the single-URL SEO architecture (localePrefix 'as-needed',
    // 2026-09-06), so the router's canonical URL for /en is `/`; either
    // spelling is the clean launch entry -- what matters is that no query,
    // hash or deep route survives.
    await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 5000 }).toBe(0);
    await expect.poll(async () => (await readStack(page)).url, { timeout: 5000 }).toMatch(new RegExp(`^${origin}/(en)?$`));
    expect([0, -1]).toContain((await readStack(page)).sameDocumentIndex);

    // React tree purged (no dialog, no canvas), session purged.
    const purged = await page.evaluate(() => ({
      dialog: document.getElementById('exit-guard-title') !== null,
      canvases: document.querySelectorAll('canvas').length,
      session: sessionStorage.length,
      guide: document.querySelectorAll('[data-unitas-exit-guide]').length,
    }));
    expect(purged.dialog).toBe(false);
    expect(purged.canvases).toBe(0);
    expect(purged.session).toBe(0);
    expect(purged.guide).toBe(1);

    // Still there a beat later: the fallback step is idempotent (one card).
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => document.querySelectorAll('[data-unitas-exit-guide]').length)).toBe(1);
    expect(page.url()).not.toContain('about:blank');
  });

  test('after the guide, ONE hardware back press leaves the document (the OS finishes the activity)', async ({ page }) => {
    await openSealedApp(page);
    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });
    await confirmButton(page).click();
    await expect(guideCard(page)).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => (await readStack(page)).sentinelDepth, { timeout: 5000 }).toBe(0);

    // Under Playwright the entry beneath the app's launch entry is the
    // harness's about:blank -- the stand-in for "the OS finishes the
    // activity": the traversal must actually leave the site.
    await page.goBack({ waitUntil: 'commit' });
    await expect.poll(() => page.url(), { timeout: 5000 }).toBe('about:blank');
  });

  test('termination purges the session and unmounts the tree on the confirmed tap (terminate event, session 0)', async ({ page }) => {
    await openSealedApp(page);
    await page.evaluate(() => sessionStorage.setItem('unitas_probe', '1'));

    let terminateFired = false;
    let sessionLenAtTerminate = -1;
    await page.exposeFunction('__recordTerminate', (len) => {
      terminateFired = true;
      sessionLenAtTerminate = len;
    });
    await page.evaluate(() => {
      window.addEventListener('unitas:app-terminate', () => window.__recordTerminate(sessionStorage.length));
    });

    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });
    await confirmButton(page).click();

    await expect.poll(() => terminateFired, { timeout: 5000 }).toBe(true);
    expect(sessionLenAtTerminate).toBe(0);
    await expect(guideCard(page)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('DESKTOP app window: two-step confirm and the black shroud fallback stay as they were (round 21, item 2)', () => {
  test.beforeEach(async ({ page }) => {
    await patchMatchMedia(page, { finePointer: true });
  });

  test('asks twice ("1 / 2" -> "2 / 2"), then window.close() -- refused under the harness -> black shroud, no guide, no about:blank', async ({ page }) => {
    // A desktop app window never parks the sentinel buffer (round 15).
    await openSealedApp(page, { expectBuffer: false });

    await sealedX(page).dispatchEvent('click');
    await expect(exitDialog(page)).toBeVisible({ timeout: 3000 });
    await expect(exitPanel(page)).toContainText(/Step 1 of 2/);
    await confirmButton(page).click();
    await expect(exitDialog(page)).toBeVisible();
    await expect(exitPanel(page)).toContainText(/Step 2 of 2/);

    // Second 종료: shell kill (none) -> window.close() (the harness page holds
    // more than one entry, so it is refused) -> round-19 shroud, in place.
    await confirmButton(page).click();
    await expect.poll(async () => (await readStack(page)).terminated, { timeout: 5000 }).toBe(true);
    const done = await readStack(page);
    expect(done.frame).toBe('shroud');
    expect(done.url).not.toContain('about:blank');
    await expect(guideCard(page)).toHaveCount(0);
    const shroud = await page.evaluate(() => {
      const el = document.querySelector('[data-unitas-shroud]');
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    expect(shroud).toBe('rgb(0, 0, 0)');
  });
});
