'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { itemsInGroup, axisTitle, type HotShortcutAxis, type ShortcutGroup } from '@/lib/hotIssues';
import { EMAIL_SHORTCUTS } from '@/lib/emailShortcuts';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

interface HotShortcutMatrixStripProps {
  onOpenShortcut: (axis: HotShortcutAxis) => void;
}

type TabKey = ShortcutGroup | 'email';

const TABS: TabKey[] = ['governance', 'hotIssue', 'email', 'finance', 'career'];

/**
 * "The Living Knowledge Ouroboros", expanded into a themed tab architecture:
 * five visibly-grouped banners (Governance, Hot Issues, Email, Finance,
 * Career) instead of one flat infinite marquee -- switching tabs swaps the
 * chip grid below rather than auto-scrolling it, so every tile stays a stable
 * click target (a continuously-translating marquee made tiles hard to tap
 * reliably once groups grew past a handful of items). Governance/HotIssue/
 * Finance/Career tiles open HotShortcutResultModal's chained U-AI popup;
 * Email tiles are a direct one-click launcher out to that provider's own
 * webmail login page in a new tab -- a fundamentally different action, so it
 * never calls onOpenShortcut.
 */
export function HotShortcutMatrixStrip({ onOpenShortcut }: HotShortcutMatrixStripProps) {
  const t = useTranslations('OmniSynapse');
  const tGovernance = useTranslations('Governance');
  const tHotIssue = useTranslations('HotIssue');
  const tFinance = useTranslations('Finance');
  const tCareer = useTranslations('Career');
  const tEmail = useTranslations('Email');
  const { playHoverSfx } = useSpatialAudio();

  const [activeTab, setActiveTab] = useState<TabKey>('governance');

  function titleOf(axis: HotShortcutAxis) {
    return axisTitle(axis, {
      governance: tGovernance,
      hotIssue: tHotIssue,
      finance: tFinance,
      career: tCareer,
    });
  }

  const items = activeTab === 'email' ? EMAIL_SHORTCUTS : itemsInGroup(activeTab);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="absolute inset-x-0 top-full z-30 mt-3 border border-white/10 bg-white/[0.03] py-4 backdrop-blur-xl"
    >
      <p className="mb-3 px-6 text-[9px] font-bold uppercase tracking-[0.3em] text-gray-500">
        {t('shortcutMatrixLabel')}
      </p>

      {/* Themed tab banner row -- "가시적 그룹핑" (visible grouping) */}
      <div className="mb-3 flex flex-wrap gap-1.5 px-6" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onMouseEnter={() => playHoverSfx()}
            onClick={() => setActiveTab(tab)}
            className={`border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
              activeTab === tab
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white'
            }`}
          >
            {t(`tab.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'email' && (
        <p className="mb-2 px-6 text-[11px] text-gray-500">{tEmail('hint')}</p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18 }}
          className="flex flex-wrap gap-3 px-6"
        >
          {activeTab === 'email'
            ? EMAIL_SHORTCUTS.map((mail) => (
                <a
                  key={mail.key}
                  href={mail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={tEmail('openAria', { brand: mail.brand })}
                  onMouseEnter={() => playHoverSfx()}
                  style={{ borderColor: `${mail.color}44` }}
                  className="flex shrink-0 items-center gap-2 border bg-void/50 px-3 py-2 text-left transition-colors hover:bg-void/80"
                >
                  <mail.icon size={14} style={{ color: mail.color }} aria-hidden="true" />
                  <span className="whitespace-nowrap text-xs font-bold text-white">{mail.brand}</span>
                  <ExternalLink size={11} className="text-gray-500" aria-hidden="true" />
                </a>
              ))
            : (items as HotShortcutAxis[]).map((axis) => (
                <button
                  key={axis.key}
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
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
