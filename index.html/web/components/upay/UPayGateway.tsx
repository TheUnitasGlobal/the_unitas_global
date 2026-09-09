'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { attestUSignature } from '@/lib/security/uSignature';
import { playHapticClick } from '@/lib/audio/haptics';
import {
  isLockInModuleKey,
  readActiveLockIns,
  toggleLockIn,
  writeActiveLockIns,
} from '@/lib/lockInModules';
import {
  classifySpendError,
  planInvestment,
  reduceOneClick,
  type OneClickState,
} from '@/lib/upay/oneClick';
import type { ClusterModule } from '@/lib/quantumWhite/clusters';
import { emitQuantumPulse } from './QuantumBluePulse';

/** "arm" micro-press before the RPC actually fires (spec section 4). */
const ARM_MS = 120;

const INITIAL_STATE: OneClickState = { status: 'idle' };

interface UPayGatewayProps {
  module: ClusterModule;
  onSuccess?: (result: { balanceAfter: number | null; reused: boolean }) => void;
}

/**
 * REV-13 "U-Pay 1-Click Holographic Gateway" (spec section 4 + section 10
 * items 3/6/7/8/9): a single button that takes a `ClusterModule` from
 * "look" to "burned + granted" in one tap, no confirmation dialog. Every
 * transition of what the button/status text shows flows through
 * `reduceOneClick` (`lib/upay/oneClick.ts`) so the state machine itself
 * stays pure and unit-tested; this component only supplies the side effects
 * (behavioural attestation, the double-burn guard, the RPC, haptics, the
 * ripple, lock-in activation) around each transition.
 *
 * Deliberately ONE `<button>` for the whole surface: its label and handler
 * change with the current state (invest -> sign in -> add coins -> retry)
 * rather than swapping between several controls, which keeps focus / the
 * accessible name stable through the whole flow. A separate `aria-live`
 * region carries the state's message text.
 */
