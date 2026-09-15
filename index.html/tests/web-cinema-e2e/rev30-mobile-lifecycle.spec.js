// REV-30 MISSION 2 -- the mobile lifecycle of the two popups, measured with
// real touch events on a real mobile viewport.
//
// WHY THIS FILE EXISTS. REV-29 M1 made one promise that only a touch device
// can test: the virtual keyboard opens for a touch IN the text box and for
// nothing else, while the popup underneath stays open. rev29-verify proves
// the single tap-a-chip case. What was never measured is the LIFECYCLE --
// what happens across a sequence: type, clear, open the hub, switch a tab,
// scroll a room, send a message, close the hub, come back to the bar. Each
// step can restore focus (and therefore the keyboard) or tear the popup down,
// and a defect in step six is invisible to a test that only does step one.
//
// The whole suite is touch-gated: a desktop project has no keyboard to
// dismiss and `page.tap()` needs `hasTouch`. Two cross-engine checks at the
// end run everywhere, because a popup that survives the hub is a claim that
// should hold on a mouse too.
const { test, expect } = require('@playwright/test');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const { collapseSovereignPanel, walkCurtain, settleSurface } = require('./_rev25Home');

const FOUNDER_URL = `/?sovereign_auth=${TOKEN}&splash=0&dev=skip`;

const input = (page) => page.locator('#omni-synapse-search input[type="text"]');
const strip = (page) => page.locator('[data-news-scope="empty-only"]');
const hub = (page) => page.locator('[role="dialog"] [data-unitas-hub]');

async function founderHome(page) {
  await collapseSovereignPanel(page);
  await page.goto(FOUNDER_URL, { waitUntil: 'domcontentloaded' });
  await walkCurtain(page);
  await settleSurface(page);
}

/** Is the search box the active element right now? That IS the keyboard. */
function boxFocused(page) {
  return page.evaluate(() => document.activeElement === document.querySelector('#omni-synapse-search input[type="text"]'));
}

test.describe('REV-30 M2 -- the search popup across a whole touch session', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch lifecycle -- mobile projects only');

  test('type, clear, and the popup never loses its place or re-raises the keyboard uninvited', async ({ page }) => {
    await founderHome(page);

    // 1. A tap in the box: popup open, keyboard up.
    await input(page).tap();
    await expect(strip(page)).toBeVisible();
    expect(await boxFocused(page), 'a tap in the box focuses it').toBe(true);

    // 2. Typing swaps the empty-box strip for the typing dropdown. The box
    //    keeps focus throughout -- the visitor is typing.
    await page.keyboard.type('seoul');
    await expect(page.locator('.qw-search-dropdown')).toBeVisible();
    await expect(strip(page)).toHaveCount(0);
    expect(await boxFocused(page)).toBe(true);

    // 3. Clearing by hand returns the strip, still focused.
    await input(page).fill('');
    await expect(strip(page)).toBeVisible();
    expect(await boxFocused(page)).toBe(true);

    // 4. A tap on a news chip drops the keyboard and KEEPS the popup.
    await page.locator('[data-news-axes] [data-axis]').first().tap();
    await page.waitForTimeout(300);
    expect(await boxFocused(page), 'a tap outside the box drops the keyboard').toBe(false);
    await expect(strip(page)).toBeVisible();

    // 5. A tap on a shortcut chip, with the keyboard already down, must not
    //    bring it back -- this is the step a naive "refocus the input" fix
    //    breaks.
    await page.locator('[data-live-hub] .qw-hub-strip [data-slot]').nth(1).tap();
    await page.waitForTimeout(300);
    expect(await boxFocused(page)).toBe(false);
    await expect(strip(page)).toBeVisible();

    // 6. Back in the box on purpose: the keyboard returns.
    await input(page).tap();
    expect(await boxFocused(page)).toBe(true);
  });

  test('a tap on the page outside the search surface closes the popup', async ({ page }) => {
    await founderHome(page);
    await input(page).tap();
    await expect(strip(page)).toBeVisible();
    // Drop the keyboard first: this is the state where the ordinary blur
    // path is NOT what closes the popup, so the outside-tap listener is.
    await page.locator('[data-news-axes] [data-axis]').first().tap();
    await page.waitForTimeout(300);
    expect(await boxFocused(page)).toBe(false);
    await expect(strip(page)).toBeVisible();

    await page.locator('.qw-hero-wrap h1').tap();
    await expect(strip(page)).toHaveCount(0);
  });
});

