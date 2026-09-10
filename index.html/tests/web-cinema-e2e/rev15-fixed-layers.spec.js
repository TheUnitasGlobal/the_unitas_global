const { test, expect } = require('@playwright/test');

// REV-15 root-cause regression guard (SPEC.md §1, §6-4): permanent E2E proof
// that `app/quantum-white.css`'s Quantum White `body` rule never again
// declares `filter` (or any other property that makes an element the CSS
// containing block for its `position: fixed` descendants). The field bug
// this exists to catch: `html[data-unitas-surface='quantum-white'] body {
// filter: brightness(var(--qw-lum)) }` made `<body>` the containing block
// for EVERY fixed layer in the app -- the pre-launch curtain, `#unitas-nav`,
// the parallax `.qw-void` background, every `ModalPortal` dialog -- so on a
// 667px-tall iPhone SE the curtain measured 1702px tall (the full document
// height) instead of one viewport, and every one of those layers dragged
// along with ordinary page scroll instead of staying pinned.
// `__tests__/quantumWhite/rev15FixedLayerGuard.test.ts` catches this
// statically in the stylesheet text; this file catches it live, in a real
// browser, against the actual rendered layout -- the two are complementary,
// not redundant (a static text scan can't see computed geometry, and a
// live-DOM check can't run in `vitest`'s jsdom-free unit environment).
//
// Split from `cinema-flow.spec.js`/`founder-bypass.spec.js` (REV-15 SPEC.md
// §7 -- new file, not an edit to those) so this guard's intent stays
// legible on its own and isn't buried inside unrelated cinema/founder
// assertions.

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

/** Collapses the founder-only debug console before it can ever render (its
 *  expanded form is a `left-4 top-24` panel that would otherwise intercept
 *  clicks in the founder-path tests below) -- the same sessionStorage flag
 *  `components/sovereign/SovereignDebugPanel.tsx` itself reads on mount, so
 *  this reproduces a founder who already collapsed it, not a test hack. */
async function collapseDebugConsole(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
    } catch {
      /* no-op */
    }
  });
}

test.describe('REV-15 fixed-layer containing block -- public visit', () => {
  for (const vp of [
    { name: '375x667 (iPhone SE)', viewport: { width: 375, height: 667 } },
    { name: '1366x650 (laptop)', viewport: { width: 1366, height: 650 } },
  ]) {
    test.describe(vp.name, () => {
      test.use({ viewport: vp.viewport });

      test('the curtain is exactly one viewport tall, never the full document height', async ({ page }) => {
        await page.goto('/en?splash=0');
        await page.waitForSelector('.cs-root', { timeout: 20_000 });
        await page.waitForTimeout(500);

        const { curtainHeight, innerHeight, bodyFilter } = await page.evaluate(() => {
          const curtain = document.querySelector('.cs-root');
          return {
            curtainHeight: curtain.getBoundingClientRect().height,
            innerHeight: window.innerHeight,
            bodyFilter: getComputedStyle(document.body).filter,
          };
        });

        expect(bodyFilter).toBe('none');
        expect(curtainHeight).toBeGreaterThanOrEqual(innerHeight - 1);
        expect(curtainHeight).toBeLessThanOrEqual(innerHeight + 1);
      });

      test('the ENTER button is reachable without scrolling', async ({ page }) => {
        await page.goto('/en?splash=0');
        await expect(enterButton(page)).toBeVisible({ timeout: 20_000 });
        await expect(enterButton(page)).toBeInViewport();
      });

      test('the curtain stays pinned to the viewport when the document scrolls', async ({ page }) => {
        await page.goto('/en?splash=0');
        await page.waitForSelector('.cs-root', { timeout: 20_000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(200);

        const top = await page.evaluate(() => document.querySelector('.cs-root').getBoundingClientRect().top);
        // A pre-REV-15 regression would report a large negative top here
        // (the curtain scrolling away with the document instead of staying
        // fixed to the viewport it covers).
        expect(top).toBe(0);
      });
    });
  }
});

test.describe('REV-15 fixed-layer containing block -- released home (founder path)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('#unitas-nav and the parallax background stay pinned to the viewport after release', async ({ page }) => {
    await collapseDebugConsole(page);
    await page.goto(`/en?sovereign_auth=${TOKEN}&splash=0`);
    await enterButton(page).click();
    await skipButton(page).click();
    await expect(page.getByRole('heading', { name: 'COMING SOON' })).toBeVisible({ timeout: 15_000 });
    await enterButton(page).click();
    await page.waitForSelector('.qw-cluster-card', { timeout: 30_000 });
    await page.waitForTimeout(800);

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(200);

    const geometry = await page.evaluate(() => {
      const nav = document.getElementById('unitas-nav');
      const voidLayer = document.querySelector('.qw-void');
      return {
        navTop: nav.getBoundingClientRect().top,
        voidHeight: voidLayer ? voidLayer.getBoundingClientRect().height : null,
        innerHeight: window.innerHeight,
        bodyFilter: getComputedStyle(document.body).filter,
      };
    });

    expect(geometry.bodyFilter).toBe('none');
    // The nav is `position: fixed` -- it must stay at the top of the
    // VIEWPORT, not scroll away with the page content beneath it.
    expect(geometry.navTop).toBe(0);
    // The parallax background is also `position: fixed`; pre-REV-15 it
    // measured the full (scrollable) document height instead of one screen.
    if (geometry.voidHeight !== null) {
      expect(geometry.voidHeight).toBeLessThanOrEqual(geometry.innerHeight + 1);
    }
  });

  test('the sealed screen never scrolls, at portrait or short-landscape aspect', async ({ page }) => {
    await collapseDebugConsole(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(`/en?sovereign_auth=${TOKEN}&splash=0`);
    await enterButton(page).click();
    await skipButton(page).click();
    await expect(page.getByRole('heading', { name: 'COMING SOON' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);

    // Short-landscape founder door (SPEC.md §2.4): the door drops out of its
    // portrait pinned-bottom slot into normal flow below this breakpoint,
    // so it must never overlap the in-flow COMING SOON / wordmark stack.
    const overlap = await page.evaluate(() => {
      const sealed = document.querySelector('.cs-sealed');
      const corpLine = sealed.querySelector('p.mt-3');
      const door = sealed.querySelector('.cs-founder-door');
      const corpRect = corpLine.getBoundingClientRect();
      const doorRect = door.getBoundingClientRect();
      return {
        overflow: sealed.scrollHeight - sealed.clientHeight,
        corpBottom: corpRect.bottom,
        doorTop: doorRect.top,
        doorVisible: doorRect.bottom > doorRect.top && doorRect.width > 0,
      };
    });

    expect(overlap.overflow).toBeLessThanOrEqual(1);
    expect(overlap.doorVisible).toBe(true);
    expect(overlap.doorTop).toBeGreaterThanOrEqual(overlap.corpBottom - 1);
  });
});
