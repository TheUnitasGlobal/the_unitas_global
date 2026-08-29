import { describe, expect, it } from 'vitest';
import {
  CINEMA_DURATION_MS,
  CINEMA_SEGMENTS,
  cinemaOverallProgress,
  cinemaSegmentAt,
  cinemaSegmentProgress,
  seedCinemaField,
} from '../../lib/comingSoonSequence';

describe('cinema timeline helpers', () => {
  it('covers the whole 30s with contiguous, non-overlapping segments', () => {
    expect(CINEMA_SEGMENTS[0].startMs).toBe(0);
    expect(CINEMA_SEGMENTS[CINEMA_SEGMENTS.length - 1].endMs).toBe(CINEMA_DURATION_MS);
    for (let i = 1; i < CINEMA_SEGMENTS.length; i++) {
      expect(CINEMA_SEGMENTS[i].startMs).toBe(CINEMA_SEGMENTS[i - 1].endMs);
    }
  });

  it('maps representative times to the spec segments', () => {
    expect(cinemaSegmentAt(0).id).toBe(1);
    expect(cinemaSegmentAt(2_999).id).toBe(1);
    expect(cinemaSegmentAt(3_000).id).toBe(2);
    expect(cinemaSegmentAt(9_999).id).toBe(2);
    expect(cinemaSegmentAt(10_000).id).toBe(3);
    expect(cinemaSegmentAt(14_999).id).toBe(3);
    expect(cinemaSegmentAt(15_000).id).toBe(4);
    expect(cinemaSegmentAt(21_999).id).toBe(4);
    expect(cinemaSegmentAt(22_000).id).toBe(5);
    expect(cinemaSegmentAt(29_999).id).toBe(5);
  });

  it('wraps past 30s and handles negative time (loop-safe)', () => {
    expect(cinemaSegmentAt(CINEMA_DURATION_MS).id).toBe(1);
    expect(cinemaSegmentAt(CINEMA_DURATION_MS + 3_500).id).toBe(2);
    expect(cinemaSegmentAt(-1).id).toBe(5);
  });

  it('reports 0..1 progress within a segment and across the loop', () => {
    expect(cinemaSegmentProgress(3_000)).toBeCloseTo(0);
    expect(cinemaSegmentProgress(6_500)).toBeCloseTo(0.5);
    expect(cinemaOverallProgress(0)).toBeCloseTo(0);
    expect(cinemaOverallProgress(15_000)).toBeCloseTo(0.5);
    expect(cinemaOverallProgress(CINEMA_DURATION_MS + 7_500)).toBeCloseTo(0.25);
  });
});

describe('seedCinemaField', () => {
  it('is deterministic for a given seed', () => {
    const a = seedCinemaField(123);
    const b = seedCinemaField(123);
    expect(a).toEqual(b);
    expect(seedCinemaField(1)).not.toEqual(seedCinemaField(2));
  });

  it('produces in-range normalized coordinates', () => {
    const { stars, spiral } = seedCinemaField();
    expect(stars.length).toBeGreaterThan(0);
    for (const s of stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
    for (const p of spiral) {
      expect(p.rad).toBeGreaterThan(0);
      expect(p.rad).toBeLessThanOrEqual(1);
    }
  });
});
