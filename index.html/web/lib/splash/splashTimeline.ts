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

/** Audio cue 1: the synthesized "UNITAS" chant. It starts at 1s; since the
 *  round-10 rebuild (owner instruction 2026-09-05) it is a slow,
 *  letter-by-letter human delivery rather than a one-second burst, so it
 *  deliberately OVERLAPS the crystal impact: the sustained "A" of "-TAS" is
 *  still ringing when the crystal lands at 2s, and the final "S" hiss rides
 *  out into the echo tail. Round 11 (owner instruction 2026-09-05, item 4)
 *  re-voiced it as a deep human BARITONE chest murmur with a soft echo.
 *  Round 12 (owner instruction 2026-09-05, 7-point hardening, item 1)
 *  re-segmented it into four organically separated syllables -- 유 (mid,
 *  shortened) · 니 (the high-tone point) · 타 (mid) · 스 (the lowest tone)
 *  -- at 1.9s. */
export const SPLASH_VOCAL_AT_S = 1.0;
export const SPLASH_VOCAL_LENGTH_S = 1.9;
/** Audio cue 2: the crystal-echo impact that rings out the final second. */
export const SPLASH_CRYSTAL_AT_S = 2.0;
export const SPLASH_CRYSTAL_LENGTH_S = 1.0;
/** How far the vocal onset is meant to lead the crystal impact. This -- not
 *  the vocal's own length -- is what a late audio unlock has to preserve. */
export const SPLASH_VOCAL_LEAD_S = SPLASH_CRYSTAL_AT_S - SPLASH_VOCAL_AT_S;

/**
 * sessionStorage key the Coming-Soon curtain (components/ComingSoonCinema.tsx)
 * persists its phase under. Owned here (pure, dependency-free) because the
 * pre-hydration bootstrap in lib/pwa/installPrompt.ts and the splash gate
 * below both need it -- one constant, three readers, zero drift.
 */
export const CINEMA_PHASE_STORAGE_KEY = 'unitas_cinema_phase';

/**
 * Curtain phases that count as a SUB-VIEW of the pre-launch funnel (owner
 * instruction 2026-09-05, round 10, item 3): the logo/entry gate, the 30s ad
 * cinema and the sealed Coming-Soon screen. A refresh while parked on any of
 * these must re-render THAT view in place -- the intro "logo page" splash is
 * reserved for a cold first load and for the main home (`released`).
 */
export const SPLASH_SUB_VIEW_PHASES = ['gate', 'cinema', 'sealed'] as const;

/** True when the persisted curtain phase names a sub-view (see above). */
export function isSubViewPhase(phase: string | null | undefined): boolean {
  if (!phase) return false;
  return (SPLASH_SUB_VIEW_PHASES as readonly string[]).includes(phase.trim());
}

/**
 * sessionStorage flag the splash component raises for exactly as long as the
 * "logo page" is on screen (owner instruction 2026-09-05, 7-point hardening,
 * item 6). A refresh while it is set means the visitor was LOOKING AT the
 * logo page, so the reload must restart that page -- not skip ahead to the
 * entry gate the curtain had already persisted underneath it. Cleared the
 * moment the splash finishes; wiped with the rest of the session on any
 * re-entry (lib/pwa/installPrompt.ts).
 */
export const SPLASH_ACTIVE_STORAGE_KEY = 'unitas_splash_active';
export const SPLASH_ACTIVE_VALUE = '1';

/** True when the persisted flag says the logo page was showing. */
export function isSplashActiveFlag(value: string | null | undefined): boolean {
  return (value ?? '').trim() === SPLASH_ACTIVE_VALUE;
}

/**
 * Combined gate: the URL opt-out (`?splash=0`) wins; then a refresh parked ON
 * the logo page itself (`splashActive`) restarts the logo page; then a
 * persisted sub-view phase suppresses the splash so the refresh lands in
 * place. A missing/unknown phase (cold visit, `released` main home) runs the
 * splash.
 */
