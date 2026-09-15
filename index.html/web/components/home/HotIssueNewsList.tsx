'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
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
import { HOT_NEWS_AXES, hotNewsAxisMeta } from '@/lib/live/hotNewsAxes';
import { DISCOVERY_ROTATE_MS } from '@/lib/live/discoverySlots';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { Modal } from '@/components/ui/Modal';
import { TwoStepTitle } from '@/components/uai/stream/StreamCards';
import { useDragScroll } from '@/components/ui/useDragScroll';
import { centeredScrollLeft } from '@/lib/interaction/railDrag';
import { OmniOpen } from '@/components/home/OmniOpen';
import { qidAnchor, textAnchor } from '@/lib/uai/deeperAnchor';
import { captureScroll, reserveHeight } from '@/lib/ui/scrollAnchor';
import { wikiLangFor } from '@/lib/uai/liveSuggest';

/** REV-29 M2.1: the news rail rotates on EXACTLY the shortcut rail's clock
 *  -- one constant, one progress bar, one cadence for both surfaces. */
const NEWS_ROTATE_MS = DISCOVERY_ROTATE_MS;

/** Per-locale in-memory cache: a tab flick back and forth must not refetch. */
const CLIENT_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: HotNewsResponse }>();

/** Stories the rotating card shows before the visitor opens the popup. */
const CARD_ITEMS = 4;

/** Touch has no hover: a tap holds the rotation this long (REV-21 §1.4). */
const TOUCH_PAUSE_MS = 700;

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

/** Merge the day's featured board with the axis's live wire, de-duplicated. */
function storiesOf(items: readonly HotNewsItem[], feed: AxisFeed, axis: HotNewsCategory): HotNewsItem[] {
  const base = items.filter((it) => it.category === axis);
  const seen = new Set(base.map((it) => normTitle(it.title)));
  return [...base, ...feed.items.filter((it) => !seen.has(normTitle(it.title)))];
}

/**
 * "실시간 뉴스" -- REV-29 MISSION 2 (founder directive 2026-09-15): the news
 * rail is now the SAME machine as the shortcut rail above it.
 *
 *  - M2.1 ROLLING: one `.qw-hub-chip` rail of the 22 axes, auto-rotating on
 *    the shortcut rail's own clock (DISCOVERY_ROTATE_MS) with the identical
 *    `.qw-hub-progress` border-colour fill on the active chip; hover / drag
 *    / touch / a hidden tab / an open popup pause it, a tap pins it. The
 *    story-count badges that used to sit in the chips are gone.
 *  - M2.2 ONE THEME PER BOX: 복지·보건 and 안보·분쟁 are split into four
 *    axes (lib/live/hotNews.ts) -- 20 -> 22.
 *  - M2.3 ONE POPUP: the active axis renders as one `.qw-hub-card` whose
 *    title opens (two-step, like every card) ONE main popup listing every
 *    story vertically; a story -- on the card or in the popup -- opens its
 *    own detail popup with the summary, the source and the direct shortcuts.
 *    The horizontal rail of individual headline boxes is retired.
 *  - M2.4 / REV-31 DIRECT ONLY: the collapsed toggle is gone, and so is
 *    the lens grid behind it. The omni-open pair ("다른출처에서열기"
 *    above "다른플랫폼에서열기") sits in flow under the card, in the
 *    main popup and in the story popup, so the reader reaches everything
 *    by scrolling.
 *
 * Codex ch.1 (한계 비용 0원): an unattended advance never spends a request --
 * the clock walks the axes the day's featured board already covers; the
 * worldwide live wire is fetched when the VISITOR pins an axis or opens its
 * popup (a stated intent), and paged endlessly from there.
 */
