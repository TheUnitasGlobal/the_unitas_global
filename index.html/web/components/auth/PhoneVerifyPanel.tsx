'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface PhoneVerifyPanelProps {
  initialPhone?: string;
  onVerified: () => void;
  onSkip?: () => void;
}

const INPUT_CLASS =
  'w-full border border-accent/30 bg-void px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent';

/**
 * Shared phone-OTP step: `updateUser({ phone })` triggers Supabase's SMS
 * OTP, `verifyOtp({ type: 'phone_change' })` confirms it. Actual
 * verification/uniqueness is decided server-side (see
 * supabase/migrations/20260823000000_zero_trust_identity.sql's
 * handle_phone_verified trigger + the partial unique index) -- this panel
 * only surfaces whatever Supabase reports back. Reused by AuthModal
 * (signup) and AccountSettingsModal (change phone).
 */
export function PhoneVerifyPanel({ initialPhone = '', onVerified, onSkip }: PhoneVerifyPanelProps) {
  const t = useTranslations('Auth');
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'enter-phone' | 'enter-code'>('enter-phone');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: code, type: 'phone_change' });
    setBusy(false);
    if (verifyError) {
      const msg = verifyError.message.toLowerCase();
      setError(msg.includes('duplicate') || msg.includes('unique') ? t('errorPhoneTaken') : t('errorGeneric'));
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
          <input
            type="text"
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('codeLabel')}
            className={INPUT_CLASS}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
          >
            {t('verifyButton')}
          </button>
          <button
            type="button"
            onClick={() => setStage('enter-phone')}
            className="w-full text-center text-[11px] text-gray-400 transition-colors hover:text-accent"
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
