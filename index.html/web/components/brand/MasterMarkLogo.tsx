import type { CSSProperties } from 'react';

export type MasterMarkVariant = 'hero' | 'compact';

interface MasterMarkLogoProps {
  className?: string;
  style?: CSSProperties;
  /**
   * 'hero' (default) -- the full glow-filter treatment for large display
   * (intro splash, Coming-Soon ad page). 'compact' -- the same geometry and
   * the same four independent rotations (triangle / hexagon / center bar /
   * globe) around the fixed gold hex frame, but with the heavy
   * `feGaussianBlur` glow filters dropped and hairline strokes thickened so
   * the mark stays crisp at nav-bar / icon scale instead of dissolving into
   * a blurry blob (owner instruction 2026-09-05, item 1: "소형 스케일 벡터
   * 최적화").
   */
  variant?: MasterMarkVariant;
}

/**
 * The v2 "FINAL SYMMETRY" master mark, inlined from
 * public/assets/svg/unitas-mark.svg with animation hooks on each layer.
 * Kept geometry-identical to the single-source SVG (same viewBox, same
 * coordinates) so this stays pixel-consistent with the static favicon/PWA
 * icons wherever it renders.
 *
 * Ported out of the intro splash into this shared component (owner
 * instruction 2026-09-05, item 1) so the SAME animated mark -- gold hexagon
 * frame perfectly fixed, with the lightning triangle, the centered dashed
 * hexagon, the center bar and the hologram globe each spinning
 * independently inside it -- renders in all three places the owner named:
 * the intro splash (CinematicIntroSplash), the nav-bar small logo (NavBar),
 * and the Coming-Soon ad page's install CTA (CinemaAppDownload). All three
 * share `app/splash.css`'s `.sp-*` animation classes, loaded globally from
 * app/layout.tsx, so no per-caller stylesheet wiring is needed.
 */
export function MasterMarkLogo({ className, style, variant = 'hero' }: MasterMarkLogoProps) {
  const hero = variant === 'hero';

  return (
    <svg viewBox="174 64 152 152" role="img" aria-label="UNITAS" className={className} style={style}>
      <defs>
        {hero && (
          <>
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
          </>
        )}
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

      {hero && <circle cx="250" cy="140" r="62" fill="#d4af37" opacity="0.14" filter="url(#sp-softBlur)" />}

      <g transform="translate(0, -40)">
        {/* gold facet hexagon -- the frame. FIXED: never wrapped in a rotation. */}
        <g className="sp-hex">
          <polygon points="205,145 250,115 250,145 225,160" fill="#FFE47A" />
          <polygon points="250,115 295,145 275,160 250,145" fill="#E8C359" />
          <polygon points="205,215 205,145 225,160 225,200" fill="#C69A2B" />
          <polygon points="295,145 295,215 275,200 275,160" fill="#9A7017" />
          <polygon points="250,245 205,215 225,200 250,215" fill="#704D07" />
          <polygon points="295,215 250,245 250,215 275,200" fill="#4D3300" />
          <polygon points="225,160 250,145 275,160 275,200 250,215 225,200" fill="url(#sp-deepVoid)" />
          {hero && (
            <polygon
              className="sp-facet-shine"
              points="205,145 250,115 295,145 295,215 250,245 205,215"
              fill="url(#sp-facetShine)"
            />
          )}
        </g>

        {/* lightning triangle -- spins independently inside the fixed frame */}
        <g className="sp-tri-spin">
          <polygon
            points="250,146 278,198 222,198"
            fill="url(#sp-triBg)"
            stroke="#00FFFF"
            strokeWidth={hero ? 2.5 : 3}
            filter={hero ? 'url(#sp-extremeGlow)' : undefined}
          />
          {hero ? (
            <>
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
            </>
          ) : (
            <polygon points="250,146 278,198 222,198" fill="none" stroke="#7FFFD4" strokeWidth="1.4" />
          )}
        </g>

        {/* centered dashed hexagon (v2 FINAL SYMMETRY) -- the inner hexagon, spins the other way */}
        <polygon
          className="sp-dothex"
          points="250,157 270,168.5 270,191.5 250,203 230,191.5 230,168.5"
          fill="none"
          stroke="#7FFFD4"
          strokeWidth={hero ? 1.5 : 2.2}
          opacity="0.85"
          strokeDasharray="4,2"
        />

        {/* center bar (bolts) -- spins as one rigid rod */}
        <g className="sp-bolt-spin">
          <path
            className="sp-bolt"
            d="M 250 162 L 250 198"
            fill="none"
            stroke="#00FFFF"
            strokeWidth={hero ? 2.8 : 3.4}
            filter={hero ? 'url(#sp-extremeGlow)' : undefined}
          />
          <path
            className="sp-bolt sp-bolt--b"
            d="M 238 162 L 238 176 L 250 180 L 262 184 L 262 198"
            fill="none"
            stroke="#00FFFF"
            strokeWidth={hero ? 2.8 : 3.4}
            filter={hero ? 'url(#sp-extremeGlow)' : undefined}
          />
          <circle
            className="sp-bolt"
            cx="238"
            cy="162"
            r={hero ? 4 : 5}
            fill="#FF0055"
            filter={hero ? 'url(#sp-extremeGlow)' : undefined}
          />
          <circle
            className="sp-bolt sp-bolt--b"
            cx="262"
            cy="198"
            r={hero ? 4 : 5}
            fill="#0055FF"
            filter={hero ? 'url(#sp-extremeGlow)' : undefined}
          />
        </g>

        {/* hologram globe -- spins while it pulses */}
        <g className="sp-globe" filter={hero ? 'url(#sp-globeGlow)' : undefined}>
          <circle cx="250" cy="180" r="12.5" fill="url(#sp-holoGlobe)" />
          <ellipse cx="250" cy="180" rx="12.5" ry="4.5" fill="none" stroke="#FFFFFF" strokeWidth={hero ? 0.7 : 1.1} opacity="0.6" />
          <ellipse cx="250" cy="180" rx="4.5" ry="12.5" fill="none" stroke="#FFFFFF" strokeWidth={hero ? 0.7 : 1.1} opacity="0.6" />
          <circle cx="250" cy="180" r="12.5" fill="none" stroke="#7FFFD4" strokeWidth={hero ? 1.1 : 1.6} opacity="0.8" />
        </g>
      </g>
    </svg>
  );
}
