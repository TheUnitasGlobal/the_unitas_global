'use client';

import { useTranslations } from 'next-intl';
import { LogIn, LogOut } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { AuthModal } from '@/components/auth/AuthModal';
import { useGatedSurface } from '@/components/ui/UIGateProvider';

/** Nav-bar Login/Logout control -- opens AuthModal when signed out, signs out directly when signed in. */
export function AuthButton() {
  const t = useTranslations('Auth');
  const { session, configured } = useWallet();
  const { open, setOpen, blocked } = useGatedSurface('nav:auth', { lockScroll: true });

  async function handleLogout() {
    await getSupabaseBrowserClient().auth.signOut();
  }

  return (
    <>
      <button
        type="button"
        disabled={!configured || (blocked && !session)}
        onClick={() => (session ? handleLogout() : setOpen(true))}
        title={!configured ? t('unavailable') : undefined}
        className="flex items-center gap-2 py-2 text-sm font-bold uppercase tracking-widest text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-accent/60"
      >
        {session ? <LogOut size={26} /> : <LogIn size={26} />}
        <span className="hidden sm:inline">{session ? t('logout') : t('login')}</span>
      </button>
      {configured && <AuthModal open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
