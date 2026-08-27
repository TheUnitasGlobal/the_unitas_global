'use client';

import { useTranslations } from 'next-intl';
import { Settings } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { AccountSettingsModal } from '@/components/account/AccountSettingsModal';
import { AuthModal } from '@/components/auth/AuthModal';
import { useGatedSurface } from '@/components/ui/UIGateProvider';

/** Nav-bar gear icon -- always visible. Signed-out clicks prompt login instead of opening settings. Red dot flags an unverified phone. */
export function SettingsButton() {
  const t = useTranslations('Auth');
  const { session, profile } = useWallet();
  const { open, setOpen, blocked } = useGatedSurface('nav:settings', { lockScroll: true });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!blocked) setOpen(true);
        }}
        aria-label={t('settingsLabel')}
        aria-disabled={blocked}
        className={`relative flex h-11 w-11 items-center justify-center text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none ${
          blocked ? 'pointer-events-none opacity-40' : ''
        }`}
      >
        <Settings size={26} />
        {profile && !profile.phone_verified && (
          <span
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500"
            aria-hidden="true"
          />
        )}
      </button>
      {session ? (
        <AccountSettingsModal open={open} onClose={() => setOpen(false)} />
      ) : (
        <AuthModal open={open} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
