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
import { useTranslations } from 'next-intl';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { SectionShield } from '@/components/system/PageShield';
import { LiveWeatherPanel } from '@/components/home/LiveWeatherPanel';
import { WeatherDeepPanel } from '@/components/home/WeatherDeepPanel';
import { OmniOpen } from '@/components/home/OmniOpen';
import { omniFamilyForSlot } from '@/lib/uai/sourceRegistry';
import { HubDot } from '@/components/home/hub/HubDot';
import { HubMetaLine } from '@/components/home/hub/HubMetaLine';
import { HubRow } from '@/components/home/hub/HubRow';
import { HubTitleRow } from '@/components/home/hub/HubTitleRow';
import { SlotTabRail } from '@/components/home/hub/SlotTabRail';
import { SlotWidgetView, slotWidgetKind } from '@/components/home/widgets/SlotWidgetView';
import { MoonPhasePixel } from '@/components/home/widgets/MoonPhasePixel';
import { DetailOpenButton } from '@/components/home/detail/DetailOpenButton';
import { SlotDetailModal, type SlotDetailKey } from '@/components/home/detail/SlotDetailModal';
import { moonPhaseWidgetFor } from '@/lib/live/skyAlmanac';
import { I18N_ITEM_PREFIX } from '@/lib/live/gastronomy';
import { captureScroll, reserveHeight } from '@/lib/ui/scrollAnchor';
import { entityAnchor } from '@/lib/uai/deeperAnchor';
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
  knownPlace,
  slotTtlMs,
  type SlotCard,
  type SlotContext,
  type SlotItem,
  type SlotKey,
  type SlotSection,
} from '@/lib/live/discoverySlots';

/**
 * REV-20 §3 / REV-21 §1 -- the single unified discovery carousel ("실시간
 * 숏컷"). Every one of the 15 slots (weather and the 14 feed themes)
 * renders through the exact same chip-rail + card shell.
 *
 * REV-21 §1 changes, in order of the SPEC:
 *  §1.2 the chip rail is a native snap scroller with mouse grab-drag
 *       (useDragScroll) and the active card answers a left/right swipe
 *       (useHorizontalSwipe) -- 60fps, one rAF per pointer frame;
 *  §1.3 a slot may carry sub-tabs inside the card (the product families,
 *       REV-41 the Around-Me radii), each tab a cursor-driven reload cached
 *       under `${cacheKey}:${tab}` -- REV-41 D-6: the tabs are SlotTabRail,
 *       the main rail's own chip, and the families advance on the clock;
 *  §1.4 one deep modal per kind (weather / feed);
 *  §1.5 the WHOLE card was the hitbox (role=button) -- retired by REV-23
 *       M2.3 (inert container) and re-opened by REV-41 D-2 for ONE-TARGET
 *       slots only, as `data-one-target` + a container onClick, never a
 *       role; inner controls stop propagation;
 *  §1.6 rotation pauses while held / hovered / dragged / a modal is open /
 *       the tab is hidden, and a release continues from the current slot;
 *       the slot change is a transform/opacity crossfade on a fixed-height
 *       card (no 7-second layout shift).
 *
 * REV-41 D-7 (founder directive 2026-09-17, mission 1-F) revokes REV-35
 * M1's slot: the `uRanking` seat -- the U-Square 유랭킹 rail embedded as a
 * card body with its own deep modal, entry action and ledger meta line --
 * is gone from the rail, the registry and this file. The hub itself keeps
 * 유랭킹 (the U-Square rankings rail, HubRankings and lib/square/uRankings.ts
 * are untouched); only the carousel seat was retired.
 *
 * REV-41 D-8: a card whose adapter attaches a typed `widget` (the FX
 * compass hero, the Around-Me omni-radar) renders it through SlotWidgetView
 * above its facts row, and the deep modal renders the same widget at full
 * width above its sections.
 *
 * REV-42 (founder directive 2026-09-18, SPEC D-5 / 1-A #4 #6 #7 #12): the
 * rail seats sixteen with three flagships in front (weather, cosmos,
 * gastronomy; `air` retired), and those three gain a THIRD tier. Each deep
 * modal owns a `detailOpen` flag, mounts a `DetailOpenButton` chip
 * (weather: under the deep moon pixel and the weather panel; cosmos /
 * gastronomy: after the sections) and a nested `SlotDetailModal` -- a
 * portal sibling in the DOM, one history layer up -- that NOTHING opens but
 * the chip and that resets on slot change and on the deep modal's own
 * close. The weather deep modal reads ONE instant at open (`openedAt`,
 * state + effect, never `Date.now()` in render) for its `MoonPhasePixel`
 * and hands the same instant to tier 3. The meta line names the honest
 * provider of the two computed flagships (`Rev42.cosmos.source` /
 * `Rev42.gastronomy.source`, the fx precedent), and a row string that
 * starts with `i18n:` is a message path resolved here, since the lib
 * adapters cannot translate (the `text()` helper).
 */

