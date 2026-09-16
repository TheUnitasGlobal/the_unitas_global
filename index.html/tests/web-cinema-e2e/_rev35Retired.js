// @ts-check
const { expect } = require('@playwright/test');

// REV-35 M1 (founder directive 2026-09-16, D-2/D-8): the REV-21 world-ranking
// slot, the REV-29 module-ranking slot, their deep modals and their detail
// popups were DELETED from the codebase, not hidden. This is the one list of
// their DOM hooks, so every spec that sweeps for them sweeps for the same
// set and a resurrected surface fails everywhere at once.
const RETIRED_RANKING_SELECTORS = Object.freeze([
  '[data-slot="worldRanking"]',
  '[data-slot="unitasRanking"]',
  '#ranking-deep-title',
  '#global-ranking-detail-title',
  '#unitas-ranking-profile-title',
  '[data-global-rankings]',
  '[data-unitas-rankings]',
  '[data-ranking-modal]',
  '[data-ranking-detail]',
]);

/** D-8 zero sweep: none of the retired ranking surfaces may exist as a DOM
 *  node, whichever layer (hub, deep modal, entry popup) is open right now. */
async function expectRetiredRankingsGone(page) {
  for (const selector of RETIRED_RANKING_SELECTORS) {
    await expect(page.locator(selector), `${selector} was retired by REV-35 M1`).toHaveCount(0);
  }
}

module.exports = { RETIRED_RANKING_SELECTORS, expectRetiredRankingsGone };
