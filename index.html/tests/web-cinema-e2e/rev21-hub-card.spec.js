const { test, expect } = require('@playwright/test');

// REV-21 SPEC.md §1.5 (§1D) -- the WHOLE card is the hitbox: a click at the
// centre or at ANY of the four corners opens that slot's deep dive, and the
// inner controls that stop propagation never double-fire.
// SPEC §1.4 -- closing a deep modal pins the slot it was opened from
// (`held = openKey`), so the visitor never comes back out onto a different
// slot.
// SPEC §2.1 (§2A.3) -- the card renders its scope sections in order:
// data-scope="global" first, data-scope="country" second.

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');
const card = (page) => page.locator('[data-live-hub] [data-slot-card]');

/** Longer than one rotation period (HUB_ROTATE_MS = 7000). */
const PAST_ONE_ROTATION_MS = 8_200;

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

/** The card's rectangle clipped to the viewport -- the part a visitor can
 *  actually click. Returns `{x, y, width, height, bottom}`. */
async function visibleBox(page) {
  return page.evaluate(() => {
    const r = document.querySelector('[data-live-hub] [data-slot-card]').getBoundingClientRect();
    const bottom = Math.min(r.bottom, window.innerHeight);
    const right = Math.min(r.right, window.innerWidth);
    const x = Math.max(r.x, 0);
    const y = Math.max(r.y, 0);
    return { x, y, width: right - x, height: bottom - y, bottom };
  });
}

/** Pin one slot so which deep modal opens is never a race with the clock. */
async function pin(page, slot) {
  await page.locator(`[data-slot="${slot}"]`).click();
  await page.waitForTimeout(500);
  await expect(page.locator(`[data-slot-card="${slot}"]`)).toBeVisible();
}

test.beforeEach(async ({ browserName }) => {
  test.slow(browserName === 'webkit', 'headless WebKit software WebGL');
});

test.describe('REV-21 §1D whole-card hitbox', () => {
  test('the centre and all four corners of the card open the deep dive', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'history');

    // 4px inside each edge: still the card root (its own padding is 16px),
    // never an inner control. Measured 2026-09-13: on a 1280x720 desktop the
    // card runs to y=726, i.e. its last 6px sit BELOW the fold (the home is a
    // single non-scrolling viewport), so the corners are taken on the card's
    // visible rectangle -- what a visitor can actually reach.
    // The "centre" is taken on the title line, not the geometric middle: on a
    // phone the middle of the card is an item headline, and §1.5 reserves
    // those (and the arrow, the sub-tabs, the ranking rows) for their own
    // action -- see the double-fire test below.
    const spots = [
      ['title line', (b) => ({ x: b.x + b.width / 2, y: b.y + 28 })],
      ['top-left', (b) => ({ x: b.x + 4, y: b.y + 4 })],
      ['top-right', (b) => ({ x: b.x + b.width - 4, y: b.y + 4 })],
      ['bottom-left', (b) => ({ x: b.x + 4, y: b.bottom - 4 })],
      ['bottom-right', (b) => ({ x: b.x + b.width - 4, y: b.bottom - 4 })],
    ];

    for (const [name, at] of spots) {
      const box = await visibleBox(page);
      const { x, y } = at(box);
      // Self-check: the point must really be on the card (a clipped or
      // occluded corner would otherwise "pass" by clicking something else).
      const onCard = await page.evaluate(
        ([px, py]) => {
          const el = document.elementFromPoint(px, py);
          const root = document.querySelector('[data-live-hub] [data-slot-card]');
          if (!el || !root || !(el === root || root.contains(el))) return 'off-card';
          // ...and on card CHROME, not on one of the controls §1.5 reserves.
          return el.closest('button, a') && el.closest('button, a') !== root ? 'on-control' : 'ok';
        },
        [x, y],
      );
      expect(onCard, `${name} must land on the card chrome`).toBe('ok');
      await page.mouse.click(x, y);
      await expect(page.locator('#feed-deep-title'), `${name} must open the deep dive`).toBeVisible({ timeout: 8_000 });
      await page.goBack();
      await page.waitForTimeout(500);
      await expect(page.locator('#feed-deep-title')).toHaveCount(0);
      await expect(page.locator('#exit-guard-title')).toHaveCount(0);
    }
  });

  test('an item headline does its own thing and does NOT also open the card (no double fire)', async ({ page, context }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'history');
    const headline = page.locator('[data-slot-card="history"] .qw-hub-headline').first();
    await expect(headline).toBeVisible({ timeout: 20_000 });

    // §1.5: the item stops propagation -- its outbound article opens, and the
    // card's own deep dive must NOT open underneath it.
    const popup = context.waitForEvent('page', { timeout: 8_000 }).catch(() => null);
    await headline.click();
    const opened = await popup;
    await page.waitForTimeout(800);
    await expect(page.locator('#feed-deep-title')).toHaveCount(0);
    if (opened) await opened.close();
  });

  test('the card answers Enter and Space as a button', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'history');
    await card(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#feed-deep-title')).toBeVisible({ timeout: 8_000 });
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#feed-deep-title')).toHaveCount(0);
  });
});

test.describe('REV-21 §1.4 held on close', () => {
  test('closing the deep modal pins the slot it was opened from, past a full rotation period', async ({ page }) => {
    await reachHome(page);
    await openHub(page);

    // Deliberately do NOT pin first: this is about a modal opened from a
    // freely rotating carousel.
    await page.evaluate(() => {
      const b = document.querySelector('[data-slot-card] button[aria-label]');
      b && b.click();
    });
    await page.waitForTimeout(600);
    const opened = await card(page).getAttribute('data-slot-card');
    expect(opened).toBeTruthy();

    await page.goBack();
    await page.waitForTimeout(600);
    // The slot the visitor came from is still the one on screen...
    expect(await card(page).getAttribute('data-slot-card')).toBe(opened);
    // ...and the rail says so (progress bar in its held state).
    await expect(page.locator('[data-live-hub] .qw-hub-progress[data-held="1"]')).toHaveCount(1);

    // Past one full rotation period it has still not moved.
    await page.waitForTimeout(PAST_ONE_ROTATION_MS);
    expect(await card(page).getAttribute('data-slot-card')).toBe(opened);
  });
});

test.describe('REV-21 §2A.3 scope sections', () => {
  test('a country-only slot renders one country section', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'weather');
    const group = page.locator('[data-slot-card="weather"] [data-scope]');
    await expect(group.first()).toBeVisible({ timeout: 20_000 });
    await expect(group).toHaveCount(1);
    await expect(group.first()).toHaveAttribute('data-scope', 'country');
  });

  test('a two-scope slot renders global before country, never country alone', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'game');
    const group = page.locator('[data-slot-card="game"] [data-scope]');
    await expect(group.first()).toBeVisible({ timeout: 20_000 });
    const scopes = await group.evaluateAll((els) => els.map((el) => el.getAttribute('data-scope')));
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes[0]).toBe('global');
    expect(scopes).toEqual([...scopes].sort((a, b) => (a === b ? 0 : a === 'global' ? -1 : 1)));
  });
});
