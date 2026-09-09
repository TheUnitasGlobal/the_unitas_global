'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

interface Ring {
  id: number;
  x: number;
  y: number;
  color: string;
}

let ringId = 0;

/**
 * Click feedback for the 11 ecosystem cards: a radial ring expanding from
 * the click point plus a brief global camera-shake (see .camera-shake /
 * @keyframes shockwave-ring in globals.css). Returns `trigger(x, y, color)`
 * to call from an onClick handler and `element` to render once near the
 * root of the page.
 */
export function useShockwave() {
  const [rings, setRings] = useState<Ring[]>([]);

  const trigger = useCallback((x: number, y: number, color = '#00f3ff') => {
    const id = ringId++;
    setRings((prev) => [...prev, { id, x, y, color }]);

    const root = document.documentElement;
    root.classList.remove('camera-shake');
    // Force reflow so the animation restarts if triggered again quickly.
    void root.offsetWidth;
    root.classList.add('camera-shake');

    window.setTimeout(() => {
      setRings((prev) => prev.filter((r) => r.id !== id));
    }, 750);
  }, []);

  const element = (
    <div className="pointer-events-none fixed inset-0 z-[150]" aria-hidden="true">
      <AnimatePresence>
        {rings.map((ring) => (
          <span
            key={ring.id}
            className="absolute rounded-full border-2"
            style={{
              left: ring.x,
              top: ring.y,
              width: 240,
              height: 240,
              borderColor: ring.color,
              animation: 'shockwave-ring 0.7s ease-out forwards',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );

  return { trigger, element };
}