export function UPayGateway({ module, onSuccess }: UPayGatewayProps) {
  const t = useTranslations('QuantumWhite');
  const { session, balance, profile, configured, guest, refreshProfile } = useWallet();
  const authGate = useGatedSurface('nav:auth');
  const chargeGate = useGatedSurface('nav:charge');
  const [state, send] = useReducer(reduceOneClick, INITIAL_STATE);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const plan = useMemo(() => planInvestment(module), [module]);

  const activateLockInIfNeeded = useCallback(() => {
    if (module.kind !== 'lockin' || !isLockInModuleKey(module.key)) return;
    const active = readActiveLockIns();
    if (!active.includes(module.key)) {
      writeActiveLockIns(toggleLockIn(active, module.key));
    }
  }, [module]);

  const finishSuccess = useCallback(
    (balanceAfter: number | null, reused: boolean, origin: { x: number; y: number }) => {
      if (!mountedRef.current) return;
      send({ type: 'succeed', balanceAfter, reused });
      activateLockInIfNeeded();
      void refreshProfile();
      emitQuantumPulse(origin);
      playHapticClick();
      onSuccess?.({ balanceAfter, reused });
    },
    [activateLockInIfNeeded, onSuccess, refreshProfile],
  );

  const executeInvestment = useCallback(
    async (origin: { x: number; y: number }) => {
      // (1) identity gates -- no session at all (signed out, not even
      // browsing as a guest), or a guest handle that has no real account.
      if (!configured || (!session && !guest)) {
        send({ type: 'block', reason: 'signin' });
        return;
      }
      if (!session) {
        send({ type: 'block', reason: 'guest' });
        return;
      }
      // Zero-Trust pre-check mirrors the server's own guard (spec section 10
      // item 7) so an unverified account gets a clear reason instead of the
      // raw PostgREST message, and lands straight on phone verification.
      if (profile?.phone_verified === false) {
        send({ type: 'block', reason: 'phone' });
        authGate.setOpen(true, { force: true });
        return;
      }
      if (!plan.executable) {
        send({ type: 'block', reason: 'unlisted' });
        return;
      }

      const attestation = await attestUSignature();
      if (!mountedRef.current) return;
      if (!attestation.ok) {
        send({ type: 'block', reason: 'shield' });
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();

        // (2) Double-burn guard (spec section 10 item 7): a still-live grant
        // for this exact module means the visitor already paid -- skip the
        // burn entirely rather than charging them twice for one session.
        const { data: existingGrant } = await supabase
          .from('module_access_grants')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('module', plan.accessName)
          .gt('expires_at', new Date().toISOString())
          .limit(1)
          .maybeSingle();
        if (!mountedRef.current) return;
        if (existingGrant) {
          finishSuccess(balance, true, origin);
          return;
        }

        const { data, error } = await supabase.rpc('spend_coins', {
          p_module: plan.accessName,
          p_amount: plan.amount,
        });
        if (!mountedRef.current) return;
        if (error) {
          const kind = classifySpendError(error.message ?? '');
          if (kind === 'insufficient') send({ type: 'block', reason: 'insufficient' });
          else if (kind === 'phone') send({ type: 'block', reason: 'phone' });
          else if (kind === 'auth') send({ type: 'block', reason: 'signin' });
          else if (kind === 'unlisted') send({ type: 'block', reason: 'unlisted' });
          else send({ type: 'fail', message: t('failed') });
          return;
        }

        const balanceAfter = typeof data === 'number' ? data : null;
        finishSuccess(balanceAfter, false, origin);
      } catch {
        if (mountedRef.current) send({ type: 'fail', message: t('failed') });
      }
    },
    [authGate, balance, configured, finishSuccess, guest, plan, profile, session, t],
  );

  const handleInvest = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (state.status === 'arming' || state.status === 'executing') return;
      const origin = { x: e.clientX, y: e.clientY };
      send({ type: 'arm' });
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        send({ type: 'execute' });
        void executeInvestment(origin);
      }, ARM_MS);
    },
    [executeInvestment, state.status],
  );

  const buttonConfig = useMemo(() => {
    if (state.status === 'blocked') {
      if (state.reason === 'insufficient') {
        return { label: t('chargeCoins'), disabled: false, onClick: () => chargeGate.setOpen(true, { force: true }) };
      }
      if (state.reason === 'signin' || state.reason === 'guest' || state.reason === 'phone') {
        return { label: t('signInToInvest'), disabled: false, onClick: () => authGate.setOpen(true, { force: true }) };
      }
      if (state.reason === 'unlisted') {
        return { label: t('investNow'), disabled: true, onClick: undefined };
      }
      // 'shield' -- let the visitor simply try again.
      return { label: t('investNow'), disabled: false, onClick: handleInvest };
    }
    if (state.status === 'failed') {
      return { label: t('investNow'), disabled: false, onClick: handleInvest };
    }
    if (state.status === 'success') {
      return { label: t('successTitle'), disabled: true, onClick: undefined };
    }
    if (state.status === 'executing') {
      return { label: t('executing'), disabled: true, onClick: undefined };
    }
    // 'idle' | 'arming'
    return { label: t('investNow'), disabled: state.status === 'arming', onClick: handleInvest };
  }, [authGate, chargeGate, handleInvest, state, t]);

  const statusText = useMemo(() => {
    if (state.status === 'blocked') {
      switch (state.reason) {
        case 'signin':
          return t('signInToInvest');
        case 'guest':
          return t('guestInvest');
        case 'insufficient':
          return t('insufficient');
        case 'shield':
          return t('shieldBlocked');
        case 'unlisted':
          return t('unlisted');
        case 'phone':
          return t('phoneRequired');
        default:
          return '';
      }
    }
    if (state.status === 'failed') return t('failed');
    if (state.status === 'success') return t('successBody');
    if (state.status === 'executing') return t('executing');
    return '';
  }, [state, t]);

  const balanceLabel = !configured || !session ? '—' : balance === null ? '···' : balance.toLocaleString();

  return (
    <div className="qw-upay-gateway">
      <div className="qw-upay-chip flex items-center justify-between gap-3 text-xs">
        <span>{t('costLabel')}</span>
        <span className="font-semibold">
          {plan.amount.toLocaleString()} {t('coinUnit')}
        </span>
      </div>
      <div className="qw-upay-chip flex items-center justify-between gap-3 text-xs">
        <span>{t('balanceLabel')}</span>
        <span className="font-semibold">
          {balanceLabel} {configured && session ? t('coinUnit') : ''}
        </span>
      </div>

      <div className="qw-upay-ring relative">
        <button
          type="button"
          className="unitas-tap qw-upay-btn w-full"
          disabled={buttonConfig.disabled}
          onClick={buttonConfig.onClick}
          data-state={state.status}
        >
          {buttonConfig.label}
        </button>
      </div>

      <p className="qw-upay-status" aria-live="polite">
        {statusText}
      </p>
    </div>
  );
}
