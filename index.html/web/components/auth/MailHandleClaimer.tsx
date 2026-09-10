'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BadgeCheck, TriangleAlert } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { UNITAS_MAIL_CLAIMED_KEY, UNITAS_MAIL_METADATA_KEY, writeReservation } from '@/lib/auth/unitasHandle';
import { claimReservedHandle } from '@/lib/auth/unitasHandleClient';

const TOAST_MS = 7000;
const ATTEMPT_KEY = 'unitas.mail.claim.attempt.v1';

interface Toast {
  tone: 'ok' | 'warn';
  text: string;
  handle: string;
}

/**
 * REV-19 follow-up -- binds a signed-in account's reserved
 * `@theunitas.global` handle in the uniqueness ledger the first time a
 * session appears with an unclaimed handle (`POST /api/mail/handle/claim`,
 * Bearer JWT). One attempt per (account, page load) -- a failed ledger is
 * retried on the next load, never in a loop. Outcomes surface as a small
 * glass toast: bound (address shown) or lost (someone claimed it first;
 * the handle is gone from the account, the visitor may reserve another).
 */
export function MailHandleClaimer() {
  const t = useTranslations('Rev19.mail');
  const { session, refreshProfile } = useWallet();
  const [toast, setToast] = useState<Toast | null>(null);
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    const handle = typeof meta[UNITAS_MAIL_METADATA_KEY] === 'string' ? (meta[UNITAS_MAIL_METADATA_KEY] as string) : '';
    if (!handle || typeof meta[UNITAS_MAIL_CLAIMED_KEY] === 'string') return;
    const key = `${session.user.id}:${handle}`;
    if (attemptedRef.current === key) return;
    try {
      if (window.sessionStorage.getItem(ATTEMPT_KEY) === key) return;
      window.sessionStorage.setItem(ATTEMPT_KEY, key);
    } catch {
      // sessionStorage unavailable -- the ref alone guards this load
    }
    attemptedRef.current = key;
    let cancelled = false;
    (async () => {
      const result = await claimReservedHandle(session.access_token);
      if (cancelled) return;
      if (result.status === 'claimed' && result.address) {
        writeReservation(handle, 'claimed');
        setToast({ tone: 'ok', text: t('claimed'), handle: result.address });
      } else if (result.status === 'taken') {
        writeReservation(handle, 'lost');
        setToast({ tone: 'warn', text: t('lost', { handle }), handle: '' });
      }
      if (result.status === 'claimed' || result.status === 'taken') {
        // pull the stamped metadata into the local session so the next load
        // sees `claimed_at` (or the cleared handle) without a re-attempt
        try {
          void getSupabaseBrowserClient().auth.refreshSession();
        } catch {
          // no client -- the next load simply re-runs the idempotent claim
        }
        void refreshProfile();
      }
      // `error` / `none` / `invalid`: nothing to say; a ledger outage is retried next load
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshProfile, t]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="u-mail-toast" role="status" data-tone={toast.tone} data-mail-claim-toast="">
      {toast.tone === 'ok' ? <BadgeCheck size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
      <span>
        {toast.handle ? <b>{toast.handle}</b> : null}
        {toast.handle ? ' · ' : ''}
        {toast.text}
      </span>
    </div>
  );
}
