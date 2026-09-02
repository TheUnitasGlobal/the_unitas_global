'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GOVERNANCE_AXES, type GovernanceAxis } from '@/lib/governance';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

interface GovernanceLadderStripProps {
  onOpenAxis: (axis: GovernanceAxis) => void;
}

// Duplicated once so the CSS marquee (globals.css .governance-ladder-track,
// -50% translateX) loops seamlessly -- the second half is an exact repeat of
// the first, so the reset is invisible.
const LOOP_AXES = [...GOVERNANCE_AXES, ...GOVERNANCE_AXES];

/**
 * "The Living Knowledge Ouroboros" -- an infinite-loop shortcut strip of all
 * 16 Governance axes, rendered directly under the search bar while it's
 * focused with an empty query (see OmniSynapseSearch's `ouroboros` state).
 * Clicking an axis reuses the existing GovernanceLadderModal (via the
 * `onOpenAxis` callback lifted from HomeContent) rather than owning its own
 * modal -- one detail surface, many entry points.
 */
export function GovernanceLadderStrip({ onOpenAxis }: GovernanceLadderStripProps) {
  const t = useTranslations('OmniSynapse');
  const tGovernance = useTranslations('Governance');
  const { playHoverSfx } = useSpatialAudio();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="absolute inset-x-0 top-full z-30 mt-3 overflow-hidden border border-white/10 bg-white/[0.03] py-4 backdrop-blur-xl"
    >
      <p className="mb-3 px-6 text-[9px] font-bold uppercase tracking-[0.3em] text-gray-500">
        {t('ladderShortcutLabel')}
      </p>
      <div className="governance-ladder-track flex w-max gap-3 px-6">
        {LOOP_AXES.map((axis, i) => (
          <button
            key={`${axis.key}-${i}`}
            type="button"
            title={t('ladderShortcutHint')}
            onMouseEnter={() => playHoverSfx()}
            onClick={() => onOpenAxis(axis)}
            style={{ borderColor: `${axis.color}44` }}
            className="flex shrink-0 items-center gap-2 border bg-void/50 px-3 py-2 text-left transition-colors hover:bg-void/80"
          >
            <axis.icon size={14} style={{ color: axis.color }} aria-hidden="true" />
            <span className="whitespace-nowrap text-xs font-bold text-white">
              {tGovernance(`axes.${axis.messageKey}.title`)}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