export function shouldRunSplashForPhase(
  search: string,
  phase: string | null | undefined,
  splashActive = false,
): boolean {
  if (!shouldRunSplash(search)) return false;
  if (splashActive) return true;
  return !isSubViewPhase(phase);
}

/**
 * Re-entry reset doctrine (owner instruction 2026-09-05, round 11, item 3).
 *
 * Every DOCUMENT LOAD that is not an in-place refresh is a (re-)entry: a
 * PWA launch, a typed/bookmarked URL, an external link, a browser session
 * restore, a history traversal back onto the site. On every one of those --
 * on every device, online and App -- the tab's session state (curtain phase,
 * sub-view UI state, open popups) is wiped BEFORE anything reads it, so the
 * visitor always starts from the very first "logo page" splash instead of
 * being restored into whatever sub-view they left. Only `reload` is exempt:
 * the round-10 rule that an F5 parked on a sub-view re-renders that view in
 * place still holds, because a refresh is not a re-entry.
 *
 * `search` carries the QA opt-out: the Playwright harness drives the funnel
 * with `?splash=0`, and that flag keeps session state as well (a harness
 * that pre-seeds a phase and then navigates must not be wiped).
 */
export function shouldResetEntrySession(navigationType: string | null | undefined, search: string): boolean {
  if (!shouldRunSplash(search)) return false;
  return (navigationType ?? '').trim().toLowerCase() !== 'reload';
}

/** Title glyphs, filled U -> S in order. */
export const SPLASH_LETTERS = ['U', 'N', 'I', 'T', 'A', 'S'] as const;
/** First letter starts drawing at this offset; each next letter is staggered. */
export const SPLASH_LETTER_START_S = 0.5;
/** Round 11: widened from 0.17s so each glyph's fill lands exactly as the
 *  travelling gold band (below) reaches it -- one letter at a time, U -> S. */
export const SPLASH_LETTER_STAGGER_S = 0.26;
/** Stroke draw length per letter (the "light running along the line"). */
export const SPLASH_LETTER_DRAW_S = 0.55;
/** Gradient fill floods in this long after a letter's stroke started. */
export const SPLASH_LETTER_FILL_LAG_S = 0.22;

/**
 * "UNITAS" gold colour loop (owner instruction 2026-09-05, round 11, item 5;
 * re-choreographed into THREE phases by the 7-point hardening, item 2).
 * A 5-second cycle:
 *   0-3s  a bright gold band travels across the title from the left-most
 *         glyph to the right-most, re-colouring one letter after the next
 *         (the "moving gold gradient");
 *   3-4s  a fast, brilliant multi-colour shimmer sweeps the whole title --
 *         a repeating rainbow-prism gradient crossing it SHIMMER_PERIODS
 *         times inside the second, lit through a cross-faded overlay;
 *   4-5s  every glyph sits on the ORIGINAL pure solid gold (#d4af37),
 *         perfectly still.
 * Then it repeats. The period equals the splash hold on purpose -- one full
 * cycle plays per splash -- and the loop is infinite so a replay / longer
 * hold keeps cycling.
 */
export const SPLASH_GOLD_LOOP_S = 5;
export const SPLASH_GOLD_SWEEP_S = 3;
export const SPLASH_GOLD_SHIMMER_S = 1;
export const SPLASH_GOLD_HOLD_S = SPLASH_GOLD_LOOP_S - SPLASH_GOLD_SWEEP_S - SPLASH_GOLD_SHIMMER_S;
/** The title's original gold -- what the hold phase (and the pad colour of
 *  the sweeping gradient) shows. */
export const SPLASH_GOLD_HEX = '#d4af37';
/** Gradient `translate` x at the start of the sweep (band fully left of the
 *  glyphs) and at its end (band fully past the last glyph). The title SVG is
 *  720 user units wide with the band centred at x = 360 of the gradient. */
export const SPLASH_GOLD_SWEEP_FROM_X = -500;
export const SPLASH_GOLD_SWEEP_TO_X = 420;
/** Title SVG width in user units -- one full period of the shimmer gradient. */
export const SPLASH_TITLE_WIDTH = 720;
/** How many full rainbow sweeps cross the title during the 1s shimmer. */
export const SPLASH_SHIMMER_PERIODS = 2;
/** Cross-fade length (s) at each edge of the shimmer window so the colour
 *  bloom rises out of the gold and dissolves back into it, never hard-cuts. */