/** REV-42 (lane E contract): a SlotItem title / description / meta that
 *  starts with `I18N_ITEM_PREFIX` ('i18n:', lib/live/gastronomy.ts) is a
 *  dotted message path, resolved through the root `t` by `text()` below.
 *  Plain strings render verbatim. */

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

/** The awards slot keeps its REV-23 keys; every other slot reads
 *  `Rev20.slots.<key>`. REV-41 D-7 removed the U-Ranking branch with the
 *  slot (its REV-35 i18n namespace is gone from every locale). */
function slotTitleKey(key: SlotKey): string {
  if (key === 'awards') return 'Rev23.awards.title';
  return `Rev20.slots.${key}.title`;
}
function slotTagKey(key: SlotKey): string {
  if (key === 'awards') return 'Rev23.awards.tag';
  return `Rev20.slots.${key}.tag`;
}

function cardKeyFor(ctx: SlotContext, key: SlotKey, tab: string | undefined): string {
  const base = slotCacheKey(ctx, key);
  return tab ? `${base}:${tab}` : base;
}

/** REV-42 1-A #12: the meta line's provider wording. The fx precedent
 *  (REV-41) names the Geo-IP resolver; the two computed flagships name the
 *  local engine that is their real supplier and Wikipedia as their only
 *  outbound (제17장 honesty) -- every other slot reads the registry. */
function metaSourceFor(key: SlotKey, t: (path: string) => string): string {
  if (key === 'fx') return t('Rev41.fx.source');
  if (key === 'cosmos') return t('Rev42.cosmos.source');
  if (key === 'gastronomy') return t('Rev42.gastronomy.source');
  return SLOT_PROVIDER[key].name;
}

/** The three slots that own a tier-3 detail (SPEC D-5). */
function detailKeyOf(key: SlotKey | null): SlotDetailKey | null {
  return key === 'weather' || key === 'cosmos' || key === 'gastronomy' ? key : null;
}

/** REV-42 i18n items: resolve an `i18n:<path>` row string through `t`,
 *  pass every other string through untouched. */
function resolveItemText(t: (path: string) => string, s: string | undefined): string | undefined {
  if (s && s.startsWith(I18N_ITEM_PREFIX)) return t(s.slice(I18N_ITEM_PREFIX.length));
  return s;
}
/** The overloaded shape the row props want: a string in, a string out. */
type ItemText = { (s: string): string; (s: string | undefined): string | undefined };

/** What the deep modal opens on: the slot. REV-41 D-7 dropped the sub-tab
 *  and the U-Ranking entry action it used to carry -- the deep modal owns
 *  its own tab (FeedDeepModal), and no slot item carries an in-app action
 *  any more. */
interface DeepTarget {
  key: SlotKey;
}

