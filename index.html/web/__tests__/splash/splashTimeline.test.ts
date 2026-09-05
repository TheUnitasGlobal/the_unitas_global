import { describe, expect, it } from 'vitest';
import {
  CINEMA_PHASE_STORAGE_KEY,
  SPLASH_ACTIVE_STORAGE_KEY,
  SPLASH_ACTIVE_VALUE,
  SPLASH_CRYSTAL_AT_S,
  SPLASH_DURATION_MS,
  SPLASH_GOLD_HEX,
  SPLASH_GOLD_HOLD_S,
  SPLASH_GOLD_LOOP_S,
  SPLASH_GOLD_SWEEP_FROM_X,
  SPLASH_GOLD_SWEEP_S,
  SPLASH_GOLD_SWEEP_TO_X,
  SPLASH_LETTERS,
  SPLASH_SUB_VIEW_PHASES,
  SPLASH_TITLE_PALETTE,
  SPLASH_TITLE_WIDTH,
  SPLASH_VOCAL_AT_S,
  SPLASH_VOCAL_LEAD_S,
  SPLASH_VOCAL_LENGTH_S,
  goldLoopKeyTimes,
  goldLoopValues,
  hexHue,
  isSplashActiveFlag,
  isSubViewPhase,
  letterDrawStart,
  letterFillStart,
  shouldResetEntrySession,
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

  it('restarts the logo page itself when a refresh lands while it was showing (7-point hardening, item 6)', () => {
    expect(SPLASH_ACTIVE_STORAGE_KEY).toBe('unitas_splash_active');
    expect(isSplashActiveFlag(SPLASH_ACTIVE_VALUE)).toBe(true);
    expect(isSplashActiveFlag(' 1 ')).toBe(true);
    expect(isSplashActiveFlag(null)).toBe(false);
    expect(isSplashActiveFlag(undefined)).toBe(false);
    expect(isSplashActiveFlag('')).toBe(false);
    expect(isSplashActiveFlag('0')).toBe(false);
    // The curtain persists `gate` beneath the splash from its very first
    // frame -- a refresh mid-splash must still replay the logo page, not
    // skip straight to the entry gate.
    expect(shouldRunSplashForPhase('', 'gate', true)).toBe(true);
    expect(shouldRunSplashForPhase('', 'cinema', true)).toBe(true);
    expect(shouldRunSplashForPhase('', 'sealed', true)).toBe(true);
    // ...but the QA opt-out still wins over everything.
    expect(shouldRunSplashForPhase('?splash=0', 'gate', true)).toBe(false);
    // And without the flag the round-10 in-place rule is unchanged.
    expect(shouldRunSplashForPhase('', 'gate', false)).toBe(false);
  });

  it('resets the session on every document load except an in-place reload (round 11, item 3)', () => {
    // Re-entries: PWA launch / typed URL / external link / session restore / history traversal.
    expect(shouldResetEntrySession('navigate', '')).toBe(true);
    expect(shouldResetEntrySession('back_forward', '')).toBe(true);
    expect(shouldResetEntrySession('prerender', '')).toBe(true);
    expect(shouldResetEntrySession(null, '')).toBe(true);
    expect(shouldResetEntrySession(undefined, '?dev=skip')).toBe(true);
    // An F5 parked on a sub-view keeps the round-10 "refresh in place" rule.
    expect(shouldResetEntrySession('reload', '')).toBe(false);
    expect(shouldResetEntrySession(' Reload ', '')).toBe(false);
    // The QA harness (?splash=0) keeps its pre-seeded session state.
    expect(shouldResetEntrySession('navigate', '?splash=0')).toBe(false);
    expect(shouldResetEntrySession('back_forward', '?a=1&splash=off')).toBe(false);
  });

  it('loops the single-tone gold light for 5s: 3s U -> S sweep, 2s solid gold hold (hardening patch, item 3)', () => {
    expect(SPLASH_GOLD_LOOP_S).toBe(5);
    expect(SPLASH_GOLD_SWEEP_S).toBe(3);
    expect(SPLASH_GOLD_HOLD_S).toBe(2);
    expect(SPLASH_GOLD_SWEEP_S + SPLASH_GOLD_HOLD_S).toBe(SPLASH_GOLD_LOOP_S);
    // One full cycle per splash hold.
    expect(SPLASH_GOLD_LOOP_S * 1000).toBe(SPLASH_DURATION_MS);
    // Sweep runs left -> right, and the SMIL cues park the light from 3s on
    // so the title is solid gold through the hold.
    expect(SPLASH_GOLD_SWEEP_TO_X).toBeGreaterThan(SPLASH_GOLD_SWEEP_FROM_X);
    expect(SPLASH_TITLE_WIDTH).toBe(720);
    expect(goldLoopKeyTimes()).toBe('0;0.6;1');
    expect(goldLoopValues()).toBe(
      `${SPLASH_GOLD_SWEEP_FROM_X} 0;${SPLASH_GOLD_SWEEP_TO_X} 0;${SPLASH_GOLD_SWEEP_TO_X} 0`,
    );
    // Every glyph has started filling before the sweep phase ends, so each
    // letter is lit by the light in turn during 0-3s and none first appears
    // during the solid-gold hold.
    expect(letterFillStart(SPLASH_LETTERS.length - 1)).toBeLessThan(SPLASH_GOLD_SWEEP_S);
  });

  it('paints the title in ONE tone: every palette entry is the original gold hue (no cyan / violet / rose)', () => {
    expect(SPLASH_TITLE_PALETTE).toContain(SPLASH_GOLD_HEX);
    const goldHue = hexHue(SPLASH_GOLD_HEX);
    expect(goldHue).toBeGreaterThan(40);
    expect(goldHue).toBeLessThan(55);
    for (const hex of SPLASH_TITLE_PALETTE) {
      expect(Math.abs(hexHue(hex) - goldHue)).toBeLessThanOrEqual(6);
    }
    // Sanity: the guard would catch the retired prism stops.
    expect(Math.abs(hexHue('#00f3ff') - goldHue)).toBeGreaterThan(90);
    expect(Math.abs(hexHue('#7c3aed') - goldHue)).toBeGreaterThan(90);
  });

  it('keeps absolute beats when audio unlocks early', () => {
    expect(splashAudioOffsets(0)).toEqual({ vocalAt: 1, crystalAt: 2 });
    expect(splashAudioOffsets(0.4)).toEqual({ vocalAt: 0.6, crystalAt: 1.6 });
  });

  it('never drops the vocal on a late unlock: chant now, crystal one full lead behind (7-point hardening, item 7)', () => {
    const late = splashAudioOffsets(1.2);
    expect(late.vocalAt).toBe(0);
    expect(late.crystalAt).toBe(SPLASH_VOCAL_LEAD_S);

    // The mobile-online reality: the first touch (= the unlock) lands well
    // into the splash. The chant must still play, in full, and lead the
    // crystal exactly as it does on an early unlock.
    for (const elapsed of [1.9, 2.5, 3.4, 4.6]) {
      const offsets = splashAudioOffsets(elapsed);
      expect(offsets.vocalAt).toBe(0);
      expect(offsets.crystalAt).toBe(SPLASH_VOCAL_LEAD_S);
    }
  });
});
