'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { motion, useMotionValue, useMotionTemplate, useSpring } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import type { GovernanceAxis } from '@/lib/governance';

interface GovernanceCardProps {
  axis: GovernanceAxis;
  index: number;
  total: number;
  onOpen: (axis: GovernanceAxis) => void;
}

/**
 * One tile of the 16-axis Governance Matrix. Denser and quieter than
 * EcosystemCard/LiveServiceCard (16 items vs 11/5, and this catalog is a free
 * doctrine reference, not a coin-gated product) -- same cursor-tilt +
 * glow-follow shell, but no coin badge; the footer instead shows the axis's
 * position in the 16-item ladder so the grid reads as one ordered structure.
 */
export function GovernanceCard({ axis, index, total, onOpen }: GovernanceCardProps) {
  const t = useTranslations('Governance');
  const { playHoverSfx } = useSpatialAudio();
  const cardRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);

  const rotateX = useSpring(useMotionValue(0), { stiffness: 240, damping: 24 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 240, damping: 24 });
  const scale = useSpring(1, { stiffness: 260, damping: 20 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowBackground = useMotionTemplate`radial-gradient(220px circle at ${glowX}% ${glowY}%, ${axis.glow}2e, transparent 65%)`;

  function handleMouseMove(e: MouseEvent<HTMLButtonElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 12);
    rotateX.set((0.5 - py) * 12);
    glowX.set(px * 100);
    glowY.set(py * 100);
  }

  function handleMouseEnter() {
    setHovered(true);
    scale.set(1.02);
    playHoverSfx((index / Math.max(1, total - 1)) * 2 - 1);
  }

  function handleMouseLeave() {
    setHovered(false);
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.button
      ref={cardRef}
      type="button"
      onClick={() => onOpen(axis)}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        scale,
        transformPerspective: 800,
        borderColor: `${axis.color}66`,
        backgroundColor: '#12111a',
        backgroundImage: `linear-gradient(${axis.color}0d 1px, transparent 1px), linear-gradient(90deg, ${axis.color}0d 1px, transparent 1px)`,
        backgroundSize: '16px 16px',
        boxShadow: hovered ? `0 0 32px ${axis.glow}3a` : `0 0 14px ${axis.color}1f`,
      }}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: index * 0.025 }}
      whileTap={{ scale: 0.96 }}
      className="group relative flex min-h-[132px] flex-col justify-between overflow-hidden border p-4 text-left transition-shadow"
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${axis.color} 30%, ${axis.glow} 50%, ${axis.color} 70%, transparent)`,
        }}
        aria-hidden="true"
      />
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: glowBackground }} />

      <div className="relative">
        <div className="mb-2 flex items-center gap-2">
          <axis.icon size={18} style={{ color: axis.color }} aria-hidden="true" />
          <h3 className="font-serif text-sm font-bold text-white" style={{ textShadow: `0 0 14px ${axis.glow}55` }}>
            {t(`axes.${axis.messageKey}.title`)}
          </h3>
        </div>
        <p className="text-[11px] font-normal leading-snug text-gray-400">
          {t(`axes.${axis.messageKey}.description`)}
        </p>
      </div>

      <div className="relative mt-3 flex items-center justify-between border-t pt-2" style={{ borderColor: `${axis.color}22` }}>
        <span className="text-[10px] uppercase tracking-widest text-gray-500">{t('badge')}</span>
        <span className="text-[10px] font-bold" style={{ color: axis.color }}>
          {String(index + 1).padStart(2, '0')} / {total}
        </span>
      </div>
    </motion.button>
  );
}
