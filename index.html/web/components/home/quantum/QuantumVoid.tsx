'use client';

import { useEffect, useRef } from 'react';

/** Number of slow-drifting translucent "quanta" rings (spec: 5-7). */
const RING_COUNT = 6;

/** Parallax depth factors, shallowest (dot-grid) to deepest (rings). */
const DEPTH_GRID = 0.02;
const DEPTH_POOLS = 0.05;
const DEPTH_RINGS = 0.09;

/** Pixel amplitude the pointer's -1..1 offset from viewport-centre is scaled to. */
const POINTER_AMPLITUDE_PX = 48;

/** How long a layer keeps `will-change: transform` after its last update. */
const WILL_CHANGE_COOLDOWN_MS = 260;

/**
 * REV-13 Parallax Quantum Void (spec §2): three fixed, pointer-events-none
 * decorative layers behind the page content -- a faint dot-grid, two soft
 * "light pools" tinted by the adaptive chrono-luminance system, and a handful
 * of slow-drifting translucent rings. All three parallax on the visitor's
 * pointer (desktop only -- touch pointers are ignored) and page scroll
 * (every device) at different depths, purely via `transform: translate3d()`.
 *
 * No continuous animation loop: pointer/scroll listeners are passive and
 * merely record the latest values, then request AT MOST one pending
 * `requestAnimationFrame` to flush them into the DOM -- the loop is not just
 * "idle when nothing changed", it doesn't exist at all until something does.
 * `will-change` is applied to the three layers only for the brief window a
 * flush is in flight, then released.
 */
export function QuantumVoid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const poolsRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let reduceMotion = false;
    try {
      reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduceMotion = false;
    }
    if (reduceMotion) return;

    const layers = [
      { ref: gridRef, depth: DEPTH_GRID },
      { ref: poolsRef, depth: DEPTH_POOLS },
      { ref: ringsRef, depth: DEPTH_RINGS },
    ];

    let pointerX = 0; // -1..1 offset from viewport centre
    let pointerY = 0;
    let scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    let rafId: number | null = null;
    let coolDownTimer: ReturnType<typeof setTimeout> | null = null;

    function flush() {
      rafId = null;
      const px = pointerX * POINTER_AMPLITUDE_PX;
      const py = pointerY * POINTER_AMPLITUDE_PX;
      for (const layer of layers) {
        const el = layer.ref.current;
        if (!el) continue;
        el.style.willChange = 'transform';
        const x = px * layer.depth;
        const y = py * layer.depth + scrollY * layer.depth;
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }
      if (coolDownTimer) clearTimeout(coolDownTimer);
      coolDownTimer = setTimeout(() => {
        for (const layer of layers) {
          if (layer.ref.current) layer.ref.current.style.willChange = 'auto';
        }
      }, WILL_CHANGE_COOLDOWN_MS);
    }

    function requestFlush() {
      if (rafId === null) rafId = requestAnimationFrame(flush);
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerType === 'touch') return;
      pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
      requestFlush();
    }

    function onScroll() {
      scrollY = window.scrollY;
      requestFlush();
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (coolDownTimer) clearTimeout(coolDownTimer);
    };
  }, []);

  return (
    <div className="qw-void" aria-hidden="true">
      <div ref={gridRef} className="qw-void-layer qw-void-grid" />
      <div ref={poolsRef} className="qw-void-layer qw-void-pools">
        <span className="qw-void-pool qw-void-pool-a" />
        <span className="qw-void-pool qw-void-pool-b" />
      </div>
      <div ref={ringsRef} className="qw-void-layer qw-void-rings">
        {Array.from({ length: RING_COUNT }, (_, i) => (
          <span key={i} className={`qw-void-ring qw-void-ring-${i + 1}`} />
        ))}
      </div>
    </div>
  );
}
