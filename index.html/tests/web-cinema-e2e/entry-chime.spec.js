const { test, expect } = require('@playwright/test');

// Logo-page entry chime under the MOBILE WEB AUTOPLAY POLICY (owner
// instruction 2026-09-07, "모바일 온라인 브라우저 첫 로그페이지 진입 오디오").
// Chromium is launched with the same policy a phone browser enforces -- no
// AudioContext may start before the document has user activation -- so these
// runs reproduce the exact environment that used to stay silent. NOTE: for
// Web Audio, Chromium's `user-gesture-required` policy gates CROSS-ORIGIN
// IFRAMES only; the main-frame gate (the real mobile / desktop default) is
// `document-user-activation-required`.
//
// TEST-HARNESS TRAP: every Playwright evaluation -- page.evaluate, locator
// assertions, waitForFunction -- is sent to Chromium with `userGesture:
// true`, which grants the document STICKY user activation and lets a later
// resume() succeed with no real tap. Everything that must observe the page
// BEFORE the first tap therefore goes through a raw CDP `Runtime.evaluate`
// (no userGesture) -- see `rawReader()`.
//
// Verified surface: web/lib/audio/logoEntryChime.ts (ENTRY_CHIME_BOOTSTRAP in
// app/layout.tsx's <head> + the hydrated armLogoEntryChime()).

test.use({ launchOptions: { args: ['--autoplay-policy=document-user-activation-required'] } });

const splash = (page) => page.getByTestId('intro-splash');

const CHIME_EXPR = `(function(){var s=window.__unitasEntryChime;if(!s)return null;return {source:s.source,played:s.played,cancelled:s.cancelled,ctxState:s.ctx?s.ctx.state:null,ctxIdx:s.ctx?s.ctx.__idx:null,gestureAt:s.gestureAt,armedAt:s.armedAt,playedAt:s.playedAt,contexts:window.__acCount,oscByCtx:window.__oscByCtx};})()`;
const SPLASH_COUNT_EXPR = `document.querySelectorAll('[data-testid="intro-splash"]').length`;
const SPLASH_FLAG_EXPR = `document.documentElement.getAttribute('data-splash')`;

/** Counts every AudioContext the page builds and the oscillators each one schedules. */
async function instrumentWebAudio(page) {
  await page.addInitScript(() => {
    const Orig = window.AudioContext;
    if (!Orig) return;
    window.__acCount = 0;
    window.__oscByCtx = [];
    window.AudioContext = class extends Orig {
      constructor(...args) {
        super(...args);
        this.__idx = window.__acCount++;
      }
      createOscillator() {
        window.__oscByCtx[this.__idx] = (window.__oscByCtx[this.__idx] || 0) + 1;
        return super.createOscillator();
      }
    };
  });
}

/** Activation-free page reader over a raw CDP session. */
async function rawReader(page) {
  const session = await page.context().newCDPSession(page);
  const evalRaw = async (expression) => {
    const { result, exceptionDetails } = await session.send('Runtime.evaluate', { expression, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.text || 'Runtime.evaluate failed');
    return result.value;
  };
  const chime = () => evalRaw(CHIME_EXPR);
  const splashCount = () => evalRaw(SPLASH_COUNT_EXPR);
  const waitFor = async (probe, predicate, timeoutMs, label) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await probe();
      if (predicate(value)) return value;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}: last value ${JSON.stringify(value)}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  return { evalRaw, chime, splashCount, waitFor, close: () => session.detach().catch(() => {}) };
}

async function tap(page) {
  const vp = page.viewportSize() || { width: 400, height: 800 };
  if (test.info().project.use.hasTouch) {
    await page.touchscreen.tap(Math.floor(vp.width / 2), Math.floor(vp.height / 2));
  } else {
    await page.mouse.click(Math.floor(vp.width / 2), Math.floor(vp.height / 2));
  }
}