export function DiscoveryCarousel() {
  const t = useTranslations();
  const tHub = useTranslations('Rev19.hub');
  const tSlots = useTranslations('Rev20.slots');
  const tRev21 = useTranslations('Rev21.hub');
  const tDeeper = useTranslations('Rev21.deeper');
  const ctx = useSlotContext();
  const { playHoverSfx } = useSpatialAudio();
  // REV-42: `i18n:<path>` row strings resolve here; everything else verbatim.
  // A per-render closure over THIS render's `t`, so a locale switch re-reads.
  const text = ((s: string | undefined) => resolveItemText(t, s)) as ItemText;

  const [held, setHeld] = useState<SlotKey | null>(null);
  const [tick, setTick] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [deep, setDeep] = useState<DeepTarget | null>(null);
  /** The last card the loader committed and the cache key it belongs to.
   *  Read through `card` / `cardLoading` below, which re-key them to the
   *  ACTIVE slot every render (REV-41 integration fix). */
  const [storedCard, setCard] = useState<SlotCard | null>(null);
  const [storedLoading, setCardLoading] = useState(false);
  const [cardKey, setCardKey] = useState<string | null>(null);
  const [tabBySlot, setTabBySlot] = useState<Partial<Record<SlotKey, string>>>({});
  /** REV-41 D-6: the sub-tab a visitor pinned on an autoplay rail, per
   *  slot -- the same shape as `held` for the main rail. A pick pins, a
   *  second press on the pinned chip releases (SlotTabRail reports both). */
  const [tabHeldBySlot, setTabHeldBySlot] = useState<Partial<Record<SlotKey, string>>>({});
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const touchResumeRef = useRef<number | null>(null);
  /** REV-24 M3: armed by a deliberate act that does NOT pin the slot (a
   *  sub-tab pick). Consumed by the loader effect, which spends a request on
   *  a stale card only when the visitor -- never the clock -- asked for it. */
  const intentRef = useRef(false);
  /** REV-41 D-6 (integration fix): set by the sub-tab rail's auto-advance so
   *  the loader reads a pinned card's family clock as a CLOCK -- `held`
   *  alone used to read as intent, which would have bought a refresh of a
   *  stale family on every tick of a pinned newProducts card. */
  const tabClockRef = useRef(false);
  const chipRefs = useRef<Map<SlotKey, HTMLButtonElement>>(new Map());
  const railRef = useRef<HTMLDivElement>(null);
  /** REV-23 M3.3: the card box and the tallest payload it has held. The
   *  reservation only ever grows within a session, so a shorter card can
   *  never shrink the document under whatever the visitor is reading. */
  const cardBoxRef = useRef<HTMLDivElement>(null);
  const [reserved, setReserved] = useState<number | null>(null);

  const activeSlot = held ? findDiscoverySlot(held) ?? discoverySlotAt(0) : discoverySlotAt(tick);
  const activeKey = activeSlot.key;
  const activeTab = tabBySlot[activeKey];
  const activeIndex = Math.max(0, DISCOVERY_SLOTS.findIndex((s) => s.key === activeKey));

  // REV-41 (integration fix): the card in state may still belong to the slot
  // the clock just left -- the loader effect only flushes AFTER this paint.
  // A stored card is live only when its cache key is the active one; else
  // the module cache answers synchronously (a Map read, no side effect) or
  // this is a loading frame. No stale rows for a frame, and no false
  // "unreadable" flash on the fx / nearby widgets.
  const activeCacheKey = cardKeyFor(ctx, activeKey, activeTab);
  const cachedNow = cardCache.get(activeCacheKey)?.card ?? null;
  const card: SlotCard | null = cardKey === activeCacheKey ? storedCard : cachedNow;
  const cardLoading = cardKey === activeCacheKey ? storedLoading : cachedNow === null;

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

  // Load the active slot's card (and, for tabbed slots, the selected tab),
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
    // weather) re-fetched it -- and since a full loop is 15 x 7s = 105s
    // (REV-41 D-7 retired the seeded U-Ranking seat, so every seat is
    // network-backed now), the rotation re-fetched every slot once
    // per TTL, forever, for a visitor who had done nothing but leave the
    // search box focused. Thirteen of those calls go browser -> third-party
    // origin, so they were not even visible in our own logs.
    //
    // The whole decision table lives in lib/live/rotationBudget.ts, pure and
    // unit-tested. What this component owns is the INTENT signal: every
    // deliberate landing routes through `setHeld` (pinned chip, swipe, arrow
    // key, closed deep modal) or arms `intentRef` (a sub-tab pick), and the
    // clock does neither -- REV-41 D-6: the sub-tab rail's auto-advance
    // (`onPick(key, 'clock')`) is a clock as well and arms nothing.
    const source: RotationSource = intentRef.current || (held !== null && !tabClockRef.current) ? 'intent' : 'clock';
    intentRef.current = false;
    tabClockRef.current = false;
    const plan = decideRotationLoad({ cachedAt: cached?.at, ttlMs: ttl, source });
    if (!plan.spendsRequest) {
      // `hasPaintableCache` is what makes this branch safe: `decideRotationLoad`
      // only answers `memory` when there IS an entry.
      if (cached) {
        setCard(cached.card);
        setCardKey(cacheKey);
        setCardLoading(false);
      }
    } else {
      setCardLoading(!cached);
      setCard(cached ? cached.card : null);
      setCardKey(cacheKey);
      void activeSlot.load({ ...ctx, signal: controller.signal }, activeTab ? { tab: activeTab } : undefined).then((next) => {
        if (cancelled) return;
        cardCache.set(cacheKey, { card: next, at: Date.now() });
        setCard(next);
        setCardKey(cacheKey);
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

  const openDeep = useCallback((key: SlotKey) => setDeep({ key }), []);

  /** REV-41 D-6: a sub-tab pick. A click is stated intent (REV-24 M3: it
   *  may spend the one request a stale card needs); the rail's own clock is
   *  a clock -- it only moves the tab, and the loader serves memory or
   *  spends the first fill exactly as the main clock does. */
  const onTabPick = useCallback(
    (key: string, source: 'intent' | 'clock') => {
      if (source === 'intent') intentRef.current = true;
      else tabClockRef.current = true;
      setTabBySlot((prev) => ({ ...prev, [activeKey]: key }));
    },
    [activeKey],
  );
  /** REV-41 D-6: pin / release a sub-tab, the main `toggleHold` one level
   *  down. SlotTabRail calls this after an intent pick (which pins the
   *  picked tab) and on a press of the active chip (release when it was
   *  the pinned one, pin otherwise). */
  const toggleTabHold = useCallback(
    (key: string) => {
      setTabHeldBySlot((prev) => {
        const next = { ...prev };
        if (prev[activeKey] === key) delete next[activeKey];
        else next[activeKey] = key;
        return next;
      });
    },
    [activeKey],
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
    openDeep(activeKey);
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
  // REV-41 D-8: the widget this slot's card carries (fx / nearby), known
  // before the card arrives so the loading shell is the right widget's own.
  const widgetKind = slotWidgetKind(activeKey);
  // REV-41 D-6: the sub-tab showing (the visitor's pick, else the
  // adapter's default) and whether it is pinned on an autoplay rail.
  const shownTab = activeTab ?? card?.activeTab;
  const tabAutoplay = Boolean(activeSlot.tabAutoplay);
  const tabHeld = shownTab !== undefined && tabHeldBySlot[activeKey] === shownTab;
  // REV-41 (integration fix): the rail reads the slot's fixed tab set first,
  // so it is mounted before the first card lands and survives a reload.
  const tabs = activeSlot.tabs ?? card?.tabs ?? [];
  // REV-41 D-6 (integration fix): the family clock keeps running while the
  // card is PINNED -- that is the one state in which a visitor deliberately
  // watches it -- and stops for the same reasons the main clock does
  // otherwise (a dive, a hover, a drag, a touch, a hidden tab).
  const tabPaused = deep !== null || hovering || dragging || touchPaused || hidden;
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

      {/* Chip rail -- 16 slots, gold/blue accent per slot, activeKey centred. */}
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
          is the only way in -- REV-34 M1-C: its text or its ⏎ box, one click.
          REV-41 D-2 (mission 1-C) re-enables the whole-card hitbox ONLY for
          one-target slots (`activeSlot.oneTarget`: weather, fx, nearby ...
          -- one piece of information, no item routes anywhere) through
          `data-one-target="1"` + this onClick, never `role=button` (SPEC
          §1-9: rev23-verify asserts the container holds none); the swipe's
          onClickCapture still swallows the click that ends a swipe, and
          every inner control (title, ⏎, rows, tab chips) stops propagation. */}
      <div
        ref={cardBoxRef}
        className="qw-hub-card qw-no-anchor mt-3 border border-white/10 bg-void/40 p-4"
        data-slot-card={activeKey}
        data-slot-kind={activeSlot.kind}
        data-one-target={activeSlot.oneTarget ? '1' : '0'}
        tabIndex={0}
        style={{ '--qw-hub-accent': activeSlot.color, ...(reserved ? { minHeight: reserved } : null) } as CSSProperties}
        onClick={() => {
          if (activeSlot.oneTarget) openDeep(activeKey);
        }}
        onKeyDown={onCardKeyDown}
        onPointerEnter={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType === 'mouse') setHovering(true);
        }}
        onPointerLeave={() => setHovering(false)}
        onPointerDownCapture={(e: ReactPointerEvent<HTMLDivElement>) => {
          // REV-41 (integration fix): capture phase, so a tap on a sub-tab
          // chip -- whose rail stops pointerdown from bubbling -- still holds
          // the main rotation for 700ms while its reload is in flight.
          if (e.pointerType !== 'mouse') pauseForTouch();
        }}
        onPointerDown={swipe.onPointerDown}
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

          {/* §1.3 sub-tabs -- REV-41 D-6 (mission 1-E): the main rail's own
              chip (SlotTabRail), which stops pointerdown / click itself so a
              drag on the tabs is never a card swipe and a chip press never
              reaches the one-target onClick. The product families advance
              on the clock (`tabAutoplay`) -- also while the card is pinned --
              and pause for the same other reasons as the main rotation;
              a press pins / releases like the main `toggleHold`. The
              Around-Me radii (D-5) ride the same rail without a clock and
              never pin (no onToggleHold), so a radius press only reloads. */}
          {tabs.length > 0 && (
            <SlotTabRail
              tabs={tabs}
              activeKey={shownTab}
              onPick={onTabPick}
              autoplay={tabAutoplay}
              paused={tabPaused}
              held={tabHeld}
              onToggleHold={tabAutoplay ? toggleTabHold : undefined}
              ariaLabel={activeKey === 'nearby' ? t('Rev41.nearby.radiusAria') : tRev21('tabsAria')}
            />
          )}

          {/* REV-41 D-8: the card's widget (the FX compass hero, the
              omni-radar) sits above the facts row. Mounted whenever the SLOT
              carries one -- before the card arrives it is the widget's own
              loading shell (`card === null` is "not loaded yet": every load
              settles on a card, EMPTY_CARD at worst), after a failed load its
              honest unreadable line -- so the widget, not the generic empty
              line, owns the empty / unreadable states of these two cards. */}
          {widgetKind && (
            <SlotWidgetView
              kind={widgetKind}
              widget={card?.widget}
              variant="card"
              loading={cardLoading || card === null}
              accent={activeSlot.color}
              pendingTab={shownTab}
            />
          )}

          {cardLoading && !card ? (
            <p className="flex items-center gap-2 py-3 text-[14px] text-gray-400">
              <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
              {tHub('loading')}
            </p>
          ) : !hasContent ? (
            widgetKind ? null : <p className="py-3 text-[14px] text-gray-500">{tHub('empty')}</p>
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
                    // REV-41 D-1 (mission 1-B): the row is the HubRow
                    // primitive -- an inline headline the ⏎ box trails on its
                    // last line -- with the marker (thumbnail / rank box /
                    // dot) outside the text flow; text and box both route to
                    // `onItem`, both stop propagation.
                    <HubRow
                      key={item.id}
                      marker={
                        item.image ? (
                          <SlotThumb src={item.image} />
                        ) : typeof item.rank === 'number' ? (
                          <span className="qw-hub-rank shrink-0" style={{ '--qw-hub-accent': item.color ?? activeSlot.color } as CSSProperties}>
                            {item.rank}
                          </span>
                        ) : (
                          <HubDot color={activeSlot.color} className="mt-1.5" />
                        )
                      }
                      title={text(item.title)}
                      description={text(item.description)}
                      source={item.domain || text(item.meta)}
                      onOpen={() => onItem(item)}
                      onHover={() => playHoverSfx()}
                    />
                  ))}
                </ul>
              )}
                </div>
              ))}
            </>
          )}

          {/* REV-34 M1-B: the one meta format; the swipe hint stays sr-only.
              REV-41 D-3: the fx card's rows are its pairs and parity rows,
              so the count is never the "0건" of the facts-only card.
              REV-42 1-A #12: cosmos / gastronomy name their local engine. */}
          <HubMetaLine count={card?.items.length ?? 0} source={metaSourceFor(activeKey, t)} updatedAt={card?.updatedAt}>
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
 *  card's possibly-stale snapshot. REV-41 D-7 retired the third, U-Ranking
 *  modal with its slot. */
