'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowUpRight, ExternalLink, Loader2, RefreshCw, Timer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { SectionShield } from '@/components/system/PageShield';
import { LiveWeatherPanel } from '@/components/home/LiveWeatherPanel';
import { DiscoveryLinks } from '@/components/home/DiscoveryLinks';
import { GlobalThemeRankings } from '@/components/home/GlobalThemeRankings';
import { UnitasModuleRankings } from '@/components/home/UnitasModuleRankings';
import { useDragScroll } from '@/components/ui/useDragScroll';
import { useHorizontalSwipe } from '@/components/ui/useHorizontalSwipe';
import { centeredScrollLeft } from '@/lib/interaction/railDrag';
import { useHubHeadlines } from '@/lib/live/hubNewsClient';
import { HUB_MODAL_ITEMS, HUB_MODAL_REFRESH_MS, HUB_ROTATE_MS, findHubTheme, isHubThemeKey } from '@/lib/live/hubThemes';
import { slotCacheKey } from '@/lib/live/slotContext';
import { useSlotContext } from '@/lib/live/useSlotContext';
import {
  DISCOVERY_SLOTS,
  discoverySlotAt,
  findDiscoverySlot,
  slotTtlMs,
  type SlotCard,
  type SlotContext,
  type SlotItem,
  type SlotItemAction,
  type SlotKey,
} from '@/lib/live/discoverySlots';

/**
 * REV-20 §3 / REV-21 §1 -- the single unified discovery carousel ("실시간
 * 숏컷"). Every one of the 24 slots (weather, the 9 REV-19 news themes, the
 * 12 REV-20 feed themes and -- REV-21 §1.3 -- the two absorbed ranking
 * widgets) renders through the exact same chip-rail + card shell.
 *
 * REV-21 §1 changes, in order of the SPEC:
 *  §1.2 the chip rail is a native snap scroller with mouse grab-drag
 *       (useDragScroll) and the active card answers a left/right swipe
 *       (useHorizontalSwipe) -- 60fps, one rAF per pointer frame;
 *  §1.3 ranking slots carry sub-tabs (theme / module) inside the card, each
 *       tab a cursor-driven reload cached under `${cacheKey}:${tab}`;
 *  §1.4 one deep modal per kind (weather / news / feed / ranking), the
 *       ranking one embedding the very same GlobalThemeRankings /
 *       UnitasModuleRankings panels so the rank-detail popups are identical
 *       to the retired standalone widgets;
 *  §1.5 the WHOLE card is the hitbox (role=button); inner controls stop
 *       propagation;
 *  §1.6 rotation pauses while held / hovered / dragged / a modal is open /
 *       the tab is hidden, and a release continues from the current slot;
 *       the slot change is a transform/opacity crossfade on a fixed-height
 *       card (no 7-second layout shift).
 */

/** Session-scoped, module-level so a slot revisited within its TTL (even
 *  across a close/reopen of the search popup) renders instantly -- same
 *  "초지능 캐싱" contract as hubNewsClient.ts's own cache. REV-21 §2.1
 *  (L1-04): keyed on `locale:country:slot[:tab]` (slotCacheKey), never on
 *  the slot alone -- a language switch must re-render that language's data
 *  at once, not serve the previous locale's card until the TTL runs out. */
const cardCache = new Map<string, { card: SlotCard; at: number }>();

function isRankingKey(key: SlotKey): boolean {
  return findDiscoverySlot(key)?.kind === 'ranking';
}

function slotTitleKey(key: SlotKey): string {
  if (isHubThemeKey(key)) return `Rev19.hub.themes.${key}.title`;
  if (isRankingKey(key)) return `Rev21.slots.${key}.title`;
  return `Rev20.slots.${key}.title`;
}
function slotTagKey(key: SlotKey): string {
  if (isHubThemeKey(key)) return `Rev19.hub.themes.${key}.tag`;
  if (isRankingKey(key)) return `Rev21.slots.${key}.tag`;
  return `Rev20.slots.${key}.tag`;
}

function cardKeyFor(ctx: SlotContext, key: SlotKey, tab: string | undefined): string {
  const base = slotCacheKey(ctx, key);
  return tab ? `${base}:${tab}` : base;
}

/** What the deep modal opens on: the slot, plus (ranking) the tab that was
 *  showing and the row that was tapped, so the embedded panel lands on the
 *  identical theme + detail popup the old standalone widget would have. */
interface DeepTarget {
  key: SlotKey;
  tab?: string;
  action?: SlotItemAction;
}

