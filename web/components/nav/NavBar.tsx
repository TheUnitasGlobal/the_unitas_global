'use client';

import type { MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { SoundToggle } from '@/components/audio/SoundToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AuthButton } from './AuthButton';
import { SettingsButton } from './SettingsButton';
import { CoinBalanceBadge } from '@/components/wallet/CoinBalanceBadge';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { useShockwave } from '@/components/effects/Shockwave';

export function NavBar() {
  const t = useTranslations('Nav');
  const { playSpatialPing } = useSpatialAudio();
  const { trigger: triggerShockwave, element: shockwaveElement } = useShockwave();

  function handleScrollToFooter(e: MouseEvent<HTMLButtonElement>) {
    playSpatialPing(-0.6);
    triggerShockwave(e.clientX, e.clientY, '#00f3ff');
    document.getElementById('site-footer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b border-accent/20 bg-void/80 px-4 py-5 backdrop-blur-md sm:px-6">
      {shockwaveElement}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center">
          <Globe size={26} className="globe-rainbow shrink-0" aria-hidden="true" />
        </Link>
        <button
          type="button"
          aria-label={t('appDownloadAria')}
          className="app-download-pulse hidden items-center gap-1.5 rounded-full border border-accent/35 bg-gradient-to-r from-accent/10 via-void/40 to-cyan-400/10 px-4 py-1.5 sm:flex"
        >
          <span className="font-serif text-[15px] font-bold uppercase leading-none tracking-[0.18em] text-accent">
            UNITAS
          </span>
          <span className="text-[11px] font-medium leading-none tracking-wide text-cyan-300/90">
            App Download
          </span>
        </button>
        <button
          type="button"
          onClick={handleScrollToFooter}
          aria-label={t('scrollToFooter')}
          className="text-[26px] font-bold leading-none tracking-[0.25em] text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
        >
          ···
        </button>
      </div>

      <div className="flex items-center gap-6 sm:gap-9">
        <SoundToggle />
        <CoinBalanceBadge />
        <LanguageSwitcher />
        <AuthButton />
        <SettingsButton />
      </div>
    </nav>
  );
}
