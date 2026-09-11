'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowUpRight, ExternalLink, Loader2, RefreshCw, Timer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { SectionShield } from '@/components/system/PageShield';
import { LiveWeatherPanel } from '@/components/home/LiveWeatherPanel';
import { DiscoveryLinks } from '@/components/home/DiscoveryLinks';
import { useHubHeadlines } from '@/lib/live/hubNewsClient';
import { HUB_MODAL_ITEMS, HUB_MODAL_REFRESH_MS, HUB_ROTATE_MS, findHubTheme, isHubThemeKey } from '@/lib/live/hubThemes';
import {
  DISCOVERY_SLOTS,
  discoverySlotAt,
  slotTtlMs,
  type SlotCard,
  type SlotKey,
} from '@/lib/live/discoverySlots';

/**
 * REV-20 §3 -- the single unified discovery carousel that replaces the old
 * "실시간 숏컷" tab row + the weather-tab-only LiveHubPanel rotation. Every
 * one of the 22 slots (weather first, then the 9 REV-19 news themes and the
 * 12 new REV-20 feed themes, lib/live/discoverySlots.ts) renders through the
 * exact same chip-rail + card shell -- weather is NOT visually special.
 *
 * Rotation starts the session at slot 0 (weather) deterministically on both
 * server and client (no Date.now() in the initial render), then a
 * mount-only client interval advances it -- REV-19's absolute-clock
 * `rotateIndex(Date.now())` scheme is retired per docs/rev20/SPEC.md §3.4
 * (22 slots made the 1-in-22 chance of landing on weather too easy to miss).
 */

/** Session-scoped, module-level so a slot revisited within its TTL (even
 *  across a close/reopen of the search popup) renders instantly -- same
 *  "초지능 캐싱" contract as hubNewsClient.ts's own cache. */
const cardCache = new Map<SlotKey, { card: SlotCard; at: number }>();

function slotTitleKey(key: SlotKey): string {
  return isHubThemeKey(key) ? `Rev19.hub.themes.${key}.title` : `Rev20.slots.${key}.title`;
}
function slotTagKey(key: SlotKey): string {
  return isHubThemeKey(key) ? `Rev19.hub.themes.${key}.tag` : `Rev20.slots.${key}.tag`;
}

