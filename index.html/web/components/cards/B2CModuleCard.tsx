'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { motion, useMotionValue, useMotionTemplate, useSpring } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ParticleBurst } from '@/components/effects/ParticleBurst';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import type { B2CModule } from '@/lib/modules';

interface B2CModuleCardProps {
  module: B2CModule;
  index: number;
  onOpen: (module: B2CModule) => void;
}

/** Neon crystal / cyber-gaming card: 3D cursor tilt, glow follow, particle burst on hover. */
export function B2CModuleCard({ module, index, onOpen }: B2CModuleCardProps) {
  const t = useTranslations('B2C');
  const tModules = useTranslations('Modules');
  const { playHoverSfx } = useSpatialAudio();
  const cardRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);

  const rotateX = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowBackground = useMotionTemplate`radial-gradient(280px circle at ${glowX}% ${glowY}%, rgba(0,243,255,0.18), transparent 65%)`;

  function handleMouseMove(e: MouseEvent<HTMLButtonElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 16);
    rotateX.set((0.5 - py) * 16);
    glowX.set(px * 100);
    glowY.set(py * 100);
  }

  function handleMouseEnter() {
    setHovered(true);
    playHoverSfx((index / 4) * 2 - 1);
  }

  function handleMouseLeave() {
    setHovered(false);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.button
      ref={cardRef}
      type="button"
      onClick={() => onOpen(module)}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      whileTap={{ scale: 0.97 }}
      className="group relative flex flex-col justify-between overflow-hidden border border-accent/30 bg-gradient-to-b from-quantum to-void p-6 text-left shadow-[0_0_40px_rgba(212,175,55,0.06)] transition-colors hover:border-neon/60"
    >
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: glowBackground }} />
      <ParticleBurst active={hovered} />

      <div className="relative">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="border border-green-400/40 bg-green-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-green-400">
            {t('badgeLive')}
          </span>
          <span className="border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-accent">
            {t('badgeCoinGated')}
          </span>
        </div>
        <h3 className="mb-2 font-serif text-xl font-bold text-white [text-shadow:0_0_20px_rgba(0,243,255,0.35)]">
          {tModules(`${module.messageKey}.title`)}
        </h3>
        <p className="text-xs text-gray-400">{tModules(`${module.messageKey}.description`)}</p>
      </div>

      <div className="relative mt-6 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="text-[10px] uppercase tracking-widest text-neon">{t('badgeQuest')}</span>
        <span className="text-xs font-bold text-accent">
          {module.coinCost.toLocaleString()} U-COIN
        </span>
      </div>
    </motion.button>
  );
}
