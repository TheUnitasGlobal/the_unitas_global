'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { HotIssueNewsList } from '@/components/home/HotIssueNewsList';
import { DiscoveryCarousel } from '@/components/home/DiscoveryCarousel';
import { SectionShield } from '@/components/system/PageShield';

/**
 * REV-20 §3 -- the search-focus popup's browsing surface. REV-19's themed
 * tab row and the "실시간 숏컷" right-side rotating title-box carousel are
 * retired in full on the founder's directive (docs/rev20/SPEC.md §3.1, §12
 * D-1): the single <DiscoveryCarousel/> below is the ONLY rotating surface.
 *
 * REV-21 §1.3 absorbed the two ranking rows that used to sit under the
 * carousel into it as slots; REV-35 M1 replaced both with the ONE `uRanking`
 * slot (lib/live/discoverySlots.ts) -- the U-Square 유랭킹 rail, one rotating
 * surface. Only the "실시간 뉴스" wire remains as its own row,
 * itself a drag rail (§1.2). Each surface keeps its own SectionShield so a
 * bad upstream answer in one can never take the other -- or the search bar
 * above -- down.
 *
 * REV-21 §1.6 / PERF-01: the strip enters on opacity + translateY only (no
 * in-flow `height` animation -- that re-laid-out every section beneath it on
 * every frame -- and no backdrop-filter behind a 24-slot rail); the exit is
 * a plain fade so the AnimatePresence in OmniSynapseSearch still gets one.
 */
export function HotShortcutMatrixStrip() {
  const t = useTranslations('OmniSynapse');

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.14, ease: 'easeOut' } }}
      // mousedown would otherwise blur the search input and unmount this whole
      // strip 150ms later (OmniSynapseSearch.handleBlur) before a carousel tap
      // or headline click ever felt "즉시" -- swallowing it keeps the input
      // focused, so every interaction in here lands with the strip still open.
      onMouseDown={(e) => e.preventDefault()}
      className="relative z-30"
      data-shortcut-strip=""
      // REV-23 M2.1: the E2E contract for "뉴스는 미입력 팝업 전용" -- this
      // node exists only while the search box is focused AND empty.
      data-news-scope="empty-only"
    >
      {/* In flow (not an absolute overlay): opening the matrix pushes the
          module walls below downward, so the strip can keep growing new
          categories without ever covering them -- and its edges align exactly
          with the search bar above (same content box, no inset-x bleed). */}
      <div className="qw-strip-panel mt-3 border border-white/10 bg-white/[0.03] py-5">
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

        <div className="mt-5 flex flex-col gap-4 px-4 sm:px-6">
          <SectionShield zone="live-news">
            <HotIssueNewsList />
          </SectionShield>
        </div>
      </div>
    </motion.div>
  );
}
