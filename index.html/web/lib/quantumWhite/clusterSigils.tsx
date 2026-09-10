// REV-17 Singularity Core sigils (SPEC.md §4.2) -- the four abstract marks
// that replace the orbit-dot rings (whose dot COUNT doubled as an
// unintentional module counter, the exact curiosity-killer the spec calls
// out). Pure inline SVG, no icon library: each sigil is a single visual
// idea rendered as geometry, never text, never a number.
//
// Geometry note (Lock-in Network / Trefoil): its path is a 96-sample trace
// of x(t)=sin t + 2 sin 2t, y(t)=cos t - 2 cos 2t, scaled 7.6x and centered
// at (32,32) -- regenerate with `node scripts/gen-sigils.mjs` rather than
// hand-editing the literal below.

import type { CSSProperties, JSX } from 'react';
import type { ClusterKey } from './clusters';

const VIEW_BOX = '0 0 64 64';
const CENTER = 32;

const COMMON_SVG_PROPS = {
  viewBox: VIEW_BOX,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round' as const,
  'aria-hidden': true,
};

/** `stroke-dasharray` for a circle of radius `r` with a gap of `gapDeg` degrees. */
function ringDash(r: number, gapDeg: number): string {
  const circumference = 2 * Math.PI * r;
  const gap = (gapDeg / 360) * circumference;
  const visible = circumference - gap;
  return `${visible.toFixed(2)} ${gap.toFixed(2)}`;
}

/** Deterministic trefoil trace -- see the module doc comment above. */
const TREFOIL_PATH =
  'M32.00 24.40 L34.48 24.51 L36.93 24.85 L39.30 25.41 L41.57 26.18 L43.70 27.14 L45.66 28.27 L47.42 29.56 L48.96 30.98 L50.27 32.50 L51.31 34.10 L52.08 35.73 L52.57 37.37 L52.78 39.00 L52.71 40.56 L52.36 42.04 L51.75 43.40 L50.88 44.61 L49.77 45.66 L48.45 46.50 L46.94 47.13 L45.27 47.53 L43.47 47.67 L41.57 47.57 L39.60 47.20 L37.60 46.57 L35.60 45.69 L33.64 44.56 L31.74 43.20 L29.94 41.62 L28.27 39.84 L26.76 37.89 L25.42 35.80 L24.28 33.59 L23.35 31.31 L22.64 28.97 L22.17 26.63 L21.94 24.30 L21.94 22.04 L22.18 19.86 L22.64 17.82 L23.30 15.93 L24.16 14.23 L25.19 12.74 L26.37 11.50 L27.67 10.50 L29.06 9.78 L30.51 9.35 L32.00 9.20 L33.49 9.35 L34.94 9.78 L36.33 10.50 L37.63 11.50 L38.81 12.74 L39.84 14.23 L40.70 15.93 L41.36 17.82 L41.82 19.86 L42.06 22.04 L42.06 24.30 L41.83 26.63 L41.36 28.97 L40.65 31.31 L39.72 33.59 L38.58 35.80 L37.24 37.89 L35.73 39.84 L34.06 41.62 L32.26 43.20 L30.36 44.56 L28.40 45.69 L26.40 46.57 L24.40 47.20 L22.43 47.57 L20.53 47.67 L18.73 47.53 L17.06 47.13 L15.55 46.50 L14.23 45.66 L13.12 44.61 L12.25 43.40 L11.64 42.04 L11.29 40.56 L11.22 39.00 L11.43 37.37 L11.92 35.73 L12.69 34.10 L13.73 32.50 L15.04 30.98 L16.58 29.56 L18.34 28.27 L20.30 27.14 L22.43 26.18 L24.70 25.41 L27.07 24.85 L29.52 24.51 Z';

