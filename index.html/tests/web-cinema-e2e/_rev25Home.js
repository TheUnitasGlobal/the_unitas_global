// Shared entry for the REV-25 specs: reach the released Quantum White home on
// ANY engine and ANY viewport.
//
// This exists because REV-24's helper (`goto('/?sovereign_auth=...&splash=0&dev=skip')`
// then wait for the search bar) is a CHROMIUM-DESKTOP helper and nothing else.
// Measured on the built app, 2026-09-13:
//
//  - on a Pixel 7 viewport the founder door does NOT dissolve the curtain:
//    `.cs-root` is still `opacity: 1`, `pointer-events: auto`, z-400 and
//    412x839 over the whole screen five seconds after `#omni-synapse-search`
//    reports "visible" -- so every click lands on the curtain. On desktop the
//    same URL leaves `.cs-root` absent. The entry gesture is a touch-viewport
//    requirement (the audio unlock), not a bug, and the project's own
//    rev15/rev17 helpers already walk it: ENTER -> SKIP -> COMING SOON -> ENTER.
//  - the sovereign debug console (`[data-sovereign-console]`, z-450, 272px
//    wide at left 16) covers the search bar on a 412px viewport. It is
//    collapsible, and the collapse flag is a sessionStorage key.
//  - `page.evaluate(() => document.fonts.ready)` resolves to a FontFaceSet,
//    which WebKit refuses to serialise. `.then(() => true)` is the fix.
//
// The walk is written as a bounded loop rather than a fixed sequence so the
// same call works where the curtain is skipped entirely.
const { expect } = require('@playwright/test');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');

const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

/**
 * Fold the founder's debug console away before the first paint. On a 412px
 * viewport it is 272px wide at left 16, z-450, and it covers the search bar
 * outright (measured) -- every click on the bar then lands on the panel.
 * Must be called BEFORE `goto`.
 */
async function collapseSovereignPanel(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
    } catch {
      /* private mode: the panel stays open, the walk still works */
    }
  });
}

/** Walk the entry curtain if this engine/viewport still shows one. */
async function walkCurtain(page, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await page.locator('.cs-root').count()) === 0) break;
    const skip = skipButton(page);
    if (await skip.isVisible().catch(() => false)) {
      await skip.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    const enter = enterButton(page);
    if (await enter.isVisible().catch(() => false)) {
      await enter.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(700);
      continue;
    }
    await page.waitForTimeout(400);
  }
}

/**
 * Wait until the page is worth measuring: the curtain gone (not merely
 * transparent), the white surface stamped -- it is applied by client JS after
 * hydration and the whole quantum-white token layer hangs off it -- and the
 * webfonts landed.
 */
async function settleSurface(page) {
  await page.waitForSelector('#omni-synapse-search', { state: 'visible', timeout: 45_000 });
  await expect(page.locator('.cs-root'), 'the curtain must be gone, not merely transparent').toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('data-unitas-surface', 'quantum-white', { timeout: 20_000 });
  // WebKit cannot serialise a FontFaceSet; resolve it to a boolean.
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.waitForTimeout(400);
}

async function reachReleasedHome(page, { locale = 'en', timeout = 60_000 } = {}) {
  await collapseSovereignPanel(page);
  // The locale is PINNED: `/` negotiates from Accept-Language, and a runner
  // on a Korean machine lands on `/ko` while CI lands on `/en`.
  // `dev=skip` dissolves the curtain outright where the engine allows it
  // (every desktop run, measured); the walk below covers the touch viewports
  // where it does not, so one call serves all three projects.
  await page.goto(`/${locale}?sovereign_auth=${TOKEN}&splash=0&dev=skip`, { waitUntil: 'domcontentloaded' });
  await walkCurtain(page, timeout);
  await settleSurface(page);
}

module.exports = { reachReleasedHome, collapseSovereignPanel, walkCurtain, settleSurface, enterButton, skipButton, TOKEN };
