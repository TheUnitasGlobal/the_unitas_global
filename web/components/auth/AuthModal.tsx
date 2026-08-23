'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useWallet } from '@/components/wallet/WalletProvider';
import { PhoneVerifyPanel } from './PhoneVerifyPanel';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'signin' | 'signup';

const INPUT_CLASS =
  'w-full border border-accent/30 bg-void px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent';

/**
 * Multi-tab Sign In / Sign Up modal. Google OAuth + email/password on both
 * tabs; sign-up additionally collects a phone number and, once a session
 * exists, hands off to PhoneVerifyPanel -- mandatory per the 1-person /
 * 1-account policy (actually enforced server-side by spend_coins(), see
 * the zero_trust_identity migration; this UI step is the honest path to
 * it, not the enforcement itself).
 */
export function AuthModal({ open, onClose }: AuthModalProps) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const { session, profile, refreshProfile } = useWallet();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showPhoneVerify = Boolean(session) && profile !== null && profile.phone_verified === false;

  function resetAndClose() {
    setError(null);
    setNotice(null);
    setPassword('');
    onClose();
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/${locale}` },
    });
    setBusy(false);
    if (oauthError) setError(t('errorGoogleUnavailable'));
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) setError(t('errorInvalidCredentials'));
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message || t('errorGeneric'));
      return;
    }
    if (!data.session) {
      setNotice(t('checkEmailNotice'));
      setTab('signin');
    }
  }

  function handlePhoneVerified() {
    refreshProfile();
    resetAndClose();
  }

  return (
    <Modal open={open} onClose={resetAndClose} labelledBy="auth-modal-title">
      {showPhoneVerify ? (
        <PhoneVerifyPanel
          initialPhone={phone || profile?.phone || ''}
          onVerified={handlePhoneVerified}
          onSkip={resetAndClose}
        />
      ) : (
        <>
          <h2 id="auth-modal-title" className="sr-only">
            {tab === 'signin' ? t('signInTab') : t('signUpTab')}
          </h2>

          <div className="mb-6 flex border-b border-accent/20">
            <button
              type="button"
              onClick={() => setTab('signin')}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                tab === 'signin' ? 'border-b-2 border-accent text-accent' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t('signInTab')}
            </button>
            <button
              type="button"
              onClick={() => setTab('signup')}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                tab === 'signup' ? 'border-b-2 border-accent text-accent' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t('signUpTab')}
            </button>
          </div>

          {notice && <p className="mb-4 text-xs text-neon">{notice}</p>}
          {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="mb-4 flex w-full items-center justify-center gap-2 border border-white/20 bg-white/5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10 disabled:opacity-50"
          >
            {t('continueWithGoogle')}
          </button>
          <div className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-500">
            <span className="h-px flex-1 bg-white/10" />
            {t('orDivider')}
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailLabel')}
                className={INPUT_CLASS}
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordLabel')}
                className={INPUT_CLASS}
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
              >
                {t('signInButton')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('fullNameLabel')}
                className={INPUT_CLASS}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailLabel')}
                className={INPUT_CLASS}
              />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordLabel')}
                className={INPUT_CLASS}
              />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('phoneLabel')}
                className={INPUT_CLASS}
              />
              <p className="text-[11px] leading-relaxed text-gray-500">{t('signUpNotice')}</p>
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
              >
                {t('signUpButton')}
              </button>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
