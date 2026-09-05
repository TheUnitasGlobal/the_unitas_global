'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Lock, Unlock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { LOCK_IN_MODULES, LOCK_IN_TOTAL, lockInIndex, type LockInModule } from '@/lib/lockInModules';

interface LockInModuleModalProps {
  module: LockInModule | null;
  active: boolean;
  onToggleActive: (module: LockInModule) => void;
  /** Ladder step: the modal walks all 8 modules in a loop (8 → 1, 1 → 8)
   *  so a visitor can activate every one without closing it. */
  onStep: (module: LockInModule) => void;
  onClose: () => void;
}

/**
 * Detail popup for one of the 8 lock-in modules: brand mark, tagline,
 * description, three core pillars, the constitution doctrine it embodies,
 * and the activate/deactivate lock-in toggle. Mirrors the shared Modal
 * shell every other centered content dialog uses; owned by HomeContent's
 * `activeLockIn` state (plain `prop !== null` open pattern, like
 * ModuleQuestModal / HotShortcutResultModal).
 */
export function LockInModuleModal({ module, active, onToggleActive, onStep, onClose }: LockInModuleModalProps) {
  const t = useTranslations('LockIn');
  const { playHoverSfx } = useSpatialAudio();
  // Keep the last module rendered through the close animation so the panel
  // doesn't blank out while AnimatePresence is still fading it away.
  const lastRef = useRef<LockInModule | null>(null);
  if (module) lastRef.current = module;
  const shown = module ?? lastRef.current;
  const open = module !== null;

  function step(delta: number) {
    if (!module) return;
    playHoverSfx();
    const next = LOCK_IN_MODULES[(lockInIndex(module.key) + delta + LOCK_IN_TOTAL) % LOCK_IN_TOTAL];
    onStep(next);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, module?.key]);

  if (!shown) return <Modal open={false} onClose={onClose}>{null}</Modal>;

  const index = lockInIndex(shown.key);
  const Icon = shown.icon;

  return (
    <Modal open={open} onClose={onClose} labelledBy="lock-in-module-title" size="lg">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-accent/70">
        {t('eyebrow', { index: index + 1, total: LOCK_IN_TOTAL })}
      </p>

      <div className="mb-4 flex items-center gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center border"
          style={{ borderColor: `${shown.color}88`, color: shown.color, boxShadow: `0 0 24px ${shown.glow}33` }}
          aria-hidden="true"
        >
          <Icon size={28} />
        </span>
        <div className="min-w-0">
          <h2
            id="lock-in-module-title"
            className="font-serif text-2xl font-bold uppercase tracking-[0.18em] text-white sm:text-3xl"
          >
            {shown.brand}
          </h2>
          <p className="mt-1 text-[14px] font-bold sm:text-[15px]" style={{ color: shown.color }}>
            {t(`modules.${shown.key}.tagline`)}
          </p>
        </div>
      </div>

      <p className="mb-5 text-[14px] leading-relaxed text-gray-300 sm:text-[15px]">
        {t(`modules.${shown.key}.description`)}
      </p>

      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">{t('pillarsLabel')}</p>
      <ul className="mb-5 space-y-2">
        {(['p1', 'p2', 'p3'] as const).map((k) => (
          <li
            key={k}
            className="border-l-2 pl-3 text-[13px] leading-relaxed text-gray-200 sm:text-[14px]"
            style={{ borderColor: `${shown.color}88` }}
          >
            {t(`modules.${shown.key}.${k}`)}
          </li>
        ))}
      </ul>

      <figure className="mb-6 border-l-2 border-accent/40 pl-3">
        <figcaption className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-accent/50">
          {t('doctrineLabel')}
        </figcaption>
        <blockquote className="text-[13px] italic leading-relaxed text-accent/80">
          {t(`modules.${shown.key}.doctrine`)}
        </blockquote>
      </figure>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onMouseEnter={() => playHoverSfx()}
          onClick={() => onToggleActive(shown)}
          aria-pressed={active}
          className={`flex flex-1 items-center justify-center gap-2 border py-2.5 text-[13px] font-bold uppercase tracking-widest transition-all ${
            active
              ? 'border-accent bg-accent text-void hover:bg-accent/80'
              : 'border-accent bg-accent/10 text-accent hover:bg-accent hover:text-void'
          }`}
        >
          {active ? <Lock size={14} aria-hidden="true" /> : <Unlock size={14} aria-hidden="true" />}
          {active ? t('deactivate') : t('activate')}
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => step(-1)}
            aria-label={t('prev')}
            className="flex h-10 w-10 items-center justify-center border border-white/15 text-gray-300 transition-colors hover:border-accent/50 hover:text-accent"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="text-[11px] font-bold tabular-nums text-gray-500">
            {index + 1} / {LOCK_IN_TOTAL}
          </span>
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => step(1)}
            aria-label={t('next')}
            className="flex h-10 w-10 items-center justify-center border border-white/15 text-gray-300 transition-colors hover:border-accent/50 hover:text-accent"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
