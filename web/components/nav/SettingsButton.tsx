'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { AccountSettingsModal } from '@/components/account/AccountSettingsModal';

/** Nav-bar gear icon -- only rendered when signed in. Red dot flags an unverified phone. */
export function SettingsButton() {
  const t = useTranslations('Auth');
  const { profile } = useWallet();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('settingsLabel')}
        className="relative flex h-[30px] w-[30px] items-center justify-center border border-accent/50 bg-void/60 text-accent transition-all hover:bg-accent hover:text-void"
      >
        <Settings size={14} />
        {profile && !profile.phone_verified && (
          <span
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500"
            aria-hidden="true"
          />
        )}
      </button>
      <AccountSettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
