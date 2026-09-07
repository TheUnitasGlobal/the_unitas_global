'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { MasterMarkLogo } from '@/components/brand/MasterMarkLogo';
import { armLogoEntryChime } from '@/lib/audio/logoEntryChime';
import {
  CINEMA_PHASE_STORAGE_KEY,
  SPLASH_ACTIVE_STORAGE_KEY,
  SPLASH_ACTIVE_VALUE,
  SPLASH_CORP_AT_S,
  SPLASH_DURATION_MS,
  SPLASH_EXIT_MS,
  SPLASH_GOLD_DEEP_HEX,
  SPLASH_GOLD_HEX,
  SPLASH_GOLD_LIGHT_HEX,
  SPLASH_GOLD_LOOP_S,
  SPLASH_GOLD_PALE_HEX,
  SPLASH_IMPACT_AT_S,
  SPLASH_LETTERS,
  SPLASH_LETTER_DRAW_S,
  SPLASH_REPLAY_EVENT,
  SPLASH_STROKE_FADE_AT_S,
  SPLASH_STROKE_FADE_S,
  SPLASH_TITLE_WIDTH,
  goldLoopKeyTimes,
  goldLoopValues,
  isSplashActiveFlag,
  letterDrawStart,
  letterFillStart,
  shouldRunSplashForPhase,
} from '@/lib/splash/splashTimeline';

