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
import { useWallet } from '@/components/wallet/WalletProvider';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { useShockwave } from '@/components/effects/Shockwave';

export function NavBar() {
  const t = useTranslations('Nav');
  const { session } = useWallet();
  const { playSpatialPing } = useSpatialAudio();
  const { trigger: triggerShockwave, element: shockwaveElement } = useShockwave();

  function handleScrollToFooter(e: MouseEvent<HTMLButtonElement>) {
    playSpatialPing(-0.6);
    triggerShockwave(e.clientX, e.clientY, '#00f3ff');
    document.getElementById('site-footer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b border-accent/20 bg-void/80 px-4 py-4 backdrop-blur-md sm:px-6">
      {shockwaveElement}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <Globe size={26} className="globe-rainbow shrink-0" aria-hidden="true" />
          <span className="hidden font-serif text-[26px] font-bold leading-none tracking-widest text-accent sm:inline">
            UNITAS
          </span>
        </Link>
        <button
          type="button"
          onClick={handleScrollToFooter}
          aria-label={t('scrollToFooter')}
          className="text-sm font-bold leading-none tracking-[0.5em] text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
        >
          ···
        </button>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <SoundToggle />
        <CoinBalanceBadge />
        <LanguageSwitcher />
        <AuthButton />
        {session && <SettingsButton />}
      </div>
    </nav>
  );
}