/**
 * cognitive: "Aperture" -- three concentric 300deg arcs (60deg gaps),
 * rotated apart, an eye not yet opened.
 *
 * The middle ring needs BOTH a static starting rotation (an SVG `transform`
 * presentation attribute, so its gap starts 120deg around from the outer
 * ring's) AND a CSS spin animation. Putting both on the SAME element is a
 * real cross-browser footgun: a CSS `transform`/animation on an SVG shape
 * REPLACES its `transform` attribute rather than composing with it, and
 * `transform-origin: 50% 50%` then resolves against the wrong box, netting
 * a rotation-around-the-wrong-point that translates the ring off-screen
 * instead of just spinning it in place. Splitting the two onto a static
 * `<g>` wrapper (the attribute) and the animated shape inside it (the CSS
 * class only, no attribute) keeps them from ever fighting over the same
 * element's transform.
 */
function ApertureSigil() {
  return (
    <svg {...COMMON_SVG_PROPS}>
      <circle
        cx={CENTER}
        cy={CENTER}
        r={24}
        strokeDasharray={ringDash(24, 60)}
        className="qw-sigil-spin"
        style={{ '--qw-sigil-period': '90s' } as CSSProperties}
      />
      <g transform={`rotate(120 ${CENTER} ${CENTER})`}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={17}
          strokeDasharray={ringDash(17, 60)}
          className="qw-sigil-spin qw-sigil-spin-reverse"
          style={{ '--qw-sigil-period': '120s' } as CSSProperties}
        />
      </g>
      <circle cx={CENTER} cy={CENTER} r={10} strokeDasharray={ringDash(10, 60)} transform={`rotate(240 ${CENTER} ${CENTER})`} />
      <circle cx={CENTER} cy={CENTER} r={1.4} fill="currentColor" stroke="none" />
    </svg>
  );
}

/** live: "Open Meridian" -- a ring with one deliberate breach, a signal line crossing it off-axis. */
function OpenMeridianSigil() {
  const angle = (-30 * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const from = { x: CENTER + cos * -24, y: CENTER + sin * -24 };
  const to = { x: CENTER + cos * 28, y: CENTER + sin * 28 };
  return (
    <svg {...COMMON_SVG_PROPS}>
      {/* See ApertureSigil's doc comment: the static starting rotation
          lives on this `<g>` wrapper, never on the animated circle itself. */}
      <g transform={`rotate(-135 ${CENTER} ${CENTER})`}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={22}
          strokeDasharray={ringDash(22, 36)}
          className="qw-sigil-spin"
          style={{ '--qw-sigil-period': '60s' } as CSSProperties}
        />
      </g>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
    </svg>
  );
}

/** lockin: "Trefoil" -- a single closed knot that never resolves; the network you never fully leave. */
function TrefoilSigil() {
  return (
    <svg {...COMMON_SVG_PROPS}>
      <path
        d={TREFOIL_PATH}
        className="qw-sigil-spin qw-sigil-spin-reverse"
        style={{ '--qw-sigil-period': '150s' } as CSSProperties}
      />
    </svg>
  );
}

/** enterprise: "Three Rails" -- three verticals bound by a single diagonal, three quiet junctions. */
function ThreeRailsSigil() {
  return (
    <svg {...COMMON_SVG_PROPS}>
      <line x1={22} y1={14} x2={22} y2={50} />
      <line x1={32} y1={10} x2={32} y2={54} />
      <line x1={42} y1={18} x2={42} y2={46} />
      <line x1={17} y1={41} x2={47} y2={23} />
      <circle cx={22} cy={35.67} r={1.1} fill="currentColor" stroke="none" />
      <circle cx={32} cy={32} r={1.1} fill="currentColor" stroke="none" />
      <circle cx={42} cy={28.33} r={1.1} fill="currentColor" stroke="none" />
    </svg>
  );
}

const SIGILS: Readonly<Record<ClusterKey, () => JSX.Element>> = {
  cognitive: ApertureSigil,
  live: OpenMeridianSigil,
  lockin: TrefoilSigil,
  enterprise: ThreeRailsSigil,
};

export interface ClusterSigilProps {
  cluster: ClusterKey;
}

/** Renders the sigil for a given cluster key -- see SIGILS above for the mapping. */
export function ClusterSigil({ cluster }: ClusterSigilProps) {
  const Sigil = SIGILS[cluster];
  return <Sigil />;
}
