'use client';

import { useTranslations } from 'next-intl';
import { LogIn, LogOut, UserRound } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { AuthModal } from '@/components/auth/AuthModal';
import { formatVirtualId } from '@/lib/guestIdentity';

/**
 * Nav-bar auth control. Three states:
 * - signed in  -> Logout (signs out directly)
 * - guest      -> shows "GUEST-xxxxxx", click ends the guest session
 * - signed out -> Login (opens AuthModal)
 */
export function AuthButton() {
  const t = useTranslations('Auth');
  const { session, guest, configured, endGuest } = useWallet();
  const { open, blocked, setOpen } = useGatedSurface('nav:auth', { lockScroll: true });

  async function handleLogout() {
    await getSupabaseBrowserClient().auth.signOut();
  }

  function handleClick() {
    if (session) {
      void handleLogout();
    } else if (guest) {
      endGuest();
    } else {
      setOpen(true, { force: true });
    }
  }

  const label = session
    ? t('logout')
    : guest
      ? formatVirtualId(guest.virtualId)
      : t('login');

  const icon = session ? <LogOut size={26} /> : guest ? <UserRound size={26} /> : <LogIn size={26} />;

  return (
    <>
      <button
        type="button"
        disabled={!configured && !guest}
        onClick={handleClick}
        title={!configured && !guest ? t('unavailable') : guest ? t('guestExitHint') : undefined}
        aria-disabled={blocked || undefined}
        className={`flex items-center gap-2 py-2 text-sm font-bold uppercase tracking-widest text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-accent/60 ${
          blocked ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
      {configured && <AuthModal open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
