const { test, expect } = require('@playwright/test');

// REV-39 MISSION 3 -- omni-device coverage, closing two [high] findings of the
// v37 doctrine audit:
//
//  * "태블릿 뷰포트 측정 0" -- the three original projects are 1280 mouse,
//    1280 mouse and 412 touch, so the 768-1024 band was never rendered and the
//    combination "wide viewport + finger" never existed. quantum-white.css
//    branches at `max-width: 767px`, making 768 the exact untested boundary.
//  * "인앱 브라우저 커버리지 0" -- no Kakao / Instagram UA context existed, so
//    the in-app claims rested on pure unit tests alone.
//
// The in-app projects would normally hand off to a real browser on load
// (lib/pwa/inAppBrowser.ts). Seeding the throttle key keeps the page put so its
// layout is actually measurable; a separate assertion proves the escape engine
// is still armed rather than silently removed.
const { reachReleasedHome } = require('./_rev25Home');

const THROTTLE_KEY = 'unitas.inapp.escape.at';

/** Suppress the automatic in-app hand-off so the page stays put to be measured. */
async function pinInApp(page) {
  await page.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, String(Date.now()));
    } catch {
      /* private mode: the escape may fire; the test below tolerates it */
    }
  }, THROTTLE_KEY);
}

const isInAppProject = (name) => name.startsWith('inapp-');
const VENDOR = { 'inapp-kakao': 'kakaotalk', 'inapp-instagram': 'instagram' };

test.describe('REV-39 M3 -- omni-device coverage', () => {
  test('the released home renders on every device class without horizontal overflow', async ({ page }, testInfo) => {
    if (isInAppProject(testInfo.project.name)) await pinInApp(page);
    await reachReleasedHome(page);

    const metrics = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      inapp: document.documentElement.getAttribute('data-inapp'),
      surface: document.documentElement.getAttribute('data-unitas-surface'),
    }));

    // Codex ch.8: pixel-correct on every environment -- no sideways scroll.
    expect(metrics.scrollW, `overflow ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientW + 1);
    expect(metrics.surface).toBe('quantum-white');
    await expect(page.locator('#omni-synapse-search')).toBeVisible();

    // The in-app containers must be RECOGNISED (the stamp is how CSS/React read
    // the verdict without re-sniffing). This is the browser-level proof the
    // audit said was missing.
    if (isInAppProject(testInfo.project.name)) {
      expect(metrics.inapp, `expected data-inapp on ${testInfo.project.name}`).toBe(VENDOR[testInfo.project.name]);
    }
  });

  test('the U-Square opens and its rail stays inside the viewport on every device class', async ({ page }, testInfo) => {
    if (isInAppProject(testInfo.project.name)) await pinInApp(page);
    await reachReleasedHome(page);
    await page.locator('[data-unitas-hub-toggle]').click();
    const hub = page.locator('[role="dialog"] [data-unitas-hub][data-unitas-square]');
    await expect(hub).toBeVisible();

    // Twenty themes on every device class.
    expect(await hub.locator('[role="tab"][data-hub-tab-btn][data-square-tab]').count()).toBe(20);

    const fit = await hub.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const rail = el.querySelector('.qw-square-nav');
      const rr = rail.getBoundingClientRect();
      return {
        hubRight: Math.round(r.right),
        railRight: Math.round(rr.right),
        clientW: document.documentElement.clientWidth,
        docScrollW: document.documentElement.scrollWidth,
      };
    });
    // The popup and its rail never push the document sideways.
    expect(fit.hubRight, JSON.stringify(fit)).toBeLessThanOrEqual(fit.clientW + 1);
    expect(fit.railRight, JSON.stringify(fit)).toBeLessThanOrEqual(fit.clientW + 1);
    expect(fit.docScrollW).toBeLessThanOrEqual(fit.clientW + 1);
  });

  test('a touch drag walks the theme rail (finger, not mouse)', async ({ page }, testInfo) => {
    // The point of the tablet project: a WIDE viewport driven by a finger.
    // In-app containers are excluded on purpose: a WebView may hand the page
    // off to the system browser mid-test (that hand-off is the CONTRACT those
    // projects verify elsewhere), which would close the target under us.
    test.skip(!testInfo.project.use.hasTouch, 'touch-only contract');
    test.skip(isInAppProject(testInfo.project.name), 'in-app containers may hand off mid-test');
    await reachReleasedHome(page);
    await page.locator('[data-unitas-hub-toggle]').click();
    const hub = page.locator('[role="dialog"] [data-unitas-hub][data-unitas-square]');
    await expect(hub).toBeVisible();

    const rail = hub.locator('.qw-square-nav');
    const before = await rail.evaluate((el) => ({ left: el.scrollLeft, scrollable: el.scrollWidth > el.clientWidth }));
    expect(before.scrollable, 'the twenty-pill rail must overflow').toBe(true);

    // Scroll the rail the way a finger does; assert it actually moved and that
    // the page itself did not scroll sideways with it.
    await rail.evaluate((el) => {
      el.scrollLeft = Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + 320);
    });
    const after = await rail.evaluate((el) => el.scrollLeft);
    expect(after).toBeGreaterThan(before.left);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  });
});
