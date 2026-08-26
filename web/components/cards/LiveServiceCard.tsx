'use client';

import { useRef, useState, useEffect, type MouseEvent } from 'react';
import { motion, useMotionValue, useMotionTemplate, useSpring } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import type { B2CModule } from '@/lib/modules';

interface LiveServiceCardProps {
  module: B2CModule;
  index: number;
  onOpen: (module: B2CModule) => void;
}

const SILVER = '#c0c0c0';
const SILVER_GLOW = '#e8e8ec';

/**
 * Section 2 ("Live Consumer Services") card. Shares the same structural
 * shell as B2BProtocolCard and EcosystemCard (grid texture, top shimmer
 * strip, icon+title header) -- differentiated by a uniform, subtle Silver
 * glow/border (rather than per-theme color) and a background weight that
 * sits between the lighter Ecosystem tier and the darkest Enterprise tier.
 */
export function LiveServiceCard({ module, index, onOpen }: LiveServiceCardProps) {
  const t = useTranslations('B2C');
  const tModules = useTranslations('Modules');
  const { playHoverSfx } = useSpatialAudio();
  const cardRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [scrollFocused, setScrollFocused] = useState(false);

  const rotateX = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const scale = useSpring(1, { stiffness: 260, damping: 20 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowBackground = useMotionTemplate`radial-gradient(320px circle at ${glowX}% ${glowY}%, ${SILVER}2e, transparent 70%)`;

  // Same device-agnostic pattern as EcosystemCard: `active` unifies mouse hover (desktop) and
  // scroll-through-center (any viewport) into one boolean driving glow/scale/SFX identically.
  const active = hovered || scrollFocused;

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setScrollFocused(entry.isIntersecting);
        if (entry.isIntersecting) {
          playHoverSfx((index / 4) * 2 - 1);
        }
      },
      { rootMargin: '-42% 0px -42% 0px', threshold: 0 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [index, playHoverSfx]);

  useEffect(() => {
    scale.set(active ? 1.015 : 1);
  }, [active, scale]);

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
      style={{
        rotateX,
        rotateY,
        scale,
        transformPerspective: 900,
        borderColor: `${SILVER}55`,
        backgroundColor: '#0a0908',
        backgroundImage: `linear-gradient(${SILVER}0d 1px, transparent 1px), linear-gradient(90deg, ${SILVER}0d 1px, transparent 1px)`,
        backgroundSize: '18px 18px',
        boxShadow: active ? `0 0 45px ${SILVER}44` : `0 0 22px ${SILVER}22`,
      }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      whileTap={{ scale: 0.97 }}
      className="group relative flex min-h-[200px] flex-col justify-between overflow-hidden border p-6 text-left transition-shadow duration-300"
    >
      {/* Silver shimmer strip -- same structural element as B2B's liquid-gold strip */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${SILVER} 30%, ${SILVER_GLOW} 50%, ${SILVER} 70%, transparent)`,
        }}
        aria-hidden="true"
      />

      <motion.div className="pointer-events-none absolute inset-0" style={{ background: glowBackground }} />

      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <module.icon
            size={22}
            style={{ color: SILVER, filter: `drop-shadow(0 0 6px ${module.metal})` }}
            aria-hidden="true"
          />
          <h3 className="font-serif text-lg font-bold text-white" style={{ textShadow: `0 0 18px ${SILVER}55` }}>
            {tModules(`${module.messageKey}.title`)}
          </h3>
        </div>
        <span className="mb-1.5 inline-block text-[13px] font-bold uppercase tracking-widest text-gray-400">
          {module.metalName} · {t('badgeLive')}
        </span>
        <p className="text-[13px] font-normal leading-snug text-gray-300">
          {tModules(`${module.messageKey}.description`)}
        </p>
      </div>

      <div className="relative mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: `${SILVER}22` }}>
        <span className="text-[13px] uppercase tracking-widest text-gray-400">{t('badgeQuest')}</span>
        <span className="text-[13px] font-bold" style={{ color: SILVER }}>
          {module.coinCost.toLocaleString()} U-COIN
        </span>
      </div>
    </motion.button>
  );
}
