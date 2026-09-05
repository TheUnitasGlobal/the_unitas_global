import { describe, expect, it } from 'vitest';
import {
  SPLASH_CRYSTAL_AT_S,
  SPLASH_DURATION_MS,
  SPLASH_LETTERS,
  SPLASH_VOCAL_AT_S,
  letterDrawStart,
  letterFillStart,
  shouldRunSplash,
  splashAudioOffsets,
} from '../../lib/splash/splashTimeline';

// Pure timeline maths only -- no fixtures shared with other __tests__/** files
// (see CLAUDE.md "Module-level test isolation").
describe('splash timeline', () => {
  it('is a forced 3-second splash spelling UNITAS', () => {
    expect(SPLASH_DURATION_MS).toBe(3000);
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

  it('places the vocal in the 1-2s window and the crystal in the final second', () => {
    expect(SPLASH_VOCAL_AT_S).toBe(1);
    expect(SPLASH_CRYSTAL_AT_S).toBe(2);
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
