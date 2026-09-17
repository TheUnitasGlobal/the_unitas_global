import { describe, expect, it } from 'vitest';
import { SHORTS_SEED, compactCount, shortStats, shortsByTheme, toggleMember } from '@/lib/live/shortsSeed';
import { passFromMetadata, passSerial } from '@/lib/live/shortsPass';
import { HOT_NEWS_CATEGORIES, isHotNewsCategory } from '@/lib/live/hotNews';
import { PULSE_HANDLES } from '@/lib/square/pulse';

// REV-29 MISSION 4 -- UNITAS Shorts, revived: the seed catalogue's pure
// invariants and the creator pass serial.

describe('shorts seed', () => {
  it('has unique ids, handles and one real news-axis theme per clip', () => {
    expect(new Set(SHORTS_SEED.map((s) => s.id)).size).toBe(SHORTS_SEED.length);
    for (const s of SHORTS_SEED) {
      expect(isHotNewsCategory(s.theme), s.id).toBe(true);
      expect(s.duration).toBeGreaterThan(0);
      expect(s.hue).toHaveLength(2);
      expect(s.handle).toMatch(/^[a-z0-9.]+$/);
    }
  });

  it('seeded counters are deterministic and internally consistent', () => {
    for (const s of SHORTS_SEED) {
      const a = shortStats(s);
      expect(a).toEqual(shortStats(s));
      expect(a.views).toBeGreaterThan(1000);
      expect(a.likes).toBeLessThan(a.views);
      expect(a.followers).toBeGreaterThan(0);
    }
  });

  it('filters by theme and returns everything for "all"', () => {
    expect(shortsByTheme('all')).toHaveLength(SHORTS_SEED.length);
    const tech = shortsByTheme('technology');
    expect(tech.length).toBeGreaterThan(0);
    expect(tech.every((s) => s.theme === 'technology')).toBe(true);
    // REV-36 M3 gave every axis at least two clips (was empty pre-REV-36).
    const disaster = shortsByTheme('disaster');
    expect(disaster.length).toBeGreaterThanOrEqual(2);
    expect(disaster.every((s) => s.theme === 'disaster')).toBe(true);
  });

  it('compactCount and toggleMember are the same pure helpers as before', () => {
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1200)).toBe('1.2K');
    expect(compactCount(1000)).toBe('1K');
    expect(compactCount(2_500_000)).toBe('2.5M');
    expect(toggleMember(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleMember(['a', 'b'], 'a')).toEqual(['b']);
  });
});

// Migrated from __tests__/square/pulse.test.ts (REV-40 MISSION 4). These
// invariants were filed under the U-Square pulse because REV-36's shorts
// simulation consumed them, but they describe the SEED CATALOGUE itself --
// a TS constant that is real, shipped truth (labelled by Rev29.shorts.seedNote)
// and outlived the simulation. They belong next to the rest of the catalogue's
// tests rather than dying with the engines.
describe('shorts seed catalogue shape (REV-36 expansion)', () => {
  it('has 44 clips with the original 14 first and unchanged', () => {
    expect(SHORTS_SEED.length).toBe(44);
    const original = [
      'aurora-run',
      'corner-kick',
      'one-take',
      'page-turn',
      'drop-alert',
      'open-bell',
      'panel-swipe',
      'silhouette',
      'night-market',
      'boss-phase',
      'lab-bench',
      'ward-round',
      'chalk-line',
      'city-grid',
    ];
    expect(SHORTS_SEED.slice(0, 14).map((s) => s.id)).toEqual(original);
    expect(new Set(SHORTS_SEED.map((s) => s.id)).size).toBe(44);
    for (const s of SHORTS_SEED) expect(s.id, s.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('gives every one of the 22 news axes at least two clips', () => {
    for (const axis of HOT_NEWS_CATEGORIES) {
      expect(SHORTS_SEED.filter((s) => s.theme === axis).length, axis).toBeGreaterThanOrEqual(2);
    }
  });

  it('draws every handle from the shared PULSE_HANDLES pool', () => {
    // lib/live/shortsSeed.ts documents this: the catalogue's creators are the
    // house identity pool in lib/square/pulse.ts, so the same people appear
    // across the U-Square panels. pulse.ts survived MISSION 4 precisely
    // because this pool is real, shipped data.
    const pool = new Set(PULSE_HANDLES);
    for (const s of SHORTS_SEED) expect(pool.has(s.handle), `${s.id}:${s.handle}`).toBe(true);
  });
});

describe('creator pass', () => {
  it('serials are stable per seed and shaped U-XXXX-YY', () => {
    expect(passSerial('seed')).toBe(passSerial('seed'));
    expect(passSerial('seed')).toMatch(/^U-[A-Z2-9]{4}-\d{2}$/);
    expect(passSerial('seed')).not.toBe(passSerial('seed2'));
  });

  it('reads a pass back from account metadata, or nothing', () => {
    expect(passFromMetadata({ unitas_shorts_pass: { handle: 'kai', at: 1, serial: 'U-AAAA-01' } })).toEqual({ handle: 'kai', at: 1, serial: 'U-AAAA-01' });
    expect(passFromMetadata({ unitas_shorts_pass: { serial: 'x' } })).toBeNull();
    expect(passFromMetadata(null)).toBeNull();
  });
});
