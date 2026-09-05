'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { MasterMarkLogo } from '@/components/brand/MasterMarkLogo';
import { createSplashAudio } from '@/lib/splash/splashAudio';
import {
  SPLASH_DURATION_MS,
  SPLASH_EXIT_MS,
  SPLASH_LETTERS,
  SPLASH_REPLAY_EVENT,
  letterDrawStart,
  letterFillStart,
  shouldRunSplash,
} from '@/lib/splash/splashTimeline';

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
 *         spins (`sp-tri-spin`), the centered dot-hexagon spins the other
 *         way (`sp-dothex`), and the hologram globe spins while it pulses
 *         (`sp-globe`) -- all compositor CSS, all still inside the static
 *         hex frame.
 *   0.5s  "UNITAS": each glyph's outline is drawn by a travelling gradient
 *         stroke (U -> S, staggered), then a flowing gold/white/cyan gradient
 *         floods the fill left-to-right like water following the line.
 *   1.9s  "THE UNITAS GLOBAL OÜ" rises in.
 *   2.0s  crystal impact: ring burst + screen bloom (matches the audio hit).
 *   3.0s  choreography complete; the mark and title hold on screen.
 *   5.0s  0.45s exit cross-fade, then the layer unmounts.
 *
 * Fail-safe by construction: the exit is a pure CSS animation with a 5s delay
 * (`sp-autohide`), so even if JS never runs the layer still fades out and
 * releases pointer events. It is SSR'd visible (no flash of the page under
 * it); `?splash=0` (QA/E2E) hides it before first paint via the
 * `html[data-splash="off"]` attribute the head bootstrap stamps.
 *
 * Audio: lib/splash/splashAudio.ts -- synthesized "UNITAS" vocal (1-2s) and
 * crystal echo (2-3s), at 0.3x the prior master gain (owner instruction
 * 2026-09-05, item 2), with an additional 30% cut on desktop only (owner
 * instruction 2026-09-05, round 2; handheld devices keep the round-1
 * level). Any pointer/key gesture during the splash unlocks a context the
 * autoplay policy kept suspended.
 */
export function CinematicIntroSplash() {
  const [active, setActive] = useState(true);
  const [run, setRun] = useState(0);

  // Founder debug panel can replay the splash at will.
  useEffect(() => {
    const onReplay = () => {
      setActive(true);
      setRun((n) => n + 1);
    };
    window.addEventListener(SPLASH_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(SPLASH_REPLAY_EVENT, onReplay);
  }, []);

  useEffect(() => {
    if (!active) return;
    if (run === 0 && !shouldRunSplash(window.location.search)) {
      setActive(false);
      return;
    }

    const startedAt = performance.now();
    let audio: ReturnType<typeof createSplashAudio> = null;
    try {
      audio = createSplashAudio(startedAt);
    } catch {
      audio = null;
    }

    const gesture = () => audio?.unlock();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('pointerdown', gesture, opts);
    window.addEventListener('touchstart', gesture, opts);
    window.addEventListener('keydown', gesture);

    const done = window.setTimeout(() => setActive(false), SPLASH_DURATION_MS + SPLASH_EXIT_MS);

    return () => {
      window.clearTimeout(done);
      window.removeEventListener('pointerdown', gesture);
      window.removeEventListener('touchstart', gesture);
      window.removeEventListener('keydown', gesture);
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
            <linearGradient id="sp-stroke-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#d4af37" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="1" stopColor="#00f3ff" />
            </linearGradient>
            <linearGradient
              id="sp-fill-grad"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="720"
              y2="0"
            >
              <stop offset="0" stopColor="#8a6d1d" />
              <stop offset="0.32" stopColor="#d4af37" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="0.66" stopColor="#00f3ff" />
              <stop offset="1" stopColor="#d4af37" />
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                from="-760 0"
                to="0 0"
                begin="0.55s"
                dur="1.5s"
                fill="freeze"
                calcMode="spline"
                keySplines="0.4 0 0.2 1"
                keyTimes="0;1"
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
