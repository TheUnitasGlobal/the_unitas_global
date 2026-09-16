'use client';

import { URankingsShorts } from './URankingsShorts';

/**
 * REV-29 MISSION 4 hub ranking panel, rewritten in REV-34 MISSION 4-C
 * (founder directive 2026-09-16): the "실시간 세계 랭킹" tab is gone from the
 * hub for good and "실시간 유니타스 랭킹" became 유랭킹 -- the UNITAS-ecosystem
 * leaderboard in the shorts skin (URankingsShorts.tsx). This wrapper survives
 * only to keep the `data-hub-rankings` root the E2E hub contract expects
 * (rev29-verify L242). REV-35 M1: the same rail is now every other ranking
 * surface too (discovery carousel card + deep modal, U-AI stream); the
 * legacy world / module ranking panels are deleted.
 */
export function HubRankings() {
  return (
    <div data-hub-rankings="">
      <URankingsShorts />
    </div>
  );
}
