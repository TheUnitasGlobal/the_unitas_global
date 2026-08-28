'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useWallet } from '@/components/wallet/WalletProvider';
import { isPasswordValid } from '@/lib/passwordPolicy';
import {
  BLOOD_OPTIONS,
  EMPTY_COGNITIVE_PROFILE,
  GENDER_OPTIONS,
  MBTI_OPTIONS,
  validateCognitiveProfile,
  type CognitiveProfileInput,
} from '@/lib/profileFields';
import { PhoneVerifyPanel } from './PhoneVerifyPanel';
import { EmailVerifyPanel } from './EmailVerifyPanel';
import { PasswordChecklist } from './PasswordChecklist';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type IdentifierType = 'email' | 'phone';
type View =
  | { k: 'signin' }
  | { k: 'signup' }
  | { k: 'verify-email'; email: string; purpose: 'signup' | 'signin' }
  | { k: 'verify-phone'; phone: string };

const INPUT_CLASS =
  'w-full border border-accent/30 bg-void px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent disabled:opacity-50';

/** Normalises a user-typed phone to E.164-ish (+digits). Supabase wants the
 *  leading `+`; a bare local number is assumed already-international-less and
 *  passed through for Supabase to reject with a clear message. */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s()-]/g, '');
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  return trimmed.replace(/\D/g, '');
}

/**
 * Sign In / Sign Up / browse-as-guest entry point.
 *
 * - Google OAuth (needs the provider enabled project-side -- see
 *   docs/auth-provider-setup.md; a disabled provider is surfaced with a
 *   precise message instead of a generic failure).
 * - Email OR phone as the unique identifier, each with a 6-digit security
 *   code (email OTP / SMS OTP). Duplicate accounts are blocked by Supabase
 *   Auth itself (unique email/phone) plus the verified-phone unique index in
 *   the zero_trust_identity migration.
 * - Guest: a local-only identity (see lib/guestIdentity.ts), no network call.
 */
