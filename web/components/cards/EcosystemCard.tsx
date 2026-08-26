'use client';

import { useRef, useState, useEffect, type MouseEvent } from 'react';
import { motion, useMotionValue, useMotionTemplate, useSpring } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Cpu } from 'lucide-react';
import { ParticleBurst } from '@/components/effects/ParticleBurst';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { useShockwave } from '@/components/effects/Shockwave';
import type { EcosystemTheme } from '@/lib/ecosystems';

interface EcosystemCardProps {
  ecosystem: EcosystemTheme;
  index: number;
  onOpen: (ecosystem: EcosystemTheme) => void;
  shockwaveTrigger: ReturnType<typeof useShockwave>['trigger'];
}

/**
 * One of the 11 "Cognitive Ecosystem" cards. Shares its outer shell (grid
 * texture background, top shimmer strip, icon+title header) with
 * B2BProtocolCard for a unified structural language across all three
 * tiers -- only the border/glow color and background weight (lightest of
 * the three tiers) differ per-theme. Cursor-tilt + glow-follow + hologram
 * particle burst + a distinct synthesized SFX per theme are unchanged.
 */
export function EcosystemCard({ ecosystem, index, onOpen, shockwaveTrigger }: EcosystemCardProps) {
  const t = useTranslations('B2C');
  const tEcosystems = useTranslations('Ecosystems');
  const { playEcosystemHover } = useSpatialAudio();
  const cardRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [scrollFocused, setScrollFocused] = useState(false);

  const rotateX = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const scale = useSpring(1, { stiffness: 260, damping: 20 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowBackground = useMotionTemplate`radial-gradient(280px circle at ${glowX}% ${glowY}%, ${ecosystem.glow}33, transparent 65%)`;

  // `active` is the single source of truth for the glow/scale/particle/CTA-pulse treatment,
  // fed by either trigger -- mouse hover (desktop) or scroll-through-center (any viewport,
  // including desktop). Keeping every visual/audio effect keyed off one boolean is what
  // guarantees PC, tablet, and mobile render literally the same reaction regardless of how
  // the card was focused, closing the feature gap between pointer and scroll interaction.
  const active = hovered || scrollFocused;

  // Runs on every viewport (not just mobile): the card nearest the vertical center as the
  // user scrolls -- via mouse wheel, trackpad, or touch -- auto-activates the same treatment
  // a hover would on desktop, so scrolling itself is a first-class interaction everywhere.
  // rootMargin shrinks the observed root to a thin band around screen center so only the
  // module actually "in focus" while scrolling lights up.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setScrollFocused(entry.isIntersecting);
        if (entry.isIntersecting) {
          playEcosystemHover(ecosystem.sfx, 0);
        }
      },
      { rootMargin: '-42% 0px -42% 0px', threshold: 0 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [ecosystem.sfx, playEcosystemHover]);

  useEffect(() => {
    scale.set(active ? 1.015 : 1);
  }, [active, scale]);

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
    playEcosystemHover(ecosystem.sfx, (index / 10) * 2 - 1);
  }

  function handleMouseLeave() {
    setHovered(false);
    rotateX.set(0);
    rotateY.set(0);
  }

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    shockwaveTrigger(e.clientX, e.clientY, ecosystem.color);
    onOpen(ecosystem);
  }

  return (
    <motion.button
      ref={cardRef}
      type="button"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        scale,
        transformPerspective: 900,
        borderColor: `${ecosystem.color}80`,
        backgroundColor: '#14131c',
        backgroundImage: `linear-gradient(${ecosystem.color}0d 1px, transparent 1px), linear-gradient(90deg, ${ecosystem.color}0d 1px, transparent 1px)`,
        backgroundSize: '18px 18px',
        boxShadow: active ? `0 0 40px ${ecosystem.glow}44` : `0 0 18px ${ecosystem.color}26`,
      }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.04 }}
      whileTap={{ scale: 0.96 }}
      className="group relative flex min-h-[200px] flex-col justify-between overflow-hidden border p-6 text-left transition-shadow"
    >
      {/* Themed shimmer strip -- same structural element as B2B's liquid-gold strip */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${ecosystem.color} 30%, ${ecosystem.glow} 50%, ${ecosystem.color} 70%, transparent)`,
        }}
        aria-hidden="true"
      />

      <motion.div className="pointer-events-none absolute inset-0" style={{ background: glowBackground }} />
      <ParticleBurst active={active} color={ecosystem.glow} />

      {/* Call-to-Action pulse: identical border pulse whether the card is currently hovered
          (desktop) or scroll-focused (any viewport) -- same `active` boolean as everything else. */}
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0 border-2"
          style={{ borderColor: ecosystem.glow }}
          animate={{ opacity: [0.25, 0.6, 0.25] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />
      )}

      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <Cpu size={22} style={{ color: ecosystem.color }} aria-hidden="true" />
          <h3
            className="font-serif text-lg font-bold text-white"
            style={{ textShadow: `0 0 18px ${ecosystem.glow}66` }}
          >
            {tEcosystems(`${ecosystem.messageKey}.title`)}
          </h3>
        </div>
        <p className="text-[13px] font-normal leading-snug text-gray-300">
          {tEcosystems(`${ecosystem.messageKey}.description`)}
        </p>
      </div>

      <div
        className="relative mt-4 flex items-center justify-between border-t pt-3"
        style={{ borderColor: `${ecosystem.color}22` }}
      >
        <span className="text-[13px] uppercase tracking-widest text-gray-400">{t('badgeCoinGated')}</span>
        <span className="text-[13px] font-bold" style={{ color: ecosystem.color }}>
          {ecosystem.coinCost.toLocaleString()} U-COIN
        </span>
      </div>
    </motion.button>
  );
}