export function HotIssueNewsList() {
  const t = useTranslations('HotNews');
  const tHub = useTranslations('Rev19.hub');
  const locale = useLocale();
  const lang = wikiLangFor(locale);
  const { playHoverSfx } = useSpatialAudio();

  const railRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<HotNewsCategory, HTMLButtonElement>>(new Map());
  const boxRef = useRef<HTMLDivElement>(null);
  const cardBoxRef = useRef<HTMLDivElement>(null);
  const [reserved, setReserved] = useState<number | null>(null);

  const [data, setData] = useState<HotNewsResponse | null>(() => cache.get(locale)?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [axisFeeds, setAxisFeeds] = useState<Record<string, AxisFeed>>({});

  // Rotation state -- the same vocabulary as DiscoveryCarousel.
  const [held, setHeld] = useState<HotNewsCategory | null>(null);
  const [tick, setTick] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const touchResumeRef = useRef<number | null>(null);
  /** The axis whose main popup is open, and the story whose detail is open. */
  const [deepAxis, setDeepAxis] = useState<HotNewsCategory | null>(null);
  const [story, setStory] = useState<HotNewsItem | null>(null);

  useEffect(() => {
    const hit = cache.get(locale);
    if (hit && Date.now() - hit.at < CLIENT_TTL_MS && reloadTick === 0) {
      setData(hit.data);
      return;
    }
    const controller = new AbortController();
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

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const pauseForTouch = useCallback(() => {
    setTouchPaused(true);
    if (touchResumeRef.current !== null) window.clearTimeout(touchResumeRef.current);
    touchResumeRef.current = window.setTimeout(() => {
      touchResumeRef.current = null;
      setTouchPaused(false);
    }, TOUCH_PAUSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (touchResumeRef.current !== null) window.clearTimeout(touchResumeRef.current);
    },
    [],
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(() => {
    const map = new Map<HotNewsCategory, number>();
    for (const it of items) map.set(it.category, (map.get(it.category) ?? 0) + 1);
    return map;
  }, [items]);

  /** The axes the day's featured board covers, in rail order: what the
   *  unattended clock walks, so every free advance has something to show. */
  const covered = useMemo(() => HOT_NEWS_AXES.filter((a) => (counts.get(a.key) ?? 0) > 0).map((a) => a.key), [counts]);
  const rotationOrder = useMemo<readonly HotNewsCategory[]>(
    () => (covered.length >= 2 ? covered : HOT_NEWS_AXES.map((a) => a.key)),
    [covered],
  );
  const activeAxis: HotNewsCategory = held ?? rotationOrder[((tick % rotationOrder.length) + rotationOrder.length) % rotationOrder.length];
  const activeMeta = hotNewsAxisMeta(activeAxis);
  const axisLabel = t(`category.${activeAxis}`);

  const rotationPaused = held !== null || deepAxis !== null || story !== null || hovering || dragging || touchPaused || hidden;

  useEffect(() => {
    if (rotationPaused) return;
    setEpoch((n) => n + 1);
    const id = window.setInterval(() => {
      const snap = captureScroll(cardBoxRef.current);
      setTick((n) => n + 1);
      snap.restore();
    }, NEWS_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotationPaused]);

  const { handlers: railHandlers, recentlyDragged } = useDragScroll(railRef, {
    onDragStart: () => setDragging(true),
    onDragEnd: () => setDragging(false),
  });

  // Keep the active chip centred -- 22 chips always overflow.
  useEffect(() => {
    const el = chipRefs.current.get(activeAxis);
    const scroller = railRef.current;
    if (!el || !scroller || recentlyDragged()) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({
      left: centeredScrollLeft(el.offsetLeft, el.offsetWidth, scroller.clientWidth),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeAxis, recentlyDragged]);

  const activeFeed: AxisFeed = axisFeeds[axisKey(locale, activeAxis)] ?? EMPTY_FEED;

  /** Load one more page of an axis's live wire and append it. */
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

  // A pinned axis (intent) streams its first wire page; the clock never does
  // unless the board covers fewer than two axes and would otherwise be empty.
  useEffect(() => {
    const key = axisKey(locale, activeAxis);
    if (axisFeeds[key]) return;
    const hit = axisCache.get(key);
    if (hit && Date.now() - hit.at < CLIENT_TTL_MS) {
      setAxisFeeds((prev) => ({ ...prev, [key]: { ...hit, loading: false } }));
      return;
    }
    if (held === null && deepAxis === null && covered.length >= 2) return;
    loadAxisPage(activeAxis, 0);
  }, [activeAxis, locale, axisFeeds, loadAxisPage, held, deepAxis, covered.length]);

  // Grow the height reservation after every commit so a thinner axis can
  // never shrink the document under the reader.
  const visible = useMemo(() => storiesOf(items, activeFeed, activeAxis), [items, activeFeed, activeAxis]);
  useEffect(() => {
    const box = cardBoxRef.current;
    if (!box) return;
    setReserved((seen) => reserveHeight(seen, box.offsetHeight));
  }, [activeAxis, visible.length, loading]);

  /** Pin an axis; pinning the pinned axis releases it and the rotation
   *  continues from THAT axis (never snapping back to the clock). */
  function toggleHold(axis: HotNewsCategory) {
    const snap = captureScroll(cardBoxRef.current);
    setHeld((prev) => {
      if (prev === axis) {
        const i = rotationOrder.indexOf(axis);
        setTick(Math.max(0, i));
        return null;
      }
      return axis;
    });
    snap.restore();
  }

  function refreshAll() {
    const snap = captureScroll(cardBoxRef.current);
    setReloadTick((n) => n + 1);
    const key = axisKey(locale, activeAxis);
    axisCache.delete(key);
    setAxisFeeds((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    snap.restore();
  }

  const openAxis = useCallback((axis: HotNewsCategory) => setDeepAxis(axis), []);
  const closeAxis = useCallback(() => {
    // A close pins the axis the popup was opened from, so the rail never
    // jumps the moment the visitor comes back out of it (REV-21 §1.4).
    setDeepAxis((current) => {
      if (current) setHeld(current);
      return null;
    });
  }, []);

  const deepFeed: AxisFeed = deepAxis ? axisFeeds[axisKey(locale, deepAxis)] ?? EMPTY_FEED : EMPTY_FEED;
  const deepStories = useMemo(() => (deepAxis ? storiesOf(items, deepFeed, deepAxis) : []), [items, deepFeed, deepAxis]);

  const showEmpty = !loading && !activeFeed.loading && visible.length === 0;

  return (
    <div
      ref={boxRef}
      className="qw-no-anchor mt-4 w-full border-t border-white/10 pt-4"
      data-news-block=""
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

      <p className="qw-discovery-label mb-1.5 flex items-center gap-2 text-[15px] font-bold text-white">
        <activeMeta.icon size={16} style={{ color: activeMeta.color }} aria-hidden="true" />
        {axisLabel}
      </p>
      <p className="qw-hub-meta mb-3 text-[12px] text-gray-500">{held ? tHub('held') : tHub('rotating')}</p>

      {/* M2.1: the 22-axis chip rail -- the shortcut rail's own grammar:
          grab-drag, snap, the progress fill on the active chip, no badges. */}
      <div
        ref={railRef}
        {...railHandlers}
        onPointerDownCapture={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType !== 'mouse') pauseForTouch();
        }}
        className="qw-hub-strip select-none"
        role="tablist"
        aria-label={t('label')}
        data-news-axes=""
        data-rotating={rotationPaused ? '0' : '1'}
        data-paused={rotationPaused ? '1' : '0'}
      >
        {HOT_NEWS_AXES.map((axis) => {
          const isActive = axis.key === activeAxis;
          return (
            <button
              key={axis.key}
              ref={(el) => {
                if (el) chipRefs.current.set(axis.key, el);
                else chipRefs.current.delete(axis.key);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-active={isActive ? '1' : '0'}
              data-axis={axis.key}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => toggleHold(axis.key)}
              className="qw-hub-chip"
              style={{ '--qw-hub-accent': axis.color, '--qw-slot-rotate': `${NEWS_ROTATE_MS}ms` } as CSSProperties}
            >
              <axis.icon size={15} style={{ color: axis.color }} aria-hidden="true" />
              {t(`category.${axis.key}`)}
              {isActive && (
                <span
                  key={`${axis.key}-${tick}-${epoch}`}
                  className="qw-hub-progress"
                  data-held={held ? '1' : '0'}
                  data-paused={rotationPaused && !held ? '1' : '0'}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* M2.3: ONE card for the active axis -- inert container, two-step
          title, the top stories as rows that open the story popup. */}
      <div
        ref={cardBoxRef}
        className="qw-hub-card qw-no-anchor mt-3 border border-white/10 bg-void/40 p-4"
        data-news-card={activeAxis}
        tabIndex={0}
        style={{ '--qw-hub-accent': activeMeta.color } as CSSProperties}
        onPointerEnter={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType === 'mouse') setHovering(true);
        }}
        onPointerLeave={() => setHovering(false)}
        onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType !== 'mouse') pauseForTouch();
        }}
      >
        <div key={activeAxis} className="qw-hub-card-body">
          <div className="mb-2 flex items-start gap-3">
            <activeMeta.icon size={22} style={{ color: activeMeta.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <TwoStepTitle as="p" className="qw-hub-card-title text-[17px] font-bold text-white" onOpen={() => openAxis(activeAxis)}>
                {axisLabel}
              </TwoStepTitle>
              <p className="qw-hub-meta text-[13px] text-gray-400">{t('axisTag', { axis: axisLabel })}</p>
            </div>
          </div>

          {loading && items.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-[14px] text-gray-400">
              <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
              {t('loading')}
            </p>
          ) : activeFeed.loading && visible.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-[14px] text-gray-400">
              <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
              {t('axisLoading', { axis: axisLabel })}
            </p>
          ) : showEmpty ? (
            <p className="py-3 text-[14px] text-gray-500">{failed && items.length === 0 ? t('empty') : t('axisEmpty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 md:grid-cols-2" data-news-card-items="">
              {visible.slice(0, CARD_ITEMS).map((it) => (
                <li key={it.id} data-news-item="">
                  <button
                    type="button"
                    className="qw-hub-headline text-white"
                    onMouseEnter={() => playHoverSfx()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setStory(it);
                    }}
                    aria-label={t('detailAria', { title: it.title })}
                  >
                    <StoryBadge item={it} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2">{it.title}</span>
                      <span className="qw-hub-source mt-0.5 block text-gray-500">{storyMeta(it, locale)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="qw-hub-meta mt-3 text-[12px] text-gray-500">
            {visible.length > 0 ? `${t('storyCount', { count: visible.length })} · ` : ''}
            {t('source')}
          </p>
        </div>
      </div>

      {/* M2.4: direct only, in flow, nothing to unfold. */}
      <OmniOpen anchor={qidAnchor(AXIS_QID[activeAxis], axisLabel, lang)} host="newsRail" className="mt-3" />

      <NewsAxisModal
        axis={deepAxis}
        stories={deepStories}
        feed={deepFeed}
        onLoadMore={() => {
          if (deepAxis) loadAxisPage(deepAxis, deepFeed.nextPage);
        }}
        onOpenStory={setStory}
        onClose={closeAxis}
      />
      <NewsStoryModal story={story} onClose={() => setStory(null)} />
    </div>
  );
}

function storyMeta(it: HotNewsItem, locale: string): string {
  const stamp = relativeTime(it.publishedAt, locale);
  return [it.domain, stamp, it.lang].filter(Boolean).join(' · ');
}

function StoryBadge({ item }: { item: HotNewsItem }) {
  const t = useTranslations('HotNews');
  if (item.source === 'live') {
    return (
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-accent/50 text-accent" title={t('live')} aria-label={t('live')}>
        <Radio size={13} aria-hidden="true" />
      </span>
    );
  }
  const itn = item.source === 'itn';
  return (
    <span
      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border ${itn ? 'border-red-400/50 text-red-300' : 'border-neon/40 text-neon'}`}
      title={itn ? t('itn') : t('trending')}
      aria-label={itn ? t('itn') : t('trending')}
    >
      {itn ? <Flame size={13} aria-hidden="true" /> : <TrendingUp size={13} aria-hidden="true" />}
    </span>
  );
}

/** M2.3: the ONE main popup of an axis -- every story, vertically, with the
 *  endless "더 불러오기" at the end and the direct-only block beneath. */
function NewsAxisModal({
  axis,
  stories,
  feed,
  onLoadMore,
  onOpenStory,
  onClose,
}: {
  axis: HotNewsCategory | null;
  stories: HotNewsItem[];
  feed: AxisFeed;
  onLoadMore: () => void;
  onOpenStory: (story: HotNewsItem) => void;
  onClose: () => void;
}) {
  const t = useTranslations('HotNews');
  const locale = useLocale();
  const lang = wikiLangFor(locale);
  const { playHoverSfx } = useSpatialAudio();
  const meta = axis ? hotNewsAxisMeta(axis) : null;
  const axisLabel = axis ? t(`category.${axis}`) : '';
  return (
    <Modal open={axis !== null} onClose={onClose} labelledBy="news-axis-title" size="xl">
      {axis && meta && (
        <div className="space-y-5" data-news-modal={axis}>
          <div className="flex items-start gap-3">
            <meta.icon size={26} style={{ color: meta.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p id="news-axis-title" className="text-[20px] font-bold text-white">
                {axisLabel}
              </p>
              <p className="mt-0.5 text-[14px] text-gray-400">{t('allStories', { axis: axisLabel })}</p>
            </div>
          </div>

          {stories.length === 0 && feed.loading ? (
            <p className="flex items-center gap-2 py-4 text-[14px] text-gray-400">
              <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
              {t('axisLoading', { axis: axisLabel })}
            </p>
          ) : stories.length === 0 ? (
            <p className="py-4 text-[14px] text-gray-500">{t('axisEmpty')}</p>
          ) : (
            <ol className="max-h-[52vh] space-y-1 overflow-y-auto overscroll-contain pr-1" data-news-modal-list="">
              {stories.map((it, i) => (
                <li key={it.id} data-news-item="">
                  <button
                    type="button"
                    className="qw-hub-headline text-white"
                    onMouseEnter={() => playHoverSfx()}
                    onClick={() => onOpenStory(it)}
                    aria-label={t('detailAria', { title: it.title })}
                  >
                    <span className="w-6 shrink-0 text-[12px] font-bold" style={{ color: meta.color }}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{it.title}</span>
                      {it.summary && <span className="qw-hub-desc mt-0.5 line-clamp-2 block text-[12px] leading-snug text-gray-400">{it.summary}</span>}
                      <span className="qw-hub-source mt-0.5 block text-gray-500">{storyMeta(it, locale)}</span>
                    </span>
                  </button>
                </li>
              ))}
              <li className="pt-2" data-news-more="">
                {feed.hasMore ? (
                  <button
                    type="button"
                    onMouseEnter={() => playHoverSfx()}
                    onClick={onLoadMore}
                    disabled={feed.loading}
                    className="flex w-full items-center justify-center gap-2 border border-accent/40 px-4 py-2.5 text-[12px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                  >
                    {feed.loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                    {t('loadMore', { axis: axisLabel })}
                  </button>
                ) : (
                  <p className="px-4 py-2 text-center text-[11px] text-gray-500">{t('endOfFeed')}</p>
                )}
              </li>
            </ol>
          )}

          <p className="text-[12px] text-gray-500">{t('source')}</p>

          <OmniOpen anchor={qidAnchor(AXIS_QID[axis], axisLabel, lang)} host="newsRail" />
        </div>
      )}
    </Modal>
  );
}

/** M2.3: a story's own popup -- the summary, the source line, the original
 *  article and the direct shortcuts for its headline. */
function NewsStoryModal({ story, onClose }: { story: HotNewsItem | null; onClose: () => void }) {
  const t = useTranslations('HotNews');
  const locale = useLocale();
  const lang = wikiLangFor(locale);
  const { playHoverSfx } = useSpatialAudio();
  const meta = story ? hotNewsAxisMeta(story.category) : null;
  return (
    <Modal open={story !== null} onClose={onClose} labelledBy="news-story-title" size="lg">
      {story && meta && (
        <div className="space-y-4" data-news-story={story.id}>
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <span className="inline-flex items-center gap-1.5" style={{ color: meta.color }}>
              <meta.icon size={13} aria-hidden="true" />
              {t(`category.${story.category}`)}
            </span>
            <StoryBadge item={story} />
          </p>
          <p id="news-story-title" className="text-[20px] font-bold leading-snug text-white">
            {story.title}
          </p>
          {story.summary && <p className="text-[14px] leading-relaxed text-gray-300">{story.summary}</p>}
          <p className="text-[12px] text-gray-500">
            {storyMeta(story, locale)}
            {typeof story.views === 'number' && story.views > 0 ? ` · ${t('views', { count: story.views })}` : ''}
          </p>
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => playHoverSfx()}
            className="inline-flex items-center gap-2 border border-accent/50 px-4 py-2.5 text-[13px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10"
            data-news-open-original=""
          >
            <ExternalLink size={14} aria-hidden="true" />
            {t('openOriginal')}
            {story.domain && <span className="normal-case tracking-normal text-gray-400">· {story.domain}</span>}
          </a>
          <OmniOpen anchor={textAnchor(story.title, lang)} host="newsRail" />
        </div>
      )}
    </Modal>
  );
}
