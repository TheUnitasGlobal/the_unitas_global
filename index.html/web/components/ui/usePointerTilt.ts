'use client';

import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * REV-19 follow-up -- pointer-driven 3D tilt for the premium glass cards
 * (app/waitlist.css). Writes four custom properties on the element the
 * handlers are spread onto: `--rx` / `--ry` (rotation, clamped to
 * `maxDeg`) and `--mx` / `--my` (pointer position in %, for the sheen).
 * Coarse pointers and reduced-motion visitors get a flat card: the
 * handlers become no-ops, nothing is written.
 */
export function usePointerTilt(maxDeg = 7) {
  const flat = useRef<boolean | null>(null);

  const isFlat = () => {
    if (flat.current === null) {
      try {
        flat.current =
          window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches;
      } catch {
        flat.current = false;
      }
    }
    return flat.current;
  };

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (isFlat()) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (px - 0.5) * 2 * maxDeg;
      const ry = (0.5 - py) * 2 * maxDeg;
      el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    },
    [maxDeg],
  );

  const onPointerLeave = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);

  return useMemo(() => ({ onPointerMove, onPointerLeave }), [onPointerMove, onPointerLeave]);
}
