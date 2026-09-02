'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Download } from 'lucide-react';
import {
  itemsInGroup,
  axisTitle,
  type AxisTranslators,
  type HotShortcutAxis,
  type ShortcutGroup,
} from '@/lib/hotIssues';
import { EMAIL_SHORTCUTS, SOCIAL_SHORTCUTS, type DirectAppShortcut } from '@/lib/appShortcuts';
import { UNITAS_ASSETS } from '@/lib/unitasAssets';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

interface HotShortcutMatrixStripProps {
  onOpenShortcut: (axis: HotShortcutAxis) => void;
}

type TabKey = ShortcutGroup | 'social' | 'email' | 'assets';

const TABS: TabKey[] = [
  'governance',
  'hotIssue',
  'social',
  'email',
  'finance',
  'realEstate',
  'dating',
  'career',
  'assets',
];

/** The active tab survives a locale remount (see HomeContent's storage keys). */
const TAB_STORAGE_KEY = 'unitas.ouroboros.tab.v1';

function isTabKey(value: string | null): value is TabKey {
  return value !== null && (TABS as string[]).includes(value);
}

/**
 * "The Living Knowledge Ouroboros", expanded into a themed tab architecture:
 * visibly-grouped banners (Governance, Hot Issues, Social, Email, Finance,
 * Real Estate, Dating, Career, Assets) instead of one flat infinite marquee --
 * switching tabs swaps the chip grid below rather than auto-scrolling it, so
 * every tile stays a stable click target. Axis tiles open
 * HotShortcutResultModal's chained U-AI popup; Social/Email tiles are direct
 * one-click launchers out to that app's own page in a new tab; Asset tiles
 * are one-click same-origin downloads -- fundamentally different actions, so
 * neither ever calls onOpenShortcut.
 */
export function HotShortcutMatrixStrip({ onOpenShortcut }: HotShortcutMatrixStripProps) {
  const t = useTranslations('OmniSynapse');
  const tGovernance = useTranslations('Governance');
  const tHotIssue = useTranslations('HotIssue');
  const tFinance = useTranslations('Finance');
  const tRealEstate = useTranslations('RealEstate');
  const tDating = useTranslations('Dating');
  const tCareer = useTranslations('Career');
  const tEmail = useTranslations('Email');
  const tSocial = useTranslations('Social');
  const tAssets = useTranslations('Assets');
  const { playHoverSfx } = useSpatialAudio();

  const [activeTab, setActiveTab] = useState<TabKey>('governance');

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
      if (isTabKey(saved)) setActiveTab(saved);
    } catch {
      // sessionStorage unavailable -- restoring the tab is a nicety.
    }
  }, []);

  function selectTab(tab: TabKey) {
    setActiveTab(tab);
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      // non-fatal, see above.
    }
  }

  const axisT: AxisTranslators = {
    governance: tGovernance,
    hotIssue: tHotIssue,
    finance: tFinance,
    realEstate: tRealEstate,
    dating: tDating,
    career: tCareer,
  };

  const hint =
    activeTab === 'email'
      ? tEmail('hint')
      : activeTab === 'social'
        ? tSocial('hint')
        : activeTab === 'assets'
          ? tAssets('hint')
          : null;

  function renderApp(app: DirectAppShortcut) {
    const tApp = app.family === 'email' ? tEmail : tSocial;
    return (
      <a
        key={app.key}
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        title={tApp('openAria', { brand: app.brand })}
        onMouseEnter={() => playHoverSfx()}
        style={{ borderColor: `${app.color}44` }}
        className="flex shrink-0 items-center gap-2 border bg-void/50 px-3 py-2 text-left transition-colors hover:bg-void/80"
      >
        <app.icon size={14} style={{ color: app.color }} aria-hidden="true" />
        <span className="whitespace-nowrap text-xs font-bold text-white">{app.brand}</span>
        <ExternalLink size={11} className="text-gray-500" aria-hidden="true" />
      </a>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="absolute inset-x-0 top-full z-30 mt-3 border border-white/10 bg-white/[0.03] py-4 backdrop-blur-xl"
    >
      <p className="mb-3 px-4 text-[9px] font-bold uppercase tracking-[0.3em] text-gray-500 sm:px-6">
        {t('shortcutMatrixLabel')}
      </p>

      {/* Themed tab banner row -- "가시적 그룹핑" (visible grouping) */}
      <div className="mb-3 flex flex-wrap gap-1.5 px-4 sm:px-6" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onMouseEnter={() => playHoverSfx()}
            onClick={() => selectTab(tab)}
            className={`border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors sm:px-3 sm:text-[11px] ${
              activeTab === tab
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white'
            }`}
          >
            {t(`tab.${tab}`)}
          </button>
        ))}
      </div>

      {hint && <p className="mb-2 px-4 text-[11px] text-gray-500 sm:px-6">{hint}</p>}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18 }}
          className="flex flex-wrap gap-2.5 px-4 sm:gap-3 sm:px-6"
        >
          {activeTab === 'email' && EMAIL_SHORTCUTS.map(renderApp)}
          {activeTab === 'social' && SOCIAL_SHORTCUTS.map(renderApp)}
          {activeTab === 'assets' &&
            UNITAS_ASSETS.map((asset) => (
              <a
                key={asset.key}
                href={asset.href}
                download={asset.fileName}
                title={tAssets('downloadAria', { name: tAssets(`items.${asset.key}`) })}
                onMouseEnter={() => playHoverSfx()}
                style={{ borderColor: `${asset.color}44` }}
                className="flex shrink-0 items-center gap-2 border bg-void/50 px-3 py-2 text-left transition-colors hover:bg-void/80"
              >
                <asset.icon size={14} style={{ color: asset.color }} aria-hidden="true" />
                <span className="whitespace-nowrap text-xs font-bold text-white">{tAssets(`items.${asset.key}`)}</span>
                <Download size={11} className="text-gray-500" aria-hidden="true" />
              </a>
            ))}
          {activeTab !== 'email' &&
            activeTab !== 'social' &&
            activeTab !== 'assets' &&
            itemsInGroup(activeTab).map((axis) => (
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
                <span className="whitespace-nowrap text-xs font-bold text-white">{axisTitle(axis, axisT)}</span>
              </button>
            ))}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
