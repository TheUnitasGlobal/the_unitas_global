'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface EmailVerifyPanelProps {
  email: string;
  /** 'signup' verifies a new-account email; 'signin' verifies an OTP login. */
  purpose: 'signup' | 'signin';
  onVerified: () => void;
  onBack?: () => void;
}

const INPUT_CLASS =
  'w-full border border-accent/30 bg-void px-3 py-2 text-sm tracking-[0.3em] text-white outline-none transition-colors focus:border-accent';

/**
 * 6-digit email OTP step. `verifyOtp({ type: 'signup' | 'email' })` confirms
 * the code Supabase Auth mailed. Success establishes a session (both flows),
 * after which the caller re-reads the profile / advances to phone verify.
 */
export function EmailVerifyPanel({ email, purpose, onVerified, onBack }: EmailVerifyPanelProps) {
  const t = useTranslations('Auth');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: purpose === 'signup' ? 'signup' : 'email',
    });
    setBusy(false);
    if (verifyError) {
      setError(t('errorCodeInvalid'));
      return;
    }
    onVerified();
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: purpose === 'signup' },
    });
    setBusy(false);
    if (resendError) setError(t('errorGeneric'));
    else setNotice(t('codeResentNotice'));
  }

  return (
    <div>
      <h3 className="mb-2 font-serif text-lg font-bold text-accent">{t('emailVerifyTitle')}</h3>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">
        {t('emailVerifyBody', { email })}
      </p>
      {notice && <p className="mb-3 text-xs text-neon">{notice}</p>}
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      <form onSubmit={handleVerify} className="space-y-3">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder={t('codeLabel')}
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={busy || code.length < 6}
          className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
        >
          {t('verifyButton')}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-[11px]">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-gray-500 transition-colors hover:text-gray-300"
          >
            {t('backButton')}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={busy}
          className="text-gray-400 transition-colors hover:text-accent disabled:opacity-50"
        >
          {t('resendCode')}
        </button>
      </div>
    </div>
  );
}
