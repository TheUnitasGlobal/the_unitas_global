'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SoundToggle } from '@/components/audio/SoundToggle';
import { usePwaInstall } from '@/lib/hooks/usePwaInstall';
import { Modal } from '@/components/ui/Modal';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AuthButton } from './AuthButton';
import { SettingsButton } from './SettingsButton';
import { CoinBalanceBadge } from '@/components/wallet/CoinBalanceBadge';

export function NavBar() {
  const t = useTranslations('Nav');
  const { canInstall, isInstalled, isIos, isDesktop, promptInstall } = usePwaInstall();
  const [showGuide, setShowGuide] = useState(false);

  const handleAppDownloadClick = () => {
    if (isInstalled) {
      setShowGuide(true);
      return;
    }
    if (canInstall) {
      void promptInstall();
      return;
    }
    setShowGuide(true);
  };

  const guideMessage = isInstalled
    ? t('appDownloadAlreadyInstalledHint')
    : isIos
      ? t('appDownloadIosHint')
      : isDesktop
        ? t('appDownloadDesktopHint')
        : t('appDownloadUnsupported');

  return (
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-accent/20 bg-void/80 py-5 backdrop-blur-md">
      <div className="nav-scroll flex items-center gap-6 overflow-x-auto px-4 lg:justify-between lg:gap-0 lg:overflow-x-visible lg:px-6">
        <div className="relative flex shrink-0 items-center gap-3">
          <Link href="/" className="flex items-center">
            <span className="logo-hologram shrink-0">
              <img src="/assets/svg/unitas-mark.svg" alt="UNITAS" width={30} height={30} />
            </span>
          </Link>
          <button
            type="button"
            aria-label={t('appDownloadAria')}
            onClick={handleAppDownloadClick}
            className="app-download-pulse flex min-w-0 flex-col items-start justify-center gap-0 rounded-xl border-none bg-transparent px-2.5 py-1 sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-1.5"
          >
            <span className="font-serif text-[10px] font-bold uppercase leading-tight tracking-[0.1em] text-accent sm:text-[15px] sm:leading-none sm:tracking-[0.18em]">
              UNITAS
            </span>
            <span className="text-[8px] font-medium uppercase leading-tight tracking-wide text-cyan-300/90 sm:text-[11px] sm:normal-case sm:leading-none">
              App Download
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-6 sm:gap-9">
          <SoundToggle />
          <CoinBalanceBadge />
          <LanguageSwitcher />
          <AuthButton />
          <SettingsButton />
        </div>
      </div>

      <Modal open={showGuide} onClose={() => setShowGuide(false)} labelledBy="app-download-guide-title">
        <h2
          id="app-download-guide-title"
          className="font-serif text-lg font-bold uppercase tracking-[0.18em] text-accent"
        >
          {t('appDownloadModalTitle')}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-gray-200">{guideMessage}</p>
      </Modal>
    </nav>
  );
}
