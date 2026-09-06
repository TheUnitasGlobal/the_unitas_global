// Pure timeline constants + predicates for the cinematic intro splash
// (owner instruction 2026-09-04, item 3; re-timed to EXACTLY 3 seconds and
// made silent per owner instruction 2026-09-05, checklist item 1). No DOM,
// no React -- unit tested in __tests__/splash/splashTimeline.test.ts. The
// component (components/splash/CinematicIntroSplash.tsx) and the CSS
// (app/splash.css) both read their cues from here so the beats can never
// drift apart.
//
// Checklist item 1 (2026-09-05): the "logo page" is on screen for exactly
// 3 seconds, carries NO voice and NO sound effect of any kind (the synthesized
// chant + crystal echo of rounds 10-13 are deleted outright -- there is no
// audio module for this page any more), and the "UNITAS" title carries its
// colour-light art effect for the whole 3 seconds.

/** Total forced on-screen time before the exit fade begins: exactly 3s. */
export const SPLASH_DURATION_MS = 3000;
/** Exit cross-fade length (the layer unmounts after DURATION + EXIT). */
export const SPLASH_EXIT_MS = 450;

/**
 * sessionStorage key the Coming-Soon curtain (components/ComingSoonCinema.tsx)
 * persists its phase under. Owned here (pure, dependency-free) because the
 * pre-hydration bootstrap in lib/pwa/installPrompt.ts and the splash gate
 * below both need it -- one constant, three readers, zero drift.
 */
export const CINEMA_PHASE_STORAGE_KEY = 'unitas_cinema_phase';

/**
 * Every curtain phase a tab can be parked on: the entry gate, the 30s ad
 * cinema (stages 1-4 + the closing stage), the sealed Coming-Soon screen and
 * the released MAIN HOME. A refresh while parked on ANY of these re-renders
 * THAT page in place, with no "logo page" in between (owner instruction
 * 2026-09-05, checklist items 2 + 3: "새로고침시 ... 아무것도 안보이게" --
 * in particular an F5 on the main home must never show the logo page again).
 * The logo page runs only on a cold entry (no persisted phase yet) and on a
 * refresh that lands WHILE the logo page itself is showing (see
 * `SPLASH_ACTIVE_STORAGE_KEY`).
 */
export const SPLASH_IN_PLACE_PHASES = ['gate', 'cinema', 'sealed', 'released'] as const;

