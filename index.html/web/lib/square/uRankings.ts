/**
 * REV-34 MISSION 4-C -- 유랭킹 (U-Rankings): the UNITAS-ecosystem
 * leaderboard that replaced the hub's world-ranking tab (founder directive
 * 2026-09-16, SPEC §3.7 / D-12).
 *
 * WHY a seeded catalogue: the hub has no aggregate-activity pipeline over real
 * accounts and the Zero-Trust identity rules keep `profiles` / `wallets` off
 * every public surface, so -- exactly like lib/unitasRankings.ts before it --
 * the ladder is a clearly pseudonymous, deterministic simulation. It is
 * derived from ONE integer `dayIndex` (UTC days since the epoch) so the
 * server render and the first client frame agree byte-for-byte (no
 * Math.random, no Date.now() during render; components compute the index in
 * a state initialiser and refresh it after hydration, the awardOfDay()
 * convention). The seed hash is FNV-1a with the MurmurHash3 fmix32 finisher
 * (house convention, lib/swarm/swarmLayout.ts) so neighbouring seeds such as
 * `…::1` and `…::2` land far apart, and mulberry32 turns that seed into the
 * per-entry draw stream.
 *
 * Twelve cards a day. `uRankingsFor(dayIndex)` is the cross-ecosystem ladder
 * (each operator assigned to one MODULE_REGISTRY module); `uRankingsFor(
 * dayIndex, moduleKey)` is that module's own twelve-card ladder, so the
 * module filter chips always fill the rail instead of thinning it out.
 * Names and handles are brand-neutral English shared by every locale.
 */
import { MODULE_REGISTRY } from '@/lib/module-registry';

export type URankTier = 'sovereign' | 'platinum' | 'gold';

export type URankMetricKey = 'microBurnEfficiency' | 'knowledgeSales' | 'nomadContribution' | 'sovereignIndex';

export interface URankEntry {
  /** Stable per-day id (`d<dayIndex>.<module|all>.<handle>`), unique within a ladder. */
  id: string;
  /** 1..U_RANKINGS_COUNT, contiguous, sorted by `sovereignIndex` descending. */
  rank: number;
  /** Display name, brand-neutral English. */
  name: string;
  /** Pseudonymous handle, `/^[a-z0-9.]+$/`, unique within a ladder. */
  handle: string;
  /** A `MODULE_REGISTRY` key. */
  moduleKey: string;
  tier: URankTier;
  /** Poster gradient stops (two hues), the shorts-card convention. */
  hue: [number, number];
  /** U-COIN Micro-Burn efficiency, 0-100 %. */
  microBurnEfficiency: number;
  /** Knowledge packs sold on the exchange, integer >= 0. */
  knowledgeSales: number;
  /** Digital-nomad contribution score, 0-1000. */
  nomadContribution: number;
  /** Composite sovereign index, 0-1000 (0.4 burn + 0.3 sales + 0.3 nomad). */
  sovereignIndex: number;
}

export const U_RANKINGS_COUNT = 12;

export const U_RANK_TIERS: readonly URankTier[] = ['sovereign', 'platinum', 'gold'];

/** The four metrics in display order; the i18n labels live under `Rev34.uRankings.metrics.*`. */
export const U_RANK_METRIC_KEYS: readonly URankMetricKey[] = [
  'microBurnEfficiency',
  'knowledgeSales',
  'nomadContribution',
  'sovereignIndex',
];

/** Message key (under `Rev34.uRankings.metrics`) for each metric. */
export const U_RANK_METRIC_LABEL_KEY: Record<URankMetricKey, 'microBurn' | 'knowledgeSales' | 'nomad' | 'sovereign'> = {
  microBurnEfficiency: 'microBurn',
  knowledgeSales: 'knowledgeSales',
  nomadContribution: 'nomad',
  sovereignIndex: 'sovereign',
};

/** Sales above this cap no longer raise the composite -- keeps the three
 *  axes on comparable footing (0-300 each for the two 0.3 weights). */
export const U_RANK_SALES_CAP = 500;

const NAME_PREFIXES = [
  'Nomad', 'Sovereign', 'Vector', 'Cipher', 'Aurora', 'Zenith', 'Nova', 'Echo',
  'Onyx', 'Solace', 'Quartz', 'Meridian', 'Lumen', 'Terra', 'Astra', 'Kinetic',
] as const;

const NAME_SUFFIXES = [
  'Kai', 'Vale', 'Orin', 'Sato', 'Lior', 'Mira', 'Idris', 'Noor',
  'Reyes', 'Tallis', 'Wren', 'Zara', 'Kato', 'Elan', 'Sol', 'Rune',
] as const;

