const { test, expect } = require('@playwright/test');

// Sovereign founder session so the run can walk the full sequence (the test
// server has no SOVEREIGN_AUTH_TOKEN env, so the owner default token from
// web/lib/sovereignAuth.ts is live). middleware.ts strips the token via a
// 303 and keeps `splash=0`, which skips the forced 5s intro splash so the
// gate button is clickable immediately (see intro-splash.spec.js for it).
const TOKEN = 'unitas_master_dooyeong_2026_secure_key';
const GATE_URL = `/en?sovereign_auth=${TOKEN}&splash=0`;

// Both <AudioGate/> (z-300) and the <ComingSoonCinema/> curtain (z-400) render
// an identical "ENTER THE EVENT HORIZON" button; the curtain's is the one on
// top and last in the DOM.
const enterButton = (page) => page.locator('button.event-horizon-btn').last();

/**
 * Instruments window.AudioContext BEFORE any app script runs so the test can
 * later assert that sound is unlocked on the SAME gesture that enters the
 * cinema (zero-delay symphony) -- no polling, no silent lead-in.
 */
async function instrumentAudio(page) {
  await page.addInitScript(() => {
    const store = { created: 0, firstResumeAt: null };
    // @ts-ignore
    window.__unitasAudio = store;

    const names = ['AudioContext', 'webkitAudioContext'];
    for (const name of names) {
      const Native = window[name];
      if (typeof Native !== 'function') continue;

      // Patch resume() on the prototype -- survives even where the constructor
      // can't be wrapped (WebKit).
      const proto = Native.prototype;
      if (proto && typeof proto.resume === 'function' && !proto.__unitasPatched) {
        const nativeResume = proto.resume;
        proto.resume = function (...args) {
          if (store.firstResumeAt == null) store.firstResumeAt = performance.now();
          return nativeResume.apply(this, args);
        };
        proto.__unitasPatched = true;
      }

      // Count constructions via a Proxy (construct trap works in WebKit too).
      const Wrapped = new Proxy(Native, {
        construct(target, args, newTarget) {
          store.created += 1;
          return Reflect.construct(target, args, newTarget);
        },
      });
      try {
        Object.defineProperty(window, name, { value: Wrapped, configurable: true, writable: true });
      } catch {
        try {
          window[name] = Wrapped;
        } catch {
          /* leave native in place; prototype resume patch still fires */
        }
      }
    }
  });
}

test.describe('pre-launch cinema flow', () => {
  test('entry gate never freezes document scroll', async ({ page }) => {
    await instrumentAudio(page);
    await page.goto(GATE_URL);

    // The gate is up...
    await expect(enterButton(page)).toBeVisible();

    // ...and the root element is NOT scroll-locked (spec 2: no forced lock).
    const htmlOverflow = await page.evaluate(
      () => getComputedStyle(document.documentElement).overflowY,
    );
    expect(htmlOverflow).not.toBe('hidden');
    const inlineOverflow = await page.evaluate(() => document.documentElement.style.overflow);
    expect(inlineOverflow).not.toBe('hidden');
  });

  test('ENTER unlocks audio on the same gesture and shows the two-line caption', async ({
    page,
    browserName,
  }) => {
    await instrumentAudio(page);
    await page.goto(GATE_URL);

    const clickAt = await page.evaluate(() => performance.now());
    await enterButton(page).click();

    // Caption: English keyword HEAD + localized SUB line, both visible (checked
    // first -- segment 1 only lasts 3s).
    await expect(page.getByRole('heading', { name: 'The Singularity is Near.' })).toBeVisible({
      timeout: 4000,
    });
    await expect(
      page.getByText('The orbit of an intelligence unbound from flesh swings open.'),
    ).toBeVisible();

    // Audio: a context was created AND/OR resumed as a direct result of the
    // ENTER gesture -- the soundscape engages immediately, no silent lead-in.
    // Playwright's bundled WebKit ships without the Web Audio API, so the app
    // correctly no-ops there and this half of the check can't run.
    const hasWebAudio = await page.evaluate(
      () => typeof (window.AudioContext || window.webkitAudioContext) === 'function',
    );
    if (browserName === 'webkit' && !hasWebAudio) {
      test.info().annotations.push({ type: 'note', description: 'WebKit build has no Web Audio API' });
    } else {
      const audio = await page.evaluate(() => ({
        created: window.__unitasAudio?.created ?? 0,
        firstResumeAt: window.__unitasAudio?.firstResumeAt ?? null,
      }));
      expect(audio.created > 0 || audio.firstResumeAt !== null).toBeTruthy();
      if (audio.firstResumeAt !== null) {
        // resume() fired essentially on the click, not seconds later.
        expect(audio.firstResumeAt - clickAt).toBeLessThan(2500);
      }
    }

    // Scroll still not frozen mid-cinema.
    const inlineOverflow = await page.evaluate(() => document.documentElement.style.overflow);
    expect(inlineOverflow).not.toBe('hidden');
  });

  test('caption advances through all 5 segments then seals', async ({ page }) => {
    test.setTimeout(90_000);
    await instrumentAudio(page);
    await page.goto(GATE_URL);
    await enterButton(page).click();

    const heads = [
      'The Singularity is Near.',
      '11 Cognitive Cores',
      'U-AI Engine',
      '5 Systems & 3 Pillars',
      'The Sovereign Intelligence is Awakening.',
    ];
    for (const h of heads) {
      await expect(page.getByRole('heading', { name: h })).toBeVisible({ timeout: 12_000 });
    }

    // After 30s the curtain lands on the sealed COMING SOON screen.
    await expect(page.getByRole('heading', { name: 'COMING SOON' })).toBeVisible({ timeout: 15_000 });
  });
});
