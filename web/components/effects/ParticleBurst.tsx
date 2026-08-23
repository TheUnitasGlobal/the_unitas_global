'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface ParticleBurstProps {
  active: boolean;
  count?: number;
  color?: string;
}

/**
 * Lightweight CSS/Framer-Motion "neon glow particle" hover effect for the
 * B2C module cards -- a handful of small dots radiating outward and fading
 * on loop while hovered. Deliberately not a per-card WebGL particle system
 * (the R3F canvas is reserved for the shared background); this reads as the
 * same effect at a fraction of the GPU cost.
 *
 * Particle geometry is randomized, so it's computed client-side only after
 * mount (like components/canvas/Scene.tsx's mount guard) -- otherwise the
 * server-rendered random values and the client's first-render random values
 * differ and React flags a hydration mismatch.
 */
export function ParticleBurst({ active, count = 10, color = '#00f3ff' }: ParticleBurstProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const distance = 60 + Math.random() * 50;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          delay: (i / count) * 0.6,
          size: 2 + Math.random() * 3,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, mounted],
  );

  if (!mounted) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{ width: p.size, height: p.size, backgroundColor: color }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
          animate={
            active
              ? {
                  opacity: [0, 1, 0],
                  x: [0, p.x],
                  y: [0, p.y],
                  scale: [0.4, 1, 0.4],
                }
              : { opacity: 0, x: 0, y: 0, scale: 0.4 }
          }
          transition={{
            duration: 1.4,
            delay: p.delay,
            repeat: active ? Infinity : 0,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}
