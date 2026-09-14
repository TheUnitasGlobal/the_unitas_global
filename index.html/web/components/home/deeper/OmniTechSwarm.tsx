'use client';

import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { swarmLayout, type SwarmInputDimension } from '@/lib/uai/swarmLayout';

/**
 * REV-24 MISSION 4 -- the OMNI-TECH SWARM (founder directive 2026-09-13).
 *
 * WHAT IT REPLACES. REV-23's `bigTechPulse` tears an organisation apart into
 * six Wikidata dimensions -- industry, parent, subsidiaries, products,
 * founders, chief executive -- and every entry is itself an entity the whole
 * block can be re-anchored onto. It shipped as six separate cards of flat
 * text chips: the relationships it had just discovered were nowhere on
 * screen, and the re-anchor loop the adapter advertises was DEAD (only the
 * `list` renderer drew a re-anchor control; the `chips` renderer never did,
 * so tapping a module went to Wikidata instead of absorbing it).
 *
 * WHAT IT IS. One field. The anchor burns at the centre; each dimension owns
 * an angular sector; every entity is a node on one of three depth shells,
 * wired back to the core. Moving a pointer over it parallaxes the shells
 * against each other, so the field reads as a volume rather than a disc.
 * Activating a node re-anchors the entire theme onto that entity -- the
 * "modular absorption" loop, finally connected.
 *
 * THREE ENGINEERING DECISIONS, EACH A CONSTRAINT THIS PROJECT ALREADY PAID
 * FOR:
 *
 *  1. NO WebGL. `components/canvas/Scene.tsx` is the only <Canvas> in the app
 *     and it is lazy, `ssr: false`, and behind a SovereignShield -- because
 *     headless WebKit loses the WebGL context on mount and trips the root
 *     error boundary (tests/web-cinema-e2e/app-exit-collapse.spec.js). A
 *     second R3F canvas, inside a modal, would multiply that exposure and put
 *     the whole three.js graph on this popup's critical path. The field is
 *     absolutely-positioned HTML over an SVG edge layer: nothing new in the
 *     bundle, nothing to lose a context.
 *
 *  2. NO RENDER LOOP. `QuantumVoid.tsx` states the doctrine -- "the loop is
 *     not just idle when nothing changed, it doesn't exist at all until
 *     something does" -- and REV-24 MISSION 3 is spending this whole revision
 *     removing always-on animation. So the pointer writes two CSS custom
 *     properties (`--sx`, `--sy`) through a ref, at most one rAF pending, and
 *     CSS turns them into per-shell `translate3d`. Idle cost: zero. No React
 *     state changes on pointer move, so no re-render either.
 *
 *  3. REAL BUTTONS. The field lives inside `components/ui/Modal.tsx`, which
 *     traps Tab across every focusable descendant. An SVG-only graph with
 *     `<g tabindex>` is a coin-flip across engines; every node here is an
 *     ordinary <button>, so keyboard, screen-reader and touch all work with
 *     no special handling and the SVG is `aria-hidden` decoration.
 *
 * Reduced motion and coarse pointers get the same field, still, with no
 * parallax -- see `.qw-swarm` in app/globals.css.
 */

export interface OmniTechSwarmProps {
  /** Already-localized dimensions, in card order. */
  dimensions: SwarmInputDimension[];
  /** The entity at the centre -- the organisation being taken apart. */
  coreLabel: string;
  /** Theme accent (`deeperTheme(...).color`). */
  color: string;
  /** Localized label for the re-anchor action (`Rev21.deeper.reAnchor`). */
  reAnchorLabel: string;
  /** Re-anchor the whole theme onto this node. Absent -> nodes are inert. */
  onReanchor?: (next: { qid: string; title: string }) => void;
}

/** Pointer travel, in field percent, at the outermost shell. */
const PARALLAX_PCT = 2.6;

