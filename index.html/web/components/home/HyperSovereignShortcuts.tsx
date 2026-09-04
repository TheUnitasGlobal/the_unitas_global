'use client';

import { useTranslations } from 'next-intl';
import { BrainCircuit } from 'lucide-react';
import { HYPER_ENGINES, type HyperEngineKey } from '@/lib/hyperSovereign';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { DraggableCarouselRow } from '@/components/ui/DraggableCarouselRow';

interface HyperSovereignShortcutsProps {
  onOpenEngine: (engine: HyperEngineKey) => void;
}

/**
 * "초소버린 숏컷" strip (owner instruction 2026-09-04 round 6): the
 * next-generation shortcut row placed in parallel with the classic 실시간
 * 숏컷 tabs (which stay untouched above it, pending the founder's final
 * sign-off). Five cognitive-engine tiles in the very same box/typography
 * spec as every other carousel in this strip; tapping one opens
 * HomeContent's HyperSovereignTower (lifted, like HotShortcutResultModal,
 * so the tower survives this search-hub strip unmounting on blur).
 */
export function HyperSovereignShortcuts({ onOpenEngine }: HyperSovereignShortcutsProps) {
  const t = useTranslations('HyperSovereign');
  const { playHoverSfx } = useSpatialAudio();

  return (
    <div className="mt-5 border-t border-white/10 px-4 pt-4 sm:px-6">
      <p className="mb-3 flex items-center gap-2 text-[16px] font-bold uppercase tracking-[0.3em] text-accent sm:text-[18px]">
        <BrainCircuit size={18} aria-hidden="true" />
        {t('label')}
      </p>
      <DraggableCarouselRow
        items={HYPER_ENGINES.map((engine) => ({
          id: engine.key,
          render: () => (
            <button
              type="button"
              title={t('hint')}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => onOpenEngine(engine.key)}
              style={{ borderColor: `${engine.color}55`, boxShadow: `0 0 18px ${engine.glow}1f` }}
              className="flex shrink-0 items-center gap-2.5 border px-4 py-3 text-left text-gray-400 transition-colors hover:border-white/30 hover:text-white"
            >
              <engine.icon size={18} style={{ color: engine.color }} aria-hidden="true" />
              <span className="whitespace-nowrap text-[13px] font-bold uppercase tracking-widest sm:text-[15px]">
                {t(`engines.${engine.key}.title`)}
              </span>
            </button>
          ),
        }))}
      />
    </div>
  );
}
