import { describe, expect, it } from 'vitest';
import {
  CINEMA_PHASE_STORAGE_KEY,
  SPLASH_ACTIVE_STORAGE_KEY,
  SPLASH_ACTIVE_VALUE,
  SPLASH_CORP_AT_S,
  SPLASH_DURATION_MS,
  SPLASH_EXIT_MS,
  SPLASH_GOLD_HEX,
  SPLASH_GOLD_HOLD_S,
  SPLASH_GOLD_LOOP_S,
  SPLASH_GOLD_SWEEP_FROM_X,
  SPLASH_GOLD_SWEEP_S,
  SPLASH_GOLD_SWEEP_TO_X,
  SPLASH_IMPACT_AT_S,
  SPLASH_IN_PLACE_PHASES,
  SPLASH_LETTERS,
  SPLASH_LETTER_DRAW_S,
  SPLASH_STROKE_FADE_AT_S,
  SPLASH_STROKE_FADE_S,
  SPLASH_TITLE_PALETTE,
  SPLASH_TITLE_WIDTH,
  goldLoopKeyTimes,
  goldLoopValues,
  hexHue,
  isInPlacePhase,
  isSplashActiveFlag,
  letterDrawStart,
  letterFillStart,
  shouldResetEntrySession,
  shouldRunSplash,
  shouldRunSplashForPhase,
} from '../../lib/splash/splashTimeline';

