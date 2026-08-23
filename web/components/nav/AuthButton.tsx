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

  if (!configured) return null;

  async function handleLogout() {
    await getSupabaseBrowserClient().auth.signOut();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (session ? handleLogout() : setOpen(true))}
        className="flex items-center gap-1.5 border border-accent/50 bg-void/60 px-3 py-2 text-xs font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void"
      >
        {session ? <LogOut size={15} /> : <LogIn size={15} />}
        <span className="hidden sm:inline">{session ? t('logout') : t('login')}</span>
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
