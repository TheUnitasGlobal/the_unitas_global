'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface PhoneVerifyPanelProps {
  initialPhone?: string;
  /**
   * 'change' (default): `updateUser({ phone })` sends the OTP, verified with
   *   `type: 'phone_change'` -- used when adding/changing a phone on an
   *   existing session (signup step 2, Account settings).
   * 'signup': the OTP was already sent by `signUp({ phone })`; skip straight
   *   to the code entry and verify with `type: 'sms'`.
   */
  purpose?: 'change' | 'signup';
  onVerified: () => void;
  onSkip?: () => void;
}

const INPUT_CLASS =
  'w-full border border-accent/30 bg-void px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent';

/**
 * Phone-OTP step. Actual verification/uniqueness is decided server-side (see
 * supabase/migrations/20260823000000_zero_trust_identity.sql: the
 * handle_phone_verified trigger + the partial unique index) -- this panel only
 * surfaces whatever Supabase reports back. Reused by AuthModal (signup) and
 * AccountSettingsModal (change phone).
 */
export function PhoneVerifyPanel({
  initialPhone = '',
  purpose = 'change',
  onVerified,
  onSkip,
}: PhoneVerifyPanelProps) {
  const t = useTranslations('Auth');
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'enter-phone' | 'enter-code'>(
    purpose === 'signup' ? 'enter-code' : 'enter-phone',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (purpose === 'signup') setStage('enter-code');
  }, [purpose]);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: sendError } = await supabase.auth.updateUser({ phone });
    setBusy(false);
    if (sendError) {
      const msg = sendError.message.toLowerCase();
      setError(msg.includes('sms') || msg.includes('provider') ? t('errorSmsUnavailable') : sendError.message);
      return;
    }
    setStage('enter-code');
  }

  async function handleResend() {
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: resendError } =
      purpose === 'signup'
        ? await supabase.auth.signInWithOtp({ phone })
        : await supabase.auth.updateUser({ phone });
    setBusy(false);
    if (resendError) {
      const msg = resendError.message.toLowerCase();
      setError(
        msg.includes('sms') || msg.includes('provider')
          ? t('errorSmsUnavailable')
          : resendError.message,
      );
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code.trim(),
      type: purpose === 'signup' ? 'sms' : 'phone_change',
    });
    setBusy(false);
    if (verifyError) {
      const msg = verifyError.message.toLowerCase();
      setError(
        msg.includes('duplicate') || msg.includes('unique') || msg.includes('registered')
          ? t('errorPhoneTaken')
          : t('errorCodeInvalid'),
      );
      return;
    }
    onVerified();
  }

  return (
    <div>
      <h3 className="mb-2 font-serif text-lg font-bold text-accent">{t('phoneVerifyTitle')}</h3>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">{t('phoneVerifyBody')}</p>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {stage === 'enter-phone' ? (
        <form onSubmit={handleSendCode} className="space-y-3">
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('phonePlaceholder')}
            className={INPUT_CLASS}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
          >
            {t('sendCodeButton')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          {purpose === 'signup' && (
            <p className="text-[11px] text-gray-500">{t('phoneCodeSentTo', { phone })}</p>
          )}
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
          <button
            type="button"
            onClick={handleResend}
            disabled={busy}
            className="w-full text-center text-[11px] text-gray-400 transition-colors hover:text-accent disabled:opacity-50"
          >
            {t('resendCode')}
          </button>
        </form>
      )}

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 w-full text-center text-[11px] text-gray-500 transition-colors hover:text-gray-300"
        >
          {t('skipForNow')}
        </button>
      )}
    </div>
  );
}