// Pure timeline maths only -- no fixtures shared with other __tests__/** files
// (see CLAUDE.md "Module-level test isolation").
describe('splash timeline', () => {
  it('is a forced, EXACTLY 3-second splash spelling UNITAS (checklist item 1)', () => {
    expect(SPLASH_DURATION_MS).toBe(3000);
    expect(SPLASH_EXIT_MS).toBeGreaterThan(0);
    expect(SPLASH_EXIT_MS).toBeLessThan(1000);
    expect(SPLASH_LETTERS.join('')).toBe('UNITAS');
  });

  it('is SILENT: the timeline exports no audio cue of any kind', async () => {
    const timeline = await import('../../lib/splash/splashTimeline');
    const audioLike = Object.keys(timeline).filter((key) => /VOCAL|CRYSTAL|AUDIO|UNLOCK/i.test(key));
    expect(audioLike).toEqual([]);
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

  it('draws letters U -> S in strictly increasing order, every glyph solid well inside the 3s', () => {
    const starts = SPLASH_LETTERS.map((_, i) => letterDrawStart(i));
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
    const last = SPLASH_LETTERS.length - 1;
    expect(letterFillStart(0)).toBeGreaterThan(letterDrawStart(0));
    // The last glyph's outline is fully drawn and its fill has started with
    // a clear second to spare before the exit fade.
    expect(letterDrawStart(last) + SPLASH_LETTER_DRAW_S).toBeLessThan(SPLASH_DURATION_MS / 1000 - 1);
    expect(letterFillStart(last)).toBeLessThan(SPLASH_DURATION_MS / 1000 - 1);
  });

  it('lands every remaining visual beat before the 3.0s exit fade', () => {
    const hold = SPLASH_DURATION_MS / 1000;
    expect(SPLASH_CORP_AT_S).toBeLessThan(hold);
    expect(SPLASH_IMPACT_AT_S).toBeLessThan(hold);
    // The impact fires only once every outline has been drawn.
    const last = SPLASH_LETTERS.length - 1;
    expect(SPLASH_IMPACT_AT_S).toBeGreaterThanOrEqual(letterDrawStart(last) + SPLASH_LETTER_DRAW_S);
    // The outline stroke has faded out (pure burnished gold) before 3.0s.
    expect(SPLASH_STROKE_FADE_AT_S + SPLASH_STROKE_FADE_S).toBeLessThanOrEqual(hold);
    expect(SPLASH_STROKE_FADE_AT_S).toBeGreaterThan(letterFillStart(last));
  });

  it('treats gate / cinema / sealed / released as pages that refresh in place without the splash (checklist items 2 + 3)', () => {
    expect(CINEMA_PHASE_STORAGE_KEY).toBe('unitas_cinema_phase');
    expect([...SPLASH_IN_PLACE_PHASES]).toEqual(['gate', 'cinema', 'sealed', 'released']);
    expect(isInPlacePhase('gate')).toBe(true);
    expect(isInPlacePhase('cinema')).toBe(true);
    expect(isInPlacePhase(' sealed ')).toBe(true);
    // The main home too: an F5 there must never show the logo page again.
    expect(isInPlacePhase('released')).toBe(true);
    // Only a cold entry (no persisted phase) keeps the intro.
    expect(isInPlacePhase(null)).toBe(false);
    expect(isInPlacePhase(undefined)).toBe(false);
    expect(isInPlacePhase('')).toBe(false);
    expect(isInPlacePhase('garbage')).toBe(false);
  });

  it('combines the URL opt-out with the in-place gate', () => {
    expect(shouldRunSplashForPhase('', null)).toBe(true);
    expect(shouldRunSplashForPhase('', 'released')).toBe(false);
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
    expect(shouldRunSplashForPhase('', 'released', true)).toBe(true);
    // ...but the QA opt-out still wins over everything.
    expect(shouldRunSplashForPhase('?splash=0', 'gate', true)).toBe(false);
    // And without the flag the in-place rule is unchanged.
    expect(shouldRunSplashForPhase('', 'gate', false)).toBe(false);
    expect(shouldRunSplashForPhase('', 'released', false)).toBe(false);
  });

  it('resets the session on every document load except an in-place reload (round 11, item 3)', () => {
    // Re-entries: PWA launch / typed URL / external link / session restore / history traversal.
    expect(shouldResetEntrySession('navigate', '')).toBe(true);
    expect(shouldResetEntrySession('back_forward', '')).toBe(true);
    expect(shouldResetEntrySession('prerender', '')).toBe(true);
    expect(shouldResetEntrySession(null, '')).toBe(true);
    expect(shouldResetEntrySession(undefined, '?dev=skip')).toBe(true);
    // An F5 parked on any page keeps the "refresh in place" rule.
    expect(shouldResetEntrySession('reload', '')).toBe(false);
    expect(shouldResetEntrySession(' Reload ', '')).toBe(false);
    // The QA harness (?splash=0) keeps its pre-seeded session state.
    expect(shouldResetEntrySession('navigate', '?splash=0')).toBe(false);
    expect(shouldResetEntrySession('back_forward', '?a=1&splash=off')).toBe(false);
  });

  it('sweeps the single-tone gold light U -> S for the WHOLE 3s hold, no parked rest (checklist item 1)', () => {
    expect(SPLASH_GOLD_LOOP_S).toBe(3);
    expect(SPLASH_GOLD_SWEEP_S).toBe(3);
    expect(SPLASH_GOLD_HOLD_S).toBe(0);
    expect(SPLASH_GOLD_SWEEP_S + SPLASH_GOLD_HOLD_S).toBe(SPLASH_GOLD_LOOP_S);
    // One full pass per splash hold -- the colour art never rests while the
    // page is on screen.
    expect(SPLASH_GOLD_LOOP_S * 1000).toBe(SPLASH_DURATION_MS);
    // Sweep runs left -> right; with no hold the SMIL cue list is a plain
    // two-point sweep (a zero-length hold segment would be invalid SMIL).
    expect(SPLASH_GOLD_SWEEP_TO_X).toBeGreaterThan(SPLASH_GOLD_SWEEP_FROM_X);
    expect(SPLASH_TITLE_WIDTH).toBe(720);
    expect(goldLoopKeyTimes()).toBe('0;1');
    expect(goldLoopValues()).toBe(`${SPLASH_GOLD_SWEEP_FROM_X} 0;${SPLASH_GOLD_SWEEP_TO_X} 0`);
    // Every glyph has started filling before the sweep ends, so each letter
    // is lit by the light in turn during the pass.
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
});