export function AuthModal({ open, onClose }: AuthModalProps) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const { session, profile, refreshProfile, startGuest } = useWallet();

  const [view, setView] = useState<View>({ k: 'signin' });
  const [idType, setIdType] = useState<IdentifierType>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profileInput, setProfileInput] = useState<CognitiveProfileInput>(EMPTY_COGNITIVE_PROFILE);
  const [showOptional, setShowOptional] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showPhoneVerify =
    Boolean(session) && profile !== null && profile.phone_verified === false;

  // Surface an OAuth round-trip error (`#error_description=...` in the URL).
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const desc = params.get('error_description') || params.get('error');
    if (desc) {
      setError(/not enabled|unsupported provider/i.test(desc) ? t('errorGoogleNotEnabled') : desc);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [open, t]);

  function setId(v: string) {
    if (idType === 'email') setEmail(v);
    else setPhone(v);
  }
  const idValue = idType === 'email' ? email : phone;

  function resetAndClose() {
    setError(null);
    setNotice(null);
    setPassword('');
    setProfileInput(EMPTY_COGNITIVE_PROFILE);
    setShowOptional(false);
    setView({ k: 'signin' });
    onClose();
  }

  const profileValidation = useMemo(
    () => validateCognitiveProfile(profileInput, { requireName: true }),
    [profileInput],
  );

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/${locale}` },
    });
    setBusy(false);
    if (oauthError) {
      setError(
        /not enabled|unsupported provider|provider/i.test(oauthError.message)
          ? t('errorGoogleNotEnabled')
          : t('errorGeneric'),
      );
    }
  }

  async function handlePasswordSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword(
      idType === 'email'
        ? { email: email.trim(), password }
        : { phone: normalizePhone(phone), password },
    );
    setBusy(false);
    if (signInError) setError(t('errorInvalidCredentials'));
  }

  async function handleSendLoginCode() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    if (idType === 'email') {
      const value = email.trim();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: value,
        options: { shouldCreateUser: false },
      });
      setBusy(false);
      if (otpError) {
        setError(/not found|no user|signups not allowed/i.test(otpError.message)
          ? t('errorNoSuchAccount')
          : t('errorSmsUnavailable'));
        return;
      }
      setView({ k: 'verify-email', email: value, purpose: 'signin' });
    } else {
      const value = normalizePhone(phone);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: value,
        options: { shouldCreateUser: false },
      });
      setBusy(false);
      if (otpError) {
        setError(/provider|sms/i.test(otpError.message)
          ? t('errorSmsUnavailable')
          : t('errorNoSuchAccount'));
        return;
      }
      setView({ k: 'verify-phone', phone: value });
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid(password)) {
      setError(t('errorPasswordWeak'));
      return;
    }
    const p = profileValidation.value;
    if (!profileValidation.ok || !p) {
      setError(t('errorProfileInvalid'));
      return;
    }

    const normalizedPhone = phone ? normalizePhone(phone) : '';
    const metadata: Record<string, string> = {};
    if (p.full_name) metadata.full_name = p.full_name;
    if (normalizedPhone) metadata.phone = normalizedPhone;
    if (p.nationality) metadata.nationality = p.nationality;
    if (p.gender) metadata.gender = p.gender;
    if (p.age != null) metadata.age = String(p.age);
    if (p.blood) metadata.blood = p.blood;
    if (p.mbti) metadata.mbti = p.mbti;
    if (p.iq != null) metadata.iq = String(p.iq);
    if (p.eq != null) metadata.eq = String(p.eq);

    setBusy(true);
    const supabase = getSupabaseBrowserClient();

    if (idType === 'email') {
      const value = email.trim();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: value,
        password,
        options: { data: metadata },
      });
      setBusy(false);
      if (signUpError) {
        setError(
          /already|registered|exists/i.test(signUpError.message)
            ? t('errorEmailTaken')
            : signUpError.message || t('errorGeneric'),
        );
        return;
      }
      if (data.session) {
        refreshProfile();
        resetAndClose();
      } else {
        setView({ k: 'verify-email', email: value, purpose: 'signup' });
      }
    } else {
      const value = normalizePhone(phone);
      const { error: signUpError } = await supabase.auth.signUp({
        phone: value,
        password,
        options: { data: { ...metadata, phone: value } },
      });
      setBusy(false);
      if (signUpError) {
        setError(
          /already|registered|exists|duplicate/i.test(signUpError.message)
            ? t('errorPhoneTaken')
            : /provider|sms/i.test(signUpError.message)
              ? t('errorSmsUnavailable')
              : signUpError.message || t('errorGeneric'),
        );
        return;
      }
      setView({ k: 'verify-phone', phone: value });
    }
  }

  function handleGuest() {
    startGuest();
    resetAndClose();
  }

  function handleVerified() {
    refreshProfile();
    resetAndClose();
  }

  // ---- render -------------------------------------------------------------

  let body: ReactNode;

  if (showPhoneVerify) {
    body = (
      <PhoneVerifyPanel
        initialPhone={phone || profile?.phone || ''}
        onVerified={handleVerified}
        onSkip={resetAndClose}
      />
    );
  } else if (view.k === 'verify-email') {
    body = (
      <EmailVerifyPanel
        email={view.email}
        purpose={view.purpose}
        onVerified={handleVerified}
        onBack={() => setView({ k: view.purpose === 'signup' ? 'signup' : 'signin' })}
      />
    );
  } else if (view.k === 'verify-phone') {
    body = (
      <PhoneVerifyPanel
        initialPhone={view.phone}
        purpose="signup"
        onVerified={handleVerified}
        onSkip={resetAndClose}
      />
    );
  } else {
    const isSignup = view.k === 'signup';
    body = (
      <>
        <h2 id="auth-modal-title" className="sr-only">
          {isSignup ? t('signUpTab') : t('signInTab')}
        </h2>

        <div className="mb-6 flex border-b border-accent/20">
          <button
            type="button"
            onClick={() => {
              setView({ k: 'signin' });
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${
              !isSignup ? 'border-b-2 border-accent text-accent' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t('signInTab')}
          </button>
          <button
            type="button"
            onClick={() => {
              setView({ k: 'signup' });
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${
              isSignup ? 'border-b-2 border-accent text-accent' : 'text-gray-500 hover:text-gray-300'
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
          className="mb-3 flex w-full items-center justify-center gap-2 border border-white/20 bg-white/5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10 disabled:opacity-50"
        >
          {t('continueWithGoogle')}
        </button>
        <button
          type="button"
          onClick={handleGuest}
          className="mb-4 flex w-full items-center justify-center gap-2 border border-accent/30 py-2.5 text-xs font-bold uppercase tracking-widest text-accent/80 transition-all hover:border-accent hover:text-accent"
        >
          {t('continueAsGuest')}
        </button>
        <div className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-500">
          <span className="h-px flex-1 bg-white/10" />
          {t('orDivider')}
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* identifier type toggle -- shared by sign-in and sign-up */}
        <div className="mb-3 flex gap-2">
          {(['email', 'phone'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setIdType(type);
                setError(null);
              }}
              className={`flex-1 border py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                idType === type
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-white/15 text-gray-500 hover:text-gray-300'
              }`}
            >
              {type === 'email' ? t('emailLabel') : t('phoneLabel')}
            </button>
          ))}
        </div>

        {isSignup ? (
          <form onSubmit={handleSignUp} className="space-y-3">
            <input
              type={idType === 'email' ? 'email' : 'tel'}
              required
              value={idValue}
              onChange={(e) => setId(e.target.value)}
              placeholder={idType === 'email' ? t('emailLabel') : t('phonePlaceholder')}
              className={INPUT_CLASS}
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordLabel')}
              className={INPUT_CLASS}
            />
            <PasswordChecklist value={password} />

            <input
              type="text"
              required
              value={profileInput.fullName}
              onChange={(e) => setProfileInput((s) => ({ ...s, fullName: e.target.value }))}
              placeholder={t('fullNameLabel')}
              className={INPUT_CLASS}
            />
            <p className="text-[10px] text-gray-600">{t('realNameLockNotice')}</p>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={14}
                max={120}
                value={profileInput.age}
                onChange={(e) => setProfileInput((s) => ({ ...s, age: e.target.value }))}
                placeholder={t('ageLabel')}
                className={INPUT_CLASS}
              />
              <select
                value={profileInput.gender}
                onChange={(e) => setProfileInput((s) => ({ ...s, gender: e.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="">{t('genderLabel')}</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {t(`gender.${g}`)}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={profileInput.nationality}
              onChange={(e) => setProfileInput((s) => ({ ...s, nationality: e.target.value }))}
              placeholder={t('nationalityLabel')}
              className={INPUT_CLASS}
            />

            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="flex w-full items-center justify-between border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-gray-200"
            >
              {t('optionalProfileToggle')}
              <ChevronDown
                size={14}
                className={`transition-transform ${showOptional ? 'rotate-180' : ''}`}
              />
            </button>
            {showOptional && (
              <div className="space-y-3 border border-white/10 border-t-0 p-3">
                <p className="text-[10px] leading-relaxed text-gray-600">{t('optionalProfileHint')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={profileInput.blood}
                    onChange={(e) => setProfileInput((s) => ({ ...s, blood: e.target.value }))}
                    className={INPUT_CLASS}
                  >
                    <option value="">{t('bloodLabel')} · {t('undisclosed')}</option>
                    {BLOOD_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <select
                    value={profileInput.mbti}
                    onChange={(e) => setProfileInput((s) => ({ ...s, mbti: e.target.value }))}
                    className={INPUT_CLASS}
                  >
                    <option value="">{t('mbtiLabel')} · {t('undisclosed')}</option>
                    {MBTI_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={40}
                    max={200}
                    value={profileInput.iq}
                    onChange={(e) => setProfileInput((s) => ({ ...s, iq: e.target.value }))}
                    placeholder={`${t('iqLabel')} · ${t('undisclosed')}`}
                    className={INPUT_CLASS}
                  />
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={profileInput.eq}
                    onChange={(e) => setProfileInput((s) => ({ ...s, eq: e.target.value }))}
                    placeholder={`${t('eqLabel')} · ${t('undisclosed')}`}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-gray-500">{t('signUpNotice')}</p>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
            >
              {t('signUpButton')}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSignIn} className="space-y-3">
            <input
              type={idType === 'email' ? 'email' : 'tel'}
              required
              value={idValue}
              onChange={(e) => setId(e.target.value)}
              placeholder={idType === 'email' ? t('emailLabel') : t('phonePlaceholder')}
              className={INPUT_CLASS}
            />
            <input
              type="password"
              required
              autoComplete="current-password"
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
            <button
              type="button"
              onClick={handleSendLoginCode}
              disabled={busy || idValue.trim().length < 3}
              className="w-full text-center text-[11px] text-gray-400 transition-colors hover:text-accent disabled:opacity-40"
            >
              {t('signInWithCodeLink')}
            </button>
          </form>
        )}
      </>
    );
  }

  return (
    <Modal open={open} onClose={resetAndClose} labelledBy="auth-modal-title" size="lg">
      {body}
    </Modal>
  );
}
