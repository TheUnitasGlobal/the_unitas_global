'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Globe2, Loader2, X } from 'lucide-react';
import {
  ENTRY_DETAIL_MAX_RANK,
  GLOBAL_RANKING_THEMES,
  LOAD_MORE_TIERS,
  THEME_QID,
  rankingEntryQid,
  type GlobalRankingEntry,
  type GlobalRankingTheme,
  type GlobalRankingThemeKey,
} from '@/lib/globalRankings';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { Modal } from '@/components/ui/Modal';
import { DraggableCarouselRow } from '@/components/ui/DraggableCarouselRow';
import { useRankingDetail } from '@/lib/uai/rankingDetailClient';
import { OmniOpen } from '@/components/home/OmniOpen';
import { entityAnchor, qidAnchor, textAnchor, type DeeperAnchor } from '@/lib/uai/deeperAnchor';
import { resolveEntity } from '@/lib/uai/entityResolve';
import { wikiLangFor } from '@/lib/uai/liveSuggest';

interface GlobalThemeRankingsProps {
  /** REV-21 §1.3: rendered inside the discovery carousel's ranking deep
   *  modal -- no section label (the modal has its own header), a theme is
   *  always expanded (never collapsible to an empty dialog). */
  embedded?: boolean;
  /** Theme to open on mount (the card's active tab). Unknown keys fall back
   *  to the first theme when embedded, to "nothing expanded" otherwise. */
  initialTheme?: string;
  /** Rank whose detail popup opens on mount (the card row that was tapped). */
  initialDetailRank?: number;
  /** REV-21 SPEC §12.2 (D-20): the host reads the active theme for its own
   *  omni-open anchor. */
  onThemeChange?: (theme: GlobalRankingThemeKey | null) => void;
}

/** SPEC §12.2 globalRankingDetail host: the curated rank 1-10 item, else a
 *  one-call English resolve of the entry name (memoised per entry). */
