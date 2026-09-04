'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, Flame, Loader2, Newspaper, RefreshCw, TrendingUp } from 'lucide-react';
import { HOT_NEWS_CATEGORIES, type HotNewsCategory, type HotNewsItem, type HotNewsResponse } from '@/lib/live/hotNews';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

/** Per-locale in-memory cache: a tab flick back and forth must not refetch. */
const CLIENT_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: HotNewsResponse }>();

type Filter = 'all' | HotNewsCategory;

/**
 * The 핫이슈 tab's live list (owner instruction 2026-09-03): category chips
 * up top, then every current story as [title → source page] + a 1–2 line
 * summary + an ITN/trending badge. Data is the keyless Wikimedia featured
 * feed via /api/live/hot-news (CDN 15 min) -- neutral, own-language,
 * 0원. Rendered under the four hot-issue axis tiles, never instead of them.
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
  const visible = filter === 'all' ? items : items.filter((it) => it.category === filter);

  const chip = (active: boolean) =>
    `shrink-0 border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors ${
      active ? 'border-accent bg-accent/15 text-accent' : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white'
    }`;

  function renderItem(it: HotNewsItem) {
    return (
      <li key={it.id}>
        <a
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => playHoverSfx()}
          className="flex items-start gap-3 border border-white/10 bg-void/50 px-3 py-2.5 transition-colors hover:border-white/30 hover:bg-void/70"
        >
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border ${
              it.source === 'itn' ? 'border-red-400/50 text-red-300' : 'border-neon/40 text-neon'
            }`}
            title={it.source === 'itn' ? t('itn') : t('trending')}
            aria-label={it.source === 'itn' ? t('itn') : t('trending')}
          >
            {it.source === 'itn' ? <Flame size={13} aria-hidden="true" /> : <TrendingUp size={13} aria-hidden="true" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[14px] font-bold text-white sm:text-[15px]">{it.title}</span>
              <span className="shrink-0 border border-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                {t(`category.${it.category}`)}
              </span>
              <ExternalLink size={12} className="ml-auto shrink-0 text-gray-500" aria-hidden="true" />
            </span>
            {it.summary && <span className="line-clamp-2 text-[12px] leading-snug text-gray-400">{it.summary}</span>}
            {typeof it.views === 'number' && it.views > 0 && (
              <span className="text-[10px] text-gray-500">{t('views', { count: it.views })}</span>
            )}
          </span>
        </a>
      </li>
    );
  }

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
          onClick={() => setReloadTick((n) => n + 1)}
          disabled={loading}
          title={t('refresh')}
          aria-label={t('refresh')}
          className="ml-auto flex h-7 w-7 items-center justify-center border border-accent/40 text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        <button type="button" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')} className={chip(filter === 'all')}>
          {t('all')} · {items.length}
        </button>
        {HOT_NEWS_CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={filter === c}
            onMouseEnter={() => playHoverSfx()}
            onClick={() => setFilter(c)}
            className={chip(filter === c)}
          >
            {t(`category.${c}`)} · {counts.get(c)}
          </button>
        ))}
      </div>

      {loading && items.length === 0 && (
        <p className="flex items-center gap-2 py-4 text-[13px] text-gray-400">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" />
          {t('loading')}
        </p>
      )}
      {!loading && failed && items.length === 0 && <p className="py-4 text-[13px] text-gray-500">{t('empty')}</p>}
      {visible.length > 0 && <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">{visible.map(renderItem)}</ul>}
      {items.length > 0 && (
        <p className="mt-2 text-[14px] font-medium text-gray-400">{t('source')}</p>
      )}
    </div>
  );
}
