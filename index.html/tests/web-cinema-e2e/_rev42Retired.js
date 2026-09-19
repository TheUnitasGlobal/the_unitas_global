// @ts-check
const { expect } = require('@playwright/test');

// REV-42 D-1 (founder directive 2026-09-18, mission 0): the REV-20 `air`
// ("공기") seat on the discovery rail -- the slot chip, its rotating card and
// its feed deep modal -- was DELETED from the registry
// (lib/live/discoverySlots.ts), not hidden: its Open-Meteo air-quality
// reading now lives inside the WEATHER deep panel's air block (D-4,
// `[data-weather-air]`), which is a different surface and stays. This is the
// one list of the retired DOM hooks, so every spec that sweeps for them
// sweeps for the same set and a resurrected seat fails everywhere at once
// (the _rev35Retired / _rev41Retired pattern, both of which stay for the
// surfaces THEY retired).
const RETIRED_AIR_SELECTORS = Object.freeze([
  '[data-slot="air"]',
  '[data-slot-card="air"]',
  '[data-feed-modal="air"]',
]);

/** D-1 zero sweep: none of the retired air rail surfaces may exist as a DOM
 *  node, whichever layer (hub, deep modal, entry popup) is open. */
async function expectRetiredAirGone(page) {
  for (const selector of RETIRED_AIR_SELECTORS) {
    await expect(page.locator(selector), `${selector} was retired by REV-42 D-1`).toHaveCount(0);
  }
}

module.exports = { RETIRED_AIR_SELECTORS, expectRetiredAirGone };
