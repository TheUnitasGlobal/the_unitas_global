import { describe, expect, it } from 'vitest';
import { MODULE_REGISTRY } from '@/lib/module-registry';
import {
  U_RANKINGS_COUNT,
  U_RANK_METRIC_KEYS,
  U_RANK_METRIC_LABEL_KEY,
  U_RANK_TIERS,
  uRankDayIndex,
  uRankHash,
  uRankModuleHue,
  uRankSovereignIndex,
  uRankTierForRank,
  uRankingsByModule,
  uRankingsFor,
} from '@/lib/square/uRankings';

// REV-34 MISSION 4-C -- 유랭킹: the seeded ladder's pure invariants.

const DAYS = [0, 1, 20_712, 20_713, 21_000];
const MODULE_KEYS = new Set(MODULE_REGISTRY.map((m) => m.key));

describe('uRankingsFor', () => {
  it('builds exactly twelve cards with unique ids, handles and contiguous ranks', () => {
    for (const day of DAYS) {
      const ladder = uRankingsFor(day);
      expect(ladder).toHaveLength(U_RANKINGS_COUNT);
      expect(new Set(ladder.map((e) => e.id)).size).toBe(U_RANKINGS_COUNT);
      expect(new Set(ladder.map((e) => e.handle)).size).toBe(U_RANKINGS_COUNT);
      expect(ladder.map((e) => e.rank)).toEqual(Array.from({ length: U_RANKINGS_COUNT }, (_, i) => i + 1));
    }
  });

  it('is deterministic for the same day and differs between days', () => {
    expect(uRankingsFor(20_712)).toEqual(uRankingsFor(20_712));
    expect(uRankingsFor(20_712.9)).toEqual(uRankingsFor(20_712));
    const a = uRankingsFor(20_712).map((e) => e.handle);
    const b = uRankingsFor(20_713).map((e) => e.handle);
    expect(a).not.toEqual(b);
  });

  it('sorts by sovereignIndex descending and tiers by rank', () => {
    for (const day of DAYS) {
      const ladder = uRankingsFor(day);
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i - 1].sovereignIndex).toBeGreaterThanOrEqual(ladder[i].sovereignIndex);
      }
      for (const e of ladder) {
        expect(e.tier).toBe(uRankTierForRank(e.rank));
        expect(U_RANK_TIERS).toContain(e.tier);
      }
      expect(ladder[0].tier).toBe('sovereign');
      expect(ladder[1].tier).toBe('platinum');
      expect(ladder[2].tier).toBe('platinum');
      expect(ladder[3].tier).toBe('gold');
    }
  });

  it('keeps every metric in range and the composite consistent', () => {
    for (const day of DAYS) {
      for (const e of uRankingsFor(day)) {
        expect(e.microBurnEfficiency).toBeGreaterThanOrEqual(0);
        expect(e.microBurnEfficiency).toBeLessThanOrEqual(100);
        expect(Number.isInteger(e.knowledgeSales)).toBe(true);
        expect(e.knowledgeSales).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(e.nomadContribution)).toBe(true);
        expect(e.nomadContribution).toBeGreaterThanOrEqual(0);
        expect(e.nomadContribution).toBeLessThanOrEqual(1000);
        expect(Number.isInteger(e.sovereignIndex)).toBe(true);
        expect(e.sovereignIndex).toBeGreaterThanOrEqual(0);
        expect(e.sovereignIndex).toBeLessThanOrEqual(1000);
        expect(e.sovereignIndex).toBe(uRankSovereignIndex(e.microBurnEfficiency, e.knowledgeSales, e.nomadContribution));
        expect(e.hue).toHaveLength(2);
        expect(e.hue[0]).toBeGreaterThanOrEqual(0);
        expect(e.hue[0]).toBeLessThan(360);
        expect(e.hue[1]).toBeGreaterThanOrEqual(0);
        expect(e.hue[1]).toBeLessThan(360);
      }
    }
  });

  it('uses handles matching /^[a-z0-9.]+$/ and non-empty names', () => {
    for (const day of DAYS) {
      for (const e of uRankingsFor(day)) {
        expect(e.handle).toMatch(/^[a-z0-9.]+$/);
        expect(e.name.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('assigns only MODULE_REGISTRY keys', () => {
    for (const day of DAYS) {
      for (const e of uRankingsFor(day)) {
        expect(MODULE_KEYS.has(e.moduleKey), e.moduleKey).toBe(true);
      }
    }
  });

  it('builds a full per-module ladder for a registry key and ignores unknown keys', () => {
    const key = MODULE_REGISTRY[0].key;
    const ladder = uRankingsFor(20_712, key);
    expect(ladder).toHaveLength(U_RANKINGS_COUNT);
    expect(ladder.every((e) => e.moduleKey === key)).toBe(true);
    expect(ladder).toEqual(uRankingsFor(20_712, key));
    expect(ladder.map((e) => e.handle)).not.toEqual(uRankingsFor(20_712).map((e) => e.handle));
    expect(uRankingsFor(20_712, 'no-such-module')).toEqual(uRankingsFor(20_712));
    expect(uRankingsFor(20_712, 'all')).toEqual(uRankingsFor(20_712));
  });
});

describe('uRankingsByModule', () => {
  it('filters an existing ladder and returns a copy for "all"', () => {
    const ladder = uRankingsFor(20_712);
    const all = uRankingsByModule(ladder, 'all');
    expect(all).toEqual(ladder);
    expect(all).not.toBe(ladder);
    const key = ladder[0].moduleKey;
    const some = uRankingsByModule(ladder, key);
    expect(some.length).toBeGreaterThan(0);
    expect(some.every((e) => e.moduleKey === key)).toBe(true);
  });
});

describe('helpers', () => {
  it('sovereign index weights and clamps', () => {
    expect(uRankSovereignIndex(0, 0, 0)).toBe(0);
    expect(uRankSovereignIndex(100, 500, 1000)).toBe(1000);
    expect(uRankSovereignIndex(100, 5000, 1000)).toBe(1000);
    expect(uRankSovereignIndex(50, 0, 0)).toBe(200);
  });

  it('hash is stable, 32-bit and separates neighbouring seeds', () => {
    expect(uRankHash('urank::1::all::0')).toBe(uRankHash('urank::1::all::0'));
    const a = uRankHash('urank::1::all::1');
    const b = uRankHash('urank::1::all::2');
    expect(a).not.toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
    expect(Math.abs(a - b) / 0xffffffff).toBeGreaterThan(0.01);
    for (const m of MODULE_REGISTRY) {
      const hue = uRankModuleHue(m.key);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('day index is whole UTC days and the metric label map is complete', () => {
    expect(uRankDayIndex(0)).toBe(0);
    expect(uRankDayIndex(86_400_000 - 1)).toBe(0);
    expect(uRankDayIndex(86_400_000)).toBe(1);
    expect(U_RANK_METRIC_KEYS).toHaveLength(4);
    for (const key of U_RANK_METRIC_KEYS) expect(typeof U_RANK_METRIC_LABEL_KEY[key]).toBe('string');
  });
});
