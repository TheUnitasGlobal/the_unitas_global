'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogIn, LogOut } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { AuthModal } from '@/components/auth/AuthModal';

/** Nav-bar Login/Logout control -- opens AuthModal when signed out, signs out directly when signed in. */
export function AuthButton() {
  const t = useTranslations('Auth');
  const { session, configured } = useWallet();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await getSupabaseBrowserClient().auth.signOut();
  }

  return (
    <>
      <button
        type="button"
        disabled={!configured}
        onClick={() => (session ? handleLogout() : setOpen(true))}
        title={!configured ? t('unavailable') : undefined}
        className="flex items-center gap-2 border border-accent/50 bg-void/60 px-5 py-3 text-base font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-void/60 disabled:hover:text-accent"
      >
        {session ? <LogOut size={26} /> : <LogIn size={26} />}
        <span className="hidden sm:inline">{session ? t('logout') : t('login')}</span>
      </button>
      {configured && <AuthModal open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
