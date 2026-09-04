'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import {
  itemsInGroup,
  axisTitle,
  type AxisTranslators,
  type HotShortcutAxis,
  type ShortcutGroup,
} from '@/lib/hotIssues';
import { EMAIL_SHORTCUTS, SOCIAL_SHORTCUTS, type DirectAppShortcut } from '@/lib/appShortcuts';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { DraggableCarouselRow } from '@/components/ui/DraggableCarouselRow';
import { HotIssueNewsList } from '@/components/home/HotIssueNewsList';
import { LiveWeatherPanel } from '@/components/home/LiveWeatherPanel';
import { GlobalThemeRankings } from '@/components/home/GlobalThemeRankings';
import { UnitasModuleRankings } from '@/components/home/UnitasModuleRankings';
import { AppDetailCard } from '@/components/interaction/AppDetailCard';

interface HotShortcutMatrixStripProps {
  onOpenShortcut: (axis: HotShortcutAxis) => void;
}

type TabKey = ShortcutGroup | 'weather' | 'social' | 'email';

/** The old standalone "governance" tab was retired 2026-09-03 -- its 16 axes
 *  now live folded into hotIssue/finance/career or the new "civic" tab (see
 *  lib/hotIssues.ts). The trailing "에셋" (asset-download) tab was removed
 *  entirely (owner instruction 2026-09-04: "가장 오른쪽 에셋 박스 일괄 삭제")
 *  -- lib/unitasAssets.ts no longer exists. The 핫이슈 tab itself was later
 *  removed too (owner instruction 2026-09-04 round 2): its icon-less pill
 *  sub-shortcuts (게임/스포츠/영화/문화/사회/표현/전략, still the 'hotIssue'
 *  group in lib/hotIssues.ts) are now rendered directly in this tab row,
 *  right beside 실시간 날씨, each opening onOpenShortcut's chained popup
 *  immediately rather than switching a tab -- see the TABS.flatMap render
 *  below. weather is the new default landing tab. */
const TABS: TabKey[] = ['weather', 'social', 'email', 'finance', 'realEstate', 'dating', 'career', 'civic'];

/** The active tab survives a locale remount (see HomeContent's storage keys). */
const TAB_STORAGE_KEY = 'unitas.ouroboros.tab.v1';

function isTabKey(value: string | null): value is TabKey {
  return value !== null && (TABS as string[]).includes(value);
}

/**
 * "The Living Knowledge Ouroboros", expanded into a themed tab architecture:
 * visibly-grouped banners (Weather, Social, Email, Finance, Real Estate,
 * Dating, Career, Civic) instead of one flat infinite marquee -- switching
 * tabs swaps the chip grid below rather than auto-scrolling it, so every
 * tile stays a stable click target. Axis tiles open HotShortcutResultModal's
 * chained U-AI popup; Social/Email tiles toggle an inline AppDetailCard
 * (now the SAME encyclopedic engine every axis tile's popup uses, keyed on
 * the brand name, rather than a static hint sentence -- owner instruction
 * 2026-09-04) via local state instead, same interaction shape as
 * onOpenShortcut but scoped to this strip. The former 핫이슈 tab's own
 * sub-shortcuts (게임/스포츠/영화/문화/사회/표현/전략) now render inline in
 * the tab row itself, right beside 실시간 날씨, each opening
 * onOpenShortcut's chained popup directly; its live news feed + rankings
 * lost their tab home along with it and now render permanently below every
 * tab's content instead of only inside one.
 */