export function OmniTechSwarm({ dimensions, coreLabel, color, reAnchorLabel, onReanchor }: OmniTechSwarmProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const { playHoverSfx } = useSpatialAudio();

  const layout = useMemo(() => swarmLayout(dimensions), [dimensions]);

  /**
   * One rAF at most, only while a pointer is actually moving over the field,
   * and it writes STYLE -- never state. Touch pointers are ignored: a finger
   * is on the node it is pressing, so parallaxing under it is noise.
   */
  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = fieldRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    pendingRef.current = {
      x: ((e.clientX - r.left) / r.width - 0.5) * 2,
      y: ((e.clientY - r.top) / r.height - 0.5) * 2,
    };
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const p = pendingRef.current;
      const node = fieldRef.current;
      if (!p || !node) return;
      node.style.setProperty('--sx', p.x.toFixed(3));
      node.style.setProperty('--sy', p.y.toFixed(3));
    });
  }, []);

  const settle = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingRef.current = null;
    const el = fieldRef.current;
    if (el) {
      el.style.setProperty('--sx', '0');
      el.style.setProperty('--sy', '0');
    }
  }, []);

  if (layout.nodes.length === 0) return null;

  const fieldStyle = {
    '--qw-swarm-accent': color,
    '--qw-swarm-travel': `${PARALLAX_PCT}%`,
    '--sx': 0,
    '--sy': 0,
  } as CSSProperties;

  return (
    <div className="qw-swarm-wrap" data-omni-swarm="" data-swarm-nodes={layout.nodes.length}>
      <div
        ref={fieldRef}
        className="qw-swarm"
        style={fieldStyle}
        onPointerMove={onPointerMove}
        onPointerLeave={settle}
        onPointerCancel={settle}
      >
        {/* Edges. `preserveAspectRatio="none"` maps the viewBox 1:1 onto the
            box, so these percentages are the SAME numbers the buttons use --
            one layout, two renderers, no drift. */}
        <svg className="qw-swarm-web" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {layout.nodes.map((n) => (
            <line
              key={n.id}
              x1={layout.centre.x}
              y1={layout.centre.y}
              x2={n.x}
              y2={n.y}
              className="qw-swarm-edge"
              data-swarm-edge-active={active === n.id ? '1' : '0'}
              style={{ '--d': n.depth } as CSSProperties}
            />
          ))}
        </svg>

        <span className="qw-swarm-core" style={{ left: `${layout.centre.x}%`, top: `${layout.centre.y}%` }}>
          <span className="qw-swarm-core-pip" aria-hidden="true" />
          <span className="qw-swarm-core-label">{coreLabel}</span>
        </span>

        {layout.nodes.map((n) => {
          const canAbsorb = Boolean(n.qid && onReanchor);
          const label = `${n.title} — ${n.dimensionLabel}`;
          return (
            <button
              key={n.id}
              type="button"
              className="qw-swarm-node"
              data-swarm-node={n.dimensionKey}
              data-swarm-depth={n.depth}
              data-swarm-absorb={canAbsorb ? '1' : '0'}
              style={{ left: `${n.x}%`, top: `${n.y}%`, '--d': n.depth } as CSSProperties}
              title={canAbsorb ? `${label} · ${reAnchorLabel}` : label}
              aria-label={canAbsorb ? `${label} · ${reAnchorLabel}` : label}
              disabled={!canAbsorb}
              onMouseEnter={() => {
                setActive(n.id);
                playHoverSfx();
              }}
              onMouseLeave={() => setActive((cur) => (cur === n.id ? null : cur))}
              onFocus={() => setActive(n.id)}
              onBlur={() => setActive((cur) => (cur === n.id ? null : cur))}
              onClick={() => {
                // THE ABSORPTION LOOP. Before REV-24 this did nothing at all
                // on a chips card: the module was a link out to Wikidata, and
                // the re-anchor the adapter documents was unreachable.
                if (n.qid && onReanchor) onReanchor({ qid: n.qid, title: n.title });
              }}
            >
              <span className="qw-swarm-dot" aria-hidden="true" />
              <span className="qw-swarm-label">{n.title}</span>
            </button>
          );
        })}
      </div>

      <ul className="qw-swarm-legend" aria-hidden="true">
        {layout.dimensions.map((d) => (
          <li key={d.key} className="qw-swarm-legend-item" data-swarm-legend={d.key}>
            <span className="qw-swarm-legend-pip" style={{ '--i': d.index } as CSSProperties} />
            {d.label}
            <span className="qw-swarm-legend-count">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
