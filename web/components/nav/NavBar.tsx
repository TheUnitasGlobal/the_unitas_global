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
    if (canInstall) {
      void promptInstall();
      return;
    }
    setShowGuide(true);
  };

  const guideMessage = isIos
    ? t('appDownloadIosHint')
    : isDesktop
      ? t('appDownloadDesktopHint')
      : t('appDownloadUnsupported');

  return (
    <nav className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b border-accent/20 bg-void/80 px-4 py-5 backdrop-blur-md sm:px-6">
      <div className="relative flex items-center gap-3">
        <Link href="/" className="flex items-center">
          <img
            src="/assets/svg/unitas-mark.svg"
            alt="UNITAS"
            width={30}
            height={30}
            className="shrink-0 drop-shadow-[0_0_10px_rgba(212,175,55,0.45)]"
          />
        </Link>
        {!isInstalled && (
          <button
            type="button"
            aria-label={t('appDownloadAria')}
            onClick={handleAppDownloadClick}
            className="app-download-pulse flex items-center gap-1.5 rounded-full border-none bg-transparent px-3 py-1.5 sm:px-4"
          >
            <span className="font-serif text-[13px] font-bold uppercase leading-none tracking-[0.18em] text-accent sm:text-[15px]">
              UNITAS
            </span>
            <span className="hidden text-[11px] font-medium leading-none tracking-wide text-cyan-300/90 sm:inline">
              App Download
            </span>
          </button>
        )}
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