/** Persisted Coming-Soon curtain phase for this tab (null on a cold visit). */
function readPersistedCinemaPhase(): string | null {
  try {
    return window.sessionStorage.getItem(CINEMA_PHASE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** True when the tab was refreshed WHILE the logo page was on screen. */
function readSplashActiveFlag(): boolean {
  try {
    return isSplashActiveFlag(window.sessionStorage.getItem(SPLASH_ACTIVE_STORAGE_KEY));
  } catch {
    return false;
  }
}

/** Raise / clear the "logo page is showing" flag (item 6, current-page reload). */
function setSplashActiveFlag(active: boolean): void {
  try {
    if (active) window.sessionStorage.setItem(SPLASH_ACTIVE_STORAGE_KEY, SPLASH_ACTIVE_VALUE);
    else window.sessionStorage.removeItem(SPLASH_ACTIVE_STORAGE_KEY);
  } catch {
    /* storage blocked -- a refresh simply follows the curtain phase */
  }
}

/**
 * Cinematic 3D intro splash -- the "logo page" (owner instruction 2026-09-04,
 * item 3; re-timed to EXACTLY 3 seconds and made completely SILENT per owner
 * instruction 2026-09-05, checklist item 1).
 *
 * Forced on EVERY cold entry / PWA launch, on every device, before anything
 * else -- it sits at z-[700], above the pre-launch curtain (z-400), the
 * audio gate (z-300) and the PWA install sheet (z-650). Mounted in the true
 * root layout (app/layout.tsx), outside the `[locale]` segment, so a locale
 * auto-switch during the first seconds can't remount and restart it.
 *
 * NO VOICE/AMBIENT SCORE (item 1): the synthesized "UNITAS" chant and the
 * crystal-echo impact of rounds 10-13 stay deleted. The crystal "impact"
 * below survives only as a visual (ring burst + bloom). Owner instruction
 * 2026-09-06 (item 2) reintroduced exactly one sound: a short two-note entry
 * chime (lib/audio/logoEntryChime.ts), self-contained and hardened to fire
 * on every omni-channel surface (PC online/App, mobile online/App) -- see
 * `armLogoEntryChime()` in the effect below. Owner instruction 2026-09-07
 * (mobile online browser): the chime is armed from the document's first byte
 * by a head bootstrap and is never torn down with this layer -- it waits for
 * the phone visitor's first tap however late that comes.
 *
 * Visual beats (lib/splash/splashTimeline.ts owns the exact cues):
 *   0.0s  v2 master mark swings in from -100deg on a 3D perspective stage,
 *         then settles and holds -- the gold facet hexagon frame is FIXED
 *         once settled; only the elements nested inside it keep moving
 *         (triangle / dot-hexagon / bolt rod spin, globe fixed).
 *   0.35s "UNITAS": each glyph's outline is drawn by a travelling gold
 *         stroke (U -> S, staggered) and its fill fades in as the LIGHT
 *         below reaches it; the last glyph is solid by ~2.0s.
 *   0-3s  SINGLE-TONE GOLD ART LIGHT, for the WHOLE 3 seconds: the title is
 *         one hue, the original gold, rendered as solid burnished metal (a
 *         vertical gradient from deep gold at the foot through pure gold to
 *         pale gold at the crown) and, on a second `<text>` overlay masked
 *         to the same glyphs, one pale-gold SPECULAR LIGHT sweeps across the
 *         title from the left-most glyph to the right-most for the full 3s,
 *         catching one letter after the next -- one continuous flow driven
 *         by a single SMIL `gradientTransform`; behind it a breathing gold
 *         halo (`sp-title-breathe`) swells and settles twice.
 *   1.5s  "THE UNITAS GLOBAL OÜ" rises in.
 *   1.7s  visual crystal impact: ring burst + screen bloom.
 *   2.35s the outline stroke fades out -- the letters are nothing but
 *         burnished gold under the still-moving light.
 *   3.0s  0.45s exit cross-fade, then the layer unmounts.
 *
 * Current-page reload (checklist items 2 + 3): while this layer is on screen
 * the tab carries `unitas_splash_active=1` in sessionStorage, so an F5 DURING
 * the logo page replays the logo page. An F5 parked on ANY other page --
 * the entry gate, an ad stage, the sealed Coming-Soon screen OR the released
 * main home -- re-renders that page in place with no logo page at all: the
 * head bootstrap hides this SSR'd layer before first paint and the effect
 * below unmounts it without running the timers.
 *
 * Fail-safe by construction: the exit is a pure CSS animation with a 3s
 * delay (`sp-autohide`), so even if JS never runs the layer still fades out
 * and releases pointer events. It is SSR'd visible (no flash of the page
 * under it); `?splash=0` (QA/E2E) hides it before first paint via the
 * `html[data-splash="off"]` attribute the head bootstrap stamps.
 */
export function CinematicIntroSplash() {
  const [active, setActive] = useState(true);
  const [run, setRun] = useState(0);

  // Founder debug panel / the Coming-Soon "다시 재생" can replay the splash.
  useEffect(() => {
    const onReplay = () => {
      // An explicit replay overrides the pre-paint CSS gate the head
      // bootstrap may have stamped for an in-place refresh (or ?splash=0).
      document.documentElement.removeAttribute('data-splash');
      setActive(true);
      setRun((n) => n + 1);
    };
    window.addEventListener(SPLASH_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(SPLASH_REPLAY_EVENT, onReplay);
  }, []);

  useEffect(() => {
    if (!active) return;
    // A refresh parked on any persisted page (gate / ad cinema / sealed /
    // released main home) re-renders that page in place -- no "logo page"
    // first. The head bootstrap already hid the SSR'd layer before paint;
    // this unmounts it and skips the timer. A cold entry (no persisted
    // phase) and a refresh DURING the logo page still run it.
    if (
      run === 0 &&
      !shouldRunSplashForPhase(window.location.search, readPersistedCinemaPhase(), readSplashActiveFlag())
    ) {
      setActive(false);
      return;
    }

    // "The logo page is showing" -- an F5 from here replays it.
    setSplashActiveFlag(true);

    // Arm the entry chime for this run of the logo page -- fires immediately
    // where the engine allows it, otherwise inside the visitor's first
    // activation gesture. MOBILE ONLINE BROWSER FIX (owner instruction
    // 2026-09-07): the chime is a document-level singleton that OUTLIVES this
    // layer. It is deliberately NOT disarmed in the cleanup below -- a phone
    // browser never lets a context start before the first tap, and that tap
    // usually comes after the 3 s logo page has already gone; tearing the
    // engine down here was exactly what silenced it. On a cold entry this
    // call adopts the chime the head bootstrap (ENTRY_CHIME_BOOTSTRAP,
    // app/layout.tsx) has been holding since the document's first byte.
    armLogoEntryChime({ replay: run > 0 });

    const done = window.setTimeout(() => {
      // The logo page is over -- a later refresh follows the curtain phase.
      setSplashActiveFlag(false);
      setActive(false);
    }, SPLASH_DURATION_MS + SPLASH_EXIT_MS);

    return () => {
      window.clearTimeout(done);
    };
  }, [active, run]);

  if (!active) return null;

  const cueVars = {
    '--sp-hold': `${SPLASH_DURATION_MS / 1000}s`,
    '--sp-exit': `${SPLASH_EXIT_MS / 1000}s`,
    '--sp-impact': `${SPLASH_IMPACT_AT_S}s`,
    '--sp-corp': `${SPLASH_CORP_AT_S}s`,
    '--sp-draw-len': `${SPLASH_LETTER_DRAW_S}s`,
    '--sp-stroke-fade-at': `${SPLASH_STROKE_FADE_AT_S}s`,
    '--sp-stroke-fade-len': `${SPLASH_STROKE_FADE_S}s`,
  } as CSSProperties;

  return (
    <div
      key={run}
      className="sp-root"
      role="presentation"
      aria-hidden="true"
      data-testid="intro-splash"
      style={cueVars}
    >
      <div className="sp-bg" />
      <div className="sp-grain" />
      <div className="sp-bloom" />

      <div className="sp-stage">
        <div className="sp-mark-3d">
          <div className="sp-mark">
            <MasterMarkLogo variant="hero" />
          </div>
          {/* Nested inside the mark's own box (not positioned against the
              viewport) so the burst locks onto the logo image's exact center
              on every layout -- owner instruction 2026-09-06, item 6. */}
          <div className="sp-flash" />
        </div>

        <svg className="sp-title" viewBox="0 0 720 150" aria-hidden="true">
          <defs>
            {/* Outline stroke: gold -> pale gold -> gold. ONE hue. */}
            <linearGradient id="sp-stroke-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={SPLASH_GOLD_HEX} />
              <stop offset="0.5" stopColor={SPLASH_GOLD_PALE_HEX} />
              <stop offset="1" stopColor={SPLASH_GOLD_HEX} />
            </linearGradient>
            {/* Body fill: SOLID BURNISHED GOLD -- a vertical gradient of the
                ORIGINAL gold hue only: pale gold on the crown of each glyph,
                pure #d4af37 through the body, deep gold at the foot, a thin
                pale highlight along the lower bevel. userSpaceOnUse so the
                same metal runs through all six glyphs at the same height. */}
            <linearGradient
              id="sp-fill-grad"
              gradientUnits="userSpaceOnUse"
              spreadMethod="pad"
              x1="0"
              y1="26"
              x2="0"
              y2="124"
            >
              <stop offset="0" stopColor={SPLASH_GOLD_PALE_HEX} />
              <stop offset="0.16" stopColor={SPLASH_GOLD_LIGHT_HEX} />
              <stop offset="0.46" stopColor={SPLASH_GOLD_HEX} />
              <stop offset="0.74" stopColor={SPLASH_GOLD_DEEP_HEX} />
              <stop offset="0.88" stopColor={SPLASH_GOLD_HEX} />
              <stop offset="1" stopColor={SPLASH_GOLD_LIGHT_HEX} />
            </linearGradient>
            {/* Specular light: transparent everywhere except one pale-gold
                blade in its middle (`spreadMethod="pad"` keeps the ends
                transparent). Translating it sweeps the blade across the
                title U -> S over the full 3s hold (one letter after the
                next) and repeats -- lib/splash/splashTimeline.ts owns the
                cue maths. Same hue as the body: the light only LIFTS the
                gold, it never recolours it. */}
            <linearGradient
              id="sp-sheen-grad"
              gradientUnits="userSpaceOnUse"
              spreadMethod="pad"
              x1="0"
              y1="0"
              x2={SPLASH_TITLE_WIDTH}
              y2="0"
            >
              <stop offset="0" stopColor={SPLASH_GOLD_PALE_HEX} stopOpacity="0" />
              <stop offset="0.38" stopColor={SPLASH_GOLD_PALE_HEX} stopOpacity="0" />
              <stop offset="0.46" stopColor={SPLASH_GOLD_LIGHT_HEX} stopOpacity="0.55" />
              <stop offset="0.5" stopColor={SPLASH_GOLD_PALE_HEX} stopOpacity="0.95" />
              <stop offset="0.54" stopColor={SPLASH_GOLD_LIGHT_HEX} stopOpacity="0.55" />
              <stop offset="0.62" stopColor={SPLASH_GOLD_PALE_HEX} stopOpacity="0" />
              <stop offset="1" stopColor={SPLASH_GOLD_PALE_HEX} stopOpacity="0" />
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                values={goldLoopValues()}
                keyTimes={goldLoopKeyTimes()}
                dur={`${SPLASH_GOLD_LOOP_S}s`}
                repeatCount="indefinite"
                calcMode="linear"
              />
            </linearGradient>
          </defs>
          <text x="372" y="110" textAnchor="middle" className="sp-title-text">
            {SPLASH_LETTERS.map((letter, i) => (
              <tspan
                key={`${letter}-${i}`}
                className="sp-letter"
                style={
                  {
                    '--draw': `${letterDrawStart(i)}s`,
                    '--fill': `${letterFillStart(i)}s`,
                  } as CSSProperties
                }
              >
                {letter}
              </tspan>
            ))}
          </text>
          {/* Specular overlay: the same glyphs painted with the sweeping
              pale-gold light. Each overlay glyph fades in on the same cue as
              its base glyph, so the light never shows on a letter that has
              not been drawn yet. Identical tspan structure so glyph advances
              match pixel-for-pixel. */}
          <text x="372" y="110" textAnchor="middle" className="sp-title-text sp-title-sheen" aria-hidden="true">
            {SPLASH_LETTERS.map((letter, i) => (
              <tspan
                key={`sheen-${letter}-${i}`}
                className="sp-letter-sheen"
                style={{ '--fill': `${letterFillStart(i)}s` } as CSSProperties}
              >
                {letter}
              </tspan>
            ))}
          </text>
        </svg>

        <p className="sp-corp">THE UNITAS GLOBAL OÜ</p>
      </div>
    </div>
  );
}

// The animated master mark itself lives in components/brand/MasterMarkLogo.tsx
// -- shared with the nav-bar small logo and the Coming-Soon ad page's install
// CTA (owner instruction 2026-09-05, item 1).
