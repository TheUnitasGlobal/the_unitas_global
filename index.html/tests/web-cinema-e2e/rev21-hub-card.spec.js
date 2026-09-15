const { test, expect } = require('@playwright/test');

// REV-23 M2.3 SUPERSEDES REV-21 §1D. The whole card WAS the hitbox: a click
// anywhere in it -- padding, gaps, corners -- opened that slot's deep dive,
// and a shortcut arrow in the top-right corner opened it a second way. The
// founder's 2026-09-13 directive removes both: only the TITLE is a target,
// and it takes two steps (first click selects, second opens). The tests
// below assert that inverted contract -- the corners must NOT open -- while
// §1.4 (held on close) and §2A.3 (scope order) are unchanged behaviours
// simply driven through the new gesture.
// SPEC §1.4 -- closing a deep modal pins the slot it was opened from
// (`held = openKey`), so the visitor never comes back out onto a different
// slot.
// SPEC §2.1 (§2A.3) -- the card renders its scope sections in order:
// data-scope="global" first, data-scope="country" second.

const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');
const card = (page) => page.locator('[data-live-hub] [data-slot-card]');

/** Longer than one rotation period (DISCOVERY_ROTATE_MS = 7000). */
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

/**
 * REV-23 M2.3: the title is the only way in, and it takes two clicks.
 *
 * REV-28: dispatched, not driven through Playwright's actionability path.
 * The discovery carousel ROTATES, so this title is a moving target, and
 * Playwright's stability check needs the same bounding box across two
 * consecutive animation frames. On this harness's WebKit a frame costs
 * 555-698ms (measured by the REV-26 render probe), so that check takes over a
 * second -- long enough for the rotation to swap the card underneath it, which
 * is exactly what the failure said: `element was detached from the DOM`. A
 * bigger budget cannot win that race; it already had three minutes. Dispatching
 * the click is the pattern this repository already uses for carousel elements
 * (rev15-cluster-popout, rev17-entry-checkout), and it changes nothing about
 * what is asserted -- the two-step contract is still two clicks, and
 * `data-selected` is still checked between them.
 */
async function openViaTitle(page, slot) {
  const title = page.locator(`[data-slot-card="${slot}"] .qw-hub-card-title .qw-two-step-hit`);
  await expect(title).toBeVisible({ timeout: 20_000 });
  const dispatch = () =>
    page.evaluate(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`no two-step hit for ${sel}`);
        el.click();
      },
      `[data-slot-card="${slot}"] .qw-hub-card-title .qw-two-step-hit`,
    );
  await dispatch();
  await expect(title).toHaveAttribute('data-selected', '1', { timeout: 20_000 });
  await dispatch();
}

test.describe('REV-23 M2.3 title-only, two-step hitbox', () => {
  test('the corners and the padding no longer open anything', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'history');

    // The exact spots that used to open it. 4px inside each edge is still the
    // card root (its own padding is 16px), never an inner control.
    const spots = [
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
      await page.waitForTimeout(600);
      await expect(page.locator('#feed-deep-title'), `${name} must NOT open anything`).toHaveCount(0);
    }
    // And the shortcut arrow that offered a third way in is gone.
    await expect(page.locator('[data-slot-card="history"] button[aria-label]')).toHaveCount(0);
  });

  test('the title opens it on the SECOND click, never the first', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'history');
    const title = page.locator('[data-slot-card="history"] .qw-hub-card-title .qw-two-step-hit');
    await expect(title).toBeVisible({ timeout: 20_000 });
    await title.click();
    await expect(title).toHaveAttribute('data-selected', '1');
    await page.waitForTimeout(400);
    await expect(page.locator('#feed-deep-title')).toHaveCount(0);
    await title.click();
    await expect(page.locator('#feed-deep-title')).toBeVisible({ timeout: 8_000 });
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#feed-deep-title')).toHaveCount(0);
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
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

  test('the keyboard follows the same two steps on the title, not the card', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'history');
    // The card container itself no longer answers Enter.
    await card(page).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('#feed-deep-title')).toHaveCount(0);
    // The title does -- on the second press.
    const title = page.locator('[data-slot-card="history"] .qw-hub-card-title .qw-two-step-hit');
    await title.focus();
    await page.keyboard.press('Enter');
    await expect(title).toHaveAttribute('data-selected', '1');
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
    // freely rotating carousel. M2.3: opened through the title's two steps.
    const liveSlot = await card(page).getAttribute('data-slot-card');
    await openViaTitle(page, liveSlot);
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

  // REV-23 M3.1 removed the nine news slots, which were the two-scope ones;
  // `fx` (the world rate, then the visitor's own currency) is the survivor.
  test('a two-scope slot renders global before country, never country alone', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'fx');
    const group = page.locator('[data-slot-card="fx"] [data-scope]');
    await expect(group.first()).toBeVisible({ timeout: 20_000 });
    const scopes = await group.evaluateAll((els) => els.map((el) => el.getAttribute('data-scope')));
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes[0]).toBe('global');
    expect(scopes).toEqual([...scopes].sort((a, b) => (a === b ? 0 : a === 'global' ? -1 : 1)));
  });
});
