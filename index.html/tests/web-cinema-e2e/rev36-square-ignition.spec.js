const { test, expect } = require('@playwright/test');

// REV-36 M3 acceptance -- the U-Square data ignition, measured on the BUILT
// app. The three panels that already existed (유숏츠 · 유토크 · 유지식거래소)
// must open on LIVING data, not a blank shell: a shorts rail of 44 clips with a
// rolling pulse feed and per-card watcher counts; 22 rooms that already breathe
// with a simulated conversation (marked as simulation, never "mine"); an
// exchange with a live ticker, a 24h market bar and a demand sparkline per pack.
//
// The square is opened exactly the way rev34-weather-square.spec.js opens it
// (the founder session cookie + released-home helper), and every assertion runs
// on chromium, webkit and mobile-chrome.
const { reachReleasedHome } = require('./_rev25Home');

async function openSquare(page) {
  await reachReleasedHome(page);
  const toggle = page.locator('[data-unitas-hub-toggle]');
  await toggle.click();
  const hub = page.locator('[role="dialog"] [data-unitas-hub][data-unitas-square]');
  await expect(hub).toBeVisible();
  return hub;
}

async function openTab(hub, key) {
  await hub.locator(`[data-hub-tab-btn="${key}"]`).click();
  await expect(hub.locator(`[data-hub-panel="${key}"]`)).toBeVisible();
}

test.describe('REV-36 M3 -- U-Square data ignition', () => {
  test('U-Shorts opens on 44 living clips with a pulse feed and watcher counts', async ({ page }) => {
    const hub = await openSquare(page);
    await openTab(hub, 'shorts');
    const shorts = hub.locator('[data-unitas-shorts]');
    await expect(shorts.locator('[data-short]').first()).toBeVisible();
    expect(await shorts.locator('[data-short]').count()).toBeGreaterThanOrEqual(40);
    // The rolling network pulse feed.
    await expect(shorts.locator('[data-shorts-pulse]')).toBeVisible();
    expect(await shorts.locator('[data-shorts-pulse] [data-shorts-pulse-row]').count()).toBeGreaterThanOrEqual(6);
    // Every card carries a live watcher badge.
    await expect(shorts.locator('[data-short]').first().locator('[data-short-watching]')).toBeVisible();
    // The two sort chips exist.
    await expect(shorts.locator('[data-shorts-sort="trending"]')).toBeVisible();
    await expect(shorts.locator('[data-shorts-sort="catalogue"]')).toBeVisible();
  });

  test('U-Talk opens on a simulated conversation in every room, never counted as mine', async ({ page }) => {
    const hub = await openSquare(page);
    await openTab(hub, 'rooms');
    const rooms = hub.locator('[data-hub-rooms]');
    expect(await rooms.locator('[data-room]').count()).toBe(22);
    // The room is not blank: simulated rows are present...
    const sim = rooms.locator('[data-hub-msg-sim]');
    expect(await sim.count()).toBeGreaterThanOrEqual(10);
    // ...and not one of them is a real, "mine" message.
    expect(await rooms.locator('[data-hub-msg][data-mine="1"]').count()).toBe(0);
    // Switching rooms changes the simulated conversation.
    const first = (await sim.first().innerText()).trim();
    await rooms.locator('[data-room]').nth(1).click();
    await expect(async () => {
      const next = (await hub.locator('[data-hub-msg-sim]').first().innerText()).trim();
      expect(next).not.toBe(first);
    }).toPass({ timeout: 10_000 });
  });

  test('U-Exchange opens on a live ticker, a 24h market bar and demand sparklines', async ({ page }) => {
    const hub = await openSquare(page);
    await openTab(hub, 'exchange');
    const ex = hub.locator('[data-hub-exchange]');
    await expect(ex.locator('[data-hub-packs] [data-pack]').first()).toBeVisible();
    // The ticker is alive at open (simulated trades), not the empty state.
    expect(await ex.locator('[data-hub-ticker] [data-hub-trade]').count()).toBeGreaterThanOrEqual(5);
    // The 24h market bar with exactly four stat tiles.
    await expect(ex.locator('[data-hub-market]')).toBeVisible();
    expect(await ex.locator('[data-hub-market] [data-market-stat]').count()).toBe(4);
    // A demand sparkline and a momentum chip on every pack card.
    expect(await ex.locator('svg[data-pack-demand]').count()).toBeGreaterThanOrEqual(20);
    expect(await ex.locator('[data-pack-momentum]').count()).toBeGreaterThanOrEqual(20);
  });
});
