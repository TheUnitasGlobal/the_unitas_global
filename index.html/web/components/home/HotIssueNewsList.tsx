'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ExternalLink, Flame, LayoutGrid, Loader2, Newspaper, Radio, RefreshCw, TrendingUp } from 'lucide-react';
import {
  normTitle,
  type AxisNewsResponse,
  type HotNewsCategory,
  type HotNewsItem,
  type HotNewsResponse,
} from '@/lib/live/hotNews';
import { HOT_NEWS_AXES } from '@/lib/live/hotNewsAxes';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { DraggableCarouselRow } from '@/components/ui/DraggableCarouselRow';

/** Per-locale in-memory cache: a tab flick back and forth must not refetch. */
const CLIENT_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: HotNewsResponse }>();

type Filter = 'all' | HotNewsCategory;

/** One axis's accumulated live wire (every page loaded so far). */
interface AxisFeed {
  items: HotNewsItem[];
  nextPage: number;
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  at: number;
}

const EMPTY_FEED: AxisFeed = { items: [], nextPage: 0, hasMore: true, loading: false, failed: false, at: 0 };
const axisCache = new Map<string, AxisFeed>();

function axisKey(locale: string, axis: HotNewsCategory): string {
  return `${locale}::${axis}`;
}

/** Compact "3h ago"-style stamp in the visitor's own language. */
function relativeTime(iso: string | undefined, locale: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMin = Math.round((then - Date.now()) / 60_000);
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
    const diffH = Math.round(diffMin / 60);
    if (Math.abs(diffH) < 24) return rtf.format(diffH, 'hour');
    return rtf.format(Math.round(diffH / 24), 'day');
  } catch {
    return null;
  }
}

/**
 * "실시간 뉴스" (owner instruction 2026-09-03, reshaped 2026-09-04 round 6):
 * a pinned "전체" chip plus a single-row auto-drifting carousel of the 21
 * news axes (the world categories fused with the founder's 16 management
 * axes, lib/live/hotNews.ts) -- the same DraggableCarouselRow + box/typo
 * spec as the two ranking widgets directly above, so the three rows read as
 * one system. "전체" shows the Wikimedia featured feed; tapping an axis
 * keeps that feed's own matches on top and then streams the worldwide live
 * wire for the axis beneath (GET /api/live/axis-news: GDELT own-language +
 * worldwide passes and the Google News board), paged back through the
 * archive endlessly via "더 불러오기". 0원 throughout.
 */
