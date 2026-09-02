'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { GOVERNANCE_AXES, type GovernanceAxis } from '@/lib/governance';

interface GovernanceLadderModalProps {
  axis: GovernanceAxis | null;
  onClose: () => void;
}

const TOTAL = GOVERNANCE_AXES.length;

/**
 * "무한 루프 사다리" (infinite-loop ladder) reader for the 16-axis Governance
 * Matrix: ONE modal instance steps through all 16 axes with next/prev,
 * wrapping 16 -> 1 and 1 -> 16, instead of stacking a new popup per axis.
 * Deliberately mirrors EcosystemEntryModal's plain `prop !== null` open
 * pattern (not lib/uiGate.ts) -- that gate covers the small anchored
 * popovers (language switcher, wallet panel), while the big centered content
 * modals in this app (EcosystemEntryModal, ModuleQuestModal) are each owned
 * by their own piece of parent state, and this one follows the same rule.
 */
export function GovernanceLadderModal({ axis, onClose }: GovernanceLadderModalProps) {
  const t = useTranslations('Governance');
  const { playHoverSfx } = useSpatialAudio();
  const [index, setIndex] = useState(0);

  const open = axis !== null;

  useEffect(() => {
    if (!axis) return;
    const found = GOVERNANCE_AXES.findIndex((a) => a.key === axis.key);
    setIndex(found === -1 ? 0 : found);
  }, [axis]);

  function step(delta: number) {
    playHoverSfx();
    setIndex((prev) => (prev + delta + TOTAL) % TOTAL);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const current = GOVERNANCE_AXES[index];

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-void/85 p-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden border bg-quantum/90 p-8"
            style={{
              borderColor: `${current.color}66`,
              boxShadow: `0 0 60px ${current.glow}33, inset 0 0 40px ${current.color}11`,
            }}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="governance-ladder-title"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)',
              }}
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center border text-xs"
              style={{ borderColor: `${current.color}55`, color: current.color }}
            >
              <X size={14} />
            </button>

            <p className="mb-1 text-[9px] uppercase tracking-[0.3em] text-gray-500">{t('badge')}</p>

            <AnimatePresence mode="wait">
              <motion.div
                key={current.key}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <current.icon size={24} style={{ color: current.color }} aria-hidden="true" />
                  <h2
                    id="governance-ladder-title"
                    className="font-serif text-2xl font-bold text-white"
                    style={{ textShadow: `0 0 24px ${current.glow}66` }}
                  >
                    {t(`axes.${current.messageKey}.title`)}
                  </h2>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-gray-400">
                  {t(`axes.${current.messageKey}.description`)}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t('prev')}
                className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-gray-400 transition-colors hover:text-accent"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                {t('prev')}
              </button>
              <span className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
                {t('indexLabel', { current: index + 1, total: TOTAL })}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t('next')}
                className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-gray-400 transition-colors hover:text-accent"
              >
                {t('next')}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
