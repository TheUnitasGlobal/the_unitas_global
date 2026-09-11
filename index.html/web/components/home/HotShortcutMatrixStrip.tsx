'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { HotIssueNewsList } from '@/components/home/HotIssueNewsList';
import { DiscoveryCarousel } from '@/components/home/DiscoveryCarousel';
import { GlobalThemeRankings } from '@/components/home/GlobalThemeRankings';
import { UnitasModuleRankings } from '@/components/home/UnitasModuleRankings';
import { SectionShield } from '@/components/system/PageShield';

/**
 * REV-20 §3 -- the search-focus popup's browsing surface. REV-19's themed
 * tab row (weather / social / email / finance / real-estate / dating /
 * career / civic, each its own chip-grid) and the "실시간 숏컷" right-side
 * rotating title-box carousel (`DraggableCarouselRow` mixing 7 hotIssue
 * sub-shortcuts + 7 tab buttons = 14 items) are retired in full on the
 * founder's directive (docs/rev20/SPEC.md §3.1, §12 D-1): the single
 * <DiscoveryCarousel/> below is now the ONLY rotating surface, and the tab
 * concept itself is gone -- browsing access to the social/email/finance/
 * real-estate/dating/career/civic axis groups is intentionally not replaced
 * with a fallback grid ("Quality and lock-in supersede scattered clutter");
 * they remain reachable through the search bar's typing index
 * (lib/uai/liveSearchIndex.ts already indexes every axis and app shortcut).
 *
 * The three live feed rows below the carousel (world rankings / UNITAS
 * rankings / news) are unchanged from REV-19 and keep their own
 * SectionShield so a bad upstream answer in one can never take another --
 * or the search bar above -- down.
 */
export function HotShortcutMatrixStrip() {
  const t = useTranslations('OmniSynapse');

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      // mousedown would otherwise blur the search input and unmount this whole
      // strip 150ms later (OmniSynapseSearch.handleBlur) before a carousel tap
      // or headline click ever felt "즉시" -- swallowing it keeps the input
      // focused, so every interaction in here lands with the strip still open.
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
        <p className="mb-3 flex items-center gap-2 px-4 text-[16px] font-bold uppercase tracking-[0.3em] text-accent sm:px-6 sm:text-[18px]">
          <LayoutGrid size={18} aria-hidden="true" />
          {t('shortcutsStripLabel')}
        </p>

        <div className="px-4 sm:px-6">
          <SectionShield zone="discovery-carousel">
            <DiscoveryCarousel />
          </SectionShield>
        </div>

        {/* The former 핫이슈 tab's live news feed + rankings render permanently
            below the carousel (owner instruction 2026-09-04 round 2). Stack
            order (owner instruction 2026-09-04 round 5): both ranking modules
            ("실시간 세계 랭킹", "실시간 유니타스 랭킹") lead, the "실시간 뉴스"
            feed closes it out. */}
        <div className="mt-5 flex flex-col gap-4 px-4 sm:px-6">
          <SectionShield zone="live-global-rankings">
            <GlobalThemeRankings />
          </SectionShield>
          <SectionShield zone="live-unitas-rankings">
            <UnitasModuleRankings />
          </SectionShield>
          <SectionShield zone="live-news">
            <HotIssueNewsList />
          </SectionShield>
        </div>
      </div>
    </motion.div>
  );
}
