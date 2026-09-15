'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Copy, ExternalLink, Link2, Mail, Share2 } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { EMAIL_SHORTCUTS, SOCIAL_SHORTCUTS, type DirectAppShortcut } from '@/lib/appShortcuts';

const SITE = 'https://www.theunitas.global';

/** Pure: the visitor's own-language home URL. */
export function unitasShareUrl(locale: string, origin?: string): string {
  const base = (origin && /^https?:\/\//.test(origin) ? origin : SITE).replace(/\/$/, '');
  return locale === 'en' ? `${base}/` : `${base}/${locale}`;
}

interface ShareTarget {
  key: string;
  brand: string;
  color: string;
  href: (url: string, text: string) => string;
}

/** Login-free share intents -- plain links, no SDK, no logo (§12.4). */
export const SHARE_TARGETS: readonly ShareTarget[] = [
  { key: 'x', brand: 'X', color: '#e5e7eb', href: (u, t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { key: 'facebook', brand: 'Facebook', color: '#1877f2', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: 'linkedin', brand: 'LinkedIn', color: '#0a66c2', href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { key: 'threads', brand: 'Threads', color: '#e5e7eb', href: (u, t) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${t} ${u}`)}` },
  { key: 'telegram', brand: 'Telegram', color: '#229ed9', href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: 'whatsapp', brand: 'WhatsApp', color: '#25d366', href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { key: 'reddit', brand: 'Reddit', color: '#ff4500', href: (u, t) => `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}` },
];

/**
 * REV-29 MISSION 4 -- 소셜 미디어 inside the hub: one-tap UNITAS sharing
 * (the device's own share sheet when it has one, seven login-free intents
 * and a copy-link), then the world's social and mail apps as direct
 * launchers -- the same registry the shortcut matrix uses
 * (lib/appShortcuts.ts). Every tile opens the vendor's own page in a new
 * tab; nothing is linked, stored or fetched.
 */
export function SocialHub() {
  const t = useTranslations('Rev29.social');
  const locale = useLocale();
  const { playHoverSfx, playQuestEnterSfx } = useSpatialAudio();
  const [url, setUrl] = useState(() => unitasShareUrl(locale));
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);

  useEffect(() => {
    setUrl(unitasShareUrl(locale, window.location.origin));
    setNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, [locale]);

  const text = t('shareText');

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      playQuestEnterSfx();
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked -- the visible link stays selectable
    }
  }, [url, playQuestEnterSfx]);

  const shareNative = useCallback(async () => {
    try {
      await navigator.share({ title: 'UNITAS', text, url });
      playQuestEnterSfx();
    } catch {
      // dismissed
    }
  }, [text, url, playQuestEnterSfx]);

  function tile(app: DirectAppShortcut) {
    return (
      <a
        key={app.key}
        href={app.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="qw-social-tile"
        style={{ '--qw-hub-accent': app.color, '--qw-hub-glow': app.glow } as CSSProperties}
        onMouseEnter={() => playHoverSfx()}
        data-social-app={app.key}
      >
        <span className="qw-social-glyph" aria-hidden="true">
          <app.icon size={18} />
        </span>
        <span className="qw-social-brand">{app.brand}</span>
        <ExternalLink size={10} className="opacity-60" aria-hidden="true" />
      </a>
    );
  }

  return (
    <div className="qw-social" data-hub-social="">
      <p className="qw-hub-meta text-[13px] text-gray-400">{t('lede')}</p>

      <section className="mt-3" data-hub-share="">
        <p className="qw-section-label flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
          <Share2 size={13} aria-hidden="true" />
          {t('share')}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-gray-400">
          <Link2 size={12} aria-hidden="true" />
          <span className="min-w-0 truncate" data-hub-share-url="">
            {url}
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {native && (
            <button type="button" className="qw-pill-btn" data-on="1" onMouseEnter={() => playHoverSfx()} onClick={() => void shareNative()} data-hub-share-native="">
              <Share2 size={13} aria-hidden="true" />
              {t('native')}
            </button>
          )}
          <button type="button" className="qw-pill-btn" data-on={copied ? '1' : '0'} onMouseEnter={() => playHoverSfx()} onClick={() => void copy()} data-hub-share-copy="">
            <Copy size={13} aria-hidden="true" />
            {copied ? t('copied') : t('copy')}
          </button>
          {SHARE_TARGETS.map((target) => (
            <a
              key={target.key}
              href={target.href(url, text)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="qw-pill-btn"
              style={{ '--qw-hub-accent': target.color } as CSSProperties}
              onMouseEnter={() => playHoverSfx()}
              data-hub-share-target={target.key}
            >
              {target.brand}
              <ExternalLink size={10} className="opacity-60" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <section className="mt-4" data-hub-social-apps="">
        <p className="qw-section-label flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
          <Share2 size={13} aria-hidden="true" />
          {t('apps')}
        </p>
        <div className="qw-social-grid mt-2">{SOCIAL_SHORTCUTS.map(tile)}</div>
      </section>

      <section className="mt-4" data-hub-mail-apps="">
        <p className="qw-section-label flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
          <Mail size={13} aria-hidden="true" />
          {t('mail')}
        </p>
        <div className="qw-social-grid mt-2">{EMAIL_SHORTCUTS.map(tile)}</div>
      </section>
    </div>
  );
}
