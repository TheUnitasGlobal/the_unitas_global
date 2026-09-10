'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BadgeCheck, Clapperboard, Share2, Sparkles, Ticket } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { usePointerTilt } from '@/components/ui/usePointerTilt';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { normalizeHandle, validateHandle } from '@/lib/auth/unitasHandle';
import {
  SHORTS_PASS_METADATA_KEY,
  deviceSeed,
  passFromMetadata,
  passSerial,
  readShortsPass,
  writeShortsPass,
  type ShortsPass,
} from '@/lib/live/shortsPass';

interface ShortsCreatorPassProps {
  open: boolean;
  onClose: () => void;
}

const WAVES = ['wave1', 'wave2', 'wave3'] as const;
const PERKS = ['p1', 'p2', 'p3'] as const;

/**
 * REV-19 follow-up -- the UNITAS Shorts CREATOR PASS: a premium, layered
 * 3D-glass pre-reservation surface (app/waitlist.css) that replaces the
 * dead "Upload" tap. The visitor picks a creator handle and reserves a
 * numbered pass; the pass lives on this device and, when signed in, on the
 * account's `user_metadata` (no schema change). Honest by design: the copy
 * says plainly that uploads open with the U-Messenger beta and that no
 * video is stored yet. Opens as a level on the deep modal history stack.
 */
export function ShortsCreatorPass({ open, onClose }: ShortsCreatorPassProps) {
  const t = useTranslations('Rev19.shorts.pass');
  const tMail = useTranslations('Rev19.mail');
  const locale = useLocale();
  const { session, refreshProfile } = useWallet();
  const { playHoverSfx, playVaultSfx } = useSpatialAudio();
  const tilt = usePointerTilt(6);
  const [handle, setHandle] = useState('');
  const [pass, setPass] = useState<ShortsPass | null>(null);
  const [busy, setBusy] = useState(false);
  const [bound, setBound] = useState(false);
  const serialPreview = useMemo(() => (open ? passSerial(deviceSeed()) : ''), [open]);

  useEffect(() => {
    if (!open) return;
    const local = readShortsPass();
    const remote = passFromMetadata(session?.user.user_metadata);
    const current = remote ?? local;
    setPass(current);
    setBound(Boolean(remote));
    if (current?.handle) setHandle(current.handle);
  }, [open, session]);

  const verdict = validateHandle(handle);
  const handleOk = verdict === 'ok';
  const sealed = pass !== null;
  const displayHandle = (sealed ? pass.handle : normalizeHandle(handle)) || t('handlePlaceholder');

  async function reserve() {
    if (!handleOk || busy) return;
    setBusy(true);
    const next: ShortsPass = { handle: normalizeHandle(handle), at: Date.now(), serial: pass?.serial ?? serialPreview };
    writeShortsPass(next);
    setPass(next);
    playVaultSfx();
    if (session) {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.updateUser({ data: { [SHORTS_PASS_METADATA_KEY]: next } });
        if (!error) {
          setBound(true);
          void refreshProfile();
        }
      } catch {
        // the device copy stands; the account copy is retried on the next reserve
      }
    }
    setBusy(false);
  }

  const reservedAt = pass ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(pass.at)) : '';

  return (
    <Modal open={open} onClose={onClose} labelledBy="unitas-shorts-pass-title" size="lg">
      <div className="u-wl-scene" data-shorts-pass="">
        <div className="u-wl-card" {...tilt}>
          <div className="u-wl-card-inner">
            <span className="u-wl-orb" data-n="1" aria-hidden="true" />
            <span className="u-wl-orb" data-n="2" aria-hidden="true" />
            <span className="u-wl-orb" data-n="3" aria-hidden="true" />
            <div className="u-wl-card-body">
              <span className="u-wl-eyebrow">
                <Clapperboard size={13} aria-hidden="true" />
                {t('eyebrow')}
              </span>
              <h2 id="unitas-shorts-pass-title" className="u-wl-title">
                {t('title')}
              </h2>
              <p className="u-wl-lede">{t('lede')}</p>

              <div className="u-wl-ticket" data-sealed={sealed ? '1' : '0'}>
                <span className="u-wl-seal">
                  <BadgeCheck size={12} aria-hidden="true" />
                  {t('reserved')}
                </span>
                <div>
                  <div className="u-wl-ticket-handle">@{displayHandle}</div>
                  <div className="u-wl-ticket-sub">
                    {sealed ? t('reservedAt', { time: reservedAt }) : t('currentWave')}
                    {sealed && (bound ? ` · ${t('signedIn')}` : '')}
                  </div>
                </div>
                <span className="u-wl-serial">
                  <Ticket size={12} aria-hidden="true" style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                  {t('serial', { serial: pass?.serial ?? serialPreview })}
                </span>
              </div>

              <div className="u-wl-waves" role="list">
                {WAVES.map((wave, i) => (
                  <div key={wave} className="u-wl-wave" role="listitem" data-active={i === 0 ? '1' : '0'}>
                    {t(wave)}
                    {i === 0 && <span className="u-wl-wave-now">{t('currentWave')}</span>}
                  </div>
                ))}
              </div>

              <div className="u-wl-perks">
                {PERKS.map((perk, i) => (
                  <div key={perk} className="u-wl-perk">
                    <span className="u-wl-perk-dot" aria-hidden="true">
                      {i === 0 ? <Sparkles size={12} /> : i === 1 ? <BadgeCheck size={12} /> : <Share2 size={12} />}
                    </span>
                    {t(`perks.${perk}`)}
                  </div>
                ))}
              </div>

              <div className="u-wl-form">
                <label className="u-mail-label" htmlFor="unitas-shorts-handle">
                  {t('handleLabel')}
                </label>
                <div className="u-wl-input-row" data-state={verdict === 'ok' ? 'available' : verdict === 'empty' ? 'idle' : verdict}>
                  <span className="u-wl-at" aria-hidden="true">
                    @
                  </span>
                  <input
                    id="unitas-shorts-handle"
                    className="u-wl-input"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={32}
                    value={handle}
                    disabled={sealed}
                    placeholder={t('handlePlaceholder')}
                    onChange={(e) => setHandle(e.target.value)}
                    aria-invalid={verdict === 'invalid' || verdict === 'reserved'}
                  />
                </div>
                <p className="u-wl-status" data-tone={verdict === 'ok' ? 'ok' : verdict === 'empty' ? 'muted' : 'warn'} aria-live="polite">
                  {verdict === 'reserved' ? tMail('reservedWord') : verdict === 'invalid' ? t('invalidHandle') : ''}
                </p>
                <button
                  type="button"
                  className="u-wl-btn"
                  data-done={sealed ? '1' : '0'}
                  disabled={busy || (!sealed && !handleOk)}
                  onMouseEnter={() => playHoverSfx()}
                  onClick={sealed ? onClose : reserve}
                  data-shorts-pass-cta=""
                >
                  {sealed ? <BadgeCheck size={16} aria-hidden="true" /> : <Ticket size={16} aria-hidden="true" />}
                  {sealed ? `${t('reserved')} · ${pass?.serial}` : t('reserve')}
                </button>
                {sealed && !bound && <p className="u-wl-status" data-tone="muted">{t('guest')}</p>}
              </div>
              <p className="u-wl-honest">{t('honest')}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
