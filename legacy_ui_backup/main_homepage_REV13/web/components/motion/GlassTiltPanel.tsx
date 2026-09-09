'use client';

import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

interface GlassTiltPanelProps {
  children: ReactNode;
  /** Border/glow accent, e.g. an ecosystem or module theme color. */
  accent?: string;
  /** Panel background beneath the glass blur. */
  background?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Reusable 3D glassmorphism shell: cursor-tilt (perspective rotateX/rotateY),
 * a glow that follows the pointer, and a themed top shimmer strip. This is
 * the interaction core of components/cards/EcosystemCard.tsx and
 * B2BProtocolCard.tsx generalized into a standalone primitive, so any new
 * surface (not just the 11/5/3-module cards) can opt into the same
 * "초정밀 반응형" tilt-glass language without re-deriving the math.
 *
 * Fails open on prefers-reduced-motion: tilt/spring math is skipped entirely
 * and the panel renders static, matching ComingSoonCinema's reduced-motion
 * handling elsewhere in the app.
 */
export function GlassTiltPanel({
  children,
  accent = '#00f3ff',
  background = '#14131c',
  className = '',
  onClick,
}: GlassTiltPanelProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  const rotateX = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowBackground = useMotionTemplate`radial-gradient(280px circle at ${glowX}% ${glowY}%, ${accent}33, transparent 65%)`;

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 16);
    rotateX.set((0.5 - py) * 16);
    glowX.set(px * 100);
    glowY.set(py * 100);
  }

  function handleMouseLeave() {
    setActive(false);
    rotateX.set(0);
    rotateY.set(0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <motion.div
      ref={ref}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={handleMouseLeave}
      style={
        reduceMotion
          ? { borderColor: `${accent}80`, backgroundColor: background }
          : { rotateX, rotateY, transformPerspective: 900, borderColor: `${accent}80`, backgroundColor: background }
      }
      className={`group relative overflow-hidden border backdrop-blur-xl transition-shadow ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent} 30%, ${accent} 70%, transparent)` }}
        aria-hidden="true"
      />
      {!reduceMotion && (
        <motion.div className="pointer-events-none absolute inset-0" style={{ background: glowBackground }} />
      )}
      {active && !reduceMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 border-2"
          style={{ borderColor: accent }}
          animate={{ opacity: [0.25, 0.6, 0.25] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />
      )}
      <div className="relative">{children}</div>
    </motion.div>
  );
}
