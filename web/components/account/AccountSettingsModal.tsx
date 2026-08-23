'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useWallet } from '@/components/wallet/WalletProvider';
import { PhoneVerifyPanel } from '@/components/auth/PhoneVerifyPanel';

interface AccountSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'security' | 'danger';

const INPUT_CLASS =
  'w-full border border-accent/30 bg-void px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent';

/** Gear-icon modal: edit profile fields, change password/phone, delete (soft) account. */
export function AccountSettingsModal({ open, onClose }: AccountSettingsModalProps) {
  const t = useTranslations('Account');
  const { session, profile, refreshProfile } = useWallet();
  const [tab, setTab] = useState<Tab>('profile');
  const [changingPhone, setChangingPhone] = useState(false);

  const [fullName, setFullName] = useState('');
  const [nationality, setNationality] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [blood, setBlood] = useState('');
  const [mbti, setMbti] = useState('');
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(profile && !profile.phone_verified ? 'security' : 'profile');
    setChangingPhone(false);
    setFullName(profile?.full_name ?? '');
    setNationality(profile?.nationality ?? '');
    setGender(profile?.gender ?? '');
    setAge(profile?.age != null ? String(profile.age) : '');
    setBlood(profile?.blood ?? '');
    setMbti(profile?.mbti ?? '');
    setProfileNotice(null);
    setPasswordNotice(null);
    setDeleteError(null);
    setConfirmText('');
  }, [open, profile]);

  function tabLabel(key: Tab) {
    return key === 'profile' ? t('tabProfile') : key === 'security' ? t('tabSecurity') : t('tabDanger');
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setProfileBusy(true);
    setProfileNotice(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        nationality: nationality || null,
        gender: gender || null,
        age: age ? Number(age) : null,
        blood: blood || null,
        mbti: mbti || null,
      })
      .eq('id', session.user.id);
    setProfileBusy(false);
    if (!error) {
      setProfileNotice(t('savedNotice'));
      refreshProfile();
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordNotice(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    if (!error) {
      setPasswordNotice(t('passwordUpdatedNotice'));
      setNewPassword('');
    }
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

  return (
    <Modal open={open} onClose={onClose} labelledBy="account-settings-title">
      <h2 id="account-settings-title" className="mb-6 font-serif text-lg font-bold text-accent">
        {t('settingsTitle')}
      </h2>

      <div className="mb-6 flex border-b border-accent/20">
        {(['profile', 'security', 'danger'] as const).map((tabKey) => (
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

      {tab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-3">
          {profileNotice && <p className="text-xs text-neon">{profileNotice}</p>}
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('fullNameLabel')} className={INPUT_CLASS} />
          <input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder={t('nationalityLabel')} className={INPUT_CLASS} />
          <input value={gender} onChange={(e) => setGender(e.target.value)} placeholder={t('genderLabel')} className={INPUT_CLASS} />
          <input
            type="number"
            min={0}
            max={150}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder={t('ageLabel')}
            className={INPUT_CLASS}
          />
          <input value={blood} onChange={(e) => setBlood(e.target.value)} placeholder={t('bloodLabel')} className={INPUT_CLASS} />
          <input value={mbti} onChange={(e) => setMbti(e.target.value)} placeholder={t('mbtiLabel')} className={INPUT_CLASS} />
          <button
            type="submit"
            disabled={profileBusy}
            className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
          >
            {t('saveButton')}
          </button>
        </form>
      )}

      {tab === 'security' &&
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
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {t('phoneSectionTitle')}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest ${
                    profile?.phone_verified ? 'text-neon' : 'text-red-400'
                  }`}
                >
                  {profile?.phone_verified ? t('phoneVerifiedBadge') : t('phoneUnverifiedBadge')}
                </span>
              </div>
              <p className="mb-3 text-sm text-gray-300">{profile?.phone || '—'}</p>
              <button
                type="button"
                onClick={() => setChangingPhone(true)}
                className="w-full border border-accent/40 py-2 text-[11px] font-bold uppercase tracking-widest text-accent transition-colors hover:border-accent"
              >
                {t('changePhoneButton')}
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 border-t border-white/10 pt-6">
              <span className="block text-xs font-bold uppercase tracking-widest text-gray-400">
                {t('passwordSectionTitle')}
              </span>
              {passwordNotice && <p className="text-xs text-neon">{passwordNotice}</p>}
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('newPasswordLabel')}
                className={INPUT_CLASS}
              />
              <button
                type="submit"
                disabled={passwordBusy}
                className="w-full bg-accent py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white disabled:opacity-50"
              >
                {t('changePasswordButton')}
              </button>
            </form>
          </div>
        ))}

      {tab === 'danger' && (
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