test.describe('logo-page entry chime under the mobile autoplay policy', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'Chromium launch flag; WebKit headless WebGL flake');

  test('THE BUG SCENARIO: no touch during the 3s logo page -> the chime stays armed and plays on the first tap after it', async ({ page }) => {
    await instrumentWebAudio(page);
    const raw = await rawReader(page);
    await page.goto('/en');
    await raw.waitFor(raw.splashCount, (n) => n === 1, 5000, 'logo page on screen');

    // Armed from the first byte by the head bootstrap, refused by the policy.
    const early = await raw.chime();
    expect(early).not.toBeNull();
    expect(early.source).toBe('bootstrap');
    expect(early.played).toBe(false);
    expect(early.ctxState).toBe('suspended');

    // The logo page ends with no gesture at all (a phone visitor watching).
    await raw.waitFor(raw.splashCount, (n) => n === 0, 8000, 'logo page gone');
    await new Promise((r) => setTimeout(r, 500));
    const after = await raw.chime();
    expect(after.played).toBe(false);
    expect(after.cancelled).toBe(false);
    // NOT torn down with the splash: the context is still open and waiting.
    expect(after.ctxState).toBe('suspended');
    // The hydrated arm ADOPTED the bootstrap's engine (a rebuilt one would
    // have republished the record as source 'module').
    expect(after.source).toBe('bootstrap');
    const chimeIdx = after.ctxIdx;
    expect(chimeIdx).not.toBeNull();

    // First tap, well after the logo page: the chime plays right there.
    await tap(page);
    const done = await raw.waitFor(raw.chime, (s) => s && s.played, 3000, 'chime played on first tap');
    expect(done.gestureAt).toBeGreaterThan(0);
    expect(done.playedAt).toBeGreaterThanOrEqual(done.gestureAt);
    expect(done.source).toBe('bootstrap');
    // Exactly one chime: 2 notes x (core + partial) = 4 oscillators on ITS context.
    expect(done.oscByCtx[chimeIdx]).toBe(4);

    // A second tap never replays it.
    await tap(page);
    await new Promise((r) => setTimeout(r, 300));
    const again = await raw.chime();
    expect(again.oscByCtx[chimeIdx]).toBe(4);
    // ...and the chime's context is released shortly after playing.
    await raw.waitFor(raw.chime, (s) => s && s.ctxState === null, 4000, 'chime context released');
    await raw.close();
  });

  test('a tap DURING the logo page sounds the chime at the tap itself (pre-hydration bootstrap path)', async ({ page }) => {
    await instrumentWebAudio(page);
    const raw = await rawReader(page);
    await page.goto('/en', { waitUntil: 'commit' });
    await raw.waitFor(raw.splashCount, (n) => n === 1, 5000, 'logo page on screen');
    const before = await raw.chime();
    expect(before.played).toBe(false);
    await tap(page);
    const done = await raw.waitFor(raw.chime, (s) => s && s.played, 2500, 'chime played at the tap');
    // Still on the logo page, and it was the bootstrap's own engine that fired.
    expect(done.source).toBe('bootstrap');
    expect(done.gestureAt).toBeGreaterThan(0);
    expect(done.oscByCtx[done.ctxIdx]).toBe(4);
    expect(await raw.splashCount()).toBe(1);
    // The logo page ends; nothing chimes a second time on the same context.
    await raw.waitFor(raw.splashCount, (n) => n === 0, 8000, 'logo page gone');
    await tap(page);
    await new Promise((r) => setTimeout(r, 300));
    const later = await raw.chime();
    expect(later.played).toBe(true);
    expect(later.source).toBe('bootstrap');
    await raw.close();
  });

  test('is skipped wherever the logo page is skipped: ?splash=0 and an in-place refresh', async ({ page }) => {
    const raw = await rawReader(page);
    await page.goto('/en?splash=0');
    expect(await raw.chime()).toBeNull();

    // An F5 parked on a persisted page (the entry gate here) re-renders that
    // page in place with no logo page -- and therefore no chime engine.
    await page.goto('/en');
    await expect(splash(page)).toHaveCount(0, { timeout: 8000 });
    const phase = await page.evaluate(() => window.sessionStorage.getItem('unitas_cinema_phase'));
    expect(['gate', 'cinema', 'sealed', 'released']).toContain(phase);
    await page.reload();
    expect(await raw.evalRaw(SPLASH_FLAG_EXPR)).toBe('off');
    expect(await raw.chime()).toBeNull();
    await raw.close();
  });

  test('sound switched OFF: no chime engine is ever built', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('unitas_audio_pref', 'off');
      } catch (_) {}
    });
    await instrumentWebAudio(page);
    const raw = await rawReader(page);
    await page.goto('/en');
    await raw.waitFor(raw.splashCount, (n) => n === 1, 5000, 'logo page on screen');
    expect(await raw.chime()).toBeNull();
    await raw.waitFor(raw.splashCount, (n) => n === 0, 8000, 'logo page gone');
    await tap(page);
    await new Promise((r) => setTimeout(r, 300));
    expect(await raw.chime()).toBeNull();
    await raw.close();
  });
});

test.describe('logo-page entry chime where autoplay is allowed (installed App / engaged origin)', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'Chromium launch flag; WebKit headless WebGL flake');

  test('chimes at first paint with no gesture at all, exactly once', async ({ playwright, baseURL }) => {
    // A per-describe launchOptions override is not allowed, so this case
    // launches its own Chromium with the autoplay-allowed policy.
    const { hasTouch, isMobile, viewport, userAgent, deviceScaleFactor } = test.info().project.use;
    const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
      const context = await browser.newContext({ baseURL, hasTouch, isMobile, viewport, userAgent, deviceScaleFactor });
      const page = await context.newPage();
      await instrumentWebAudio(page);
      const raw = await rawReader(page);
      await page.goto('/en');
      const done = await raw.waitFor(raw.chime, (s) => s && s.played, 2500, 'chime at first paint');
      expect(done.source).toBe('bootstrap');
      expect(done.gestureAt).toBe(0);
      expect(done.oscByCtx[done.ctxIdx]).toBe(4);
      await raw.waitFor(raw.splashCount, (n) => n === 0, 8000, 'logo page gone');
      await tap(page);
      await new Promise((r) => setTimeout(r, 300));
      const later = await raw.chime();
      expect(later.played).toBe(true);
      expect(later.source).toBe('bootstrap');
      await raw.close();
      await context.close();
    } finally {
      await browser.close();
    }
  });
});
