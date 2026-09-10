'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Eye, Heart, MessageCircle, Play, Upload, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { DiscoveryLinks } from '@/components/home/DiscoveryLinks';
import { findHubTheme } from '@/lib/live/hubThemes';
import {
  SHORTS_SEED,
  compactCount,
  readShortsPrefs,
  shortStats,
  toggleMember,
  writeShortsPrefs,
  type ShortSeed,
  type ShortsPrefs,
} from '@/lib/live/shortsSeed';

function posterStyle(short: ShortSeed) {
  return {
    background: `linear-gradient(160deg, hsl(${short.hue[0]} 70% 52%) 0%, hsl(${short.hue[1]} 80% 30%) 100%)`,
  };
}

/**
 * REV-19 §8 -- UNITAS Shorts: the vertical-video sharing UI (views, likes,
 * follows, share-to-U-Messenger) that seeds the U-Messenger ecosystem.
 * Honest posture: the rail is a labelled SEED catalogue with deterministic
 * counters (lib/live/shortsSeed.ts) and per-device like / follow toggles;
 * the upload CTA says plainly that uploads open with the U-Messenger beta.
 * A card opens the short's deep modal (a level on the deep modal history
 * stack) with the poster, counters, the toggles and outbound discovery
 * links for its theme.
 */
export function UnitasShortsPanel() {
  const t = useTranslations('Rev19.shorts');
  const tHub = useTranslations('Rev19.hub');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();
  const [prefs, setPrefs] = useState<ShortsPrefs>({ liked: [], followed: [] });
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(readShortsPrefs());
  }, []);

  function update(next: ShortsPrefs) {
    setPrefs(next);
    writeShortsPrefs(next);
  }

  const open = useMemo(() => SHORTS_SEED.find((s) => s.id === openId) ?? null, [openId]);

  function renderToggles(short: ShortSeed, stats: ReturnType<typeof shortStats>) {
    const liked = prefs.liked.includes(short.id);
    const followed = prefs.followed.includes(short.handle);
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="qw-pill-btn border border-white/20 text-gray-200"
          data-on={liked ? '1' : '0'}
          aria-pressed={liked}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => update({ ...prefs, liked: toggleMember(prefs.liked, short.id) })}
        >
          <Heart size={13} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
          {liked ? t('liked') : t('like')} · {compactCount(stats.likes + (liked ? 1 : 0))}
        </button>
        <button
          type="button"
          className="qw-pill-btn border border-white/20 text-gray-200"
          data-on={followed ? '1' : '0'}
          aria-pressed={followed}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => update({ ...prefs, followed: toggleMember(prefs.followed, short.handle) })}
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
          className="qw-pill-btn ml-auto border border-white/20 text-gray-200"
          title={t('uploadSoon')}
          aria-label={t('uploadSoon')}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => undefined}
        >
          <Upload size={13} aria-hidden="true" />
          {t('upload')}
        </button>
      </div>
      <p className="qw-hub-meta mb-3 text-[12px] text-gray-500">{t('lede')}</p>

      <div className="qw-shorts-rail">
        {SHORTS_SEED.map((short) => {
          const stats = shortStats(short);
          const theme = findHubTheme(short.theme);
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
                <theme.icon size={11} aria-hidden="true" />
                {tHub(`themes.${short.theme}.title`)}
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
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-widest text-gray-600">{t('seedNote')}</p>

      <Modal open={open !== null} onClose={() => setOpenId(null)} labelledBy="unitas-short-title" size="lg">
        {open &&
          (() => {
            const stats = shortStats(open);
            const theme = findHubTheme(open.theme);
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
                      <theme.icon size={12} style={{ color: theme.color }} aria-hidden="true" />
                      {tHub(`themes.${open.theme}.title`)}
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
                <DiscoveryLinks subject={open.title} locale={locale} />
                <p className="text-[11px] uppercase tracking-widest text-gray-600">{t('seedNote')}</p>
              </div>
            );
          })()}
      </Modal>
    </div>
  );
}
