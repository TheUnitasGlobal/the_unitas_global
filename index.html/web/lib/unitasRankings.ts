import { MODULE_REGISTRY, type ModuleRegistryEntry } from './module-registry';

export type UnitasRankingTier = 'sovereign' | 'platinum' | 'gold';

export interface UnitasRankingEntry {
  rank: number;
  handle: string;
  tier: UnitasRankingTier;
  score: number;
  bioIndex: number;
}

const ENTRIES_PER_MODULE = 10;
export const UNITAS_RANKING_BIO_COUNT = 6;

const HANDLE_PREFIXES = [
  'Nomad', 'Sovereign', 'Vector', 'Cipher', 'Aurora', 'Zenith', 'Nova', 'Echo',
  'Onyx', 'Solace', 'Quartz', 'Meridian', 'Lumen', 'Terra', 'Astra', 'Kinetic',
] as const;

/** Deterministic FNV-1a string hash -- the seed source for everything below,
 *  so the leaderboard renders identically on the server and the client (no
 *  Math.random hydration mismatch) and stays stable across re-renders. */
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG seeded from hashString -- fast and deterministic; good
 *  enough for cosmetic leaderboard flavor, not used for anything security- or
 *  fairness-sensitive. */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tierForRank(rank: number): UnitasRankingTier {
  if (rank === 1) return 'sovereign';
  if (rank <= 3) return 'platinum';
  return 'gold';
}

/**
 * "실시간 유니타스 랭킹" (owner instruction 2026-09-04 round 2): a
 * cross-module leaderboard shown both inside the U-AI report popup and at the
 * bottom of the home page. Deliberately NOT wired to `profiles`/`wallets` --
 * this repo's Zero-Trust identity rules (see CLAUDE.md) treat real user
 * records as sensitive, and there is no existing aggregate-activity pipeline
 * to rank real accounts on. A plausible, clearly pseudonymous leaderboard
 * (deterministic per module+rank, so it never shifts between renders or
 * hydration passes) delivers the requested UI without inventing a new PII
 * surface -- `UnitasRankings.disclaimer` in the message catalogs is always
 * rendered alongside it, saying so plainly.
 */
export function unitasRankingFor(module: ModuleRegistryEntry): UnitasRankingEntry[] {
  const moduleBias = hashString(module.key) % 900;
  const rows: UnitasRankingEntry[] = [];
  for (let rank = 1; rank <= ENTRIES_PER_MODULE; rank++) {
    const rand = mulberry32(hashString(`${module.key}::${rank}`));
    const prefix = HANDLE_PREFIXES[Math.floor(rand() * HANDLE_PREFIXES.length)];
    const suffix = 1000 + Math.floor(rand() * 9000);
    const jitter = Math.floor(rand() * 400);
    const score = Math.max(120, 48000 - rank * 1850 - jitter + moduleBias);
    rows.push({
      rank,
      handle: `${prefix}-${suffix}`,
      tier: tierForRank(rank),
      score,
      bioIndex: hashString(`${module.key}::${rank}::bio`) % UNITAS_RANKING_BIO_COUNT,
    });
  }
  return rows;
}

/** Which message namespace resolves a module's display title -- the 11
 *  ecosystems keep their own `Ecosystems` namespace, while both B2C and B2B
 *  catalogs share `Modules` (see B2CModuleCard.tsx / B2BProtocolCard.tsx). */
export function moduleTitleNamespace(module: ModuleRegistryEntry): 'Ecosystems' | 'Modules' {
  return module.tier === 'ecosystem' ? 'Ecosystems' : 'Modules';
}

export { MODULE_REGISTRY };
export type { ModuleRegistryEntry };
