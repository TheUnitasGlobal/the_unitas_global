'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BadgeCheck, Mail } from 'lucide-react';
import { usePointerTilt } from '@/components/ui/usePointerTilt';
import {
  UNITAS_MAIL_DOMAIN,
  handleBlocksSubmit,
  mailFieldState,
  normalizeHandle,
  validateHandle,
  type MailFieldAvailability,
} from '@/lib/auth/unitasHandle';
import { HANDLE_CHECK_DEBOUNCE_MS, checkHandleAvailability } from '@/lib/auth/unitasHandleClient';

interface MailHandleFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** Reports whether the sign-up form may submit with the field's state. */
  onBlockingChange?: (blocking: boolean) => void;
  disabled?: boolean;
}

/**
 * REV-19 follow-up -- the `@theunitas.global` FOUNDING ADDRESS field of
 * the sign-up form (app/waitlist.css §2): a tilting glass envelope that
 * previews the address as it is typed, an availability orb that pulses
 * while the uniqueness ledger is asked (debounced, abortable -- see
 * lib/auth/unitasHandleClient.ts), a sealed bloom when the handle is free,
 * and an honest verdict line. `taken` blocks the form exactly like a
 * reserved word; `unchecked` (ledger unreachable) lets it submit and says
 * so -- the claim at sign-in re-checks atomically.
 */
export function MailHandleField({ value, onChange, onBlockingChange, disabled }: MailHandleFieldProps) {
  const t = useTranslations('Rev19.mail');
  const tilt = usePointerTilt(4);
  const verdict = validateHandle(value);
  const [availability, setAvailability] = useState<MailFieldAvailability>(null);
  const probeRef = useRef<AbortController | null>(null);

  // Live availability probe: only for a syntactically valid handle, only
  // after the visitor pauses, and only the latest probe may answer.
  useEffect(() => {
    probeRef.current?.abort();
    probeRef.current = null;
    if (verdict !== 'ok') {
      setAvailability(null);
      return;
    }
    const handle = normalizeHandle(value);
    setAvailability('checking');
    const ctrl = new AbortController();
    probeRef.current = ctrl;
    const timer = window.setTimeout(async () => {
      const result = await checkHandleAvailability(handle, ctrl.signal);
      if (!ctrl.signal.aborted) setAvailability(result);
    }, HANDLE_CHECK_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, verdict]);

  const blocking = handleBlocksSubmit(verdict, availability);
  useEffect(() => {
    onBlockingChange?.(blocking);
  }, [blocking, onBlockingChange]);

  const state = mailFieldState(verdict, availability);
  const handle = normalizeHandle(value);
  const tone = state === 'available' ? 'ok' : state === 'checking' ? 'busy' : state === 'idle' || state === 'unchecked' ? 'muted' : 'warn';
  const verdictText =
    state === 'idle'
      ? t('hint')
      : state === 'invalid'
        ? t('invalid')
        : state === 'reserved'
          ? t('reservedWord')
          : state === 'checking'
            ? t('checking')
            : state === 'taken'
              ? t('taken')
              : state === 'unchecked'
                ? t('unchecked')
                : `${t('available')} · ${t('reserved')}`;

  return (
    <div className="u-mail-field" data-mail-handle="" data-state={state}>
      <div className="u-mail-inner" {...tilt}>
        <div className="u-mail-head">
          <span className="u-wl-eyebrow">
            <Mail size={12} aria-hidden="true" />
            {t('eyebrow')}
          </span>
          <label className="u-mail-label" htmlFor="unitas-mail-handle">
            {t('label')}
          </label>
        </div>
        <div className="u-wl-input-row" data-state={state} style={{ marginTop: 10 }}>
          <input
            id="unitas-mail-handle"
            className="u-wl-input"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('placeholder')}
            aria-invalid={state === 'invalid' || state === 'reserved' || state === 'taken'}
            aria-describedby="unitas-mail-verdict"
          />
          <span className="u-wl-domain">{t('domain')}</span>
        </div>
        <div className="u-mail-preview" data-state={state} aria-hidden="true">
          <span className="u-mail-orb" data-state={state} />
          <span className="u-mail-address" data-empty={handle ? '0' : '1'}>
            {handle ? (
              <>
                <b>{handle}</b>@{UNITAS_MAIL_DOMAIN}
              </>
            ) : (
              `${t('placeholder')}@${UNITAS_MAIL_DOMAIN}`
            )}
          </span>
          <span className="u-mail-sealed">
            <BadgeCheck size={11} aria-hidden="true" />
            {t('sealed')}
          </span>
        </div>
        <p id="unitas-mail-verdict" className="u-mail-verdict" data-tone={tone} aria-live="polite">
          {verdictText}
        </p>
        <div className="u-mail-perks" aria-hidden="true">
          <span className="u-mail-perk">{t('perk1')}</span>
          <span className="u-mail-perk">{t('perk2')}</span>
        </div>
      </div>
    </div>
  );
}