/** Both sub-modals are mounted unconditionally (their own `open` prop
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
  // REV-42 D-3 / D-5: ONE instant per open -- read in state / effect, never
  // in render -- feeds the deep moon pixel and tier 3's seed clock. The
  // tier-3 flag resets on every slot change (a close sets slotKey null), so
  // no ghost history layer can survive a reopen (1-A #6).
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const [detailOpen, setDetailOpen] = useState(false);
  useEffect(() => {
    if (slotKey === 'weather') setOpenedAt(Date.now());
    setDetailOpen(false);
  }, [slotKey]);
  const moonWidget = useMemo(() => moonPhaseWidgetFor(openedAt, ctx.locale, -new Date(openedAt).getTimezoneOffset()), [openedAt, ctx.locale]);
  const closeDetail = useCallback(() => setDetailOpen(false), []);
  const openDetail = useCallback(() => setDetailOpen(true), []);
  const closeAll = useCallback(() => {
    setDetailOpen(false);
    onClose();
  }, [onClose]);
  const weatherAnchor = slot ? slotAnchor('weather', ctx.locale, weatherPlace?.name ?? 'weather', weatherPlace) : null;
  const title = slotKey ? t(slotTitleKey(slotKey)) : '';
  return (
    <Modal open={Boolean(slotKey && slot)} onClose={closeAll} labelledBy="slot-weather-title" size="xl">
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
          {/* REV-42 D-3: the deep moon pixel -- the weather deep modal does
              not ride the widget path (SPEC 1-5 #4), so it is mounted here
              explicitly from the instant this open read. */}
          <MoonPhasePixel widget={moonWidget} variant="deep" loading={false} accent={slot.color} />
          <SectionShield zone="live-weather">
            <LiveWeatherPanel compact onPlaceChange={setWeatherPlace} />
          </SectionShield>
          <WeatherDeepPanel place={weatherPlace} onLoaded={setLoaded} />
          {/* REV-42 D-5: the only way into tier 3 (never auto-opened). */}
          <DetailOpenButton slotKey="weather" onOpen={openDetail} />
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
      {/* REV-42 D-5: tier 3 -- a portal sibling in the DOM, one history
          layer up; the observer is the place the panel is showing. */}
      <SlotDetailModal open={detailOpen && slotKey === 'weather'} slotKey="weather" place={weatherPlace} nowMs={openedAt} onClose={closeDetail} />
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
    // REV-41 D-4 (integration fix): the same place rule as the adapter, so
    // the dive's deeper links anchor where the radar is centred (the Geo-IP
    // city when no weather place is known), not on the country capital.
    if (slotKey === 'nearby') return placeAnchor(knownPlace(ctx), lang);
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
  // REV-42 D-5: the tier-3 flag for the cosmos / gastronomy flagships --
  // reset on every slot change (a close sets slotKey null) so no ghost
  // history layer survives a reopen (1-A #6); nothing but the chip sets it.
  const [detailOpen, setDetailOpen] = useState(false);
  const detailKey = detailKeyOf(slotKey);
  // REV-42: `i18n:<path>` row strings resolve here (lane E contract).
  const text = ((s: string | undefined) => resolveItemText(t, s)) as ItemText;

  useEffect(() => {
    setTab(undefined);
    setDetailOpen(false);
  }, [slotKey]);
  const openDetail = useCallback(() => setDetailOpen(true), []);
  const closeDetail = useCallback(() => setDetailOpen(false), []);
  const closeAll = useCallback(() => {
    setDetailOpen(false);
    onClose();
  }, [onClose]);
  // The observer / diner's point for tier 3: the same rule as the adapters
  // (weather cache -> Geo-IP fix -> the country's default place). Read
  // only for the two slots that have a tier 3 -- it touches localStorage.
  const detailPlace = useMemo(() => (detailKey === 'cosmos' || detailKey === 'gastronomy' ? knownPlace(ctx) : null), [detailKey, ctx]);

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

  // DISCOVERY_SLOTS holds every slot -- weather included -- so an
  // unfiltered lookup opened THIS modal on top of the modal
  // SlotDeepModal already opened for the same key: two dialogs, two history
  // levels, one back press short of closed. Each deep modal answers for its
  // own kind only.
  const found = slotKey ? findDiscoverySlot(slotKey) : undefined;
  const slot = found && found.kind === 'feed' ? found : undefined;
  const title = slotKey ? t(slotTitleKey(slotKey)) : '';
  // REV-41 D-8: the widget this slot's card carries, if any.
  const widgetKind = slotKey && slot ? slotWidgetKind(slotKey) : null;
  // REV-41 (integration fix): the slot's fixed tab set first, as on the card.
  const modalTabs = slot ? slot.tabs ?? card?.tabs ?? [] : [];
  // SPEC §12.2 feed row: the slot's Wikidata item when it has one; the
  // resolved first item (history / mostRead) or the visitor's place (nearby)
  // otherwise; else the card's subject in sources-only mode (D-23).
  const feedAnchor = useFeedAnchor(slotKey && slot ? slotKey : null, card, ctx);
  const anchor = slotKey && slot ? (SLOT_QID[slotKey] ? slotAnchor(slotKey, ctx.locale, card?.subject?.term || title, null) : feedAnchor ?? textAnchor(card?.subject?.term || title, wikiLangFor(ctx.locale))) : null;

  return (
    <Modal open={Boolean(slotKey && slot)} onClose={closeAll} labelledBy="feed-deep-title" size="xl">
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

        {/* REV-41 D-6: the same chip rail as the card, without a clock (a
            deep dive is read, not rotated); a pick reloads the long list. */}
        {modalTabs.length > 0 && (
          <SlotTabRail
            tabs={modalTabs}
            activeKey={tab ?? card?.activeTab}
            onPick={(key) => setTab(key)}
            autoplay={false}
            ariaLabel={slotKey === 'nearby' ? t('Rev41.nearby.radiusAria') : tRev21('tabsAria')}
            data-testid="feed-tabs"
          />
        )}

        {/* REV-41 D-8: the widget at full width above the sections. A card
            left over from another slot's dive is the wrong kind and is
            ignored by SlotWidgetView, so the loading shell shows until this
            slot's own widget lands; the widget owns the empty / unreadable
            states of its own card. */}
        {widgetKind && (
          <SlotWidgetView
            kind={widgetKind}
            widget={card?.widget}
            variant="deep"
            loading={loading || card === null}
            accent={slot.color}
            pendingTab={tab ?? card?.activeTab}
          />
        )}

        {loading && !card ? (
          <p className="flex items-center gap-2 py-4 text-[14px] text-gray-400">
            <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
            {tHub('loading')}
          </p>
        ) : !card || (card.facts.length === 0 && card.items.length === 0) ? (
          widgetKind ? null : <p className="py-4 text-[14px] text-gray-500">{tHub('empty')}</p>
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
                        <span className="block">{text(item.title)}</span>
                        {item.description && <span className="qw-hub-desc mt-0.5 block text-[12px] leading-snug text-gray-400">{text(item.description)}</span>}
                        {(item.domain || item.meta) && (
                          <span className="qw-hub-source mt-0.5 flex items-center gap-1 text-gray-500">
                            {item.domain ?? text(item.meta)}
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
                        <span className="block">{text(item.title)}</span>
                        {item.description && <span className="qw-hub-desc mt-0.5 block text-[12px] leading-snug text-gray-400">{text(item.description)}</span>}
                        {item.meta && <span className="qw-hub-source mt-0.5 block text-gray-500">{text(item.meta)}</span>}
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

        {/* REV-42 D-5: the only way into tier 3 for the two computed
            flagships -- after the sections, before the omni-open block. */}
        {detailKey && detailKey !== 'weather' && <DetailOpenButton slotKey={detailKey} onOpen={openDetail} />}

        <OmniOpen anchor={anchor} host="feed" family={omniFamilyForSlot(slotKey)} />

        {/* REV-34 M1-B: the one meta format (count · source ~ updated). */}
        {/* REV-41 (integration fix): the REAL provider of this slot (source
            registry), never the news rail's wording -- the fx line also
            names the Geo-IP resolver that picked the home currency.
            REV-42 1-A #12: cosmos / gastronomy name their local engine. */}
        <HubMetaLine count={card?.items.length ?? 0} source={metaSourceFor(slotKey, t)} updatedAt={card?.updatedAt} className="text-[12px] text-gray-500" />
      </div>
      )}
      {/* REV-42 D-5: tier 3 -- a portal sibling in the DOM, one history
          layer up. Mounted whenever this feed modal is open for a slot
          that owns a tier 3; only the chip above flips it open. */}
      {detailKey && detailKey !== 'weather' && (
        <SlotDetailModal open={detailOpen} slotKey={detailKey} place={detailPlace} onClose={closeDetail} />
      )}
    </Modal>
  );
}
