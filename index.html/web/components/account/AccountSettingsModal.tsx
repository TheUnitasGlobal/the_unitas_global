'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useWallet } from '@/components/wallet/WalletProvider';
import { PhoneVerifyPanel } from '@/components/auth/PhoneVerifyPanel';
import { PasswordChecklist } from '@/components/auth/PasswordChecklist';
import { isPasswordValid } from '@/lib/passwordPolicy';
import {
  BLOOD_OPTIONS,
  GENDER_OPTIONS,
  MBTI_OPTIONS,
  validateCognitiveProfile,
  type CognitiveProfileInput,
} from '@/lib/profileFields';

interface AccountSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'identity' | 'banking' | 'withdrawal';

const INPUT_CLASS =
  'w-full border border-accent/30 bg-void px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-50';
const LABEL_CLASS = 'block text-[10px] font-bold uppercase tracking-widest text-gray-500';

/**
 * Gear-icon dashboard: the three account-asset areas from the brief --
 * "로그인 및 개인정보 관리", "은행 및 인증 관리", "회원탈퇴 프로세스".
 * The real name is write-once (locked here and enforced by
 * protect_profile_realname() in the 20260901 migration); only the password is
 * ever editable among the identity-core fields.
 */
export function AccountSettingsModal({ open, onClose }: AccountSettingsModalProps) {
  const t = useTranslations('Account');
  const tAuth = useTranslations('Auth');
  const { session, profile, refreshProfile } = useWallet();
  const [tab, setTab] = useState<Tab>('identity');
  const [changingPhone, setChangingPhone] = useState(false);

  const [form, setForm] = useState<CognitiveProfileInput>({
    fullName: '',
    age: '',
    gender: '',
    nationality: '',
    blood: '',
    mbti: '',
    iq: '',
    eq: '',
  });
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const nameLocked = Boolean(profile?.full_name && profile.full_name.trim() !== '');
  const accountEmail = session?.user.email ?? null;
  const accountPhone = session?.user.phone ? `+${session.user.phone}` : profile?.phone ?? null;

  useEffect(() => {
    if (!open) return;
    setTab(profile && !profile.phone_verified ? 'banking' : 'identity');
    setChangingPhone(false);
    setForm({
      fullName: profile?.full_name ?? '',
      age: profile?.age != null ? String(profile.age) : '',
      gender: profile?.gender ?? '',
      nationality: profile?.nationality ?? '',
      blood: profile?.blood ?? '',
      mbti: profile?.mbti ?? '',
      iq: profile?.iq != null ? String(profile.iq) : '',
      eq: profile?.eq != null ? String(profile.eq) : '',
    });
    setProfileNotice(null);
    setProfileError(null);
    setPasswordNotice(null);
    setPasswordError(null);
    setNewPassword('');
    setDeleteError(null);
    setConfirmText('');
  }, [open, profile]);

  const validation = useMemo(
    () => validateCognitiveProfile(form, { requireName: !nameLocked }),
    [form, nameLocked],
  );

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setProfileError(null);
    setProfileNotice(null);
    const validated = validation.value;
    if (!validation.ok || !validated) {
      setProfileError(t('profileInvalid'));
      return;
    }
    setProfileBusy(true);
    const supabase = getSupabaseBrowserClient();
    // full_name is never sent once locked -- the DB trigger would revert it
    // anyway, but not sending it keeps the update honest.
    const { full_name, ...rest } = validated;
    const payload = nameLocked ? rest : { full_name, ...rest };
    const { error } = await supabase.from('profiles').update(payload).eq('id', session.user.id);
    setProfileBusy(false);
    if (error) {
      setProfileError(t('profileSaveError'));
      return;
    }
    setProfileNotice(t('savedNotice'));
    refreshProfile();
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);
    if (!isPasswordValid(newPassword)) {
      setPasswordError(tAuth('errorPasswordWeak'));
      return;
    }
    setPasswordBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    if (error) {
      setPasswordError(t('passwordChangeError'));
      return;
    }
    setPasswordNotice(t('passwordUpdatedNotice'));
    setNewPassword('');
  }

  async function handleDelete() {
    if (!session) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('delete failed');
      await getSupabaseBrowserClient().auth.signOut();
      onClose();
    } catch {
      setDeleteError(t('deleteError'));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!session) return null;

  const TABS: Tab[] = ['identity', 'banking', 'withdrawal'];
  const tabLabel = (key: Tab) =>
    key === 'identity' ? t('tabIdentity') : key === 'banking' ? t('tabBanking') : t('tabWithdrawal');

  return (
    <Modal open={open} onClose={onClose} labelledBy="account-settings-title" size="lg">
      <h2 id="account-settings-title" className="mb-6 font-serif text-lg font-bold text-accent">
        {t('settingsTitle')}
      </h2>

      <div className="mb-6 flex border-b border-accent/20">
        {TABS.map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={`flex-1 pb-3 text-[11px] font-bold uppercase tracking-widest transition-colors ${
              tab === tabKey ? 'border-b-2 border-accent text-accent' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tabLabel(tabKey)}
          </button>
        ))}
      </div>

      {tab === 'identity' && (
        <div className="space-y-6">
          {/* login identity (read-only) */}
          <div className="space-y-2">
            <span className={LABEL_CLASS}>{t('loginIdSection')}</span>
            <div className="flex items-center justify-between border border-white/10 bg-void/40 px-3 py-2 text-xs">
              <span className="text-gray-500">{tAuth('emailLabel')}</span>
              <span className="text-gray-200">{accountEmail || '—'}</span>
            </div>
            <div className="flex items-center justify-between border border-white/10 bg-void/40 px-3 py-2 text-xs">
              <span className="text-gray-500">{tAuth('phoneLabel')}</span>
              <span className="text-gray-200">{accountPhone || '—'}</span>
            </div>
          </div>

          {/* password */}
          <form onSubmit={handleChangePassword} className="space-y-3 border-t border-white/10 pt-6">
            <span className={LABEL_CLASS}>{t('passwordSectionTitle')}</span>
            {passwordNotice && <p className="text-xs text-neon">{passwordNotice}</p>}
            {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
            <input
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('newPasswordLabel')}
              className={INPUT_CLASS}
            />
            {newPassword.length > 0 && <PasswordChecklist value={newPassword} />}
            <button
              type="submit"
              disabled={passwordBusy}
              className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
            >
              {t('changePasswordButton')}
            </button>
          </form>

          {/* personal / cognitive profile */}
          <form onSubmit={handleSaveProfile} className="space-y-3 border-t border-white/10 pt-6">
            <span className={LABEL_CLASS}>{t('personalSection')}</span>
            {profileNotice && <p className="text-xs text-neon">{profileNotice}</p>}
            {profileError && <p className="text-xs text-red-400">{profileError}</p>}

            <label className={LABEL_CLASS}>
              {t('fullNameLabel')}
              <input
                value={form.fullName}
                disabled={nameLocked}
                onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                placeholder={t('fullNameLabel')}
                className={`mt-1 ${INPUT_CLASS}`}
              />
            </label>
            <p className="text-[10px] text-gray-600">
              {nameLocked ? t('realNameLocked') : t('realNameLockWarning')}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <label className={LABEL_CLASS}>
                {t('ageLabel')}
                <input
                  type="number"
                  min={14}
                  max={120}
                  value={form.age}
                  onChange={(e) => setForm((s) => ({ ...s, age: e.target.value }))}
                  className={`mt-1 ${INPUT_CLASS}`}
                />
              </label>
              <label className={LABEL_CLASS}>
                {t('genderLabel')}
                <select
                  value={form.gender}
                  onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
                  className={`mt-1 ${INPUT_CLASS}`}
                >
                  <option value="">{tAuth('undisclosed')}</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {tAuth(`gender.${g}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className={LABEL_CLASS}>
              {t('nationalityLabel')}
              <input
                value={form.nationality}
                onChange={(e) => setForm((s) => ({ ...s, nationality: e.target.value }))}
                className={`mt-1 ${INPUT_CLASS}`}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className={LABEL_CLASS}>
                {t('bloodLabel')}
                <select
                  value={form.blood}
                  onChange={(e) => setForm((s) => ({ ...s, blood: e.target.value }))}
                  className={`mt-1 ${INPUT_CLASS}`}
                >
                  <option value="">{tAuth('undisclosed')}</option>
                  {BLOOD_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL_CLASS}>
                {t('mbtiLabel')}
                <select
                  value={form.mbti}
                  onChange={(e) => setForm((s) => ({ ...s, mbti: e.target.value }))}
                  className={`mt-1 ${INPUT_CLASS}`}
                >
                  <option value="">{tAuth('undisclosed')}</option>
                  {MBTI_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL_CLASS}>
                {t('iqLabel')}
                <input
                  type="number"
                  min={40}
                  max={200}
                  value={form.iq}
                  onChange={(e) => setForm((s) => ({ ...s, iq: e.target.value }))}
                  placeholder={tAuth('undisclosed')}
                  className={`mt-1 ${INPUT_CLASS}`}
                />
              </label>
              <label className={LABEL_CLASS}>
                {t('eqLabel')}
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={form.eq}
                  onChange={(e) => setForm((s) => ({ ...s, eq: e.target.value }))}
                  placeholder={tAuth('undisclosed')}
                  className={`mt-1 ${INPUT_CLASS}`}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={profileBusy}
              className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
            >
              {t('saveButton')}
            </button>
          </form>
        </div>
      )}

      {tab === 'banking' &&
        (changingPhone ? (
          <PhoneVerifyPanel
            initialPhone={profile?.phone ?? ''}
            onVerified={() => {
              refreshProfile();
              setChangingPhone(false);
            }}
            onSkip={() => setChangingPhone(false)}
          />
        ) : (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={LABEL_CLASS}>{t('phoneSectionTitle')}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest ${
                    profile?.phone_verified ? 'text-neon' : 'text-red-400'
                  }`}
                >
                  {profile?.phone_verified ? t('phoneVerifiedBadge') : t('phoneUnverifiedBadge')}
                </span>
              </div>
              <p className="mb-3 text-sm text-gray-300">{accountPhone || '—'}</p>
              <button
                type="button"
                onClick={() => setChangingPhone(true)}
                className="w-full border border-accent/40 py-2 text-[11px] font-bold uppercase tracking-widest text-accent transition-colors hover:border-accent"
              >
                {profile?.phone_verified ? t('changePhoneButton') : t('verifyPhoneButton')}
              </button>
              <p className="mt-2 text-[10px] leading-relaxed text-gray-600">{t('phoneAuthNote')}</p>
            </div>

            <div className="border-t border-white/10 pt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className={LABEL_CLASS}>{t('bankSectionTitle')}</span>
                <span className="border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-amber-300">
                  {t('bankPending')}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-500">{t('bankSectionBody')}</p>
              <button
                type="button"
                disabled
                className="mt-3 w-full cursor-not-allowed border border-white/15 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500"
              >
                {t('bankConnectButton')}
              </button>
            </div>
          </div>
        ))}

      {tab === 'withdrawal' && (
        <div className="space-y-4 border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-bold text-red-400">{t('dangerTitle')}</p>
          <p className="text-xs leading-relaxed text-gray-400">{t('dangerBody')}</p>
          {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
          <label className="block text-[11px] uppercase tracking-widest text-gray-500">
            {t('dangerConfirmLabel')}
          </label>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={INPUT_CLASS} />
          <button
            type="button"
            disabled={confirmText !== 'DELETE' || deleteBusy}
            onClick={handleDelete}
            className="w-full border border-red-500 bg-red-500/10 py-2.5 text-xs font-bold uppercase tracking-widest text-red-400 transition-all hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('dangerConfirmButton')}
          </button>
        </div>
      )}
    </Modal>
  );
}
