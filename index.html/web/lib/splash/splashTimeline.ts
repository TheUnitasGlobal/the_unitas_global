// Pure timeline constants + predicates for the cinematic intro splash
// (owner instruction 2026-09-04, item 3; duration extended to 5s and the
// master mark's rotation redesigned 2026-09-05). No DOM, no React -- unit
// tested in __tests__/splash/splashTimeline.test.ts. The component
// (components/splash/CinematicIntroSplash.tsx) and the audio score
// (lib/splash/splashAudio.ts) both read their cues from here so the visual
// beats and the sound beats can never drift apart.
//
// The choreographed beats (mark swing-in, letter draw, crystal impact) all
// still land inside the original first 3s -- extending this constant to
// 5000 only lengthens the hold after they finish, so the mark and title sit
// on screen longer before the exit cross-fade rather than re-timing every
// keyframe in app/splash.css.

/** Total forced on-screen time before the exit fade begins. */
export const SPLASH_DURATION_MS = 5000;
/** Exit cross-fade length (the layer unmounts after DURATION + EXIT). */
export const SPLASH_EXIT_MS = 450;

/** Audio cue 1: the deep synthesized "UNITAS" vocal (1s -> 2s). */
export const SPLASH_VOCAL_AT_S = 1.0;
export const SPLASH_VOCAL_LENGTH_S = 1.0;
/** Audio cue 2: the crystal-echo impact that rings out the final second. */
export const SPLASH_CRYSTAL_AT_S = 2.0;
export const SPLASH_CRYSTAL_LENGTH_S = 1.0;

/** Title glyphs, filled U -> S in order. */
export const SPLASH_LETTERS = ['U', 'N', 'I', 'T', 'A', 'S'] as const;
/** First letter starts drawing at this offset; each next letter is staggered. */
export const SPLASH_LETTER_START_S = 0.5;
export const SPLASH_LETTER_STAGGER_S = 0.17;
/** Stroke draw length per letter (the "light running along the line"). */
export const SPLASH_LETTER_DRAW_S = 0.55;
/** Gradient fill floods in this long after a letter's stroke started. */
export const SPLASH_LETTER_FILL_LAG_S = 0.22;

/** Window `CustomEvent` name that restarts the splash (founder debug panel). */
export const SPLASH_REPLAY_EVENT = 'unitas:splash-replay';
/** `?splash=0|off|false` skips the splash (QA / Playwright only). */
export const SPLASH_QUERY_PARAM = 'splash';

const OFF_VALUES = new Set(['0', 'off', 'false']);

/** True unless the URL explicitly opts out. Fail-open: malformed -> run. */
export function shouldRunSplash(search: string): boolean {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || '');
  } catch {
    return true;
  }
  const value = params.get(SPLASH_QUERY_PARAM);
  if (value === null) return true;
  return !OFF_VALUES.has(value.trim().toLowerCase());
}

/** Seconds after splash start at which letter `index` begins its stroke draw. */
export function letterDrawStart(index: number): number {
  return SPLASH_LETTER_START_S + index * SPLASH_LETTER_STAGGER_S;
}

/** Seconds after splash start at which letter `index` begins filling. */
export function letterFillStart(index: number): number {
  return letterDrawStart(index) + SPLASH_LETTER_FILL_LAG_S;
}

export interface SplashAudioOffsets {
  /** Delay (s) until the vocal should start, or null to skip it (too late). */
  vocalAt: number | null;
  /** Delay (s) until the crystal impact should start. */
  crystalAt: number;
}

/**
 * Autoplay policy means the AudioContext may only unlock on a later gesture.
 * Given how far into the splash we already are, this maps the absolute cue
 * times onto "from now" delays: cues still in the future keep their absolute
 * beat; a vocal we are already past is compressed (played now) while there is
 * still room for it before the crystal, and dropped once it is not.
 */
export function splashAudioOffsets(elapsedS: number): SplashAudioOffsets {
  const e = Math.max(0, elapsedS);
  const crystalAbs = Math.max(0, SPLASH_CRYSTAL_AT_S - e);
  const vocalAbs = SPLASH_VOCAL_AT_S - e;
  if (vocalAbs >= 0) return { vocalAt: vocalAbs, crystalAt: crystalAbs };
  // Past the vocal cue: play it immediately only if most of it still fits
  // before the crystal impact would land.
  const roomLeft = SPLASH_CRYSTAL_AT_S - e;
  if (roomLeft >= SPLASH_VOCAL_LENGTH_S * 0.6) {
    return { vocalAt: 0, crystalAt: Math.max(crystalAbs, SPLASH_VOCAL_LENGTH_S * 0.85) };
  }
  return { vocalAt: null, crystalAt: crystalAbs };
}
