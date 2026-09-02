'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { HOT_SHORTCUT_MATRIX, type HotShortcutAxis } from '@/lib/hotIssues';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

interface HotShortcutMatrixStripProps {
  onOpenShortcut: (axis: HotShortcutAxis) => void;
}

// Duplicated once so the CSS marquee (globals.css .governance-ladder-track,
// -50% translateX) loops seamlessly -- reused as-is from the 16-axis-only
// strip this replaces, now looping the full governance + hot-issue matrix.
const LOOP_AXES = [...HOT_SHORTCUT_MATRIX, ...HOT_SHORTCUT_MATRIX];

/**
 * "The Living Knowledge Ouroboros", expanded: an infinite-loop shortcut strip
 * spanning the 16 Governance axes AND the global hot-issue categories (game,
 * sports, movie, weather), rendered directly under the search bar while it's
 * focused with an empty query (see OmniSynapseSearch's `ouroboros` state).
 * Clicking any tile opens HotShortcutResultModal's chained U-AI popup --
 * distinct from GovernanceLadderStrip/GovernanceLadderModal, which stay
 * wired to Section 4's pure 16-axis reference grid.
 */
export function HotShortcutMatrixStrip({ onOpenShortcut }: HotShortcutMatrixStripProps) {
  const t = useTranslations('OmniSynapse');
  const tGovernance = useTranslations('Governance');
  const tHotIssue = useTranslations('HotIssue');
  const { playHoverSfx } = useSpatialAudio();

  function titleOf(axis: HotShortcutAxis) {
    return axis.group === 'hotIssue'
      ? tHotIssue(`axes.${axis.messageKey}.title`)
      : tGovernance(`axes.${axis.messageKey}.title`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="absolute inset-x-0 top-full z-30 mt-3 overflow-hidden border border-white/10 bg-white/[0.03] py-4 backdrop-blur-xl"
    >
      <p className="mb-3 px-6 text-[9px] font-bold uppercase tracking-[0.3em] text-gray-500">
        {t('shortcutMatrixLabel')}
      </p>
      <div className="governance-ladder-track flex w-max gap-3 px-6">
        {LOOP_AXES.map((axis, i) => (
          <button
            key={`${axis.key}-${i}`}
            type="button"
            title={t('shortcutMatrixHint')}
            onMouseEnter={() => playHoverSfx()}
            onClick={() => onOpenShortcut(axis)}
            style={{ borderColor: `${axis.color}44` }}
            className="flex shrink-0 items-center gap-2 border bg-void/50 px-3 py-2 text-left transition-colors hover:bg-void/80"
          >
            <axis.icon size={14} style={{ color: axis.color }} aria-hidden="true" />
            <span className="whitespace-nowrap text-xs font-bold text-white">{titleOf(axis)}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
