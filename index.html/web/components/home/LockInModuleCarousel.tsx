'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Lock, Unlock } from 'lucide-react';
import { LOCK_IN_MODULES, LOCK_IN_TOTAL, type LockInModule, type LockInModuleKey } from '@/lib/lockInModules';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { DraggableCarouselRow } from '@/components/ui/DraggableCarouselRow';

interface LockInModuleCarouselProps {
  active: LockInModuleKey[];
  onOpen: (module: LockInModule) => void;
}

/**
 * "락인 에코시스템" -- the 8 lock-in modules [NEXUS, AEGIS, U-TWIN, INFINITY,
 * PANOPTICON, ORACLE, SYNDICATE-X, FATE-MATRIX] as ONE single-row rotating
 * carousel (owner instruction 2026-09-04 round 8: "8대 모듈 1행 회전
 * 캐러셀이 코어 3대 모듈 바로 위에 정확히 정렬"). Same DraggableCarouselRow
 * every other rotating strip on the home page rides (idle drift, mouse
 * grab-drag, native touch swipe, tiles stay tap targets), same section
 * header altitude as Sections 1-3 so it reads as one continuous catalog.
 * Tapping a tile opens HomeContent's LockInModuleModal; an activated
 * module lights its tile and the "n / 8" progress in the header.
 */
export function LockInModuleCarousel({ active, onOpen }: LockInModuleCarouselProps) {
  const t = useTranslations('LockIn');
  const { playHoverSfx } = useSpatialAudio();
  const complete = active.length >= LOCK_IN_TOTAL;

  return (
    <section id="lock-in" className="mx-auto mt-8 max-w-7xl border-t border-white/10 px-6 py-16">
      <div className="mb-10 text-center">
        <h2 className="glow-text mb-3 font-serif text-2xl font-bold text-accent md:text-3xl">{t('title')}</h2>
        <p className="mx-auto max-w-2xl text-[16px] text-gray-400 sm:text-[17px] md:text-[19px]">{t('subtitle')}</p>
        <p
          className={`mt-4 inline-flex items-center gap-2 border px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.25em] sm:text-[13px] ${
            complete ? 'border-accent bg-accent/15 text-accent' : 'border-white/15 text-gray-400'
          }`}
          aria-live="polite"
        >
          {complete ? <Lock size={13} aria-hidden="true" /> : <Unlock size={13} aria-hidden="true" />}
          {complete ? t('complete') : t('progress', { active: active.length, total: LOCK_IN_TOTAL })}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
      >
        <DraggableCarouselRow
          className="py-2"
          speed={22}
          items={LOCK_IN_MODULES.map((module) => {
            const isActive = active.includes(module.key);
            return {
              id: module.key,
              render: () => (
                <button
                  type="button"
                  title={t('hint')}
                  aria-label={`${module.brand} · ${t(`modules.${module.key}.tagline`)}`}
                  aria-pressed={isActive}
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => onOpen(module)}
                  style={{
                    borderColor: isActive ? `${module.color}cc` : `${module.color}55`,
                    boxShadow: isActive ? `0 0 28px ${module.glow}33` : `0 0 18px ${module.glow}1a`,
                    backgroundColor: isActive ? `${module.color}12` : undefined,
                  }}
                  className="flex w-[240px] shrink-0 items-center gap-3.5 border bg-void/60 px-4 py-3.5 text-left transition-colors hover:bg-void/90 sm:w-[300px] sm:px-5 sm:py-4"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center border"
                    style={{ borderColor: `${module.color}66`, color: module.color }}
                    aria-hidden="true"
                  >
                    <module.icon size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-bold uppercase tracking-[0.2em] text-white sm:text-[15px]">
                        {module.brand}
                      </span>
                      {isActive && (
                        <span
                          className="shrink-0 border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                          style={{ borderColor: `${module.color}88`, color: module.color }}
                        >
                          {t('activeBadge')}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-[12px] text-gray-400 sm:text-[13px]">
                      {t(`modules.${module.key}.tagline`)}
                    </span>
                  </span>
                </button>
              ),
            };
          })}
        />
      </motion.div>
    </section>
  );
}