/** FNV-1a 32-bit with the MurmurHash3 fmix32 finisher (house convention). */
export function uRankHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** UTC day index (days since the epoch) -- the ONLY clock read in this module. */
export function uRankDayIndex(now: number = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

/** Tier by rank: #1 sovereign, #2-#3 platinum, the rest gold. */
export function uRankTierForRank(rank: number): URankTier {
  if (rank === 1) return 'sovereign';
  if (rank <= 3) return 'platinum';
  return 'gold';
}

/** Composite 0-1000: 40 % burn efficiency, 30 % capped sales, 30 % nomad score. */
export function uRankSovereignIndex(microBurnEfficiency: number, knowledgeSales: number, nomadContribution: number): number {
  const burn = 0.4 * microBurnEfficiency * 10;
  const sales = 0.3 * Math.min(knowledgeSales, U_RANK_SALES_CAP) * 2;
  const nomad = 0.3 * nomadContribution;
  return Math.max(0, Math.min(1000, Math.round(burn + sales + nomad)));
}

/** A stable per-module hue for the filter chips' `--qw-hub-accent`. */
export function uRankModuleHue(moduleKey: string): number {
  return uRankHash(`urank-module::${moduleKey}`) % 360;
}

function isModuleKey(key: string): boolean {
  return MODULE_REGISTRY.some((m) => m.key === key);
}

interface Draft {
  name: string;
  handle: string;
  moduleKey: string;
  hue: [number, number];
  microBurnEfficiency: number;
  knowledgeSales: number;
  nomadContribution: number;
  sovereignIndex: number;
}

function draftEntry(seedKey: string, moduleKey: string | null, used: Set<string>): Draft {
  const hash = uRankHash(seedKey);
  const rand = mulberry32(hash);
  const prefix = NAME_PREFIXES[Math.floor(rand() * NAME_PREFIXES.length)];
  const suffix = NAME_SUFFIXES[Math.floor(rand() * NAME_SUFFIXES.length)];
  const assigned = moduleKey ?? MODULE_REGISTRY[Math.floor(rand() * MODULE_REGISTRY.length)].key;
  const microBurnEfficiency = Math.round((42 + rand() * 58) * 10) / 10;
  const knowledgeSales = Math.floor(rand() * 1_200);
  const nomadContribution = Math.floor(rand() * 1_001);
  const base = `${prefix.toLowerCase()}.${suffix.toLowerCase()}`;
  // Handles must be unique within a ladder; on a collision keep drawing a
  // numeric tail from the same stream so the outcome stays deterministic.
  let handle = base;
  while (used.has(handle)) handle = `${base}.${10 + Math.floor(rand() * 90)}`;
  used.add(handle);
  return {
    name: `${prefix} ${suffix}`,
    handle,
    moduleKey: assigned,
    hue: [hash % 360, (hash >>> 8) % 360],
    microBurnEfficiency,
    knowledgeSales,
    nomadContribution,
    sovereignIndex: uRankSovereignIndex(microBurnEfficiency, knowledgeSales, nomadContribution),
  };
}

/**
 * Pure: the twelve-card ladder for a day. Without `moduleKey` (or with 'all'
 * / an unknown key) it is the cross-ecosystem ladder; with a registry key it
 * is that module's own ladder. Same inputs, same output, on every runtime.
 */
export function uRankingsFor(dayIndex: number, moduleKey: string | 'all' = 'all'): URankEntry[] {
  const day = Math.trunc(dayIndex);
  const scope = moduleKey !== 'all' && isModuleKey(moduleKey) ? moduleKey : null;
  const used = new Set<string>();
  const drafts: Draft[] = [];
  for (let i = 0; i < U_RANKINGS_COUNT; i++) {
    drafts.push(draftEntry(`urank::${day}::${scope ?? 'all'}::${i}`, scope, used));
  }
  drafts.sort((a, b) => b.sovereignIndex - a.sovereignIndex || (a.handle < b.handle ? -1 : 1));
  return drafts.map((d, i) => {
    const rank = i + 1;
    return {
      id: `d${day}.${scope ?? 'all'}.${d.handle}`,
      rank,
      tier: uRankTierForRank(rank),
      ...d,
    };
  });
}

/** Pure: the entries of one module from an already-built ladder (or all of them). */
export function uRankingsByModule(entries: readonly URankEntry[], moduleKey: string | 'all'): URankEntry[] {
  return moduleKey === 'all' ? [...entries] : entries.filter((e) => e.moduleKey === moduleKey);
}
