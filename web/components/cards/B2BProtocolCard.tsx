'use client';

import { useRef, useState, useEffect, type MouseEvent } from 'react';
import { motion, AnimatePresence, useMotionValue, useMotionTemplate, useSpring } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { EnterpriseInquiryModal } from '@/components/interaction/EnterpriseInquiryModal';
import { SwordShieldIcon } from '@/components/icons/SwordShieldIcon';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { B2B_TECH_SPECS } from '@/lib/b2bSpecs';
import { shouldPlayScrollFocusSfx } from '@/lib/pointerDevice';
import type { B2BProtocol } from '@/lib/modules';

interface B2BProtocolCardProps {
  protocol: B2BProtocol;
  index: number;
}

const GOLD = '#d4af37';

/**
 * Deep Obsidian & Liquid Gold themed card for the Enterprise R&D section.
 * Uses the same cursor-tilt + glow-follow hover interaction as
 * EcosystemCard/LiveServiceCard for a consistent feel across all three card
 * tiers -- this one stays a `motion.div` (not a `motion.button`) because it
 * hosts its own nested interactive buttons below.
 */
export function B2BProtocolCard({ protocol, index }: B2BProtocolCardProps) {
  const t = useTranslations('B2B');
  const tModules = useTranslations('Modules');
  const { playVaultSfx } = useSpatialAudio();
  const [specOpen, setSpecOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [scrollFocused, setScrollFocused] = useState(false);

  const rotateX = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const scale = useSpring(1, { stiffness: 260, damping: 20 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowBackground = useMotionTemplate`radial-gradient(320px circle at ${glowX}% ${glowY}%, ${GOLD}2e, transparent 70%)`;

  // Same device-agnostic pattern as EcosystemCard/LiveServiceCard: `active` unifies mouse
  // hover (desktop) and scroll-through-center (any viewport) into one boolean driving
  // glow/scale identically.
  const active = hovered || scrollFocused;

  const nodes = B2B_TECH_SPECS[protocol.route] ?? [];

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setScrollFocused(entry.isIntersecting);
        // Gates on the LIVE input modality (see lib/pointerDevice.ts): the scroll cue fires
        // only while the visitor is scrolling by touch, and never on a mouse/trackpad
        // session -- not even a touchscreen laptop -- where handleMouseEnter already plays
        // the identical SFX.
        if (entry.isIntersecting && shouldPlayScrollFocusSfx()) {
          playVaultSfx();
        }
      },
      { rootMargin: '-42% 0px -42% 0px', threshold: 0 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [playVaultSfx]);

  useEffect(() => {
    scale.set(active ? 1.015 : 1);
  }, [active, scale]);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
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
    playVaultSfx();
  }

  function handleMouseLeave() {
    setHovered(false);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        scale,
        transformPerspective: 900,
        borderColor: active ? `${GOLD}99` : `${GOLD}33`,
        backgroundColor: '#050403',
        backgroundImage:
          'linear-gradient(rgba(212,175,55,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.05) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
        boxShadow: active ? `0 0 40px ${GOLD}33` : `0 0 18px ${GOLD}18`,
      }}
      className="relative overflow-hidden border p-6 transition-shadow duration-300"
    >
      {/* Liquid gold shimmer strip */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, #d4af37 30%, #fff3c4 50%, #d4af37 70%, transparent)',
        }}
        aria-hidden="true"
      />

      <motion.div className="pointer-events-none absolute inset-0" style={{ background: glowBackground }} />

      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <SwordShieldIcon size={22} className="text-accent" />
          <h3 className="font-serif text-lg font-bold tracking-wide text-white">
            {tModules(`${protocol.messageKey}.title`)}
          </h3>
        </div>

        <p className="mb-4 text-[13px] font-normal leading-snug text-gray-300">
          {tModules(`${protocol.messageKey}.description`)}
        </p>

        <div className="mb-4 space-y-2">
          <p className="border-l-2 border-accent/50 pl-3 text-[13px] italic text-gray-400">
            {t('rdNotice')}
          </p>
          <span className="inline-block border border-accent/30 bg-accent/5 px-2 py-1 text-[13px] font-bold uppercase tracking-widest text-accent">
            {t('patentBadge')}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSpecOpen((prev) => !prev)}
          aria-expanded={specOpen}
          className="mb-2 flex w-full items-center justify-between border border-white/10 bg-void/60 px-3 py-2 text-[13px] font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-accent/40 hover:text-accent"
        >
          <span>{specOpen ? t('hideSpec') : t('viewSpec')}</span>
          <ChevronDown size={14} className={specOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>

        <AnimatePresence initial={false}>
          {specOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mb-4 flex flex-col gap-2 border border-white/10 bg-void/40 p-4">
                {nodes.map((node, i) => (
                  <div key={node} className="flex items-center gap-2">
                    <span className="flex-1 border border-accent/20 bg-accent/5 px-2 py-1.5 text-[13px] text-gray-300">
                      {node}
                    </span>
                    {i < nodes.length - 1 && (
                      <ArrowRight size={12} className="shrink-0 rotate-90 text-accent/60 sm:rotate-0" />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setInquiryOpen(true)}
          className="w-full border border-accent bg-accent/10 py-2.5 text-[13px] font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void"
        >
          {t('earlyAccess')}
        </button>
      </div>

      <EnterpriseInquiryModal
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        protocolTitle={tModules(`${protocol.messageKey}.title`)}
      />
    </motion.div>
  );
}