export function DiscoveryCarousel() {
  const t = useTranslations();
  const tHub = useTranslations('Rev19.hub');
  const tSlots = useTranslations('Rev20.slots');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();

  const [held, setHeld] = useState<SlotKey | null>(null);
  const [tick, setTick] = useState(0);
  const [openKey, setOpenKey] = useState<SlotKey | null>(null);
  const [card, setCard] = useState<SlotCard | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const chipRefs = useRef<Map<SlotKey, HTMLButtonElement>>(new Map());
  const railRef = useRef<HTMLDivElement>(null);

  const activeSlot = held ? DISCOVERY_SLOTS.find((s) => s.key === held) ?? discoverySlotAt(0) : discoverySlotAt(tick);
  const activeKey = activeSlot.key;

  // Advance one slot every HUB_ROTATE_MS -- paused while a chip is held.
  useEffect(() => {
    if (held) return;
    const id = window.setInterval(() => setTick((n) => n + 1), HUB_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [held]);

  // Load the active slot's card, honouring its per-kind TTL cache.
  useEffect(() => {
    let cancelled = false;
    const cached = cardCache.get(activeKey);
    const ttl = slotTtlMs(activeSlot.kind);
    if (cached && Date.now() - cached.at < ttl) {
      setCard(cached.card);
      setCardLoading(false);
    } else {
      setCardLoading(!cached);
      if (cached) setCard(cached.card);
      void activeSlot.load({ locale }).then((next) => {
        if (cancelled) return;
        cardCache.set(activeKey, { card: next, at: Date.now() });
        setCard(next);
        setCardLoading(false);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, locale]);

  // Keep the active chip scrolled into view -- 22 chips reliably overflow.
  useEffect(() => {
    const el = chipRefs.current.get(activeKey);
    if (!el) return;
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeKey]);

  function toggleHold(key: SlotKey) {
    setHeld((prev) => (prev === key ? null : key));
  }

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);

  return (
    <div className="w-full" data-discovery-carousel="" data-live-hub="">
      <p className="qw-discovery-label mb-1.5 flex items-center gap-2 text-[15px] font-bold text-white">
        <activeSlot.icon size={16} style={{ color: activeSlot.color }} aria-hidden="true" />
        {t(slotTitleKey(activeKey))}
      </p>
      <p className="qw-hub-meta mb-3 text-[12px] text-gray-500">{held ? tHub('held') : tHub('rotating')}</p>

      {/* Chip rail -- 22 slots, gold/blue accent per slot, activeKey centred. */}
      <div ref={railRef} className="qw-hub-strip" role="tablist" aria-label={tSlots('railLabel')}>
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
                  key={`${slot.key}-${held ? 'held' : tick}`}
                  className="qw-hub-progress"
                  data-held={held ? '1' : '0'}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active card -- same shell for weather, news and every feed theme. */}
      <div className="qw-hub-card mt-3 border border-white/10 bg-void/40 p-4" data-slot-card={activeKey}>
        <div className="mb-2 flex items-start gap-3">
          <activeSlot.icon size={22} style={{ color: activeSlot.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold text-white">{t(slotTitleKey(activeKey))}</p>
            <p className="qw-hub-meta text-[13px] text-gray-400">{t(slotTagKey(activeKey))}</p>
          </div>
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => setOpenKey(activeKey)}
            aria-label={tHub('openAria', { theme: t(slotTitleKey(activeKey)) })}
            title={tHub('openAria', { theme: t(slotTitleKey(activeKey)) })}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 text-accent transition-colors hover:bg-accent/10"
            style={{ borderColor: `${activeSlot.color}66`, color: activeSlot.color }}
          >
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </div>

        {cardLoading && !card ? (
          <p className="flex items-center gap-2 py-3 text-[14px] text-gray-400">
            <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
            {tHub('loading')}
          </p>
        ) : !card || (card.facts.length === 0 && card.items.length === 0) ? (
          <p className="py-3 text-[14px] text-gray-500">{tHub('empty')}</p>
        ) : (
          <>
            {card.facts.length > 0 && (
              <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
                {card.facts.map((fact, i) => {
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
            {card.items.length > 0 && (
              <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
                {card.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="qw-hub-headline text-white"
                      onMouseEnter={() => playHoverSfx()}
                      onClick={() => (item.url ? window.open(item.url, '_blank', 'noopener,noreferrer') : setOpenKey(activeKey))}
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: activeSlot.color }} aria-hidden="true" />
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
        </p>
      </div>

      <SlotDeepModal slotKey={openKey} onClose={() => setOpenKey(null)} />
    </div>
  );
}

/** Deep dive for any slot: weather opens the full LiveWeatherPanel (city
 *  search / locate-me / 5-day grid); a news theme keeps REV-19's twelve
 *  headline + countdown refresh behaviour (`useHubHeadlines`); every feed
 *  theme shows its already-loaded facts + items with outbound discovery
 *  links -- re-fetched fresh on open rather than reusing the rotating
 *  card's possibly-stale snapshot. */
/** All three sub-modals are mounted unconditionally (their own `open` prop
 *  toggles, per-kind) rather than an if/else branch returning different JSX
 *  -- so closing one plays `Modal`'s own exit transition instead of an
 *  abrupt unmount, matching every other modal in this codebase. */
function SlotDeepModal({ slotKey, onClose }: { slotKey: SlotKey | null; onClose: () => void }) {
  const locale = useLocale();
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
      <FeedDeepModal slotKey={slotKey} locale={locale} onClose={onClose} />
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

function FeedDeepModal({ slotKey, locale, onClose }: { slotKey: SlotKey | null; locale: string; onClose: () => void }) {
  const t = useTranslations();
  const tHub = useTranslations('Rev19.hub');
  const { playHoverSfx } = useSpatialAudio();
  const [card, setCard] = useState<SlotCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slotKey) return;
    const slot = DISCOVERY_SLOTS.find((s) => s.key === slotKey);
    if (!slot) return;
    let cancelled = false;
    setLoading(true);
    void slot.load({ locale }).then((next) => {
      if (cancelled) return;
      cardCache.set(slotKey, { card: next, at: Date.now() });
      setCard(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slotKey, locale]);

  const slot = slotKey ? DISCOVERY_SLOTS.find((s) => s.key === slotKey) : undefined;
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

        <DiscoveryLinks subject={card?.facts.find((f) => f.emphasis)?.value || title} locale={locale} />

        {card?.updatedAt && (
          <p className="text-[12px] text-gray-500">{tHub('updated', { time: timeFormatter.format(new Date(card.updatedAt)) })}</p>
        )}
      </div>
      )}
    </Modal>
  );
}
