'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ExternalLink, Flame, Loader2, Newspaper, Radio, RefreshCw, TrendingUp } from 'lucide-react';
import {
  normTitle,
  type AxisNewsResponse,
  type HotNewsCategory,
  type HotNewsItem,
  type HotNewsResponse,
} from '@/lib/live/hotNews';
import { AXIS_QID } from '@/lib/live/hotNews';
import { HOT_NEWS_AXES } from '@/lib/live/hotNewsAxes';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { DraggableCarouselRow } from '@/components/ui/DraggableCarouselRow';
import { useDragScroll } from '@/components/ui/useDragScroll';
import { ExploreDeeper } from '@/components/home/ExploreDeeper';
import { qidAnchor } from '@/lib/uai/deeperAnchor';
import { captureScroll, reserveHeight } from '@/lib/ui/scrollAnchor';
import { wikiLangFor } from '@/lib/uai/liveSuggest';

/** M3.3: axis auto-rotation cadence (ms). Deliberately slower than the
 *  shortcut rail's 7s -- a headline needs longer to read than a fact row. */
const NEWS_ROTATE_MS = 9000;

/** Per-locale in-memory cache: a tab flick back and forth must not refetch. */
const CLIENT_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: HotNewsResponse }>();

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
 * "실시간 뉴스" -- a single-row auto-rotating, drag-scrollable carousel of
 * the 20 news axes (the world categories fused with the founder's 16
 * management axes, lib/live/hotNews.ts), using the same
 * DraggableCarouselRow + box/typo spec as the discovery rail above, so the
 * two read as one system. Selecting an axis keeps the Wikimedia featured
 * feed's own matches for it on top and then streams the worldwide live wire
 * beneath (GET /api/live/axis-news: the worldwide legs first, then the
 * locale's own), paged back through the archive endlessly via "더 불러오기".
 * 0원 throughout.
 *
 * REV-23 M3 (founder directive 2026-09-13):
 *  - M3.2, the pinned "전체" chip and the catch-all "세계실시간" axis are
 *    BOTH deleted. Their job was to pool everything in one box; the founder's
 *    instruction was that the individual themes absorb it, so an axis is
 *    always selected and every story reaches the visitor through the theme
 *    it belongs to. The "세계" prefix came off all twenty labels with them.
 *  - M3.1, this is now the ONLY news surface on the home screen: the nine
 *    RSS wires that used to ride the discovery rail above are gone from it.
 *  - M3.3, the axis rail auto-rotates like the shortcut rail and neither the
 *    rotation nor a refresh may move the viewport.
 *
 * REV-21 §1.2 / §1.4: the headline boxes are one horizontal snap rail with
 * mouse grab-drag (touch keeps native momentum) -- the same physics as the
 * discovery carousel's chip rail -- and the axis chips share the carousel's
 * `.qw-hub-chip` language so the two rows read as one system. A headline
 * click goes straight to the article (§1.4: news never opens a primary
 * popup); "더 불러오기" is the rail's last card.
 */
export function HotIssueNewsList() {
  const t = useTranslations('HotNews');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();
  const railRef = useRef<HTMLUListElement>(null);
  const { handlers: railHandlers } = useDragScroll(railRef);
  /** M3.3: the block whose height the rotation must not be allowed to
   *  change under the reader, and the tallest payload it has held. */
  const boxRef = useRef<HTMLDivElement>(null);
  const [reserved, setReserved] = useState<number | null>(null);
  /** M3.2/M3.3: the axis rail advances on its own like the shortcut rail --
   *  paused while the pointer is over it, while a deeper block is open, and
   *  while the tab is in the background. */
  const [hovering, setHovering] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [userPicked, setUserPicked] = useState(false);
  const [data, setData] = useState<HotNewsResponse | null>(() => cache.get(locale)?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<HotNewsCategory>(HOT_NEWS_AXES[0].key);
  const [reloadTick, setReloadTick] = useState(0);
  const [axisFeeds, setAxisFeeds] = useState<Record<string, AxisFeed>>({});
  // REV-21 SPEC §12.2 newsRail host (D-19): a collapsed in-flow block under
  // the rail, anchored on the active axis's Wikidata item. Collapsed by
  // default (strip height preserved); toggling never touches history.
  const [deeperOpen, setDeeperOpen] = useState(false);
  const tDeeper = useTranslations('Rev21.deeper');

  useEffect(() => {
    const hit = cache.get(locale);
    if (hit && Date.now() - hit.at < CLIENT_TTL_MS && reloadTick === 0) {
      setData(hit.data);
      return;
    }
    const controller = new AbortController();
    // REV-21 §2.1: never show the previous locale's board while the new one
    // loads -- a language switch must re-render that language's data.
    setData(hit?.data ?? null);
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

  // M3.3: the axis rail rotates on its own, like the shortcut rail above.
  // It stops for good the moment the visitor picks an axis -- an auto-swap
  // under someone who has stated an intent is the other half of the
  // "화면이 저절로 튀는" complaint, not just the scroll jump.
  const rotationPaused = userPicked || hovering || hidden || deeperOpen;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Grow the height reservation after every commit so a thinner axis can
  // never shrink the document under the reader.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    setReserved((seen) => reserveHeight(seen, box.offsetHeight));
  }, [filter, data, axisFeeds]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(() => {
    const map = new Map<HotNewsCategory, number>();
    for (const it of items) map.set(it.category, (map.get(it.category) ?? 0) + 1);
    return map;
  }, [items]);

  /** The axes the day's featured board actually covers, in rail order. The
   *  auto-rotation walks THESE, so every unattended advance is free. */
  const covered = useMemo(
    () => HOT_NEWS_AXES.filter((a) => (counts.get(a.key) ?? 0) > 0).map((a) => a.key),
    [counts],
  );

  useEffect(() => {
    if (rotationPaused || covered.length < 2) return;
    const id = window.setInterval(() => {
      // Pin the viewport across the swap: the axis change re-renders the
      // headline rail, whose height moves with the story count.
      const snap = captureScroll(boxRef.current);
      setFilter((current) => {
        const i = covered.indexOf(current);
        return covered[(i + 1 + covered.length) % covered.length];
      });
      snap.restore();
    }, NEWS_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotationPaused, covered]);

  // The board decides where the rail starts: the first axis it actually has
  // stories for, so the opening frame is never an empty theme.
  useEffect(() => {
    if (userPicked || covered.length === 0 || covered.includes(filter)) return;
    setFilter(covered[0]);
  }, [covered, filter, userPicked]);

  const activeFeed: AxisFeed = axisFeeds[axisKey(locale, filter)] ?? EMPTY_FEED;

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
    const key = axisKey(locale, filter);
    if (axisFeeds[key]) return;
    const hit = axisCache.get(key);
    if (hit && Date.now() - hit.at < CLIENT_TTL_MS) {
      setAxisFeeds((prev) => ({ ...prev, [key]: { ...hit, loading: false } }));
      return;
    }
    // M3.3 / Codex ch.1 (한계 비용 0원): an AUTO-advance never spends a
    // request. The rotation only ever lands on axes the day's featured board
    // already covers, so it always has something to show from data already in
    // hand; the worldwide live wire is fetched when the VISITOR picks an axis
    // -- a stated intent -- or when the rail has nothing else to offer.
    if (!userPicked && covered.length >= 2) return;
    loadAxisPage(filter, 0);
  }, [filter, locale, axisFeeds, loadAxisPage, userPicked, covered.length]);

  const visible = useMemo(() => {
    const base = items.filter((it) => it.category === filter);
    const seen = new Set(base.map((it) => normTitle(it.title)));
    return [...base, ...activeFeed.items.filter((it) => !seen.has(normTitle(it.title)))];
  }, [filter, items, activeFeed.items]);

  /** A tap on an axis chip. M3.3: stops the auto-rotation for good (the
   *  visitor has stated an intent) and pins the viewport across the swap. */
  function selectFilter(next: HotNewsCategory) {
    const snap = captureScroll(boxRef.current);
    setUserPicked(true);
    setFilter(next);
    snap.restore();
  }

  function refreshAll() {
    const snap = captureScroll(boxRef.current);
    setReloadTick((n) => n + 1);
    const key = axisKey(locale, filter);
    axisCache.delete(key);
    setAxisFeeds((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    snap.restore();
  }

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
      <li key={it.id} data-news-item="">
        <a
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => playHoverSfx()}
          // A mouse drag on the rail must never turn into a spurious link
          // drag; useDragScroll swallows the click that tails a drag.
          draggable={false}
          className="flex items-start gap-3 border border-white/10 bg-void/50 px-3 py-2.5 transition-colors hover:border-white/30 hover:bg-void/70"
        >
          {renderBadge(it)}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="line-clamp-2 text-[14px] font-bold text-white sm:text-[15px]">{it.title}</span>
              <ExternalLink size={12} className="ml-auto shrink-0 text-gray-500" aria-hidden="true" />
            </span>
            {it.summary && <span className="line-clamp-2 text-[12px] leading-snug text-gray-400">{it.summary}</span>}
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 border border-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                {t(`category.${it.category}`)}
              </span>
              {meta && <span className="truncate text-[10px] text-gray-500">{meta}</span>}
            </span>
            {typeof it.views === 'number' && it.views > 0 && (
              <span className="text-[10px] text-gray-500">{t('views', { count: it.views })}</span>
            )}
          </span>
        </a>
      </li>
    );
  }

  const axisLabel = t(`category.${filter}`);
  const axisBusy = activeFeed.loading;
  const showAxisEmpty = !activeFeed.loading && activeFeed.failed && visible.length === 0;

  return (
    <div
      ref={boxRef}
      className="qw-no-anchor mt-4 w-full border-t border-white/10 pt-4"
      style={reserved ? { minHeight: reserved } : undefined}
    >
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

      {/* M3.2: the pinned "전체" lead chip is GONE. The 20-axis rail is the
          whole control -- it auto-rotates like the shortcut rail above it
          (M3.3) until the visitor picks an axis, and it uses the same
          `.qw-hub-chip` language so the two rows read as one system. */}
      <div
        className="mb-3 flex items-center gap-2.5"
        role="tablist"
        data-news-axes=""
        data-rotating={rotationPaused ? '0' : '1'}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setHovering(true);
        }}
        onPointerLeave={() => setHovering(false)}
      >
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
                  data-active={active ? '1' : '0'}
                  data-axis={axis.key}
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => selectFilter(axis.key)}
                  style={{ '--qw-hub-accent': axis.color } as CSSProperties}
                  className="qw-hub-chip"
                >
                  <axis.icon size={15} style={{ color: axis.color }} aria-hidden="true" />
                  {t(`category.${axis.key}`)}
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
      {!loading && failed && items.length === 0 && <p className="py-4 text-[13px] text-gray-500">{t('empty')}</p>}
      {axisBusy && visible.length === 0 && (
        <p className="flex items-center gap-2 py-4 text-[13px] text-gray-400">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" />
          {t('axisLoading', { axis: axisLabel })}
        </p>
      )}
      {showAxisEmpty && <p className="py-4 text-[13px] text-gray-500">{t('axisEmpty')}</p>}
      {visible.length > 0 && (
        <ul
          ref={railRef}
          {...railHandlers}
          className="qw-news-rail u-hscroll cursor-grab select-none"
          data-news-rail=""
          aria-label={t('label')}
        >
          {visible.map(renderItem)}
          {/* §1.2: paging lives at the END of the rail, where a drag lands. */}
          {(
            <li className="flex items-center" data-news-more="">
              {activeFeed.hasMore ? (
                <button
                  type="button"
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => loadAxisPage(filter, activeFeed.nextPage)}
                  disabled={activeFeed.loading}
                  className="flex h-full min-h-[96px] w-full flex-col items-center justify-center gap-2 border border-accent/40 px-4 text-[12px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                >
                  {activeFeed.loading ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ChevronDown size={16} className="-rotate-90" aria-hidden="true" />
                  )}
                  {t('loadMore', { axis: axisLabel })}
                </button>
              ) : (
                <p className="px-4 text-center text-[11px] text-gray-500">{t('endOfFeed')}</p>
              )}
            </li>
          )}
        </ul>
      )}

      {(items.length > 0 || activeFeed.items.length > 0) && (
        <p className="mt-2 text-[14px] font-medium text-gray-400">{t('source')}</p>
      )}

      {(
        <div className="mt-2" data-news-deeper={deeperOpen ? 'open' : 'collapsed'}>
          <button
            type="button"
            aria-expanded={deeperOpen}
            aria-controls="news-rail-deeper"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => setDeeperOpen((v) => !v)}
            className="qw-hub-chip"
            data-news-deeper-toggle=""
          >
            <ChevronDown size={14} className={`transition-transform ${deeperOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            {tDeeper('label')} · {axisLabel}
          </button>
          {deeperOpen && (
            <div id="news-rail-deeper">
              <ExploreDeeper anchor={qidAnchor(AXIS_QID[filter], axisLabel, wikiLangFor(locale))} host="newsRail" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