/** True when the persisted curtain phase names a page that refreshes in place. */
export function isInPlacePhase(phase: string | null | undefined): boolean {
  if (!phase) return false;
  return (SPLASH_IN_PLACE_PHASES as readonly string[]).includes(phase.trim());
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
 * the logo page itself (`splashActive`) restarts the logo page; then ANY
 * persisted phase (gate / cinema / sealed / released) suppresses the splash
 * so the refresh lands in place. Only a missing/unknown phase (a cold entry)
 * runs the splash.
 */
export function shouldRunSplashForPhase(
  search: string,
  phase: string | null | undefined,
  splashActive = false,
): boolean {
  if (!shouldRunSplash(search)) return false;
  if (splashActive) return true;
  return !isInPlacePhase(phase);
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
 * an F5 parked on any page re-renders that page in place, because a refresh
 * is not a re-entry.
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
/** First letter starts drawing at this offset; each next letter is staggered.
 *  Compressed for the 3s hold: the last glyph has started filling by ~1.4s
 *  and is solid by ~2.0s, leaving the final second for the light to finish
 *  its pass over the complete word. */
export const SPLASH_LETTER_START_S = 0.35;
export const SPLASH_LETTER_STAGGER_S = 0.18;
/** Stroke draw length per letter (the "light running along the line"). */
export const SPLASH_LETTER_DRAW_S = 0.45;
/** Gradient fill floods in this long after a letter's stroke started. */
export const SPLASH_LETTER_FILL_LAG_S = 0.18;
/** The outline stroke fades out here, so the word is pure burnished gold
 *  before the exit fade begins at 3.0s. */
export const SPLASH_STROKE_FADE_AT_S = 2.35;
export const SPLASH_STROKE_FADE_S = 0.5;
/** Visual crystal impact (ring burst + screen bloom) -- purely visual, no
 *  sound (item 1). Lands once every glyph outline has been drawn. */
export const SPLASH_IMPACT_AT_S = 1.7;
/** "THE UNITAS GLOBAL OÜ" rises in. */
export const SPLASH_CORP_AT_S = 1.5;

/**
 * "UNITAS" SINGLE-TONE gold light (owner instruction 2026-09-05, hardening
 * patch, item 3; re-timed to the 3s hold by checklist item 1). The title is
 * ONE tone, the original gold (#d4af37), rendered as solid metal: a vertical
 * burnished-gold body (deep gold at the foot, pure gold in the body, pale
 * gold at the crown -- all the same hue) with a single pale-gold specular
 * light sweeping across it from the left-most glyph to the right-most,
 * catching one letter after the next, for the WHOLE 3 seconds the logo page
 * is on screen -- the colour art effect never rests while the page shows.
 * The period equals the splash hold on purpose -- one full pass plays per
 * splash -- and the loop is infinite so a replay / longer hold keeps cycling.
 */
export const SPLASH_GOLD_LOOP_S = 3;
export const SPLASH_GOLD_SWEEP_S = 3;
export const SPLASH_GOLD_HOLD_S = SPLASH_GOLD_LOOP_S - SPLASH_GOLD_SWEEP_S;
/** The title's one and only hue -- the original gold. */
export const SPLASH_GOLD_HEX = '#d4af37';
/** Same hue, darker (the metal's foot / shadow side). */
export const SPLASH_GOLD_DEEP_HEX = '#9c7a1f';
/** Same hue, brighter (the metal's crown / lit edge). */
export const SPLASH_GOLD_LIGHT_HEX = '#f1d36a';
/** Same hue, palest (the specular light itself). */
export const SPLASH_GOLD_PALE_HEX = '#fff4c7';
/** Gradient `translate` x at the start of the sweep (light fully left of the
 *  glyphs) and at its end (light fully past the last glyph). The title SVG is
 *  720 user units wide with the light centred at x = 360 of the gradient. */
export const SPLASH_GOLD_SWEEP_FROM_X = -500;
export const SPLASH_GOLD_SWEEP_TO_X = 420;
/** Title SVG width in user units. */
export const SPLASH_TITLE_WIDTH = 720;

/** SMIL `keyTimes` for the loop: sweep 0 -> SWEEP_S, then (if any) hold to
 *  LOOP_S. With no hold the cue list collapses to a plain two-point sweep. */
export function goldLoopKeyTimes(): string {
  if (SPLASH_GOLD_HOLD_S <= 0) return '0;1';
  const holdAt = SPLASH_GOLD_SWEEP_S / SPLASH_GOLD_LOOP_S;
  return `0;${holdAt};1`;
}

/** SMIL `values` for the loop (translate x/y pairs): from -> to [-> to]. */
export function goldLoopValues(): string {
  const sweep = `${SPLASH_GOLD_SWEEP_FROM_X} 0;${SPLASH_GOLD_SWEEP_TO_X} 0`;
  if (SPLASH_GOLD_HOLD_S <= 0) return sweep;
  return `${sweep};${SPLASH_GOLD_SWEEP_TO_X} 0`;
}

/** Every colour the title may ever show, for the single-tone guard test:
 *  all four are the same gold hue at different lightness. */
export const SPLASH_TITLE_PALETTE = [
  SPLASH_GOLD_DEEP_HEX,
  SPLASH_GOLD_HEX,
  SPLASH_GOLD_LIGHT_HEX,
  SPLASH_GOLD_PALE_HEX,
] as const;

/** Hue (degrees) of a `#rrggbb` colour -- used to prove the palette is one
 *  tone. */
export function hexHue(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
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