function useEntryAnchor(entry: GlobalRankingEntry | null, themeKey: GlobalRankingThemeKey | null, localizedName: string | undefined, locale: string): DeeperAnchor | null {
  const lang = wikiLangFor(locale);
  const curated = entry && themeKey ? entry.qid ?? rankingEntryQid(themeKey, entry.rank) : undefined;
  const [fallback, setFallback] = useState<DeeperAnchor | null>(null);
  useEffect(() => {
    setFallback(null);
    if (!entry || curated) return;
    const controller = new AbortController();
    resolveEntity(entry.name, 'en', controller.signal, { wikidataFallback: false })
      .then((r) => {
        if (!controller.signal.aborted && r && !r.disambiguation) setFallback(entityAnchor(r, 'en', entry.name));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [entry, curated]);
  if (!entry) return null;
  const term = localizedName ?? entry.name;
  if (curated) return qidAnchor(curated, term, lang, entry.name);
  if (fallback) return { ...fallback, term, lang };
  return textAnchor(term, lang);
}

function resolveTheme(key: string | undefined): GlobalRankingThemeKey | null {
  return GLOBAL_RANKING_THEMES.find((theme) => theme.key === key)?.key ?? null;
}

/**
 * "실시간 세계 랭킹" (owner instruction 2026-09-04, deepened same day): a row
 * of global theme chips (UNESCO heritage, GDP benchmark, human-history
 * milestones, ...). Tapping a chip expands its top-10 countdown inline;
 * "11~50위 보기" / "51~100위 보기" step through LOAD_MORE_TIERS until the
 * curated dataset runs out, at which point the panel says so plainly rather
 * than padding with unsourced filler ranks (see lib/globalRankings.ts
 * banner).
 *
 * REV-21 §1.3: no longer a standalone strip row -- it lives inside the
 * discovery carousel as the `worldRanking` slot, and this panel is what
 * that slot's deep modal embeds (`embedded`), keeping the rank-detail popup
 * (`#global-ranking-detail-title`) byte-identical.
 */
export function GlobalThemeRankings({ embedded = false, initialTheme, initialDetailRank, onThemeChange }: GlobalThemeRankingsProps = {}) {
  const t = useTranslations('GlobalRankings');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();
  const [expandedKey, setExpandedKey] = useState<GlobalRankingThemeKey | null>(
    () => resolveTheme(initialTheme) ?? (embedded ? GLOBAL_RANKING_THEMES[0].key : null),
  );
  useEffect(() => {
    onThemeChange?.(expandedKey);
  }, [expandedKey, onThemeChange]);
  const [visibleTiers, setVisibleTiers] = useState<Record<string, number>>({});
  const listRef = useRef<HTMLOListElement>(null);
  /** Rank the list was cut off at *before* the last "더 보기" click -- lets the
   *  effect below carry the viewer into the freshly-revealed rows instead of
   *  leaving them to hunt for rank 11 at the bottom of a now much-longer
   *  list. Null means "no reveal pending" (theme just opened/switched, or
   *  first mount) so that transition never triggers an unwanted scroll. */
  const revealBoundaryRef = useRef<number | null>(null);
  const [detail, setDetail] = useState<{ entry: GlobalRankingEntry; theme: GlobalRankingTheme } | null>(null);
  const { report: detailReport, loading: detailLoading } = useRankingDetail(
    detail?.theme.key ?? null,
    detail?.entry.rank ?? null,
    locale,
  );

  const expandedTheme = GLOBAL_RANKING_THEMES.find((theme) => theme.key === expandedKey) ?? null;
  const visibleTier = expandedKey ? (visibleTiers[expandedKey] ?? LOAD_MORE_TIERS[0]) : LOAD_MORE_TIERS[0];
  const detailAnchor = useEntryAnchor(detail?.entry ?? null, detail?.theme.key ?? null, detailReport?.localizedName, locale);

  // REV-21 §1.3: land on the tapped row's detail. Deferred one tick so the
  // host modal's own history layer is parked BEFORE this nested one -- React
  // runs a child's mount effect before the parent's update effect, and the
  // wrong order would put the detail level under the deep modal's.
  useEffect(() => {
    if (!initialDetailRank) return;
    const theme = GLOBAL_RANKING_THEMES.find((th) => th.key === (resolveTheme(initialTheme) ?? GLOBAL_RANKING_THEMES[0].key));
    const entry = theme?.entries.find((e) => e.rank === initialDetailRank);
    if (!theme || !entry || entry.rank > ENTRY_DETAIL_MAX_RANK) return;
    const id = window.setTimeout(() => setDetail({ entry, theme }), 80);
    return () => window.clearTimeout(id);
    // mount-only by design
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openTheme(key: GlobalRankingThemeKey) {
    revealBoundaryRef.current = null;
    setExpandedKey((prev) => (prev === key && !embedded ? null : key));
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
    <div className={embedded ? 'w-full' : 'mb-4 w-full'} data-global-rankings={embedded ? 'embedded' : 'standalone'}>
      {!embedded && (
        <p className="mb-3 flex items-center gap-1.5 text-[16px] font-bold uppercase tracking-[0.3em] text-accent sm:text-[18px]">
          <Globe2 size={18} aria-hidden="true" />
          {t('label')}
        </p>
      )}

      <DraggableCarouselRow
        items={GLOBAL_RANKING_THEMES.map((theme) => ({
          id: theme.key,
          render: () => {
            const active = expandedKey === theme.key;
            return (
              <button
                type="button"
                aria-expanded={active}
                data-ranking-theme={theme.key}
                onMouseEnter={() => playHoverSfx()}
                onClick={() => openTheme(theme.key)}
                style={{
                  borderColor: active ? theme.color : `${theme.color}44`,
                  backgroundColor: active ? `${theme.color}14` : undefined,
                }}
                className={`flex shrink-0 items-center gap-2.5 border px-4 py-3 text-left transition-colors hover:border-white/30 ${
                  active ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <theme.icon size={18} style={{ color: theme.color }} aria-hidden="true" />
                <span className="whitespace-nowrap text-[13px] font-bold uppercase tracking-widest sm:text-[15px]">
                  {t(`themes.${theme.key}.title`)}
                </span>
              </button>
            );
          },
        }))}
      />

      {expandedTheme && (
        <div className="mt-3 border border-white/10 bg-void/40 p-4">
          <div className="mb-3 flex items-start gap-3">
            <expandedTheme.icon size={18} style={{ color: expandedTheme.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-white">{t(`themes.${expandedTheme.key}.title`)}</p>
              <p className="mt-0.5 text-[12px] text-gray-400">{t(`themes.${expandedTheme.key}.description`)}</p>
            </div>
            {!embedded && (
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
            )}
          </div>

          {/* Capped-height, self-scrolling list (rather than letting 50-100
              rows grow the whole panel taller and bury the load-more control
              or the sections below it -- owner instruction 2026-09-04: "가림
              현상 없이"). scroll-smooth pairs with the boundary-tracking
              effect above so paging in more ranks reads as one continuous
              glide, not a jump-cut. */}
          <ol
            ref={listRef}
            className="grid max-h-[22rem] grid-cols-1 gap-1.5 overflow-y-auto overscroll-contain scroll-smooth pr-1 sm:grid-cols-2"
          >
            {shownEntries.map((entry) => {
              const clickable = entry.rank <= ENTRY_DETAIL_MAX_RANK;
              return (
                <li
                  key={entry.rank}
                  data-rank={entry.rank}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onMouseEnter={clickable ? () => playHoverSfx() : undefined}
                  onClick={clickable ? () => setDetail({ entry, theme: expandedTheme }) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setDetail({ entry, theme: expandedTheme });
                          }
                        }
                      : undefined
                  }
                  aria-label={clickable ? t('entryDetailAria', { name: entry.name }) : undefined}
                  className={`flex items-center gap-3 border border-white/10 bg-void/50 px-3 py-2 text-[15px] ${
                    clickable ? 'cursor-pointer transition-colors hover:border-white/25 hover:bg-void/80' : ''
                  }`}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-bold"
                    style={{ borderColor: `${expandedTheme.color}55`, color: expandedTheme.color }}
                  >
                    {entry.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold text-white">{entry.name}</span>
                  <span className="shrink-0 text-[12px] text-gray-500">{entry.note}</span>
                </li>
              );
            })}
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

      <Modal open={detail !== null} onClose={() => setDetail(null)} labelledBy="global-ranking-detail-title" size="xl">
        {detail && (
          <div
            className="space-y-5"
            data-ranking-detail={`${detail.theme.key}:${detail.entry.rank}`}
            data-anchor-qid={detail.entry.qid ?? rankingEntryQid(detail.theme.key, detail.entry.rank)}
            data-theme-qid={THEME_QID[detail.theme.key]}
          >
            <div className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center border text-[14px] font-bold"
                style={{ borderColor: `${detail.theme.color}55`, color: detail.theme.color }}
              >
                {detail.entry.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p id="global-ranking-detail-title" className="text-[19px] font-bold text-white">
                  {detailReport?.localizedName ?? detail.entry.name}
                </p>
                <p className="mt-0.5 text-[13px] text-gray-500">{detailReport?.localizedNote ?? detail.entry.note}</p>
              </div>
            </div>

            <p className="text-[15px] leading-relaxed text-gray-200">
              {detailReport?.overview ?? detail.entry.detail ?? detail.entry.note}
            </p>

            {detailLoading && !detailReport && (
              <p className="flex items-center gap-2 text-[12px] text-gray-500">
                <Loader2 size={13} className="animate-spin text-accent" aria-hidden="true" />
                {t('detailLoading')}
              </p>
            )}

            {detailReport && (
              <>
                <div>
                  <p className="mb-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
                    {t('detailBackgroundLabel')}
                  </p>
                  <p className="text-[14px] leading-relaxed text-gray-300">{detailReport.background}</p>
                </div>

                {detailReport.keyFacts.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
                      {t('detailKeyFactsLabel')}
                    </p>
                    <ul className="space-y-1.5">
                      {detailReport.keyFacts.map((fact, i) => (
                        <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-gray-300">
                          <span className="mt-0.5 shrink-0 text-accent" aria-hidden="true">•</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-l-2 border-accent/40 pl-3">
                  <p className="mb-1 text-[12px] font-bold uppercase tracking-widest text-accent">
                    {t('detailSignificanceLabel')}
                  </p>
                  <p className="text-[14px] italic leading-relaxed text-gray-300">{detailReport.significance}</p>
                </div>
              </>
            )}

            {/* REV-21 SPEC §12.2 globalRankingDetail host (depth 2): the entry's
                own Wikidata item, never a string search of a translated name. */}
            <OmniOpen anchor={detailAnchor} host="globalRankingDetail" />

            <p className="text-[11px] uppercase tracking-widest text-gray-600">
              {t(`themes.${detail.theme.key}.title`)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
