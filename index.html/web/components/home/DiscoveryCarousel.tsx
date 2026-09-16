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
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { SectionShield } from '@/components/system/PageShield';
import { LiveWeatherPanel } from '@/components/home/LiveWeatherPanel';
import { WeatherDeepPanel } from '@/components/home/WeatherDeepPanel';
import { OmniOpen } from '@/components/home/OmniOpen';
import { omniFamilyForSlot } from '@/lib/uai/sourceRegistry';
import { GlobalThemeRankings } from '@/components/home/GlobalThemeRankings';
import { HubDot } from '@/components/home/hub/HubDot';
import { HubMetaLine } from '@/components/home/hub/HubMetaLine';
import { HubRowEnter, HubTitleRow } from '@/components/home/hub/HubTitleRow';
import { captureScroll, reserveHeight } from '@/lib/ui/scrollAnchor';
import { UnitasModuleRankings } from '@/components/home/UnitasModuleRankings';
import { GLOBAL_RANKING_THEMES, THEME_QID, type GlobalRankingThemeKey } from '@/lib/globalRankings';
import { MODULE_REGISTRY, unitasRankingFor } from '@/lib/unitasRankings';
import { readWeatherCache } from '@/lib/live/useLiveWeather';
import { entityAnchor, resolveDeeperPlace } from '@/lib/uai/deeperAnchor';
import { resolveEntity } from '@/lib/uai/entityResolve';
import { useDragScroll } from '@/components/ui/useDragScroll';
import { useHorizontalSwipe } from '@/components/ui/useHorizontalSwipe';
import { centeredScrollLeft } from '@/lib/interaction/railDrag';
import { DISCOVERY_ROTATE_MS } from '@/lib/live/discoverySlots';
import { slotCacheKey } from '@/lib/live/slotContext';
import { decideRotationLoad, type RotationSource } from '@/lib/live/rotationBudget';
import { useSlotContext } from '@/lib/live/useSlotContext';
import type { Place } from '@/lib/live/useLiveWeather';
import { anchorDataAttrs, placeAnchor, qidAnchor, textAnchor, type DeeperAnchor } from '@/lib/uai/deeperAnchor';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import {
  DISCOVERY_SLOTS,
  SLOT_PROVIDER,
  SLOT_QID,
  discoverySlotAt,
  findDiscoverySlot,
  slotTtlMs,
  type SlotCard,
  type SlotContext,
  type SlotItem,
  type SlotItemAction,
  type SlotKey,
  type SlotSection,
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

/** REV-21 §1.4: on a touch screen there is no hover to pause the rotation,
 *  so a `pointerdown` anywhere on the rail or the card holds the slot still
 *  for this long -- long enough to read what was tapped, short enough that a
 *  stray tap does not freeze the carousel. */
const HUB_TOUCH_PAUSE_MS = 700;

/** A card's scope groups (REV-21 §2.1): the registry attaches them to every
 *  load, but a cache entry written before this version -- or an adapter that
 *  returned EMPTY_CARD -- may not carry any. */
function scopeGroups(card: SlotCard | null): SlotSection[] {
  if (!card) return [];
  if (card.sections && card.sections.length > 0) return card.sections;
  if (card.facts.length === 0 && card.items.length === 0) return [];
  return [{ scope: 'global', facts: card.facts, items: card.items }];
}

function isRankingKey(key: SlotKey): boolean {
  return findDiscoverySlot(key)?.kind === 'ranking';
}

function slotTitleKey(key: SlotKey): string {
  if (key === 'awards') return 'Rev23.awards.title';
  if (isRankingKey(key)) return `Rev21.slots.${key}.title`;
  return `Rev20.slots.${key}.title`;
}
function slotTagKey(key: SlotKey): string {
  if (key === 'awards') return 'Rev23.awards.tag';
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
  /** REV-34 M1-B: when the card being opened was loaded, for the ranking
   *  modal's meta line (the embedded panels carry no timestamp of their own). */
  updatedAt?: number;
}

export function DiscoveryCarousel() {
  const t = useTranslations();
  const tHub = useTranslations('Rev19.hub');
  const tSlots = useTranslations('Rev20.slots');
  const tRev21 = useTranslations('Rev21.hub');
  const tDeeper = useTranslations('Rev21.deeper');
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
  const [touchPaused, setTouchPaused] = useState(false);
  const touchResumeRef = useRef<number | null>(null);
  /** REV-24 M3: armed by a deliberate act that does NOT pin the slot (a
   *  sub-tab pick). Consumed by the loader effect, which spends a request on
   *  a stale card only when the visitor -- never the clock -- asked for it. */
  const intentRef = useRef(false);
  const chipRefs = useRef<Map<SlotKey, HTMLButtonElement>>(new Map());
  const railRef = useRef<HTMLDivElement>(null);
  const tabRailRef = useRef<HTMLDivElement>(null);
  /** REV-23 M3.3: the card box and the tallest payload it has held. The
   *  reservation only ever grows within a session, so a shorter card can
   *  never shrink the document under whatever the visitor is reading. */
  const cardBoxRef = useRef<HTMLDivElement>(null);
  const [reserved, setReserved] = useState<number | null>(null);

  const activeSlot = held ? findDiscoverySlot(held) ?? discoverySlotAt(0) : discoverySlotAt(tick);
  const activeKey = activeSlot.key;
  const activeTab = tabBySlot[activeKey];
  const activeIndex = Math.max(0, DISCOVERY_SLOTS.findIndex((s) => s.key === activeKey));

  // §1.6: every reason the rotation stands still. `document.hidden` keeps a
  // background tab from burning fetches on slots nobody sees.
  const rotationPaused = held !== null || deep !== null || hovering || dragging || touchPaused || hidden;

  // §1.4: touch has no hover -- a tap pauses, and the clock resumes 700ms
  // after the LAST touch (a second tap restarts the window).
  const pauseForTouch = useCallback(() => {
    setTouchPaused(true);
    if (touchResumeRef.current !== null) window.clearTimeout(touchResumeRef.current);
    touchResumeRef.current = window.setTimeout(() => {
      touchResumeRef.current = null;
      setTouchPaused(false);
    }, HUB_TOUCH_PAUSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (touchResumeRef.current !== null) window.clearTimeout(touchResumeRef.current);
    },
    [],
  );

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Advance one slot every DISCOVERY_ROTATE_MS while nothing pauses it. A resume
  // restarts the full period AND bumps `epoch`, which remounts the progress
  // bar so the bar and the timer always start together.
  useEffect(() => {
    if (rotationPaused) return;
    setEpoch((n) => n + 1);
    const id = window.setInterval(() => {
      // REV-23 M3.3: an auto-advance must never move the viewport. Snapshot
      // the page (and any scroll container above the rail) before the swap
      // and put it back on the next frame -- see lib/ui/scrollAnchor.ts for
      // why the browser's own anchoring cannot do this on a keyed subtree.
      const snap = captureScroll(cardBoxRef.current);
      setTick((n) => n + 1);
      snap.restore();
    }, DISCOVERY_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotationPaused]);

  // Measure the card AFTER every commit and grow the reservation. Reading
  // offsetHeight here is the one place layout is already up to date.
  useEffect(() => {
    const box = cardBoxRef.current;
    if (!box) return;
    const measured = box.offsetHeight;
    setReserved((seen) => reserveHeight(seen, measured));
  }, [activeKey, card, cardLoading]);

  // Load the active slot's card (and, for ranking slots, the selected tab),
  // honouring its per-kind TTL cache keyed on locale + country + slot + tab.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const cacheKey = cardKeyFor(ctx, activeKey, activeTab);
    const cached = cardCache.get(cacheKey);
    const ttl = slotTtlMs(activeSlot.kind);
    // REV-24 M3 (founder directive 2026-09-13, Codex ch.1 한계 비용 0원): the
    // CLOCK never spends a request. Before this, a 7s tick that landed on a
    // slot whose cache entry had aged past its TTL (15 min feed / 10 min
    // weather / 6 h ranking) re-fetched it -- and since a full loop is 16 x 7s
    // = 112s, the rotation re-fetched all thirteen network-backed slots once
    // per TTL, forever, for a visitor who had done nothing but leave the
    // search box focused. Thirteen of those calls go browser -> third-party
    // origin, so they were not even visible in our own logs.
    //
    // The whole decision table lives in lib/live/rotationBudget.ts, pure and
    // unit-tested. What this component owns is the INTENT signal: every
    // deliberate landing routes through `setHeld` (pinned chip, swipe, arrow
    // key, closed deep modal) or arms `intentRef` (a sub-tab pick), and the
    // clock does neither.
    const source: RotationSource = held !== null || intentRef.current ? 'intent' : 'clock';
    intentRef.current = false;
    const plan = decideRotationLoad({ cachedAt: cached?.at, ttlMs: ttl, source });
    if (!plan.spendsRequest) {
      // `hasPaintableCache` is what makes this branch safe: `decideRotationLoad`
      // only answers `memory` when there IS an entry.
      if (cached) {
        setCard(cached.card);
        setCardLoading(false);
      }
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
    // `held` is a dependency so that PINNING a slot the clock had parked on
    // re-enters this effect and is allowed to refresh it -- that pin is the
    // intent the rule above is waiting for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, activeTab, ctx, held]);

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
      // `card` is the active slot's own entry (or null while it loads), so
      // its timestamp is the one the deep modal's meta line may quote.
      setDeep({ key, tab: tabBySlot[key], action, updatedAt: card?.updatedAt });
    },
    [tabBySlot, card],
  );
  /** §1.4: a close pins the slot the modal was opened from (`held = openKey`)
   *  so the carousel never jumps to a different slot the moment the visitor
   *  comes back out of a deep dive. */
  const closeDeep = useCallback(() => {
    if (deep) setHeld(deep.key);
    setDeep(null);
  }, [deep]);

  function onItem(item: SlotItem) {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    openDeep(activeKey, item.action);
  }

  // REV-23 M2.3: Enter / Space no longer open from the card container --
  // opening belongs to the title row alone (REV-34 M1-C: its text button
  // and its ⏎ box, both on the FIRST press). The arrow keys still steer
  // the rail, which is what a card container should own.
  function onCardKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHeld(discoverySlotAt(activeIndex + 1).key);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHeld(discoverySlotAt(activeIndex - 1).key);
    }
  }

  const title = t(slotTitleKey(activeKey));
  const hasContent = Boolean(card && (card.facts.length > 0 || card.items.length > 0));
  // §2A.3: worldwide section first, the visitor's country second. One-scope
  // slots (quake, weather...) render a single group with no scope header.
  const groups = scopeGroups(card);
  const scopeHeads = groups.length > 1;

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
        onPointerDownCapture={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType !== 'mouse') pauseForTouch();
        }}
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
              style={{ '--qw-hub-accent': slot.color, '--qw-slot-rotate': `${DISCOVERY_ROTATE_MS}ms` } as CSSProperties}
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

      {/* Active card. REV-23 M2.3 (founder directive 2026-09-13): the card
          used to BE the button -- `role="button"` with an onClick on the
          whole 4-padding box -- so a tap on the padding, the icon or any gap
          between controls opened the deep modal. That, plus the top-right
          shortcut arrow, is the "빈 공간 클릭 시 팝업이 열리는 현상" the
          founder ordered removed. The container is now inert; the TITLE ROW
          is the only way in -- REV-34 M1-C: its text or its ⏎ box, one click. */}
      <div
        ref={cardBoxRef}
        className="qw-hub-card qw-no-anchor mt-3 border border-white/10 bg-void/40 p-4"
        data-slot-card={activeKey}
        data-slot-kind={activeSlot.kind}
        tabIndex={0}
        style={{ '--qw-hub-accent': activeSlot.color, ...(reserved ? { minHeight: reserved } : null) } as CSSProperties}
        onKeyDown={onCardKeyDown}
        onPointerEnter={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType === 'mouse') setHovering(true);
        }}
        onPointerLeave={() => setHovering(false)}
        onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType !== 'mouse') pauseForTouch();
          swipe.onPointerDown(e);
        }}
        onPointerUp={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType !== 'mouse') pauseForTouch();
          swipe.onPointerUp(e);
        }}
        onPointerCancel={swipe.onPointerCancel}
        onClickCapture={swipe.onClickCapture}
      >
        <div key={activeKey} className="qw-hub-card-body">
          <div className="mb-2 flex items-start gap-3">
            <activeSlot.icon size={22} style={{ color: activeSlot.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <HubTitleRow
                as="p"
                className="qw-hub-card-title text-[17px] font-bold text-white"
                onOpen={() => openDeep(activeKey)}
              >
                {title}
              </HubTitleRow>
              <p className="qw-hub-meta text-[13px] text-gray-400">{t(slotTagKey(activeKey))}</p>
            </div>
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
                      // REV-24 M3: a tab pick is stated intent, so it may
                      // spend the one request a stale card needs.
                      intentRef.current = true;
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
              {groups.map((section) => (
                <div key={section.scope} data-scope={section.scope} className="qw-hub-scope mb-1 last:mb-0">
                  {scopeHeads && (
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      {tDeeper(`scope.${section.scope}`)}
                    </p>
                  )}
              {section.facts.length > 0 && (
                <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
                  {section.facts.map((fact, i) => {
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
              {section.items.length > 0 && (
                <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  {section.items.map((item) => (
                    // REV-34 M1-C: the row is the headline button + a sibling
                    // ⏎ box at its right end (a button cannot nest a button);
                    // both route to `onItem`, both stop propagation.
                    <li key={item.id} className="qw-hub-row">
                      <button
                        type="button"
                        className="qw-hub-headline text-white"
                        onMouseEnter={() => playHoverSfx()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItem(item);
                        }}
                      >
                        {item.image ? (
                          <SlotThumb src={item.image} />
                        ) : typeof item.rank === 'number' ? (
                          <span className="qw-hub-rank shrink-0" style={{ '--qw-hub-accent': item.color ?? activeSlot.color } as CSSProperties}>
                            {item.rank}
                          </span>
                        ) : (
                          <HubDot color={activeSlot.color} className="mt-1.5" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="qw-hub-headline-text line-clamp-2">{item.title}</span>
                          {item.description && <span className="qw-hub-desc mt-0.5 line-clamp-2 block text-[12px] leading-snug text-gray-400">{item.description}</span>}
                          {(item.domain || item.meta) && (
                            <span className="qw-hub-source mt-0.5 block text-gray-500">{item.domain ?? item.meta}</span>
                          )}
                        </span>
                      </button>
                      <HubRowEnter onOpen={() => onItem(item)} />
                    </li>
                  ))}
                </ul>
              )}
                </div>
              ))}
            </>
          )}

          {/* REV-34 M1-B: the one meta format; the swipe hint stays sr-only. */}
          <HubMetaLine count={card?.items.length ?? 0} source={tHub('sources')} updatedAt={card?.updatedAt}>
            <span className="sr-only"> · {tRev21('swipeHint')}</span>
          </HubMetaLine>
        </div>
      </div>

      <SlotDeepModal target={deep} ctx={ctx} onClose={closeDeep} />
    </div>
  );
}

/** Deep dive for any slot: weather opens the compact LiveWeatherPanel (city
 *  search / locate-me / headline reading) over the REV-34 WeatherDeepPanel
 *  (extended current row, 24h rail, 7-day outlook, rain radar, AQI); a news
 *  theme keeps REV-19's twelve
 *  headline + countdown refresh behaviour (`useHubHeadlines`); every feed
 *  theme shows its already-loaded facts + items with outbound discovery
 *  links -- re-fetched fresh on open rather than reusing the rotating
 *  card's possibly-stale snapshot; a ranking slot embeds the full ranking
 *  panel (REV-21 §1.3/§1.4). */
/** All four sub-modals are mounted unconditionally (their own `open` prop
 *  toggles, per-kind) rather than an if/else branch returning different JSX
 *  -- so closing one plays `Modal`'s own exit transition instead of an
 *  abrupt unmount, matching every other modal in this codebase. */
/** REV-21 SPEC §12.2/§12.3: the anchor a slot's deep modal is ABOUT. The
 *  weather host anchors on the place the panel is showing (coordinates +
 *  the city's Wikidata item when known); news / feed hosts on the slot's
 *  own Wikidata item (`SLOT_QID`); anything else is sources-only (D-23). */
/** REV-29 M3: a small product thumbnail beside a row (card + deep modal). */
function SlotThumb({ src }: { src: string }) {
  return (
    <span className="qw-hub-thumb shrink-0" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Wikimedia thumbnails, sized by the CSS box */}
      <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
    </span>
  );
}

function slotAnchor(key: SlotKey, locale: string, term: string, place: Place | null): DeeperAnchor {
  const lang = wikiLangFor(locale);
  if (key === 'weather' && place) return placeAnchor(place, lang, SLOT_QID.weather);
  const qid = SLOT_QID[key];
  return qid ? qidAnchor(qid, term, lang) : textAnchor(term, lang);
}

function SlotDeepModal({ target, ctx, onClose }: { target: DeepTarget | null; ctx: SlotContext; onClose: () => void }) {
  const slotKey = target?.key ?? null;
  return (
    <>
      <WeatherDeepModal slotKey={slotKey} ctx={ctx} onClose={onClose} />
      <FeedDeepModal slotKey={slotKey} ctx={ctx} onClose={onClose} />
      <RankingDeepModal target={target} onClose={onClose} />
    </>
  );
}

/** REV-34 M1-A (founder directive 2026-09-16): the weather slot's DEEP popup.
 *  Until now the weather dialog was the compact panel alone (search, locate,
 *  current reading, 5-day grid) under a screen-reader-only title; the
 *  founder asked for hourly, weekly and radar on a click of the widget. The
 *  shell is now the FeedDeepModal's byte for byte (icon, 20px title, tag),
 *  the compact panel keeps its search / locate / headline reading but hides
 *  its 5-day grid (`compact` -- the 7-day list below supersedes it), and
 *  `WeatherDeepPanel` adds the extended current row, the 24h rail, the 7-day
 *  outlook, the rain radar and the AQI row. The history id
 *  (`modal:slot-weather-title`), `data-slot-modal="weather"` and the deeper
 *  anchor attrs are unchanged; `data-weather-modal` is new. */
function WeatherDeepModal({ slotKey, ctx, onClose }: { slotKey: SlotKey | null; ctx: SlotContext; onClose: () => void }) {
  const t = useTranslations();
  // Weather kind only -- the same per-kind gate as FeedDeepModal, so no
  // other slot's open can ever raise this dialog as a second layer.
  const found = slotKey ? findDiscoverySlot(slotKey) : undefined;
  const slot = found && found.kind === 'weather' ? found : undefined;
  // SPEC §12.3 (a): the weather panel lifts the place it is showing so the
  // host's omni-open block AND the deep panel follow THAT place, not the
  // locale default.
  const [weatherPlace, setWeatherPlace] = useState<Place | null>(null);
  // REV-34 M1-B: the meta line quotes the deep load (forecast days, stamp).
  const [loaded, setLoaded] = useState<{ days: number; at: number } | null>(null);
  const weatherAnchor = slot ? slotAnchor('weather', ctx.locale, weatherPlace?.name ?? 'weather', weatherPlace) : null;
  const title = slotKey ? t(slotTitleKey(slotKey)) : '';
  return (
    <Modal open={Boolean(slotKey && slot)} onClose={onClose} labelledBy="slot-weather-title" size="xl">
      {slotKey && slot && (
        <div className="space-y-5" data-slot-modal="weather" data-weather-modal="weather" data-context-country={ctx.country} {...anchorDataAttrs(weatherAnchor)}>
          <div className="flex items-start gap-3">
            <slot.icon size={26} style={{ color: slot.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p id="slot-weather-title" className="text-[20px] font-bold text-white">
                {title}
              </p>
              <p className="mt-0.5 text-[14px] text-gray-400">{t(slotTagKey(slotKey))}</p>
            </div>
          </div>
          <SectionShield zone="live-weather">
            <LiveWeatherPanel compact onPlaceChange={setWeatherPlace} />
          </SectionShield>
          <WeatherDeepPanel place={weatherPlace} onLoaded={setLoaded} />
          {/* SPEC §12.2 weather host: a sibling OUTSIDE the panel's shield, with
              its own zone, anchored on the place the panel is showing. */}
          <SectionShield zone="omni-open">
            <OmniOpen anchor={weatherAnchor} host="weather" family="place" />
          </SectionShield>
          {/* REV-34 M1-B: the one meta format -- forecast days counted, both
              providers named, the deep fetch's stamp as `{updated}`. */}
          <HubMetaLine count={loaded?.days ?? 0} source="Open-Meteo · RainViewer" updatedAt={loaded?.at} className="text-[12px] text-gray-500" />
        </div>
      )}
    </Modal>
  );
}

/** SPEC §12.2 feed row (D-23): history / mostRead resolve the tapped card's
 *  first item to an entity ONCE on open; nearby anchors on the visitor's
 *  place; the rest use the slot's own Wikidata item. */
function useFeedAnchor(slotKey: SlotKey | null, card: SlotCard | null, ctx: SlotContext): DeeperAnchor | null {
  const [resolved, setResolved] = useState<DeeperAnchor | null>(null);
  const lang = wikiLangFor(ctx.locale);
  const firstTitle = card?.items[0]?.title ?? null;
  useEffect(() => {
    setResolved(null);
    if (!slotKey || (slotKey !== 'history' && slotKey !== 'mostRead') || !firstTitle) return;
    const controller = new AbortController();
    resolveEntity(firstTitle, lang, controller.signal, { wikidataFallback: false })
      .then((r) => {
        if (!controller.signal.aborted && r && !r.disambiguation) setResolved(entityAnchor(r, lang, firstTitle));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [slotKey, firstTitle, lang]);
  return useMemo(() => {
    if (!slotKey) return null;
    if (slotKey === 'nearby') return placeAnchor(resolveDeeperPlace(ctx, readWeatherCache()?.place), lang);
    if (resolved) return resolved;
    return null;
  }, [slotKey, resolved, ctx, lang]);
}

function FeedDeepModal({ slotKey, ctx, onClose }: { slotKey: SlotKey | null; ctx: SlotContext; onClose: () => void }) {
  const t = useTranslations();
  const tHub = useTranslations('Rev19.hub');
  const tDeeper = useTranslations('Rev21.deeper');
  const tRev21 = useTranslations('Rev21.hub');
  const { playHoverSfx } = useSpatialAudio();
  const [card, setCard] = useState<SlotCard | null>(null);
  const [loading, setLoading] = useState(true);
  /** REV-29 M3: a feed slot may carry sub-tabs (the product families); the
   *  deep modal owns its own tab and reloads on a pick, like the rankings. */
  const [tab, setTab] = useState<string | undefined>(undefined);
  const tabRailRef = useRef<HTMLDivElement>(null);
  const tabRail = useDragScroll(tabRailRef);

  useEffect(() => {
    setTab(undefined);
  }, [slotKey]);

  useEffect(() => {
    if (!slotKey) return;
    const slot = findDiscoverySlot(slotKey);
    // Feed kinds only -- otherwise a weather/news open re-fetched that slot's
    // data here as well, purely to fill a modal that must stay closed.
    if (!slot || slot.kind !== 'feed') return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    // `deep: 1` asks the adapter for its long list; the rotating card's own
    // cache entry is left alone (a different key), so the card never paints
    // the modal's twelve rows.
    void slot.load({ ...ctx, signal: controller.signal }, tab ? { tab, deep: 1 } : { deep: 1 }).then((next) => {
      if (cancelled) return;
      cardCache.set(`${slotCacheKey(ctx, slotKey)}:deep${tab ? `:${tab}` : ''}`, { card: next, at: Date.now() });
      setCard(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slotKey, ctx, tab]);

  // DISCOVERY_SLOTS holds all 24 slots -- weather, the nine news themes and
  // the two rankings included -- so an unfiltered lookup opened THIS modal
  // on top of the modal SlotDeepModal already opened for the same key: two
  // dialogs, two history levels, one back press short of closed. Each deep
  // modal answers for its own kind only.
  const found = slotKey ? findDiscoverySlot(slotKey) : undefined;
  const slot = found && found.kind === 'feed' ? found : undefined;
  const title = slotKey ? t(slotTitleKey(slotKey)) : '';
  // SPEC §12.2 feed row: the slot's Wikidata item when it has one; the
  // resolved first item (history / mostRead) or the visitor's place (nearby)
  // otherwise; else the card's subject in sources-only mode (D-23).
  const feedAnchor = useFeedAnchor(slotKey && slot ? slotKey : null, card, ctx);
  const anchor = slotKey && slot ? (SLOT_QID[slotKey] ? slotAnchor(slotKey, ctx.locale, card?.subject?.term || title, null) : feedAnchor ?? textAnchor(card?.subject?.term || title, wikiLangFor(ctx.locale))) : null;

  return (
    <Modal open={Boolean(slotKey && slot)} onClose={onClose} labelledBy="feed-deep-title" size="xl">
      {slotKey && slot && (
      <div className="space-y-5" data-feed-modal={slotKey} data-context-country={ctx.country} {...anchorDataAttrs(anchor)}>
        <div className="flex items-start gap-3">
          <slot.icon size={26} style={{ color: slot.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p id="feed-deep-title" className="text-[20px] font-bold text-white">
              {title}
            </p>
            <p className="mt-0.5 text-[14px] text-gray-400">{t(slotTagKey(slotKey))}</p>
          </div>
        </div>

        {card?.tabs && card.tabs.length > 0 && (
          <div
            ref={tabRailRef}
            className="qw-hub-tabs u-hscroll select-none"
            role="tablist"
            aria-label={tRev21('tabsAria')}
            data-feed-tabs=""
            onPointerDown={tabRail.handlers.onPointerDown}
            onPointerMove={tabRail.handlers.onPointerMove}
            onPointerUp={tabRail.handlers.onPointerUp}
            onPointerCancel={tabRail.handlers.onPointerCancel}
            onClickCapture={tabRail.handlers.onClickCapture}
          >
            {card.tabs.map((tb) => {
              const selected = tb.key === (tab ?? card.activeTab);
              return (
                <button
                  key={tb.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  data-tab={tb.key}
                  className="qw-hub-tab"
                  style={{ '--qw-hub-accent': tb.color } as CSSProperties}
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => setTab(tb.key)}
                >
                  {t(tb.labelKey)}
                </button>
              );
            })}
          </div>
        )}

        {loading && !card ? (
          <p className="flex items-center gap-2 py-4 text-[14px] text-gray-400">
            <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
            {tHub('loading')}
          </p>
        ) : !card || (card.facts.length === 0 && card.items.length === 0) ? (
          <p className="py-4 text-[14px] text-gray-500">{tHub('empty')}</p>
        ) : (
          <>
            {scopeGroups(card).map((section, gi) => (
            <div key={section.scope} data-scope={section.scope} className="qw-hub-scope space-y-4">
            {gi > 0 || (card.sections?.length ?? 0) > 1 ? (
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{tDeeper(`scope.${section.scope}`)}</p>
            ) : null}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-white/10 pb-4">
              {section.facts.map((fact, i) => {
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
              {section.items.map((item, i) => (
                <li key={item.id}>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => playHoverSfx()}
                      className="qw-hub-headline text-white"
                    >
                      {item.image ? (
                        <SlotThumb src={item.image} />
                      ) : (
                        <span className="w-6 shrink-0 text-[12px] font-bold" style={{ color: slot.color }}>
                          {i + 1}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block">{item.title}</span>
                        {item.description && <span className="qw-hub-desc mt-0.5 block text-[12px] leading-snug text-gray-400">{item.description}</span>}
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
            </div>
            ))}
          </>
        )}

        <OmniOpen anchor={anchor} host="feed" family={omniFamilyForSlot(slotKey)} />

        {/* REV-34 M1-B: the one meta format (count · source ~ updated). */}
        <HubMetaLine count={card?.items.length ?? 0} source={tHub('sources')} updatedAt={card?.updatedAt} className="text-[12px] text-gray-500" />
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
  const locale = useLocale();
  const key = target && isRankingKey(target.key) ? target.key : null;
  const slot = key ? findDiscoverySlot(key) : undefined;
  const action = target?.action;
  const title = key ? t(slotTitleKey(key)) : '';
  // SPEC §12.2 rankingDeep host (D-20): the ACTIVE theme tab's Wikidata item
  // (THEME_QID) -- the embedded panel reports tab changes up here.
  const [activeTheme, setActiveTheme] = useState<GlobalRankingThemeKey | null>(null);
  const [activeModuleTitle, setActiveModuleTitle] = useState<string>('');
  const lang = wikiLangFor(locale);
  // REV-34 M1-B: what the meta line counts -- the entries of the theme the
  // embedded panel is on (world) or the rows of the module it opened on
  // (UNITAS). Both are bundled data, so the counts are exact, not estimates.
  const rankedCount =
    key === 'worldRanking'
      ? (GLOBAL_RANKING_THEMES.find((theme) => theme.key === (activeTheme ?? target?.tab)) ?? GLOBAL_RANKING_THEMES[0]).entries.length
      : key === 'unitasRanking'
        ? unitasRankingFor(
            MODULE_REGISTRY.find((m) => m.key === (action?.kind === 'unitasProfile' ? action.moduleKey : target?.tab)) ?? MODULE_REGISTRY[0],
          ).length
        : 0;
  const rankingAnchor: DeeperAnchor | null =
    key === 'worldRanking'
      ? activeTheme
        ? qidAnchor(THEME_QID[activeTheme], t(`GlobalRankings.themes.${activeTheme}.title`), lang)
        : null
      : key === 'unitasRanking'
        ? textAnchor(activeModuleTitle || title, lang)
        : null;

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
              onThemeChange={setActiveTheme}
            />
          ) : (
            <UnitasModuleRankings
              embedded
              initialModule={action?.kind === 'unitasProfile' ? action.moduleKey : target?.tab}
              initialProfileRank={action?.kind === 'unitasProfile' ? action.rank : undefined}
              onModuleChange={setActiveModuleTitle}
            />
          )}
          {/* REV-25 M1: the world-ranking anchor is a real Wikidata item, so it
              may bridge; the UNITAS-ranking anchor is a MODULE NAME and must
              not be resolved to an unrelated encyclopedia entry (D-23). */}
          <OmniOpen anchor={rankingAnchor} host="rankingDeep" family={omniFamilyForSlot(key)} compact />
          {/* REV-34 M1-B: the one meta format, provider named as the source. */}
          <HubMetaLine count={rankedCount} source={SLOT_PROVIDER[key].name} updatedAt={target?.updatedAt} className="text-[12px] text-gray-500" />
        </div>
      )}
    </Modal>
  );
}
