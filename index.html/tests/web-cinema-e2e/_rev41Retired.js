// @ts-check
const { expect } = require('@playwright/test');

// REV-41 D-7 (founder directive 2026-09-17, mission 1-F): the REV-35 M1
// U-Ranking seat on the discovery rail -- the slot chip, its card, its
// `uRanking` slot kind, its deep modal (`#uranking-deep-title`) and that
// modal's body -- was DELETED from the registry, not hidden. This is the one
// list of its DOM hooks, so every spec that sweeps for it sweeps for the same
// set and a resurrected surface fails everywhere at once (the REV-35 pattern,
// _rev35Retired.js, which stays for the ranking slots IT retired).
//
// U-Square's own 유랭킹 (`data-square-theme="uRanking"`, `[data-hub-rankings]`,
// `[data-urank-rail]` inside the square) is a DIFFERENT surface and stays --
// none of its hooks may ever appear in this list.
const RETIRED_URANKING_SELECTORS = Object.freeze([
  '[data-slot="uRanking"]',
  '[data-slot-card="uRanking"]',
  '[data-slot-kind="uRanking"]',
  '#uranking-deep-title',
  '[data-slot-modal="uRanking"]',
]);

/** D-7 zero sweep: none of the retired U-Ranking rail surfaces may exist as
 *  a DOM node, whichever layer (hub, deep modal, entry popup) is open. */
async function expectRetiredURankingGone(page) {
  for (const selector of RETIRED_URANKING_SELECTORS) {
    await expect(page.locator(selector), `${selector} was retired by REV-41 D-7`).toHaveCount(0);
  }
}

module.exports = { RETIRED_URANKING_SELECTORS, expectRetiredURankingGone };
