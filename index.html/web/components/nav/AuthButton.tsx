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
 * - signed in  -> glass nickname chip (profile.full_name, or a fallback) + a
 *                 glassmorphism "Logout" button that ends the Supabase session
 * - guest      -> glass "GUEST-xxxxxx" chip + a glass "Exit guest" button
 * - signed out -> a single "Login" button that opens the AuthModal
 *
 * Owner instruction 2026-08-29: once logged in (real account OR guest) the top
 * "Login" label must become the visitor's nickname, with an always-available
 * logout control mounted beside it in the glassmorphism style.
 */
export function AuthButton() {
  const t = useTranslations('Auth');
  const { session, guest, profile, configured, endGuest } = useWallet();
  const { open, blocked, setOpen } = useGatedSurface('nav:auth', { lockScroll: true });

  async function handleLogout() {
    await getSupabaseBrowserClient().auth.signOut();
  }

  const identified = Boolean(session || guest);
  const nickname = session
    ? profile?.full_name?.trim() || t('memberFallback')
    : guest
      ? formatVirtualId(guest.virtualId)
      : '';

  if (identified) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="nav-glass inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-accent"
          title={nickname}
        >
          <UserRound size={16} aria-hidden="true" />
          <span className="max-w-[7.5rem] truncate sm:max-w-[11rem]">{nickname}</span>
        </span>
        <button
          type="button"
          onClick={session ? () => void handleLogout() : endGuest}
          title={session ? t('logout') : t('guestExitHint')}
          className="nav-glass inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-accent/70 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
        >
          <LogOut size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{session ? t('logout') : t('guestExit')}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={!configured}
        onClick={() => setOpen(true, { force: true })}
        title={!configured ? t('unavailable') : undefined}
        aria-disabled={blocked || undefined}
        className={`flex items-center gap-2 py-2 text-sm font-bold uppercase tracking-widest text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-accent/60 ${
          blocked ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        <LogIn size={26} aria-hidden="true" />
        <span className="hidden sm:inline">{t('login')}</span>
      </button>
      {configured && <AuthModal open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
