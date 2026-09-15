'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Eye, Heart, MessageCircle, Play, Sparkles, Tag, Ticket, Upload, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { OmniOpen } from '@/components/home/OmniOpen';
import { ShortsCreatorPass } from './ShortsCreatorPass';
import { hotNewsAxisMeta } from '@/lib/live/hotNewsAxes';
import type { HotNewsCategory } from '@/lib/live/hotNews';
import { textAnchor } from '@/lib/uai/deeperAnchor';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import {
  SHORTS_SEED,
  compactCount,
  readShortsPrefs,
  shortStats,
  shortsByTheme,
  toggleMember,
  writeShortsPrefs,
  type ShortSeed,
  type ShortsPrefs,
} from '@/lib/live/shortsSeed';

function posterStyle(short: ShortSeed): CSSProperties {
  return {
    background: `linear-gradient(160deg, hsl(${short.hue[0]} 70% 52%) 0%, hsl(${short.hue[1]} 80% 30%) 100%)`,
  };
}

/**
 * UNITAS Shorts -- retired in REV-20 §7.1, REVIVED in REV-29 MISSION 4 and
 * moved into the UNITAS hub. The vertical-video sharing UI (views, likes,
 * follows, share-to-U-Messenger) that seeds the U-Messenger ecosystem.
 * Honest posture: the rail is a labelled SEED catalogue with deterministic
 * counters (lib/live/shortsSeed.ts) and per-device like / follow toggles;
 * the upload CTA and the rail-end card open the CREATOR PASS
 * (ShortsCreatorPass.tsx). A card opens the short's own popup (a level on
 * the deep modal history stack) with the poster, the counters, the toggles
 * and the direct shortcuts for its title. Clips are filed under the same 22
 * themes as the news rail and the chat rooms.
 */
export function UnitasShorts() {
  const t = useTranslations('Rev29.shorts');
  const tNews = useTranslations('HotNews');
  const tPass = useTranslations('Rev29.shorts.pass');
  const locale = useLocale();
  const lang = wikiLangFor(locale);
  const { playHoverSfx } = useSpatialAudio();
  const [prefs, setPrefs] = useState<ShortsPrefs>({ liked: [], followed: [] });
  const [openId, setOpenId] = useState<string | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [theme, setTheme] = useState<HotNewsCategory | 'all'>('all');

  useEffect(() => {
    setPrefs(readShortsPrefs());
  }, []);

  function update(next: ShortsPrefs) {
    setPrefs(next);
    writeShortsPrefs(next);
  }

  const themes = useMemo(() => Array.from(new Set(SHORTS_SEED.map((s) => s.theme))), []);
  const clips = useMemo(() => shortsByTheme(theme), [theme]);
  const open = useMemo(() => SHORTS_SEED.find((s) => s.id === openId) ?? null, [openId]);

  function renderToggles(short: ShortSeed, stats: ReturnType<typeof shortStats>) {
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
          onClick={() => update({ ...prefs, liked: toggleMember(prefs.liked, short.id) })}
          data-short-like=""
        >
          <Heart size={13} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
          {liked ? t('liked') : t('like')} · {compactCount(stats.likes + (liked ? 1 : 0))}
        </button>
        <button
          type="button"
          className="qw-pill-btn"
          data-on={followed ? '1' : '0'}
          aria-pressed={followed}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => update({ ...prefs, followed: toggleMember(prefs.followed, short.handle) })}
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
      <p className="qw-hub-meta mb-3 text-[12px] text-gray-500">{t('lede')}</p>

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
              <meta.icon size={15} style={{ color: meta.color }} aria-hidden="true" />
              {tNews(`category.${key}`)}
            </button>
          );
        })}
      </div>

      <div className="qw-shorts-rail" data-shorts-rail="">
        {clips.map((short) => {
          const stats = shortStats(short);
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
                <meta.icon size={11} aria-hidden="true" />
                {tNews(`category.${short.theme}`)}
              </span>
              <span className="absolute right-2.5 top-2.5 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold backdrop-blur">
                {t('duration', { seconds: short.duration })}
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
            const stats = shortStats(open);
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
                      <meta.icon size={12} style={{ color: meta.color }} aria-hidden="true" />
                      {tNews(`category.${open.theme}`)}
                    </span>
                    <span>{t('views', { count: compactCount(stats.views) })}</span>
                    <span>{t('followers', { count: compactCount(stats.followers + (prefs.followed.includes(open.handle) ? 1 : 0)) })}</span>
                  </p>
                </div>
                {renderToggles(open, stats)}
                <div className="border-l-2 border-accent/40 pl-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-accent">
                    <MessageCircle size={13} aria-hidden="true" />
                    {t('share')}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-gray-300">{t('shareHint')}</p>
                </div>
                <OmniOpen anchor={textAnchor(open.title, lang)} host="newsRail" />
                <p className="text-[11px] uppercase tracking-widest text-gray-500">{t('seedNote')}</p>
              </div>
            );
          })()}
      </Modal>
    </div>
  );
}
