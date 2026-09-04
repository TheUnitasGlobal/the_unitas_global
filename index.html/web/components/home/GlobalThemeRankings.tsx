'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Globe2, X } from 'lucide-react';
import { GLOBAL_RANKING_THEMES, LOAD_MORE_TIERS, type GlobalRankingThemeKey } from '@/lib/globalRankings';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

/**
 * 핫이슈 탭의 "하이브리드 테마 랭킹 위젯" (owner instruction 2026-09-04, deepened
 * same day): a row of global theme chips (UNESCO heritage, GDP benchmark,
 * human-history milestones, ...) sitting directly above HotIssueNewsList's
 * live feed. Tapping a chip expands its top-10 countdown inline; "11~50위
 * 보기" / "51~100위 보기" step through LOAD_MORE_TIERS until the curated
 * dataset runs out, at which point the panel says so plainly rather than
 * padding with unsourced filler ranks (see lib/globalRankings.ts banner).
 */
export function GlobalThemeRankings() {
  const t = useTranslations('GlobalRankings');
  const { playHoverSfx } = useSpatialAudio();
  const [expandedKey, setExpandedKey] = useState<GlobalRankingThemeKey | null>(null);
  const [visibleTiers, setVisibleTiers] = useState<Record<string, number>>({});
  const listRef = useRef<HTMLOListElement>(null);
  /** Rank the list was cut off at *before* the last "더 보기" click -- lets the
   *  effect below carry the viewer into the freshly-revealed rows instead of
   *  leaving them to hunt for rank 11 at the bottom of a now much-longer
   *  list. Null means "no reveal pending" (theme just opened/switched, or
   *  first mount) so that transition never triggers an unwanted scroll. */
  const revealBoundaryRef = useRef<number | null>(null);

  const expandedTheme = GLOBAL_RANKING_THEMES.find((theme) => theme.key === expandedKey) ?? null;
  const visibleTier = expandedKey ? (visibleTiers[expandedKey] ?? LOAD_MORE_TIERS[0]) : LOAD_MORE_TIERS[0];

  function openTheme(key: GlobalRankingThemeKey) {
    revealBoundaryRef.current = null;
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  function loadMore() {
    if (!expandedTheme) return;
    const nextTier = LOAD_MORE_TIERS.find((tier) => tier > visibleTier) ?? expandedTheme.entries.length;
    revealBoundaryRef.current = visibleTier;
    setVisibleTiers((prev) => ({ ...prev, [expandedTheme.key]: Math.min(nextTier, expandedTheme.entries.length) }));
  }

  // Smoothly carries the viewer to the first newly-revealed rank rather than
  // leaving the reveal to happen off-screen at the bottom of a now much
  // taller list (owner instruction 2026-09-04: "가림 현상 없이 부드럽게 조회").
  useEffect(() => {
    const boundary = revealBoundaryRef.current;
    revealBoundaryRef.current = null;
    if (boundary === null || !listRef.current) return;
    const target = listRef.current.querySelector(`[data-rank="${boundary + 1}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [visibleTier]);

  const shownEntries = expandedTheme ? expandedTheme.entries.slice(0, visibleTier) : [];
  const hasMoreData = expandedTheme ? visibleTier < expandedTheme.entries.length : false;
  const nextTierCap = expandedTheme
    ? Math.min(LOAD_MORE_TIERS.find((tier) => tier > visibleTier) ?? expandedTheme.entries.length, expandedTheme.entries.length)
    : 0;

  return (
    <div className="mb-4 w-full">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-accent">
        <Globe2 size={12} aria-hidden="true" />
        {t('label')}
      </p>
      <p className="mb-3 text-[12px] text-gray-400">{t('hint')}</p>

      <div className="flex flex-wrap gap-2.5 sm:gap-3">
        {GLOBAL_RANKING_THEMES.map((theme) => {
          const active = expandedKey === theme.key;
          return (
            <button
              key={theme.key}
              type="button"
              aria-expanded={active}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => openTheme(theme.key)}
              style={{ borderColor: `${theme.color}44`, backgroundColor: active ? `${theme.color}14` : undefined }}
              className="flex shrink-0 items-center gap-2.5 border bg-void/50 px-4 py-3 text-left transition-colors hover:bg-void/80"
            >
              <theme.icon size={18} style={{ color: theme.color }} aria-hidden="true" />
              <span className="whitespace-nowrap text-[15px] font-bold text-white sm:text-base">
                {t(`themes.${theme.key}.title`)}
              </span>
            </button>
          );
        })}
      </div>

      {expandedTheme && (
        <div className="mt-3 border border-white/10 bg-void/40 p-4">
          <div className="mb-3 flex items-start gap-3">
            <expandedTheme.icon size={18} style={{ color: expandedTheme.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-white">{t(`themes.${expandedTheme.key}.title`)}</p>
              <p className="mt-0.5 text-[12px] text-gray-400">{t(`themes.${expandedTheme.key}.description`)}</p>
            </div>
            <button
              type="button"
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setExpandedKey(null)}
              title={t('collapseAria')}
              aria-label={t('collapseAria')}
              className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/15 text-gray-400 transition-colors hover:border-white/30 hover:text-white"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>

          {/* Capped-height, self-scrolling list (rather than letting 50-100
              rows grow the whole 70vh browse-hub panel taller and bury the
              load-more control or the sections below it -- owner instruction
              2026-09-04: "가림 현상 없이"). scroll-smooth pairs with the
              boundary-tracking effect above so paging in more ranks reads as
              one continuous glide, not a jump-cut. */}
          <ol
            ref={listRef}
            className="grid max-h-[22rem] grid-cols-1 gap-1.5 overflow-y-auto overscroll-contain scroll-smooth pr-1 sm:grid-cols-2"
          >
            {shownEntries.map((entry) => (
              <li
                key={entry.rank}
                data-rank={entry.rank}
                className="flex items-center gap-3 border border-white/10 bg-void/50 px-3 py-2 text-[13px]"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-bold"
                  style={{ borderColor: `${expandedTheme.color}55`, color: expandedTheme.color }}
                >
                  {entry.rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold text-white">{entry.name}</span>
                <span className="shrink-0 text-[11px] text-gray-500">{entry.note}</span>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {hasMoreData ? (
              <button
                type="button"
                onMouseEnter={() => playHoverSfx()}
                onClick={loadMore}
                className="flex items-center gap-1.5 border border-accent/40 px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10"
              >
                <ChevronDown size={13} aria-hidden="true" />
                {t('loadMoreRange', { from: visibleTier + 1, to: nextTierCap })}
              </button>
            ) : (
              <p className="text-[11px] text-gray-500">{t('collectingMore')}</p>
            )}
            <p className="text-[10px] text-gray-500">{t('snapshot')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