export function HotIssueNewsList() {
  const t = useTranslations('HotNews');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();
  const [data, setData] = useState<HotNewsResponse | null>(() => cache.get(locale)?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [reloadTick, setReloadTick] = useState(0);
  const [axisFeeds, setAxisFeeds] = useState<Record<string, AxisFeed>>({});

  useEffect(() => {
    const hit = cache.get(locale);
    if (hit && Date.now() - hit.at < CLIENT_TTL_MS && reloadTick === 0) {
      setData(hit.data);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch(`/api/live/hot-news?locale=${encodeURIComponent(locale)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then((res) => (res.ok ? (res.json() as Promise<HotNewsResponse>) : Promise.reject(new Error(String(res.status)))))
      .then((json) => {
        if (controller.signal.aborted) return;
        cache.set(locale, { at: Date.now(), data: json });
        setData(json);
        setFailed(!json.ok);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [locale, reloadTick]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(() => {
    const map = new Map<HotNewsCategory, number>();
    for (const it of items) map.set(it.category, (map.get(it.category) ?? 0) + 1);
    return map;
  }, [items]);

  const activeFeed: AxisFeed = filter === 'all' ? EMPTY_FEED : (axisFeeds[axisKey(locale, filter)] ?? EMPTY_FEED);

  /** Load one more page of an axis's live wire and append it (de-duped
   *  against everything already on screen for that axis). */
  const loadAxisPage = useCallback(
    (axis: HotNewsCategory, page: number) => {
      const key = axisKey(locale, axis);
      setAxisFeeds((prev) => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_FEED), loading: true, failed: false } }));
      fetch(`/api/live/axis-news?locale=${encodeURIComponent(locale)}&axis=${encodeURIComponent(axis)}&page=${page}`, {
        headers: { accept: 'application/json' },
      })
        .then((res) => (res.ok ? (res.json() as Promise<AxisNewsResponse>) : Promise.reject(new Error(String(res.status)))))
        .then((json) => {
          setAxisFeeds((prev) => {
            const current = prev[key] ?? EMPTY_FEED;
            const seen = new Set(current.items.map((it) => normTitle(it.title)));
            const fresh = json.items.filter((it) => {
              const k = normTitle(it.title);
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            const next: AxisFeed = {
              items: [...current.items, ...fresh],
              nextPage: page + 1,
              // A page that adds nothing new means the wires are exhausted
              // (or throttled) for now -- stop offering an empty "더 보기".
              hasMore: json.hasMore && fresh.length > 0,
              loading: false,
              failed: !json.ok && current.items.length === 0,
              at: Date.now(),
            };
            axisCache.set(key, next);
            return { ...prev, [key]: next };
          });
        })
        .catch(() => {
          setAxisFeeds((prev) => {
            const current = prev[key] ?? EMPTY_FEED;
            return { ...prev, [key]: { ...current, loading: false, failed: current.items.length === 0 } };
          });
        });
    },
    [locale],
  );

  // Selecting an axis streams its first page immediately (or restores the
  // session's already-loaded pages from the module cache).
  useEffect(() => {
    if (filter === 'all') return;
    const key = axisKey(locale, filter);
    if (axisFeeds[key]) return;
    const hit = axisCache.get(key);
    if (hit && Date.now() - hit.at < CLIENT_TTL_MS) {
      setAxisFeeds((prev) => ({ ...prev, [key]: { ...hit, loading: false } }));
      return;
    }
    loadAxisPage(filter, 0);
  }, [filter, locale, axisFeeds, loadAxisPage]);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    const base = items.filter((it) => it.category === filter);
    const seen = new Set(base.map((it) => normTitle(it.title)));
    return [...base, ...activeFeed.items.filter((it) => !seen.has(normTitle(it.title)))];
  }, [filter, items, activeFeed.items]);

  function selectFilter(next: Filter) {
    setFilter(next);
  }

  function refreshAll() {
    setReloadTick((n) => n + 1);
    if (filter !== 'all') {
      const key = axisKey(locale, filter);
      axisCache.delete(key);
      setAxisFeeds((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  }

  /** Box + typography spec shared 1:1 with GlobalThemeRankings /
   *  UnitasModuleRankings chips (owner instruction 2026-09-04 round 6:
   *  "박스/글자 크기와 100% 동일"). */
  const chipBase =
    'flex shrink-0 items-center gap-2.5 border px-4 py-3 text-left transition-colors hover:border-white/30';
  const chipText = 'whitespace-nowrap text-[13px] font-bold uppercase tracking-widest sm:text-[15px]';

  function renderBadge(it: HotNewsItem) {
    if (it.source === 'live') {
      return (
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-accent/50 text-accent"
          title={t('live')}
          aria-label={t('live')}
        >
          <Radio size={13} aria-hidden="true" />
        </span>
      );
    }
    return (
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border ${
          it.source === 'itn' ? 'border-red-400/50 text-red-300' : 'border-neon/40 text-neon'
        }`}
        title={it.source === 'itn' ? t('itn') : t('trending')}
        aria-label={it.source === 'itn' ? t('itn') : t('trending')}
      >
        {it.source === 'itn' ? <Flame size={13} aria-hidden="true" /> : <TrendingUp size={13} aria-hidden="true" />}
      </span>
    );
  }

  function renderItem(it: HotNewsItem) {
    const stamp = relativeTime(it.publishedAt, locale);
    const meta = [it.domain, stamp, it.lang].filter(Boolean).join(' · ');
    return (
      <li key={it.id}>
        <a
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => playHoverSfx()}
          className="flex items-start gap-3 border border-white/10 bg-void/50 px-3 py-2.5 transition-colors hover:border-white/30 hover:bg-void/70"
        >
          {renderBadge(it)}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[14px] font-bold text-white sm:text-[15px]">{it.title}</span>
              <span className="shrink-0 border border-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                {t(`category.${it.category}`)}
              </span>
              <ExternalLink size={12} className="ml-auto shrink-0 text-gray-500" aria-hidden="true" />
            </span>
            {it.summary && <span className="line-clamp-2 text-[12px] leading-snug text-gray-400">{it.summary}</span>}
            {meta && <span className="truncate text-[10px] text-gray-500">{meta}</span>}
            {typeof it.views === 'number' && it.views > 0 && (
              <span className="text-[10px] text-gray-500">{t('views', { count: it.views })}</span>
            )}
          </span>
        </a>
      </li>
    );
  }

  const axisLabel = filter === 'all' ? '' : t(`category.${filter}`);
  const axisBusy = filter !== 'all' && activeFeed.loading;
  const showAxisEmpty = filter !== 'all' && !activeFeed.loading && activeFeed.failed && visible.length === 0;

  return (
    <div className="mt-4 w-full border-t border-white/10 pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-[16px] font-bold uppercase tracking-[0.3em] text-accent sm:text-[18px]">
          <Newspaper size={18} aria-hidden="true" />
          {t('label')}
          {data?.date && <span className="normal-case tracking-normal text-gray-500">· {data.date}</span>}
        </p>
        <button
          type="button"
          onMouseEnter={() => playHoverSfx()}
          onClick={refreshAll}
          disabled={loading}
          title={t('refresh')}
          aria-label={t('refresh')}
          className="ml-auto flex h-7 w-7 items-center justify-center border border-accent/40 text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      {/* Pinned "전체" lead chip + the 21-axis rotating carousel beside it --
          the same fixed-lead + drifting-row composition as the 실시간 날씨
          tab row at the top of this strip, sized 1:1 with the ranking chips. */}
      <div className="mb-3 flex items-center gap-2.5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => selectFilter('all')}
          className={`${chipBase} ${
            filter === 'all' ? 'border-accent bg-accent/15 text-white' : 'border-white/15 text-gray-400 hover:text-white'
          }`}
        >
          <LayoutGrid size={18} className="text-accent" aria-hidden="true" />
          <span className={chipText}>{t('all')}</span>
          {items.length > 0 && (
            <span className="border border-white/15 px-1.5 py-0.5 text-[10px] font-bold text-gray-400">{items.length}</span>
          )}
        </button>
        <DraggableCarouselRow
          className="min-w-0 flex-1"
          items={HOT_NEWS_AXES.map((axis) => {
            const active = filter === axis.key;
            const count = counts.get(axis.key) ?? 0;
            return {
              id: axis.key,
              render: () => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => selectFilter(axis.key)}
                  style={{
                    borderColor: active ? axis.color : `${axis.color}44`,
                    backgroundColor: active ? `${axis.color}14` : undefined,
                  }}
                  className={`${chipBase} ${active ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <axis.icon size={18} style={{ color: axis.color }} aria-hidden="true" />
                  <span className={chipText}>{t(`category.${axis.key}`)}</span>
                  {count > 0 && (
                    <span className="border border-white/15 px-1.5 py-0.5 text-[10px] font-bold text-gray-400">{count}</span>
                  )}
                </button>
              ),
            };
          })}
        />
      </div>

      {loading && items.length === 0 && (
        <p className="flex items-center gap-2 py-4 text-[13px] text-gray-400">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" />
          {t('loading')}
        </p>
      )}
      {!loading && failed && items.length === 0 && filter === 'all' && (
        <p className="py-4 text-[13px] text-gray-500">{t('empty')}</p>
      )}
      {axisBusy && visible.length === 0 && (
        <p className="flex items-center gap-2 py-4 text-[13px] text-gray-400">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" />
          {t('axisLoading', { axis: axisLabel })}
        </p>
      )}
      {showAxisEmpty && <p className="py-4 text-[13px] text-gray-500">{t('axisEmpty')}</p>}
      {visible.length > 0 && <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">{visible.map(renderItem)}</ul>}

      {filter !== 'all' && visible.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {activeFeed.hasMore ? (
            <button
              type="button"
              onMouseEnter={() => playHoverSfx()}
              onClick={() => loadAxisPage(filter, activeFeed.nextPage)}
              disabled={activeFeed.loading}
              className="flex items-center gap-1.5 border border-accent/40 px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              {activeFeed.loading ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <ChevronDown size={13} aria-hidden="true" />
              )}
              {t('loadMore', { axis: axisLabel })}
            </button>
          ) : (
            <p className="text-[11px] text-gray-500">{t('endOfFeed')}</p>
          )}
        </div>
      )}

      {(items.length > 0 || activeFeed.items.length > 0) && (
        <p className="mt-2 text-[14px] font-medium text-gray-400">{t('source')}</p>
      )}
    </div>
  );
}
