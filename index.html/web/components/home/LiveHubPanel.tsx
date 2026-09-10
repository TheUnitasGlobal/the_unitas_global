'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowUpRight, ExternalLink, Loader2, RefreshCw, Timer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { SectionShield } from '@/components/system/PageShield';
import { LiveWeatherPanel } from '@/components/home/LiveWeatherPanel';
import { UnitasShortsPanel } from '@/components/home/UnitasShortsPanel';
import { DiscoveryLinks } from '@/components/home/DiscoveryLinks';
import { useHubHeadlines } from '@/lib/live/hubNewsClient';
import {
  HUB_CARD_ITEMS,
  HUB_MODAL_ITEMS,
  HUB_MODAL_REFRESH_MS,
  HUB_ROTATE_MS,
  HUB_THEMES,
  findHubTheme,
  rotateIndex,
  type HubThemeKey,
} from '@/lib/live/hubThemes';


/**
 * REV-19 §8 -- the LIVE HUB: the real-time weather panel on top, then a
 * self-rotating strip of nine discovery themes (game / sports / movie /
 * bestseller / shopping / stock / webtoon / fashion / food) whose active
 * card shows four live headlines, and the UNITAS Shorts rail beneath.
 *
 * Rotation: `rotateIndex(now)` on a 7s period, so the first frame agrees
 * between server and client; tapping a theme HOLDS it (rotation resumes
 * when the visitor taps it again). Every headline and the card itself open
 * the theme's deep modal (a level on the deep modal history stack) with
 * twelve headlines, source links, outbound discovery links and a 60s
 * refresh countdown while it stays open. Everything is fed by
 * `/api/live/hub-news` -- keyless RSS, edge-cached, 0원.
 */
export function LiveHubPanel() {
  const t = useTranslations('Rev19.hub');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();
  const [held, setHeld] = useState<HubThemeKey | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [openTheme, setOpenTheme] = useState<HubThemeKey | null>(null);

  // Rotation clock -- one React tick per rotation slot (the progress bar
  // itself is a CSS animation, so nothing re-renders between slots -- a
  // deliberate low-end-device / headless-WebKit consideration). Paused
  // while a theme is held.
  useEffect(() => {
    if (held) return;
    const schedule = () => {
      const wait = HUB_ROTATE_MS - (Date.now() % HUB_ROTATE_MS) + 20;
      return window.setTimeout(() => {
        setNow(Date.now());
        id = schedule();
      }, wait);
    };
    let id = schedule();
    return () => window.clearTimeout(id);
  }, [held]);

  const activeKey: HubThemeKey = held ?? HUB_THEMES[rotateIndex(now, HUB_THEMES.length)].key;
  const active = findHubTheme(activeKey);
  const card = useHubHeadlines(activeKey, locale);

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);

  function toggleHold(key: HubThemeKey) {
    setHeld((prev) => (prev === key ? null : key));
  }

  return (
    <div className="w-full" data-live-hub="">
      <SectionShield zone="live-weather">
        <LiveWeatherPanel />
      </SectionShield>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="qw-discovery-label mb-1.5 text-[15px] font-bold text-white">
          <active.icon size={16} style={{ color: active.color }} aria-hidden="true" />
          {t('themesLabel')}
        </p>
        <p className="qw-hub-meta mb-3 text-[12px] text-gray-500">{held ? t('held') : t('rotating')}</p>

        <div className="qw-hub-strip" role="tablist" aria-label={t('themesLabel')}>
          {HUB_THEMES.map((theme) => {
            const isActive = theme.key === activeKey;
            return (
              <button
                key={theme.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-active={isActive ? '1' : '0'}
                data-hub-theme={theme.key}
                onMouseEnter={() => playHoverSfx()}
                onClick={() => toggleHold(theme.key)}
                className="qw-hub-chip border border-white/15 text-gray-400"
                style={{ '--qw-hub-accent': theme.color } as CSSProperties}
              >
                <theme.icon size={15} style={{ color: theme.color }} aria-hidden="true" />
                {t(`themes.${theme.key}.title`)}
                {isActive && (
                  <span
                    key={`${theme.key}-${held ? 'held' : now}`}
                    className="qw-hub-progress"
                    data-held={held ? '1' : '0'}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="qw-hub-card mt-3 border border-white/10 bg-void/40 p-4" data-hub-card={activeKey}>
          <div className="mb-2 flex items-start gap-3">
            <active.icon size={22} style={{ color: active.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold text-white">{t(`themes.${activeKey}.title`)}</p>
              <p className="qw-hub-meta text-[13px] text-gray-400">{t(`themes.${activeKey}.tag`)}</p>
            </div>
            <button
              type="button"
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setOpenTheme(activeKey)}
              aria-label={t('openAria', { theme: t(`themes.${activeKey}.title`) })}
              title={t('openAria', { theme: t(`themes.${activeKey}.title`) })}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 text-accent transition-colors hover:bg-accent/10"
              style={{ borderColor: `${active.color}66`, color: active.color }}
            >
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </div>

          {card.loading && card.items.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-[14px] text-gray-400">
              <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" />
              {t('loading')}
            </p>
          ) : card.items.length === 0 ? (
            <p className="py-3 text-[14px] text-gray-500">{t('empty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
              {card.items.slice(0, HUB_CARD_ITEMS).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="qw-hub-headline text-white"
                    onMouseEnter={() => playHoverSfx()}
                    onClick={() => setOpenTheme(activeKey)}
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: active.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2">{item.title}</span>
                      {item.domain && <span className="qw-hub-source mt-0.5 block text-gray-500">{item.domain}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="qw-hub-meta mt-3 text-[12px] text-gray-500">
            {card.fetchedAt ? `${t('updated', { time: timeFormatter.format(new Date(card.fetchedAt)) })} · ` : ''}
            {t('cadence')}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <SectionShield zone="unitas-shorts">
          <UnitasShortsPanel />
        </SectionShield>
      </div>

      <HubDeepModal theme={openTheme} onClose={() => setOpenTheme(null)} />
    </div>
  );
}

/** The theme deep dive -- twelve live headlines, refreshed every minute
 *  while open, with a visible countdown, source links and discovery links. */
function HubDeepModal({ theme, onClose }: { theme: HubThemeKey | null; onClose: () => void }) {
  const t = useTranslations('Rev19.hub');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();
  const feed = useHubHeadlines(theme, locale, theme ? HUB_MODAL_REFRESH_MS : undefined);
  const [seconds, setSeconds] = useState(HUB_MODAL_REFRESH_MS / 1000);
  const fetchedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!theme) return;
    const id = window.setInterval(() => {
      const base = feed.fetchedAt ?? fetchedRef.current ?? Date.now();
      const elapsed = Date.now() - base;
      setSeconds(Math.max(0, Math.ceil((HUB_MODAL_REFRESH_MS - (elapsed % HUB_MODAL_REFRESH_MS)) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [theme, feed.fetchedAt]);

  useEffect(() => {
    if (feed.fetchedAt) fetchedRef.current = feed.fetchedAt;
  }, [feed.fetchedAt]);

  const meta = theme ? findHubTheme(theme) : null;
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);
  const title = theme ? t(`themes.${theme}.title`) : '';

  return (
    <Modal open={theme !== null} onClose={onClose} labelledBy="hub-deep-title" size="xl">
      {theme && meta && (
        <div className="space-y-5" data-hub-modal={theme}>
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
