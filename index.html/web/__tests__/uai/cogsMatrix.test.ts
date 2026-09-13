import { describe, expect, it } from 'vitest';
import {
  COGS_GROUPS,
  COGS_GROUP_KEYS,
  COGS_LENS_KEYS,
  COGS_MIN_GROUP_SIZE,
  LENS_AXES,
  cogsCardFor,
  cogsGroupForPage,
  hashSeed,
} from '@/lib/uai/stream/cogsMatrix';
import type { ConstitutionScore } from '@/lib/uai/types';

// REV-21 SPEC.md §12.7 (SR-8) -- the COGS matrix is pure and deterministic:
// seven groups with unique seeds, hash-seeded picks that never change for
// the same (query, page), a lens that maps to two real axes, no randomness.

const constitution: ConstitutionScore[] = [
  { axis: 'logic', score: 80, band: 'high' },
  { axis: 'future', score: 60, band: 'mid' },
  { axis: 'economy', score: 40, band: 'mid' },
  { axis: 'security', score: 20, band: 'low' },
  { axis: 'sovereign', score: 70, band: 'high' },
  { axis: 'art', score: 10, band: 'low' },
];

describe('COGS matrix', () => {
  it('engraves seven groups of unique seeds at the codex counts', () => {
    expect(COGS_GROUP_KEYS.length).toBe(7);
    for (const key of COGS_GROUP_KEYS) {
      const items = COGS_GROUPS[key];
      expect(items.length, key).toBeGreaterThanOrEqual(COGS_MIN_GROUP_SIZE);
      expect(new Set(items.map((s) => s.toLowerCase())).size, key).toBe(items.length);
      for (const item of items) expect(item.trim().length, key).toBeGreaterThan(0);
    }
    expect(COGS_GROUPS.origin).toContain('알파제네시스'); // typo-corrected seed
    expect(COGS_GROUPS.civilization.length).toBe(60); // 70 listed, 10 duplicates
  });

  it('rotates the group by page and picks the same seed / lens for the same (query, page) everywhere', () => {
    expect(cogsGroupForPage(1)).toBe('origin');
    expect(cogsGroupForPage(7)).toBe('nexus');
    expect(cogsGroupForPage(8)).toBe('origin');
    const a = cogsCardFor('공기', 3, constitution);
    const b = cogsCardFor(' 공기 ', 3, constitution);
    expect(a).toEqual(b);
    expect(a.group).toBe('civilization');
    expect(COGS_GROUPS.civilization).toContain(a.seed);
    expect(COGS_LENS_KEYS).toContain(a.lens);
    expect(a.axes.map((x) => x.axis)).toEqual([...LENS_AXES[a.lens]]);
    expect(a.resonance).toBe(Math.round((a.axes[0].score + a.axes[1].score) / 2));
    const other = cogsCardFor('공기', 4, constitution);
    expect(other.group).toBe('cosmos');
  });

  it('hashes stably and marks rarity deterministically (about one in nine), never by chance', () => {
    expect(hashSeed('a', 1)).toBe(hashSeed('a', 1));
    expect(hashSeed('a', 1)).not.toBe(hashSeed('a', 2));
    const rare = Array.from({ length: 90 }, (_, i) => cogsCardFor('bitcoin', i + 1, constitution).rare).filter(Boolean).length;
    expect(rare).toBeGreaterThan(3);
    expect(rare).toBeLessThan(25);
    expect(cogsCardFor('bitcoin', 5, constitution).rare).toBe(cogsCardFor('bitcoin', 5, constitution).rare);
  });
});