export function DiscoveryCarousel() {
  const t = useTranslations();
  const tHub = useTranslations('Rev19.hub');
  const tSlots = useTranslations('Rev20.slots');
  const tRev21 = useTranslations('Rev21.hub');
  const locale = useLocale();
  const ctx = useSlotContext();
  const { playHoverSfx } = useSpatialAudio();

  const [held, setHeld] = useState<SlotKey | null>(null);
  const [tick, setTick] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [deep, setDeep] = useState<DeepTarget | null>(null);
  const [card, setCard] = useState<SlotCard | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [tabBySlot, setTabBySlot] = useState<Partial<Record<SlotKey, string>>>({});
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const chipRefs = useRef<Map<SlotKey, HTMLButtonElement>>(new Map());
  const railRef = useRef<HTMLDivElement>(null);
  const tabRailRef = useRef<HTMLDivElement>(null);

  const activeSlot = held ? findDiscoverySlot(held) ?? discoverySlotAt(0) : discoverySlotAt(tick);
  const activeKey = activeSlot.key;
  const activeTab = tabBySlot[activeKey];
  const activeIndex = Math.max(0, DISCOVERY_SLOTS.findIndex((s) => s.key === activeKey));

  // §1.6: every reason the rotation stands still. `document.hidden` keeps a
  // background tab from burning fetches on slots nobody sees.
  const rotationPaused = held !== null || deep !== null || hovering || dragging || hidden;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Advance one slot every HUB_ROTATE_MS while nothing pauses it. A resume
  // restarts the full period AND bumps `epoch`, which remounts the progress
  // bar so the bar and the timer always start together.
  useEffect(() => {
    if (rotationPaused) return;
    setEpoch((n) => n + 1);
    const id = window.setInterval(() => setTick((n) => n + 1), HUB_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotationPaused]);

  // Load the active slot's card (and, for ranking slots, the selected tab),
  // honouring its per-kind TTL cache keyed on locale + country + slot + tab.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const cacheKey = cardKeyFor(ctx, activeKey, activeTab);
    const cached = cardCache.get(cacheKey);
    const ttl = slotTtlMs(activeSlot.kind);
    if (cached && Date.now() - cached.at < ttl) {
      setCard(cached.card);
      setCardLoading(false);
    } else {
      setCardLoading(!cached);
      setCard(cached ? cached.card : null);
      void activeSlot.load({ ...ctx, signal: controller.signal }, activeTab ? { tab: activeTab } : undefined).then((next) => {
        if (cancelled) return;
        cardCache.set(cacheKey, { card: next, at: Date.now() });
        setCard(next);
        setCardLoading(false);
      });
    }
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, activeTab, ctx]);

  // §1.2: the chip rail is a native scroller; a mouse drag on it never
  // fights the auto-centering below (recentlyDragged) and pauses rotation.
  const { handlers: railHandlers, recentlyDragged } = useDragScroll(railRef, {
    onDragStart: () => setDragging(true),
    onDragEnd: () => setDragging(false),
  });
  const tabRail = useDragScroll(tabRailRef);

  // Keep the active chip centred -- 24 chips reliably overflow. Scrolling the
  // rail itself (not scrollIntoView) guarantees the page never moves.
  useEffect(() => {
    const el = chipRefs.current.get(activeKey);
    const scroller = railRef.current;
    if (!el || !scroller || recentlyDragged()) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({
      left: centeredScrollLeft(el.offsetLeft, el.offsetWidth, scroller.clientWidth),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeKey, recentlyDragged]);

  /** Pin a slot; pinning the pinned slot releases it and rotation continues
   *  from THAT slot rather than snapping back to wherever the clock was. */
  const toggleHold = useCallback((key: SlotKey) => {
    setHeld((prev) => {
      if (prev === key) {
        setTick(Math.max(0, DISCOVERY_SLOTS.findIndex((s) => s.key === key)));
        return null;
      }
      return key;
    });
  }, []);

  // §1.2: a swipe on the card pins the neighbouring slot (explicit intent).
  const swipe = useHorizontalSwipe((step) => {
    const next = discoverySlotAt(activeIndex + step).key;
    setHeld(next);
  });

  const openDeep = useCallback(
    (key: SlotKey, action?: SlotItemAction) => {
      setDeep({ key, tab: tabBySlot[key], action });
    },
    [tabBySlot],
  );
  const closeDeep = useCallback(() => setDeep(null), []);

  function onItem(item: SlotItem) {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    openDeep(activeKey, item.action);
  }

  function onCardKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDeep(activeKey);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHeld(discoverySlotAt(activeIndex + 1).key);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHeld(discoverySlotAt(activeIndex - 1).key);
    }
  }

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);
  const title = t(slotTitleKey(activeKey));
  const openLabel = tHub('openAria', { theme: title });
  const hasContent = Boolean(card && (card.facts.length > 0 || card.items.length > 0));

  return (
    <div className="w-full" data-discovery-carousel="" data-live-hub="">
      <p className="qw-discovery-label mb-1.5 flex items-center gap-2 text-[15px] font-bold text-white">
        <activeSlot.icon size={16} style={{ color: activeSlot.color }} aria-hidden="true" />
        {title}
      </p>
      <p className="qw-hub-meta mb-3 text-[12px] text-gray-500">{held ? tHub('held') : tHub('rotating')}</p>

      {/* Chip rail -- 24 slots, gold/blue accent per slot, activeKey centred. */}
      <div
        ref={railRef}
        {...railHandlers}
        className="qw-hub-strip select-none"
        role="tablist"
        aria-label={tSlots('railLabel')}
        data-paused={rotationPaused ? '1' : '0'}
      >
        {DISCOVERY_SLOTS.map((slot) => {
          const isActive = slot.key === activeKey;
          return (
            <button
              key={slot.key}
              ref={(el) => {
                if (el) chipRefs.current.set(slot.key, el);
                else chipRefs.current.delete(slot.key);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-active={isActive ? '1' : '0'}
              data-slot={slot.key}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => toggleHold(slot.key)}
              className="qw-hub-chip"
              style={{ '--qw-hub-accent': slot.color, '--qw-slot-rotate': `${HUB_ROTATE_MS}ms` } as CSSProperties}
            >
              <slot.icon size={15} style={{ color: slot.color }} aria-hidden="true" />
              {t(slotTitleKey(slot.key))}
              {isActive && (
                <span
                  key={`${slot.key}-${tick}-${epoch}`}
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

      {/* Active card -- same shell for weather, news, feeds and rankings.
          §1.5: the card itself is the button; every inner control stops
          propagation so a tap on a tab / row / arrow does exactly its own
          thing and nothing more. */}
      <div
        className="qw-hub-card mt-3 border border-white/10 bg-void/40 p-4"
        data-slot-card={activeKey}
        data-slot-kind={activeSlot.kind}
        role="button"
        tabIndex={0}
        aria-label={openLabel}
        style={{ '--qw-hub-accent': activeSlot.color } as CSSProperties}
        onClick={() => openDeep(activeKey)}
        onKeyDown={onCardKeyDown}
        onPointerEnter={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType === 'mouse') setHovering(true);
        }}
        onPointerLeave={() => setHovering(false)}
        onPointerDown={swipe.onPointerDown}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
        onClickCapture={swipe.onClickCapture}
      >
        <div key={activeKey} className="qw-hub-card-body">
          <div className="mb-2 flex items-start gap-3">
            <activeSlot.icon size={22} style={{ color: activeSlot.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold text-white">{title}</p>
              <p className="qw-hub-meta text-[13px] text-gray-400">{t(slotTagKey(activeKey))}</p>
            </div>
            <button
              type="button"
              onMouseEnter={() => playHoverSfx()}
              onClick={(e) => {
                e.stopPropagation();
                openDeep(activeKey);
              }}
              aria-label={openLabel}
              title={openLabel}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 text-accent transition-colors hover:bg-accent/10"
              style={{ borderColor: `${activeSlot.color}66`, color: activeSlot.color }}
            >
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </div>

          {/* §1.3: ranking sub-tabs (theme / module) -- their own drag rail;
              pointerdown stops here so a drag on the tabs is never read as a
              card swipe. */}
          {card?.tabs && card.tabs.length > 0 && (
            <div
              ref={tabRailRef}
              className="qw-hub-tabs u-hscroll select-none"
              role="tablist"
              aria-label={tRev21('tabsAria')}
              onPointerDown={(e) => {
                e.stopPropagation();
                tabRail.handlers.onPointerDown(e);
              }}
              onPointerMove={tabRail.handlers.onPointerMove}
              onPointerUp={(e) => {
                e.stopPropagation();
                tabRail.handlers.onPointerUp(e);
              }}
              onPointerCancel={tabRail.handlers.onPointerCancel}
              onClickCapture={tabRail.handlers.onClickCapture}
            >
              {card.tabs.map((tab) => {
                const selected = tab.key === (activeTab ?? card.activeTab);
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    data-tab={tab.key}
                    className="qw-hub-tab"
                    style={{ '--qw-hub-accent': tab.color } as CSSProperties}
                    onMouseEnter={() => playHoverSfx()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTabBySlot((prev) => ({ ...prev, [activeKey]: tab.key }));
                    }}
                  >
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>
          )}

          {cardLoading && !card ? (
            <p className="flex items-center gap-2 py-3 text-[14px] text-gray-400">
              <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
              {tHub('loading')}
            </p>
          ) : !hasContent ? (
            <p className="py-3 text-[14px] text-gray-500">{tHub('empty')}</p>
          ) : (
            <>
              {card!.facts.length > 0 && (
                <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
                  {card!.facts.map((fact, i) => {
                    const label = fact.labelKey ? t(fact.labelKey) : '';
                    // A value-less fact (e.g. weather condition, AQI band) IS its
                    // own label -- shown as the display text itself, not a suffix.
                    const display = fact.value ? `${fact.value}${fact.unit ?? ''}` : label;
                    const suffix = fact.value && !fact.emphasis ? label : '';
                    return (
                      <span key={i} className={fact.emphasis ? 'text-[26px] font-bold text-white' : 'text-[13px] font-semibold text-gray-300'}>
                        {display}
                        {suffix && <span className="ml-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">{suffix}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
              {card!.items.length > 0 && (
                <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  {card!.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="qw-hub-headline text-white"
                        onMouseEnter={() => playHoverSfx()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItem(item);
                        }}
                      >
                        {typeof item.rank === 'number' ? (
                          <span className="qw-hub-rank shrink-0" style={{ '--qw-hub-accent': item.color ?? activeSlot.color } as CSSProperties}>
                            {item.rank}
                          </span>
                        ) : (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: activeSlot.color }} aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2">{item.title}</span>
                          {(item.domain || item.meta) && (
                            <span className="qw-hub-source mt-0.5 block text-gray-500">{item.domain ?? item.meta}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <p className="qw-hub-meta mt-3 text-[12px] text-gray-500">
            {card?.updatedAt ? `${tHub('updated', { time: timeFormatter.format(new Date(card.updatedAt)) })} · ` : ''}
            {tHub('cadence')}
            <span className="sr-only"> · {tRev21('swipeHint')}</span>
          </p>
        </div>
      </div>

      <SlotDeepModal target={deep} ctx={ctx} onClose={closeDeep} />
    </div>
  );
}

/** Deep dive for any slot: weather opens the full LiveWeatherPanel (city
 *  search / locate-me / 5-day grid); a news theme keeps REV-19's twelve
 *  headline + countdown refresh behaviour (`useHubHeadlines`); every feed
 *  theme shows its already-loaded facts + items with outbound discovery
 *  links -- re-fetched fresh on open rather than reusing the rotating
 *  card's possibly-stale snapshot; a ranking slot embeds the full ranking
 *  panel (REV-21 §1.3/§1.4). */
/** All four sub-modals are mounted unconditionally (their own `open` prop
 *  toggles, per-kind) rather than an if/else branch returning different JSX
 *  -- so closing one plays `Modal`'s own exit transition instead of an
 *  abrupt unmount, matching every other modal in this codebase. */
function SlotDeepModal({ target, ctx, onClose }: { target: DeepTarget | null; ctx: SlotContext; onClose: () => void }) {
  const slotKey = target?.key ?? null;
  return (
    <>
      <Modal open={slotKey === 'weather'} onClose={onClose} labelledBy="slot-weather-title" size="xl">
        <div className="space-y-3">
          <p id="slot-weather-title" className="sr-only">
            weather
          </p>
          <SectionShield zone="live-weather">
            <LiveWeatherPanel />
          </SectionShield>
        </div>
      </Modal>
      <NewsDeepModal slotKey={slotKey} onClose={onClose} />
      <FeedDeepModal slotKey={slotKey} ctx={ctx} onClose={onClose} />
      <RankingDeepModal target={target} onClose={onClose} />
    </>
  );
}

function NewsDeepModal({ slotKey, onClose }: { slotKey: SlotKey | null; onClose: () => void }) {
  const t = useTranslations('Rev19.hub');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();
  const key = slotKey !== null && isHubThemeKey(slotKey) ? slotKey : null;
  const feed = useHubHeadlines(key, locale, key ? HUB_MODAL_REFRESH_MS : undefined);
  const [seconds, setSeconds] = useState(HUB_MODAL_REFRESH_MS / 1000);
  const fetchedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!key) return;
    const id = window.setInterval(() => {
      const base = feed.fetchedAt ?? fetchedRef.current ?? Date.now();
      const elapsed = Date.now() - base;
      setSeconds(Math.max(0, Math.ceil((HUB_MODAL_REFRESH_MS - (elapsed % HUB_MODAL_REFRESH_MS)) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [key, feed.fetchedAt]);

  useEffect(() => {
    if (feed.fetchedAt) fetchedRef.current = feed.fetchedAt;
  }, [feed.fetchedAt]);

  const meta = key ? findHubTheme(key) : null;
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const title = key ? t(`themes.${key}.title`) : '';

  return (
    <Modal open={key !== null} onClose={onClose} labelledBy="hub-deep-title" size="xl">
      {key && meta && (
      <div className="space-y-5" data-hub-modal={key}>
        <div className="flex items-start gap-3">
          <meta.icon size={26} style={{ color: meta.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p id="hub-deep-title" className="text-[20px] font-bold text-white">
              {t('modalTitle', { theme: title })}
            </p>
            <p className="mt-0.5 text-[14px] text-gray-400">{t('modalLede', { term: feed.term || title })}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-gray-300">
            <Timer size={14} className="text-accent" aria-hidden="true" />
            {t('refreshIn', { seconds })}
          </span>
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => feed.refresh()}
            className="flex items-center gap-1.5 border border-accent/40 px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10"
          >
            <RefreshCw size={12} className={feed.loading ? 'animate-spin' : ''} aria-hidden="true" />
            {t('refreshNow')}
          </button>
          {feed.fetchedAt && (
            <span className="text-[12px] text-gray-500">{t('updated', { time: timeFormatter.format(new Date(feed.fetchedAt)) })}</span>
          )}
        </div>

        <ol className="max-h-[42vh] space-y-1 overflow-y-auto overscroll-contain pr-1">
          {feed.items.slice(0, HUB_MODAL_ITEMS).map((item, i) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={() => playHoverSfx()}
                className="qw-hub-headline text-white"
              >
                <span className="w-6 shrink-0 text-[12px] font-bold" style={{ color: meta.color }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{item.title}</span>
                  <span className="qw-hub-source mt-0.5 flex items-center gap-1 text-gray-500">
                    {item.domain ?? t('readMore')}
                    <ExternalLink size={10} aria-hidden="true" />
                  </span>
                </span>
              </a>
            </li>
          ))}
          {feed.items.length === 0 && (
            <li className="py-4 text-[14px] text-gray-500">{feed.loading ? t('loading') : t('empty')}</li>
          )}
        </ol>

        <DiscoveryLinks subject={feed.term || title} locale={locale} />

        <p className="text-[11px] uppercase tracking-widest text-gray-600">{t('sources')}</p>
      </div>
      )}
    </Modal>
  );
}

function FeedDeepModal({ slotKey, ctx, onClose }: { slotKey: SlotKey | null; ctx: SlotContext; onClose: () => void }) {
  const t = useTranslations();
  const tHub = useTranslations('Rev19.hub');
  const locale = ctx.locale;
  const { playHoverSfx } = useSpatialAudio();
  const [card, setCard] = useState<SlotCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slotKey) return;
    const slot = findDiscoverySlot(slotKey);
    // Feed kinds only -- otherwise a weather/news open re-fetched that slot's
    // data here as well, purely to fill a modal that must stay closed.
    if (!slot || slot.kind !== 'feed') return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    void slot.load({ ...ctx, signal: controller.signal }).then((next) => {
      if (cancelled) return;
      cardCache.set(slotCacheKey(ctx, slotKey), { card: next, at: Date.now() });
      setCard(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slotKey, ctx]);

  // DISCOVERY_SLOTS holds all 24 slots -- weather, the nine news themes and
  // the two rankings included -- so an unfiltered lookup opened THIS modal
  // on top of the modal SlotDeepModal already opened for the same key: two
  // dialogs, two history levels, one back press short of closed. Each deep
  // modal answers for its own kind only.
  const found = slotKey ? findDiscoverySlot(slotKey) : undefined;
  const slot = found && found.kind === 'feed' ? found : undefined;
  const title = slotKey ? t(slotTitleKey(slotKey)) : '';
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal open={Boolean(slotKey && slot)} onClose={onClose} labelledBy="feed-deep-title" size="xl">
      {slotKey && slot && (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <slot.icon size={26} style={{ color: slot.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p id="feed-deep-title" className="text-[20px] font-bold text-white">
              {title}
            </p>
            <p className="mt-0.5 text-[14px] text-gray-400">{t(slotTagKey(slotKey))}</p>
          </div>
        </div>

        {loading && !card ? (
          <p className="flex items-center gap-2 py-4 text-[14px] text-gray-400">
            <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
            {tHub('loading')}
          </p>
        ) : !card || (card.facts.length === 0 && card.items.length === 0) ? (
          <p className="py-4 text-[14px] text-gray-500">{tHub('empty')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-white/10 pb-4">
              {card.facts.map((fact, i) => {
                const label = fact.labelKey ? t(fact.labelKey) : '';
                const display = fact.value ? `${fact.value}${fact.unit ?? ''}` : label;
                const suffix = fact.value && !fact.emphasis ? label : '';
                return (
                  <span key={i} className={fact.emphasis ? 'text-[28px] font-bold text-white' : 'text-[14px] font-semibold text-gray-300'}>
                    {display}
                    {suffix && <span className="ml-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">{suffix}</span>}
                  </span>
                );
              })}
            </div>
            <ol className="max-h-[42vh] space-y-1 overflow-y-auto overscroll-contain pr-1">
              {card.items.map((item, i) => (
                <li key={item.id}>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => playHoverSfx()}
                      className="qw-hub-headline text-white"
                    >
                      <span className="w-6 shrink-0 text-[12px] font-bold" style={{ color: slot.color }}>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{item.title}</span>
                        {(item.domain || item.meta) && (
                          <span className="qw-hub-source mt-0.5 flex items-center gap-1 text-gray-500">
                            {item.domain ?? item.meta}
                            <ExternalLink size={10} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                    </a>
                  ) : (
                    <div className="qw-hub-headline text-white">
                      <span className="w-6 shrink-0 text-[12px] font-bold" style={{ color: slot.color }}>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{item.title}</span>
                        {item.meta && <span className="qw-hub-source mt-0.5 block text-gray-500">{item.meta}</span>}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}

        <DiscoveryLinks subject={card?.subject?.term || card?.facts.find((f) => f.emphasis)?.value || title} locale={locale} />

        {card?.updatedAt && (
          <p className="text-[12px] text-gray-500">{tHub('updated', { time: timeFormatter.format(new Date(card.updatedAt)) })}</p>
        )}
      </div>
      )}
    </Modal>
  );
}

/** REV-21 §1.3/§1.4: the ranking deep dive embeds the very same panels the
 *  retired standalone widgets rendered, so the theme chips, the tiered
 *  "11~50위 보기" paging and the rank-detail / operator-profile popups
 *  (`#global-ranking-detail-title` / `#unitas-ranking-profile-title`) are
 *  byte-identical to before -- the card's tab and the tapped row are handed
 *  in so the modal lands exactly where the visitor was looking. */
function RankingDeepModal({ target, onClose }: { target: DeepTarget | null; onClose: () => void }) {
  const t = useTranslations();
  const key = target && isRankingKey(target.key) ? target.key : null;
  const slot = key ? findDiscoverySlot(key) : undefined;
  const action = target?.action;
  const title = key ? t(slotTitleKey(key)) : '';

  return (
    <Modal open={key !== null} onClose={onClose} labelledBy="ranking-deep-title" size="xl">
      {key && slot && (
        <div className="space-y-4" data-ranking-modal={key}>
          <div className="flex items-start gap-3">
            <slot.icon size={26} style={{ color: slot.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p id="ranking-deep-title" className="text-[20px] font-bold text-white">
                {title}
              </p>
              <p className="mt-0.5 text-[14px] text-gray-400">{t(slotTagKey(key))}</p>
            </div>
          </div>
          {key === 'worldRanking' ? (
            <GlobalThemeRankings
              embedded
              initialTheme={action?.kind === 'rankingDetail' ? action.theme : target?.tab}
              initialDetailRank={action?.kind === 'rankingDetail' ? action.rank : undefined}
            />
          ) : (
            <UnitasModuleRankings
              embedded
              initialModule={action?.kind === 'unitasProfile' ? action.moduleKey : target?.tab}
              initialProfileRank={action?.kind === 'unitasProfile' ? action.rank : undefined}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
