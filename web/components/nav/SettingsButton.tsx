'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { AccountSettingsModal } from '@/components/account/AccountSettingsModal';
import { AuthModal } from '@/components/auth/AuthModal';

/** Nav-bar gear icon -- always visible. Signed-out clicks prompt login instead of opening settings. Red dot flags an unverified phone. */
export function SettingsButton() {
  const t = useTranslations('Auth');
  const { session, profile } = useWallet();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('settingsLabel')}
        className="relative flex h-[52px] w-[52px] items-center justify-center border border-accent/50 bg-void/60 text-accent transition-all hover:bg-accent hover:text-void"
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
