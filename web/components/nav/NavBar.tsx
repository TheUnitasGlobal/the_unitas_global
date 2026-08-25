'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { SoundToggle } from '@/components/audio/SoundToggle';
import { usePwaInstall } from '@/lib/hooks/usePwaInstall';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AuthButton } from './AuthButton';
import { SettingsButton } from './SettingsButton';
import { CoinBalanceBadge } from '@/components/wallet/CoinBalanceBadge';

export function NavBar() {
  const t = useTranslations('Nav');
  const { canInstall, isInstalled, isIos, promptInstall } = usePwaInstall();
  const [showHint, setShowHint] = useState(false);

  const handleAppDownloadClick = () => {
    if (canInstall) {
      void promptInstall();
      return;
    }
    setShowHint(true);
    window.setTimeout(() => setShowHint(false), 6000);
  };

  return (
    <nav className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b border-accent/20 bg-void/80 px-4 py-5 backdrop-blur-md sm:px-6">
      <div className="relative flex items-center gap-3">
        <Link href="/" className="flex items-center">
          <Globe size={26} className="globe-rainbow shrink-0" aria-hidden="true" />
        </Link>
        {!isInstalled && (
          <button
            type="button"
            aria-label={t('appDownloadAria')}
            onClick={handleAppDownloadClick}
            className="app-download-pulse hidden items-center gap-1.5 rounded-full border-none bg-transparent px-4 py-1.5 sm:flex"
          >
            <span className="font-serif text-[15px] font-bold uppercase leading-none tracking-[0.18em] text-accent">
              UNITAS
            </span>
            <span className="text-[11px] font-medium leading-none tracking-wide text-cyan-300/90">
              App Download
            </span>
          </button>
        )}
        {showHint && (
          <div
            role="status"
            className="absolute left-0 top-full mt-2 w-64 rounded-lg border border-[rgba(212,175,55,0.35)] bg-void/95 px-4 py-3 text-xs leading-relaxed text-gray-200 shadow-[0_0_18px_rgba(212,175,55,0.25),0_0_10px_rgba(0,243,255,0.15)] backdrop-blur-md"
          >
            {isIos ? t('appDownloadIosHint') : t('appDownloadUnsupported')}
          </div>
        )}
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