export const SPLASH_SHIMMER_FADE_S = 0.1;

const clampKeyTime = (t: number) => Math.min(1, Math.max(0, Number(t.toFixed(4))));

/** SMIL `keyTimes` for the loop: sweep 0 -> SWEEP_S, then hold to LOOP_S. */
export function goldLoopKeyTimes(): string {
  const holdAt = SPLASH_GOLD_SWEEP_S / SPLASH_GOLD_LOOP_S;
  return `0;${holdAt};1`;
}

/** SMIL `values` for the loop (translate x/y pairs): from -> to -> to (hold). */
export function goldLoopValues(): string {
  return `${SPLASH_GOLD_SWEEP_FROM_X} 0;${SPLASH_GOLD_SWEEP_TO_X} 0;${SPLASH_GOLD_SWEEP_TO_X} 0`;
}

/** Shimmer window edges as fractions of the loop. */
export function shimmerWindow(): { start: number; end: number } {
  return {
    start: SPLASH_GOLD_SWEEP_S / SPLASH_GOLD_LOOP_S,
    end: (SPLASH_GOLD_SWEEP_S + SPLASH_GOLD_SHIMMER_S) / SPLASH_GOLD_LOOP_S,
  };
}

/** SMIL `keyTimes` for the shimmer overlay's opacity: hidden, fade in at the
 *  window start, hold, fade out at the window end, hidden. */
export function shimmerOpacityKeyTimes(): string {
  const { start, end } = shimmerWindow();
  const fade = SPLASH_SHIMMER_FADE_S / SPLASH_GOLD_LOOP_S;
  return [0, start, start + fade, end - fade, end, 1].map(clampKeyTime).join(';');
}

/** SMIL `values` matching `shimmerOpacityKeyTimes()`. */
export function shimmerOpacityValues(): string {
  return '0;0;1;1;0;0';
}

/** SMIL `keyTimes` for the shimmer gradient's translate: parked, then a fast
 *  multi-period sweep across the shimmer window, then parked again. */
export function shimmerSweepKeyTimes(): string {
  const { start, end } = shimmerWindow();
  return [0, start, end, 1].map(clampKeyTime).join(';');
}

/** SMIL `values` matching `shimmerSweepKeyTimes()` (translate x/y pairs). The
 *  gradient repeats every TITLE_WIDTH, so travelling PERIODS x TITLE_WIDTH
 *  inside the window crosses the whole title PERIODS times. */
export function shimmerSweepValues(): string {
  const travel = -SPLASH_SHIMMER_PERIODS * SPLASH_TITLE_WIDTH;
  return `0 0;0 0;${travel} 0;${travel} 0`;
}

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
 * beat; once we are past the vocal cue the whole score is simply re-based on
 * the unlock moment -- the chant plays NOW and the crystal lands its full
 * lead behind it.
 *
 * Owner instruction 2026-09-05 (7-point hardening, item 7): the vocal is
 * NEVER dropped any more. On a phone in the online channel the very first
 * touch is the unlock, and it routinely arrives 2-4s into the splash; the
 * round-11 rule that discarded a chant "too late for its lead" was the exact
 * reason the mobile logo page played the crystal alone -- or nothing. The
 * audio module keeps its context alive long enough for a late-started score
 * to finish (see splashAudio.ts `dispose`).
 */
export function splashAudioOffsets(elapsedS: number): SplashAudioOffsets {
  const e = Math.max(0, elapsedS);
  const crystalAbs = Math.max(0, SPLASH_CRYSTAL_AT_S - e);
  const vocalAbs = SPLASH_VOCAL_AT_S - e;
  if (vocalAbs >= 0) return { vocalAt: vocalAbs, crystalAt: crystalAbs };
  return { vocalAt: 0, crystalAt: Math.max(crystalAbs, SPLASH_VOCAL_LEAD_S) };
}
