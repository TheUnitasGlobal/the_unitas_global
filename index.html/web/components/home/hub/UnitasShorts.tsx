'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Eye, Flame, Heart, MessageCircle, Play, Radio, Sparkles, Tag, Ticket, Upload, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { OmniOpen } from '@/components/home/OmniOpen';
import { HubDot } from '@/components/home/hub/HubDot';
import { ShortsCreatorPass } from './ShortsCreatorPass';
import { hotNewsAxisMeta } from '@/lib/live/hotNewsAxes';
import type { HotNewsCategory } from '@/lib/live/hotNews';
import { textAnchor } from '@/lib/uai/deeperAnchor';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import {
  SHORTS_SEED,
  compactCount,
  readShortsPrefs,
  shortsByTheme,
  toggleMember,
  writeShortsPrefs,
  type ShortSeed,
  type ShortsPrefs,
} from '@/lib/live/shortsSeed';
import { PULSE_SLOT_MS, shortsPulseFeed, shortsPulseStats, shortsTrending } from '@/lib/square/shortsPulse';
import { hasHubSession, hubShortsSync, hubShortsToggle, isHubServerConfigured } from '@/lib/hub/hubLedger';

function posterStyle(short: ShortSeed): CSSProperties {
  return {
    background: `linear-gradient(160deg, hsl(${short.hue[0]} 70% 52%) 0%, hsl(${short.hue[1]} 80% 30%) 100%)`,
  };
}

type SortMode = 'trending' | 'catalogue';

/**
 * UNITAS Shorts -- retired in REV-20 §7.1, revived in REV-29 M4, and IGNITED
 * in REV-36 M3: every card now carries a LIVE view/like/watching count that
 * climbs with the 5-minute network pulse (lib/square/shortsPulse.ts,
 * deterministic, offline-identical), a Trending / Catalogue sort, and a rolling
 * pulse feed of likes/follows/watches from across the network. A signed-in
 * visitor's own likes/follows are durable (hub_shorts_*); a guest keeps this
 * device's toggles. The pulse is labelled as a simulation; the visitor's own
 * actions and the account ledger are the real part.
 */
