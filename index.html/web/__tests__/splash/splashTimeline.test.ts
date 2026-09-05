import { describe, expect, it } from 'vitest';
import {
  CINEMA_PHASE_STORAGE_KEY,
  SPLASH_CRYSTAL_AT_S,
  SPLASH_DURATION_MS,
  SPLASH_LETTERS,
  SPLASH_SUB_VIEW_PHASES,
  SPLASH_VOCAL_AT_S,
  SPLASH_VOCAL_LEAD_S,
  SPLASH_VOCAL_LENGTH_S,
  isSubViewPhase,
  letterDrawStart,
  letterFillStart,
  shouldRunSplash,
  shouldRunSplashForPhase,
  splashAudioOffsets,
} from '../../lib/splash/splashTimeline';

// Pure timeline maths only -- no fixtures shared with other __tests__/** files
// (see CLAUDE.md "Module-level test isolation").
describe('splash timeline', () => {
  it('is a forced 5-second splash spelling UNITAS', () => {
    expect(SPLASH_DURATION_MS).toBe(5000);
    expect(SPLASH_LETTERS.join('')).toBe('UNITAS');
  });

  it('runs by default and only skips on an explicit opt-out', () => {
    expect(shouldRunSplash('')).toBe(true);
    expect(shouldRunSplash('?dev=skip')).toBe(true);
    expect(shouldRunSplash('?splash=1')).toBe(true);
    expect(shouldRunSplash('?splash=0')).toBe(false);
    expect(shouldRunSplash('?splash=off')).toBe(false);
    expect(shouldRunSplash('?a=1&splash=FALSE')).toBe(false);
    expect(() => shouldRunSplash('%%%')).not.toThrow();
  });

  it('draws letters U -> S in strictly increasing order, all inside the splash', () => {
    const starts = SPLASH_LETTERS.map((_, i) => letterDrawStart(i));
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
    const lastFill = letterFillStart(SPLASH_LETTERS.length - 1);
    expect(lastFill).toBeLessThan(SPLASH_DURATION_MS / 1000);
    expect(letterFillStart(0)).toBeGreaterThan(letterDrawStart(0));
  });

  it('places the vocal at 1s leading the crystal at 2s, chant overlapping the impact', () => {
    expect(SPLASH_VOCAL_AT_S).toBe(1);
    expect(SPLASH_CRYSTAL_AT_S).toBe(2);
    expect(SPLASH_VOCAL_LEAD_S).toBe(1);
    // Round 10: the letter-by-letter bass chant is longer than its lead, so
    // the held "A" is still ringing when the crystal lands -- by design.
    expect(SPLASH_VOCAL_LENGTH_S).toBeGreaterThan(SPLASH_VOCAL_LEAD_S);
    expect(SPLASH_VOCAL_AT_S + SPLASH_VOCAL_LENGTH_S).toBeLessThan(SPLASH_DURATION_MS / 1000);
  });

  it('treats gate / cinema / sealed as sub-views that refresh in place without the splash', () => {
    expect(CINEMA_PHASE_STORAGE_KEY).toBe('unitas_cinema_phase');
    expect([...SPLASH_SUB_VIEW_PHASES]).toEqual(['gate', 'cinema', 'sealed']);
    expect(isSubViewPhase('gate')).toBe(true);
    expect(isSubViewPhase('cinema')).toBe(true);
    expect(isSubViewPhase(' sealed ')).toBe(true);
    // Cold visit and the released main home keep the intro.
    expect(isSubViewPhase(null)).toBe(false);
    expect(isSubViewPhase(undefined)).toBe(false);
    expect(isSubViewPhase('')).toBe(false);
    expect(isSubViewPhase('released')).toBe(false);
    expect(isSubViewPhase('garbage')).toBe(false);
  });

  it('combines the URL opt-out with the sub-view gate', () => {
    expect(shouldRunSplashForPhase('', null)).toBe(true);
    expect(shouldRunSplashForPhase('', 'released')).toBe(true);
    expect(shouldRunSplashForPhase('', 'sealed')).toBe(false);
    expect(shouldRunSplashForPhase('', 'cinema')).toBe(false);
    expect(shouldRunSplashForPhase('', 'gate')).toBe(false);
    expect(shouldRunSplashForPhase('?splash=0', 'released')).toBe(false);
    expect(shouldRunSplashForPhase('?splash=0', null)).toBe(false);
  });

  it('keeps absolute beats when audio unlocks early', () => {
    expect(splashAudioOffsets(0)).toEqual({ vocalAt: 1, crystalAt: 2 });
    expect(splashAudioOffsets(0.4)).toEqual({ vocalAt: 0.6, crystalAt: 1.6 });
  });

  it('compresses the vocal when unlocked slightly late, drops it when too late', () => {
    const late = splashAudioOffsets(1.2);
    expect(late.vocalAt).toBe(0);
    expect(late.crystalAt).toBeGreaterThanOrEqual(0.8);

    const tooLate = splashAudioOffsets(1.9);
    expect(tooLate.vocalAt).toBeNull();
    expect(tooLate.crystalAt).toBeCloseTo(0.1, 5);

    const past = splashAudioOffsets(2.5);
    expect(past.vocalAt).toBeNull();
    expect(past.crystalAt).toBe(0);
  });
});