export function HotShortcutMatrixStrip({ onOpenShortcut }: HotShortcutMatrixStripProps) {
  const t = useTranslations('OmniSynapse');
  const tCivic = useTranslations('Civic');
  const tHotIssue = useTranslations('HotIssue');
  const tFinance = useTranslations('Finance');
  const tRealEstate = useTranslations('RealEstate');
  const tDating = useTranslations('Dating');
  const tCareer = useTranslations('Career');
  const tEmail = useTranslations('Email');
  const tSocial = useTranslations('Social');
  const { playHoverSfx } = useSpatialAudio();

  const [activeTab, setActiveTab] = useState<TabKey>('weather');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

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
    setExpandedApp(null);
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      // non-fatal, see above.
    }
  }

  const axisT: AxisTranslators = {
    civic: tCivic,
    hotIssue: tHotIssue,
    finance: tFinance,
    realEstate: tRealEstate,
    dating: tDating,
    career: tCareer,
  };

  /** Tapping a webmail/social tile toggles its AppDetailCard open below the
   *  grid instead of navigating immediately -- same click-opens-detail shape
   *  as every other U-AI shortcut (owner instruction 2026-09-04). */
  function renderApp(app: DirectAppShortcut) {
    const tApp = app.family === 'email' ? tEmail : tSocial;
    const active = expandedApp === app.key;
    return (
      <button
        key={app.key}
        type="button"
        title={tApp('openAria', { brand: app.brand })}
        aria-label={tApp('openAria', { brand: app.brand })}
        aria-expanded={active}
        onMouseEnter={() => playHoverSfx()}
        onClick={() => setExpandedApp((prev) => (prev === app.key ? null : app.key))}
        style={{ borderColor: `${app.color}44`, backgroundColor: active ? `${app.color}14` : undefined }}
        className="flex shrink-0 items-center gap-2.5 border bg-void/50 px-4 py-3 text-left transition-colors hover:bg-void/80"
      >
        <app.icon size={18} style={{ color: app.color }} aria-hidden="true" />
        <span className="whitespace-nowrap text-[13px] font-bold text-white sm:text-[15px]">{app.brand}</span>
      </button>
    );
  }

  const expandedAppList = activeTab === 'email' ? EMAIL_SHORTCUTS : activeTab === 'social' ? SOCIAL_SHORTCUTS : [];
  const expandedAppEntry = expandedAppList.find((app) => app.key === expandedApp) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      // mousedown would otherwise blur the search input and unmount this whole
      // strip 150ms later (OmniSynapseSearch.handleBlur) before a tab switch or
      // shortcut tap ever felt "즉시" -- swallowing it keeps the input focused,
      // so every interaction in here lands with the strip still open.
      onMouseDown={(e) => e.preventDefault()}
      className="relative z-30 overflow-hidden"
    >
      {/* In flow (not an absolute overlay): opening the matrix pushes the
          module walls below downward, so the strip can keep growing new
          categories without ever covering them -- and its edges align exactly
          with the search bar above (same content box, no inset-x bleed). */}
      <div className="mt-3 border border-white/10 bg-white/[0.03] py-5 backdrop-blur-xl">
      {/* Strip title -- brand HUD label (English-branded like "U-AI SEARCH
          RESULT"), aligned to the same horizontal gutter as every row below
          (owner instruction 2026-09-02). */}
      <p className="mb-3 flex items-center gap-2 px-4 text-[13px] font-bold uppercase tracking-[0.3em] text-accent sm:px-6">
        <LayoutGrid size={14} aria-hidden="true" />
        {t('shortcutsStripLabel')}
      </p>
      {/* Themed tab banner row -- "실시간 날씨" stays pinned as a fixed lead
          tile; every other tab button plus the former 핫이슈 tab's inlined
          sub-shortcuts (게임/스포츠/영화/문화/사회/표현/전략, each opening
          onOpenShortcut's chained popup directly rather than switching
          activeTab) now ride a single-row, drag/swipe-able auto-drifting
          carousel beside it instead of wrapping across lines (owner
          instruction 2026-09-04 round 4: "1행 회전형 정렬"). */}
      <div className="mb-4 flex items-center gap-2 px-4 sm:px-6" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'weather'}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => selectTab('weather')}
          className={`shrink-0 border px-3 py-2 text-[13px] font-bold uppercase tracking-widest transition-colors sm:px-4 sm:text-[15px] ${
            activeTab === 'weather'
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white'
          }`}
        >
          {t('tab.weather')}
        </button>
        <DraggableCarouselRow
          className="min-w-0 flex-1"
          items={[
            ...itemsInGroup('hotIssue').map((axis) => ({
              id: `sub-${axis.key}`,
              render: () => (
                <button
                  type="button"
                  title={t('shortcutMatrixHint')}
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => onOpenShortcut(axis)}
                  style={{ borderColor: `${axis.color}44` }}
                  className="flex items-center gap-1.5 border px-3 py-2 text-[13px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-white/30 hover:text-white sm:px-4 sm:text-[15px]"
                >
                  <axis.icon size={14} style={{ color: axis.color }} aria-hidden="true" />
                  {axisTitle(axis, axisT)}
                </button>
              ),
            })),
            ...TABS.filter((tab) => tab !== 'weather').map((tab) => ({
              id: `tab-${tab}`,
              render: () => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => selectTab(tab)}
                  className={`border px-3 py-2 text-[13px] font-bold uppercase tracking-widest transition-colors sm:px-4 sm:text-[15px] ${
                    activeTab === tab
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {t(`tab.${tab}`)}
                </button>
              ),
            })),
          ]}
        />
      </div>

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
          {expandedAppEntry && (
            <AppDetailCard
              app={expandedAppEntry}
              openLabel={(expandedAppEntry.family === 'email' ? tEmail : tSocial)('openAria', {
                brand: expandedAppEntry.brand,
              })}
              onHover={() => playHoverSfx()}
              onOpen={() => setExpandedApp(null)}
            />
          )}
          {activeTab === 'weather' && <LiveWeatherPanel />}
          {activeTab !== 'email' &&
            activeTab !== 'social' &&
            activeTab !== 'weather' &&
            itemsInGroup(activeTab).map((axis) => (
              <button
                key={axis.key}
                type="button"
                title={t('shortcutMatrixHint')}
                onMouseEnter={() => playHoverSfx()}
                onClick={() => onOpenShortcut(axis)}
                style={{ borderColor: `${axis.color}44` }}
                className="flex shrink-0 items-center gap-2.5 border bg-void/50 px-4 py-3 text-left transition-colors hover:bg-void/80"
              >
                <axis.icon size={18} style={{ color: axis.color }} aria-hidden="true" />
                <span className="whitespace-nowrap text-[13px] font-bold text-white sm:text-[15px]">{axisTitle(axis, axisT)}</span>
              </button>
            ))}
        </motion.div>
      </AnimatePresence>

      {/* The former 핫이슈 tab's live news feed + rankings lost their tab home
          when that tab was removed above -- rather than deleting them, they
          now render permanently below every tab's content instead of only
          inside one (owner instruction 2026-09-04 round 2). Stack order
          reversed (owner instruction 2026-09-04 round 5): both ranking
          modules ("실시간 세계 랭킹", "실시간 유니타스 랭킹") now lead, the
          renamed "실시간 뉴스" feed closes it out. */}
      <div className="mt-5 flex flex-col gap-4 px-4 sm:px-6">
        <GlobalThemeRankings />
        <UnitasModuleRankings />
        <HotIssueNewsList />
      </div>
      </div>
    </motion.div>
  );
}