export function UnitasShorts() {
  const t = useTranslations('Rev29.shorts');
  const t36 = useTranslations('Rev36');
  const tNews = useTranslations('HotNews');
  const tPass = useTranslations('Rev29.shorts.pass');
  const locale = useLocale();
  const lang = wikiLangFor(locale);
  const { playHoverSfx } = useSpatialAudio();
  const [prefs, setPrefs] = useState<ShortsPrefs>({ liked: [], followed: [] });
  const [openId, setOpenId] = useState<string | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [theme, setTheme] = useState<HotNewsCategory | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('trending');
  // `now` from a state initialiser (never render-time Date.now), refreshed
  // every pulse slot after mount so the counts breathe without a reload.
  const [now, setNow] = useState(() => Date.now());
  /** 'device' = this device only; 'account' = durable on the server. */
  const [ledger, setLedger] = useState<'device' | 'account'>('device');

  useEffect(() => {
    setPrefs(readShortsPrefs());
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), PULSE_SLOT_MS);
    return () => clearInterval(id);
  }, []);

  // Signed-in path: merge the account's durable toggles over this device's.
  useEffect(() => {
    if (!isHubServerConfigured()) return;
    let cancelled = false;
    void (async () => {
      if (!(await hasHubSession())) return;
      const res = await hubShortsSync();
      if (cancelled || !res.ok || !res.data) return;
      setLedger('account');
      setPrefs((prev) => ({
        liked: Array.from(new Set([...prev.liked, ...res.data!.liked])),
        followed: Array.from(new Set([...prev.followed, ...res.data!.followed])),
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(next: ShortsPrefs) {
    setPrefs(next);
    writeShortsPrefs(next);
  }

  /** Toggle a like/follow: optimistic locally, durable on the server, reverted on refusal. */
  const react = useCallback(
    (kind: 'like' | 'follow', target: string, nextList: string[], key: 'liked' | 'followed') => {
      const optimistic = { ...prefs, [key]: nextList } as ShortsPrefs;
      persist(optimistic);
      if (ledger !== 'account') return;
      void hubShortsToggle(kind, target).then((res) => {
        if (!res.ok) {
          // The server refused (offline, flood, invalid) -- put the device
          // copy back rather than pretend it stuck.
          setPrefs((cur) => {
            const reverted = { ...cur, [key]: toggleMember(cur[key], target) } as ShortsPrefs;
            writeShortsPrefs(reverted);
            return reverted;
          });
        }
      });
    },
    [prefs, ledger],
  );

  const themes = useMemo(() => Array.from(new Set(SHORTS_SEED.map((s) => s.theme))), []);
  const clips = useMemo(() => {
    const byTheme = shortsByTheme(theme);
    return sort === 'trending' ? shortsTrending(byTheme, now) : byTheme;
  }, [theme, sort, now]);
  const feed = useMemo(() => shortsPulseFeed(now, 8), [now]);
  const open = useMemo(() => SHORTS_SEED.find((s) => s.id === openId) ?? null, [openId]);

  function feedLabel(kind: 'like' | 'follow' | 'watch', handle: string, shortId: string): string {
    const clip = SHORTS_SEED.find((s) => s.id === shortId);
    const title = clip?.title ?? shortId;
    if (kind === 'follow') return t36('shorts.feedFollow', { handle, creator: clip?.handle ?? shortId });
    if (kind === 'watch') return t36('shorts.feedWatch', { handle, title });
    return t36('shorts.feedLike', { handle, title });
  }

  function renderToggles(short: ShortSeed, likes: number) {
    const liked = prefs.liked.includes(short.id);
    const followed = prefs.followed.includes(short.handle);
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="qw-pill-btn"
          data-on={liked ? '1' : '0'}
          aria-pressed={liked}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => react('like', short.id, toggleMember(prefs.liked, short.id), 'liked')}
          data-short-like=""
        >
          <Heart size={13} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
          {liked ? t('liked') : t('like')} · {compactCount(likes + (liked ? 1 : 0))}
        </button>
        <button
          type="button"
          className="qw-pill-btn"
          data-on={followed ? '1' : '0'}
          aria-pressed={followed}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => react('follow', short.handle, toggleMember(prefs.followed, short.handle), 'followed')}
          data-short-follow=""
        >
          <UserPlus size={13} aria-hidden="true" />
          {followed ? t('following') : t('follow')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full" data-unitas-shorts="">
      <div className="mb-1.5 flex flex-wrap items-center gap-3">
        <p className="qw-discovery-label mb-0 text-[15px] font-bold text-white">
          <Play size={16} aria-hidden="true" />
          {t('label')}
        </p>
        <button
          type="button"
          className="qw-pill-btn ml-auto"
          title={t('uploadSoon')}
          aria-label={`${t('upload')} · ${tPass('eyebrow')}`}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => setPassOpen(true)}
          data-shorts-upload=""
        >
          <Upload size={13} aria-hidden="true" />
          {t('upload')}
        </button>
      </div>
      <p className="qw-hub-meta mb-2 text-[12px] text-gray-500">{t('lede')}</p>

      {/* REV-36: the rolling network pulse feed -- likes / follows / watches. */}
      <div className="qw-shorts-pulse" data-shorts-pulse="" aria-live="polite">
        <p className="qw-shorts-pulse-head">
          <Radio size={12} aria-hidden="true" />
          {t36('shorts.feed')}
          <span className="qw-shorts-pulse-sim" data-shorts-pulse-sim="">
            {t36('pulse.sim')}
          </span>
        </p>
        <ul className="qw-shorts-pulse-list">
          {feed.map((e) => (
            <li key={e.id} className="qw-shorts-pulse-row" data-shorts-pulse-row={e.kind}>
              {e.kind === 'like' ? <Heart size={11} aria-hidden="true" /> : e.kind === 'follow' ? <UserPlus size={11} aria-hidden="true" /> : <Eye size={11} aria-hidden="true" />}
              <span>{feedLabel(e.kind, e.handle, e.shortId)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="qw-hub-tabs" role="tablist" aria-label={t36('shorts.trending')}>
          {(['trending', 'catalogue'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={sort === key}
              className="qw-hub-tab"
              data-shorts-sort={key}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setSort(key)}
            >
              {key === 'trending' ? <Flame size={12} aria-hidden="true" /> : null}
              {key === 'trending' ? t36('shorts.sortTrending') : t36('shorts.sortCatalogue')}
            </button>
          ))}
        </div>
        <span className="qw-hub-meta ml-auto text-[11px] text-gray-500" data-shorts-ledger={ledger}>
          {ledger === 'account' ? t36('shorts.account') : t36('shorts.device')}
        </span>
      </div>

      <div className="qw-hub-strip select-none mb-3" role="tablist" aria-label={t('filterAll')}>
        <button type="button" role="tab" aria-selected={theme === 'all'} data-active={theme === 'all' ? '1' : '0'} className="qw-hub-chip" onMouseEnter={() => playHoverSfx()} onClick={() => setTheme('all')}>
          <Tag size={15} aria-hidden="true" />
          {t('filterAll')}
        </button>
        {themes.map((key) => {
          const meta = hotNewsAxisMeta(key);
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={theme === key}
              data-active={theme === key ? '1' : '0'}
              className="qw-hub-chip"
              style={{ '--qw-hub-accent': meta.color } as CSSProperties}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setTheme(key)}
            >
              <HubDot color={meta.color} />
              {tNews(`category.${key}`)}
            </button>
          );
        })}
      </div>

      <div className="qw-shorts-rail" data-shorts-rail="">
        {clips.map((short) => {
          const stats = shortsPulseStats(short, now);
          const meta = hotNewsAxisMeta(short.theme);
          return (
            <button
              key={short.id}
              type="button"
              className="qw-short-card"
              style={posterStyle(short)}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setOpenId(short.id)}
              aria-label={t('openAria', { title: short.title })}
              data-short={short.id}
            >
              <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold backdrop-blur">
                <HubDot color={meta.color} size={7} />
                {tNews(`category.${short.theme}`)}
              </span>
              <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold backdrop-blur" data-short-watching="">
                <Eye size={11} aria-hidden="true" />
                {t36('shorts.watching', { count: compactCount(stats.watching) })}
              </span>
              <span className="qw-short-title">{short.title}</span>
              <span className="qw-short-meta">
                <span>@{short.handle}</span>
              </span>
              <span className="qw-short-meta">
                <span className="inline-flex items-center gap-1">
                  <Eye size={12} aria-hidden="true" />
                  {compactCount(stats.views)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart size={12} aria-hidden="true" />
                  {compactCount(stats.likes + (prefs.liked.includes(short.id) ? 1 : 0))}
                </span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className="u-wl-rail-card"
          onMouseEnter={() => playHoverSfx()}
          onClick={() => setPassOpen(true)}
          aria-label={tPass('cta')}
          data-shorts-pass-card=""
        >
          <span className="u-wl-rail-plus" aria-hidden="true">
            <Ticket size={18} />
          </span>
          <span className="u-wl-rail-sub">
            <Sparkles size={11} aria-hidden="true" style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            {tPass('eyebrow')}
          </span>
          <span className="u-wl-rail-title">{tPass('cta')}</span>
        </button>
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-widest text-gray-500">{t('seedNote')}</p>

      <ShortsCreatorPass open={passOpen} onClose={() => setPassOpen(false)} />

      <Modal open={open !== null} onClose={() => setOpenId(null)} labelledBy="unitas-short-title" size="lg">
        {open &&
          (() => {
            const stats = shortsPulseStats(open, now);
            const meta = hotNewsAxisMeta(open.theme);
            return (
              <div className="space-y-4" data-short-modal={open.id}>
                <div className="qw-short-poster qw-short-card w-full" style={posterStyle(open)} aria-hidden="true">
                  <span className="qw-short-title">{open.title}</span>
                </div>
                <div>
                  <p id="unitas-short-title" className="text-[19px] font-bold text-white">
                    {open.title}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-400">
                    <span>
                      {t('creator')} · @{open.handle}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <HubDot color={meta.color} />
                      {tNews(`category.${open.theme}`)}
                    </span>
                    <span>{t('views', { count: compactCount(stats.views) })}</span>
                    <span>{t('followers', { count: compactCount(stats.followers + (prefs.followed.includes(open.handle) ? 1 : 0)) })}</span>
                    <span className="inline-flex items-center gap-1" data-short-modal-watching="">
                      <Eye size={12} aria-hidden="true" />
                      {t36('shorts.watching', { count: compactCount(stats.watching) })}
                    </span>
                    <span className="inline-flex items-center gap-1" data-short-modal-momentum="">
                      <Flame size={12} aria-hidden="true" />
                      +{compactCount(stats.momentum)}
                    </span>
                  </p>
                </div>
                {renderToggles(open, stats.likes)}
                <div className="border-l-2 border-accent/40 pl-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-accent">
                    <MessageCircle size={13} aria-hidden="true" />
                    {t('share')}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-gray-300">{t('shareHint')}</p>
                </div>
                <OmniOpen anchor={textAnchor(open.title, lang)} host="newsRail" family="shorts" />
                <p className="text-[11px] uppercase tracking-widest text-gray-500">{t('seedNote')}</p>
              </div>
            );
          })()}
      </Modal>
    </div>
  );
}