test.describe('REV-30 M2 -- the UNITAS hub popup on touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch lifecycle -- mobile projects only');

  test('opens without the keyboard, survives tab and room switching, and closes back to a live bar', async ({ page }) => {
    await founderHome(page);
    await input(page).tap();
    await expect(strip(page)).toBeVisible();

    // Opening the hub is not a text interaction: the keyboard goes down and
    // stays down for everything inside it.
    await page.locator('[data-unitas-hub-toggle]').tap();
    await expect(hub(page)).toBeVisible();
    expect(await boxFocused(page), 'opening the hub must not hold the keyboard').toBe(false);

    // Every tab switch: panel changes, hub stays, keyboard stays down.
    for (const tab of ['shorts', 'rankings', 'rooms', 'social', 'exchange']) {
      await hub(page).locator(`[data-hub-tab-btn="${tab}"]`).tap();
      await expect(page.locator(`[data-hub-panel="${tab}"]`)).toBeVisible();
      expect(await boxFocused(page), `tab ${tab} must not raise the keyboard`).toBe(false);
    }

    // Rooms: switching rooms is a chip tap inside a portal -- neither the
    // hub nor the popup beneath it may notice.
    await hub(page).locator('[data-hub-tab-btn="rooms"]').tap();
    const rooms = hub(page).locator('[data-hub-room-rail] [data-room]');
    await expect(rooms.first()).toBeVisible();
    await rooms.nth(3).tap();
    await expect(hub(page)).toBeVisible();
    await rooms.nth(7).tap();
    await expect(hub(page)).toBeVisible();
    expect(await boxFocused(page)).toBe(false);

    // The room composer is the ONE text box inside the hub: tapping it is a
    // deliberate text interaction and the keyboard is allowed back.
    await hub(page).locator('[data-hub-room-input]').tap();
    const composerFocused = await page.evaluate(() =>
      document.activeElement === document.querySelector('[data-hub-room-input]'),
    );
    expect(composerFocused, 'the composer is a text box and may take focus').toBe(true);
    expect(await boxFocused(page), 'but the SEARCH box must not steal it back').toBe(false);

    // Close: the hub goes, the search popup underneath is still there, and
    // the bar is usable again.
    await page.locator('[role="dialog"] button[aria-label="Close"]').first().tap();
    await expect(hub(page)).toHaveCount(0);
    await expect(strip(page)).toBeVisible();
    await input(page).tap();
    expect(await boxFocused(page)).toBe(true);
  });

  test('the device back gesture closes the hub and only the hub', async ({ page }) => {
    await founderHome(page);
    await input(page).tap();
    await page.locator('[data-unitas-hub-toggle]').tap();
    await expect(hub(page)).toBeVisible();

    // One history level for the dialog (REV-19 §1): back closes it and lands
    // on the popup, not on the home screen.
    await page.goBack();
    await expect(hub(page)).toHaveCount(0);
    await expect(strip(page)).toBeVisible();
  });

  test('the room list scrolls inside the hub without dismissing anything', async ({ page }) => {
    await founderHome(page);
    await input(page).tap();
    await page.locator('[data-unitas-hub-toggle]').tap();
    await hub(page).locator('[data-hub-tab-btn="rooms"]').tap();
    const list = hub(page).locator('[data-hub-room-list]');
    await expect(list).toBeVisible();

    // A touch scroll inside a portaled, overflow-contained list is exactly
    // the gesture that an over-eager outside-tap listener eats.
    await list.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(200);
    await expect(hub(page)).toBeVisible();
    await expect(strip(page)).toBeVisible();
  });

  test('the attach shortcut survives a touch pick and releases when nothing is attached', async ({ page }) => {
    await founderHome(page);
    await input(page).tap();
    await page.locator('[data-attach-toggle]').tap();
    await expect(page.locator('[data-attach-menu]')).toBeVisible();
    expect(await boxFocused(page), 'opening the attach menu is not a text interaction').toBe(false);

    await page.locator('[data-attach-item="sketch"]').tap();
    const toggle = page.locator('[data-attach-toggle]');
    await expect(toggle).toHaveAttribute('data-active', '1');
    await expect(toggle).toHaveAttribute('data-attach-active', 'sketch');

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('data-active', '0');
    // And the popup that was open the whole time is still open.
    await expect(strip(page)).toBeVisible();
  });
});

test.describe('REV-30 M2 -- the hub ledger states, every engine', () => {
  test('a signed-out visitor is told plainly that the device holds the record', async ({ page }) => {
    await founderHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    await page.locator('[data-unitas-hub-toggle]').click();
    await expect(hub(page)).toBeVisible();
    // REV-30 M1 decision 3: no session means the device ledger, and the UI
    // says so rather than implying the purchase reached an account.
    const badge = hub(page).locator('[data-hub-ledger]');
    await expect(badge).toBeVisible();
    await expect.poll(async () => badge.getAttribute('data-hub-ledger'), { timeout: 15_000 }).toBe('device');
  });

  test('a room states whether its messages survive this device', async ({ page }) => {
    await founderHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    await page.locator('[data-unitas-hub-toggle]').click();
    await hub(page).locator('[data-hub-tab-btn="rooms"]').click();
    const durable = hub(page).locator('[data-hub-durable]');
    await expect(durable).toBeVisible();
    // Signed out in this harness: device-only, and it says it.
    await expect(durable).toHaveAttribute('data-hub-durable', '0');
  });

  test('the hub never leaves a stray dialog behind after a close', async ({ page }) => {
    await founderHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').click();
    await page.locator('[data-unitas-hub-toggle]').click();
    await expect(hub(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(hub(page)).toHaveCount(0);
    // The search popup owns no dialog of its own at this level -- a leftover
    // here is the "다중 팝업" defect REV-19 closed, back again.
    expect(await page.locator('[role="dialog"]').count()).toBe(0);
    await expect(page.locator('[data-unitas-hub-toggle]')).toHaveAttribute('data-active', '0');
  });
});
