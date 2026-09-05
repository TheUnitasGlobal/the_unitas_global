'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { MasterMarkLogo } from '@/components/brand/MasterMarkLogo';
import { attachActivationUnlock, createSplashAudio } from '@/lib/splash/splashAudio';
import {
  CINEMA_PHASE_STORAGE_KEY,
  SPLASH_ACTIVE_STORAGE_KEY,
  SPLASH_ACTIVE_VALUE,
  SPLASH_DURATION_MS,
  SPLASH_EXIT_MS,
  SPLASH_GOLD_HEX,
  SPLASH_GOLD_LOOP_S,
  SPLASH_LETTERS,
  SPLASH_REPLAY_EVENT,
  SPLASH_TITLE_WIDTH,
  goldLoopKeyTimes,
  goldLoopValues,
  isSplashActiveFlag,
  letterDrawStart,
  letterFillStart,
  shimmerOpacityKeyTimes,
  shimmerOpacityValues,
  shimmerSweepKeyTimes,
  shimmerSweepValues,
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

/** Shimmer-phase prism palette (item 2): gold -> ice-cyan -> violet -> rose
 *  -> white -> gold, repeating, so the 1s sweep reads as a brilliant
 *  multi-colour flash rather than a single hue. */
const SHIMMER_STOPS: ReadonlyArray<[number, string]> = [
  [0, SPLASH_GOLD_HEX],
  [0.14, '#fff7d6'],
  [0.28, '#00f3ff'],
  [0.42, '#7c3aed'],
  [0.56, '#ec4899'],
  [0.7, '#ffffff'],
  [0.84, '#f1d36a'],
  [1, SPLASH_GOLD_HEX],
];

/**
 * Cinematic 3D intro splash (owner instruction 2026-09-04, item 3; extended
 * to a 5s hold and the master mark's rotation redesigned per owner
 * instruction 2026-09-05, item 1).
 *
 * Forced on EVERY cold load / PWA launch, on every device, before anything
 * else -- it sits at z-[700], above the pre-launch curtain (z-400), the
 * audio gate (z-300) and the PWA install sheet (z-650). Mounted in the true
 * root layout (app/layout.tsx), outside the `[locale]` segment, so a locale
 * auto-switch during the first seconds can't remount and restart it.
 *
 * Visual beats (see lib/splash/splashTimeline.ts for the exact cues):
 *   0.0s  v2 master mark swings in from -100deg on a 3D perspective stage,
 *         then settles and holds -- the gold facet hexagon frame is FIXED
 *         once settled (no continuous 3D sway); only the elements nested
 *         inside it keep moving, each independently: the lightning triangle
 *         spins about its true centroid (`sp-tri-spin`, origin 50%/66.667%
 *         of its fill-box == (250, 180)), the centered dot-hexagon spins the
 *         other way (`sp-dothex`), the bolt rod spins (`sp-bolt-spin`), and
 *         the hologram globe stays FIXED at that same (250, 180) centre --
 *         all compositor CSS, all still inside the static hex frame.
 *   0.5s  "UNITAS": each glyph's outline is drawn by a travelling gold
 *         stroke (U -> S, staggered) and its fill fades in as the GOLD BAND
 *         below reaches it.
 *   0-3s  COLOUR LOOP, phase 1 (owner instruction 2026-09-05, round 11,
 *         item 5): a bright gold band sweeps across the title from the
 *         left-most glyph to the right-most, re-colouring one letter after
 *         the next -- the "moving gold gradient". Driven by a single SMIL
 *         `gradientTransform` on the shared fill gradient, so it is one
 *         continuous flow rather than six disjoint flashes.
 *   1.9s  "THE UNITAS GLOBAL OÜ" rises in.
 *   2.0s  crystal impact: ring burst + screen bloom (matches the audio hit).
 *   3-4s  COLOUR LOOP, phase 2 (7-point hardening, item 2): a FAST, brilliant
 *         multi-colour shimmer -- a repeating gold/cyan/violet/rose/white
 *         prism gradient crosses the whole title twice inside the second,
 *         painted by a second `<text>` overlay whose opacity cross-fades in
 *         at 3.0s and out by 4.0s (SMIL, same document timeline as the band
 *         sweep, so the phases can never drift apart).
 *   4-5s  COLOUR LOOP, phase 3: every glyph sits on the ORIGINAL pure solid
 *         gold (#d4af37), perfectly still (the outline stroke has faded out
 *         by 3.2s and the overlay is gone, so nothing but gold remains). The
 *         cycle then repeats every 5s (`repeatCount="indefinite"`) -- the
 *         period matches the splash hold, so one full cycle plays per
 *         splash, and a founder replay or a longer hold keeps cycling.
 *   5.0s  0.45s exit cross-fade, then the layer unmounts.
 *
 * Current-page reload (7-point hardening, item 6): while this layer is on
 * screen the tab carries `unitas_splash_active=1` in sessionStorage. The
 * curtain persists its `gate` phase underneath from its first frame, which
 * -- before this -- made an F5 during the logo page skip straight to the
 * entry gate. Now the head bootstrap and the effect below both see the flag
 * and replay the logo page instead, exactly where the visitor was.
 *
 * Fail-safe by construction: the exit is a pure CSS animation with a 5s delay
 * (`sp-autohide`), so even if JS never runs the layer still fades out and
 * releases pointer events. It is SSR'd visible (no flash of the page under
 * it); `?splash=0` (QA/E2E) hides it before first paint via the
 * `html[data-splash="off"]` attribute the head bootstrap stamps.
 *
 * Audio: lib/splash/splashAudio.ts -- the synthesized "UNITAS" chant (a deep
 * human BARITONE chest murmur with a soft echo, letter-by-letter, ~1.0-2.8s;
 * round 11 item 4) and the crystal echo (2-3s). Master level = the 0.246
 * baseline x the global omni-channel 50% attenuation
 * (lib/audio/masterLevel.ts), identical on every device and in both the
 * online and App channels (owner instruction 2026-09-05, round 10, item 2).
 * Unlocking a context the autoplay policy kept suspended is handled by the
 * audio module's own global ACTIVATION-event listeners (`pointerup` /
 * `touchend` / `click` / mouse `pointerdown` / `keydown` -- round 11 item 2:
 * `touchstart` alone never carried activation on phones, which is why the
 * mobile online chant used to drop out); the effect below mirrors the same
 * set as a belt-and-braces second path.
 *
 * Sub-view refresh (round 10, item 3): when the tab's persisted Coming-Soon
 * phase is gate / cinema / sealed, the head bootstrap hides this layer
 * before paint and the effect below unmounts it -- the refresh lands on the
 * same view. Cold visits and the released main home still get the splash.
 */
export function CinematicIntroSplash() {
  const [active, setActive] = useState(true);
  const [run, setRun] = useState(0);

  // Founder debug panel can replay the splash at will.
  useEffect(() => {
    const onReplay = () => {
      // An explicit replay overrides the pre-paint CSS gate the head
      // bootstrap may have stamped for a sub-view refresh (or ?splash=0).
      document.documentElement.removeAttribute('data-splash');
      setActive(true);
      setRun((n) => n + 1);
    };
    window.addEventListener(SPLASH_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(SPLASH_REPLAY_EVENT, onReplay);
  }, []);

  useEffect(() => {
    if (!active) return;
    // Owner instruction 2026-09-05 (round 10, item 3): a refresh parked on a
    // pre-launch SUB-VIEW (gate / ad cinema / sealed Coming-Soon) re-renders
    // that view in place -- no "logo page" first. The head bootstrap already
    // hid the SSR'd layer before paint; this unmounts it and skips the
    // score/timers. A cold visit and the main home (`released`) still run.
    if (
      run === 0 &&
      !shouldRunSplashForPhase(window.location.search, readPersistedCinemaPhase(), readSplashActiveFlag())
    ) {
      setActive(false);
      return;
    }

    // Item 6: "the logo page is showing" -- an F5 from here replays it.
    setSplashActiveFlag(true);

    const startedAt = performance.now();
    let audio: ReturnType<typeof createSplashAudio> = null;
    try {
      audio = createSplashAudio(startedAt);
    } catch {
      audio = null;
    }

    // Second unlock path (the audio module installs the primary one itself):
    // the same activation-event set, so a gesture anywhere during the splash
    // resumes the context on every device, online and App alike.
    const detachGesture = attachActivationUnlock(() => audio?.unlock());

    const done = window.setTimeout(() => {
      // The logo page is over -- a later refresh follows the curtain phase.
      setSplashActiveFlag(false);
      setActive(false);
    }, SPLASH_DURATION_MS + SPLASH_EXIT_MS);

    return () => {
      window.clearTimeout(done);
      detachGesture();
      audio?.dispose();
    };
  }, [active, run]);

  if (!active) return null;

  return (
    <div key={run} className="sp-root" role="presentation" aria-hidden="true" data-testid="intro-splash">
      <div className="sp-bg" />
      <div className="sp-grain" />
      <div className="sp-bloom" />
      <div className="sp-flash" />

      <div className="sp-stage">
        <div className="sp-mark-3d">
          <div className="sp-mark">
            <MasterMarkLogo variant="hero" />
          </div>
        </div>

        <svg className="sp-title" viewBox="0 0 720 150" aria-hidden="true">
          <defs>
            {/* Outline stroke: gold -> white-gold -> gold (no cyan -- the
                typography must resolve to pure original gold). */}
            <linearGradient id="sp-stroke-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={SPLASH_GOLD_HEX} />
              <stop offset="0.5" stopColor="#fff4c7" />
              <stop offset="1" stopColor={SPLASH_GOLD_HEX} />
            </linearGradient>
            {/* Fill: the 5-second GOLD COLOUR LOOP (round 11, item 5). The
                gradient is the ORIGINAL gold everywhere except a bright band
                in its middle; `spreadMethod="pad"` extends the first/last
                stop, so wherever the band is not, a glyph shows solid
                #d4af37. Translating the gradient sweeps the band across the
                title U -> S over the first 3s (one letter after the next),
                then parks it past the last glyph for 2s (all glyphs solid
                original gold), and repeats -- lib/splash/splashTimeline.ts
                owns the cue maths. */}
            <linearGradient
              id="sp-fill-grad"
              gradientUnits="userSpaceOnUse"
              spreadMethod="pad"
              x1="0"
              y1="0"
              x2="720"
              y2="0"
            >
              <stop offset="0" stopColor={SPLASH_GOLD_HEX} />
              <stop offset="0.36" stopColor={SPLASH_GOLD_HEX} />
              <stop offset="0.44" stopColor="#f1d36a" />
              <stop offset="0.5" stopColor="#fff4c7" />
              <stop offset="0.56" stopColor="#f1d36a" />
              <stop offset="0.64" stopColor={SPLASH_GOLD_HEX} />
              <stop offset="1" stopColor={SPLASH_GOLD_HEX} />
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
            {/* Shimmer (phase 2, 3-4s -- 7-point hardening, item 2): a
                REPEATING prism gradient one title-width long. Translating it
                by two title-widths inside the 1s window sweeps the full
                colour cycle across every glyph twice -- fast and brilliant.
                Parked (and invisible, see the overlay's opacity animation)
                outside the window. */}
            <linearGradient
              id="sp-shimmer-grad"
              gradientUnits="userSpaceOnUse"
              spreadMethod="repeat"
              x1="0"
              y1="0"
              x2={SPLASH_TITLE_WIDTH}
              y2="0"
            >
              {SHIMMER_STOPS.map(([offset, color]) => (
                <stop key={offset} offset={offset} stopColor={color} />
              ))}
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                values={shimmerSweepValues()}
                keyTimes={shimmerSweepKeyTimes()}
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
          {/* Phase-2 overlay: the same glyphs painted with the prism
              gradient, cross-faded in at 3.0s and out by 4.0s on the SAME
              SMIL timeline as the band sweep. Below 3s and from 4s on it is
              fully transparent, so phase 1 (gold band) and phase 3 (pure
              gold) show the base text untouched. */}
          <text
            x="372"
            y="110"
            textAnchor="middle"
            className="sp-title-text sp-title-shimmer"
            fill="url(#sp-shimmer-grad)"
            opacity="0"
            aria-hidden="true"
          >
            {/* Same tspan structure as the base text so glyph advances match
                pixel-for-pixel (letter-spacing is applied per glyph either
                way, but identical markup removes any engine-level doubt). */}
            {SPLASH_LETTERS.map((letter, i) => (
              <tspan key={`shimmer-${letter}-${i}`}>{letter}</tspan>
            ))}
            <animate
              attributeName="opacity"
              values={shimmerOpacityValues()}
              keyTimes={shimmerOpacityKeyTimes()}
              dur={`${SPLASH_GOLD_LOOP_S}s`}
              repeatCount="indefinite"
              calcMode="linear"
            />
          </text>
        </svg>

        <p className="sp-corp">THE UNITAS GLOBAL OÜ</p>
      </div>
    </div>
  );
}

// The animated master mark itself now lives in
// components/brand/MasterMarkLogo.tsx -- shared with the nav-bar small logo
// and the Coming-Soon ad page's install CTA (owner instruction 2026-09-05,
// item 1).
