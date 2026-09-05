'use client';

import { useEffect, useState, type CSSProperties } from 'react';
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
 * 3-second cinematic 3D intro splash (owner instruction 2026-09-04, item 3).
 *
 * Forced on EVERY cold load / PWA launch, on every device, before anything
 * else -- it sits at z-[700], above the pre-launch curtain (z-400), the
 * audio gate (z-300) and the PWA install sheet (z-650). Mounted in the true
 * root layout (app/layout.tsx), outside the `[locale]` segment, so a locale
 * auto-switch during the first seconds can't remount and restart it.
 *
 * Visual beats (see lib/splash/splashTimeline.ts for the exact cues):
 *   0.0s  v2 master mark (gold facet hexagon, centered dot-hexagon, lightning
 *         triangle, hologram globe) swings in from -100deg on a 3D perspective
 *         stage, then floats; dot-hexagon spins, triangle/bolt strokes run
 *         their dashes and flicker, the globe pulses -- all compositor CSS.
 *   0.5s  "UNITAS": each glyph's outline is drawn by a travelling gradient
 *         stroke (U -> S, staggered), then a flowing gold/white/cyan gradient
 *         floods the fill left-to-right like water following the line.
 *   1.9s  "THE UNITAS GLOBAL OÜ" rises in.
 *   2.0s  crystal impact: ring burst + screen bloom (matches the audio hit).
 *   3.0s  0.45s exit cross-fade, then the layer unmounts.
 *
 * Fail-safe by construction: the exit is a pure CSS animation with a 3s delay
 * (`sp-autohide`), so even if JS never runs the layer still fades out and
 * releases pointer events. It is SSR'd visible (no flash of the page under
 * it); `?splash=0` (QA/E2E) hides it before first paint via the
 * `html[data-splash="off"]` attribute the head bootstrap stamps.
 *
 * Audio: lib/splash/splashAudio.ts -- synthesized "UNITAS" vocal (1-2s) and
 * crystal echo (2-3s). Any pointer/key gesture during the splash unlocks a
 * context the autoplay policy kept suspended.
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
            <MasterMark />
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

/**
 * The v2 "FINAL SYMMETRY" master mark, inlined from
 * public/assets/svg/unitas-mark.svg with animation hooks on each layer.
 * Kept geometry-identical to the single-source SVG (same viewBox, same
 * coordinates) so the splash logo is pixel-consistent with the nav mark,
 * favicon and PWA icons.
 */
function MasterMark() {
  return (
    <svg viewBox="174 64 152 152" role="img" aria-label="UNITAS">
      <defs>
        <filter id="sp-softBlur" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="sp-extremeGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="sp-sparkFilter" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="sp-globeGlow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <radialGradient id="sp-triBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#002A2A" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <radialGradient id="sp-deepVoid" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#004D4D" />
          <stop offset="100%" stopColor="#010103" />
        </radialGradient>
        <radialGradient id="sp-holoGlobe" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#E0FFFF" />
          <stop offset="30%" stopColor="#00FFFF" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#008B8B" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#002233" stopOpacity="0.95" />
        </radialGradient>
        <linearGradient id="sp-facetShine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <circle cx="250" cy="140" r="62" fill="#d4af37" opacity="0.14" filter="url(#sp-softBlur)" />

      <g transform="translate(0, -40)">
        {/* gold facet hexagon */}
        <g className="sp-hex">
          <polygon points="205,145 250,115 250,145 225,160" fill="#FFE47A" />
          <polygon points="250,115 295,145 275,160 250,145" fill="#E8C359" />
          <polygon points="205,215 205,145 225,160 225,200" fill="#C69A2B" />
          <polygon points="295,145 295,215 275,200 275,160" fill="#9A7017" />
          <polygon points="250,245 205,215 225,200 250,215" fill="#704D07" />
          <polygon points="295,215 250,245 250,215 275,200" fill="#4D3300" />
          <polygon
            points="225,160 250,145 275,160 275,200 250,215 225,200"
            fill="url(#sp-deepVoid)"
          />
          <polygon
            className="sp-facet-shine"
            points="205,145 250,115 295,145 295,215 250,245 205,215"
            fill="url(#sp-facetShine)"
          />
        </g>

        {/* lightning triangle */}
        <polygon
          points="250,146 278,198 222,198"
          fill="url(#sp-triBg)"
          stroke="#00FFFF"
          strokeWidth="2.5"
          filter="url(#sp-extremeGlow)"
        />
        <polygon
          className="sp-tri-spark"
          points="250,146 278,198 222,198"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeDasharray="8,12,15,6"
          filter="url(#sp-sparkFilter)"
        />
        <polygon
          className="sp-tri-arc"
          points="250,146 278,198 222,198"
          fill="none"
          stroke="#7FFFD4"
          strokeWidth="3"
          strokeDasharray="4,25,10,18"
          filter="url(#sp-extremeGlow)"
        />

        {/* centered dot-hexagon (v2 FINAL SYMMETRY) */}
        <polygon
          className="sp-dothex"
          points="250,157 270,168.5 270,191.5 250,203 230,191.5 230,168.5"
          fill="none"
          stroke="#7FFFD4"
          strokeWidth="1.5"
          opacity="0.85"
          strokeDasharray="4,2"
        />

        {/* bolts */}
        <path
          className="sp-bolt"
          d="M 250 162 L 250 198"
          fill="none"
          stroke="#00FFFF"
          strokeWidth="2.8"
          filter="url(#sp-extremeGlow)"
        />
        <path
          className="sp-bolt sp-bolt--b"
          d="M 238 162 L 238 176 L 250 180 L 262 184 L 262 198"
          fill="none"
          stroke="#00FFFF"
          strokeWidth="2.8"
          filter="url(#sp-extremeGlow)"
        />
        <circle className="sp-bolt" cx="238" cy="162" r="4" fill="#FF0055" filter="url(#sp-extremeGlow)" />
        <circle className="sp-bolt sp-bolt--b" cx="262" cy="198" r="4" fill="#0055FF" filter="url(#sp-extremeGlow)" />

        {/* hologram globe */}
        <g className="sp-globe" filter="url(#sp-globeGlow)">
          <circle cx="250" cy="180" r="12.5" fill="url(#sp-holoGlobe)" />
          <ellipse cx="250" cy="180" rx="12.5" ry="4.5" fill="none" stroke="#FFFFFF" strokeWidth="0.7" opacity="0.6" />
          <ellipse cx="250" cy="180" rx="4.5" ry="12.5" fill="none" stroke="#FFFFFF" strokeWidth="0.7" opacity="0.6" />
          <circle cx="250" cy="180" r="12.5" fill="none" stroke="#7FFFD4" strokeWidth="1.1" opacity="0.8" />
        </g>
      </g>
    </svg>
  );
}
