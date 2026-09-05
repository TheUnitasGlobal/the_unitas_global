'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut, Power, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

/** history.state marker of the sentinel entry parked under the home page. */
const GUARD_MARKER = 'unitasExitGuard';
/** Give a leave attempt this long to actually unload before admitting the
 *  browser refused (no prior page to go back to, window.close() denied). */
const LEAVE_SETTLE_MS = 450;

type Step = 'logout' | 'exit';

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function shouldArm(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth <= 1024;
    return coarse || isStandaloneMode() || narrow;
  } catch {
    return false;
  }
}

function armSentinel() {
  try {
    const state = window.history.state as Record<string, unknown> | null;
    if (!state?.[GUARD_MARKER]) {
      window.history.pushState({ ...(state ?? {}), [GUARD_MARKER]: true }, '');
    }
  } catch {
    // history unavailable -- nothing to guard with.
  }
}

/**
 * Mobile "back = leave" double gate (owner instruction 2026-09-03). On a
 * touch / narrow / installed-PWA viewport, the home page parks one extra
 * same-URL history entry beneath itself; the device's hardware or browser
 * back gesture -- including the second press after one has only dismissed
 * the virtual keyboard -- pops to the real entry, and instead of bouncing
 * the visitor out to the launcher this opens the two-step confirm:
 * "로그아웃을 하시겠습니까?" (only while signed in) then "종료하시겠습니까?".
 * The sentinel is re-armed immediately, so the site only actually unloads
 * on an explicit tap of 종료; every other path (취소, backdrop, Escape)
 * leaves the visitor exactly where they were, keyboard closed.
 *
 * Plays nicely with the dialog towers: they push their own markers on top
 * of the sentinel, so one back closes the tower and the next reaches here.
 */
export function ExitGuard() {
  const t = useTranslations('ExitGuard');
  const { session } = useWallet();
  const { playHoverSfx } = useSpatialAudio();
  const gate = useGatedSurface('exit-guard');
  const [step, setStep] = useState<Step>('exit');
  const [leaveRefused, setLeaveRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const leavingRef = useRef(false);

  const openGate = gate.setOpen;

  useEffect(() => {
    if (!shouldArm()) return;
    // Let Next's own hydration-time replaceState land first, so the
    // sentinel is layered over the router's real entry, not under it.
    const armTimer = setTimeout(armSentinel, 60);

    const onPop = (e: PopStateEvent) => {
      if (leavingRef.current) return;
      const state = e.state as Record<string, unknown> | null;
      if (state?.[GUARD_MARKER]) return; // a tower closed -- still on the sentinel
      // We are on the real entry: re-arm at once, then ask.
      armSentinel();
      try {
        (document.activeElement as HTMLElement | null)?.blur?.();
      } catch {
        // nothing focused
      }
      setLeaveRefused(false);
      setStep(sessionRef.current ? 'logout' : 'exit');
      openGate(true, { force: true });
    };
    window.addEventListener('popstate', onPop);
    return () => {
      clearTimeout(armTimer);
      window.removeEventListener('popstate', onPop);
    };
  }, [openGate]);

  const close = useCallback(() => {
    if (busy) return;
    openGate(false);
  }, [busy, openGate]);

  async function handleLogout() {
    setBusy(true);
    try {
      await getSupabaseBrowserClient().auth.signOut();
    } catch {
      // Signed-out state is reconciled by WalletProvider's auth listener; a
      // failed network call here must not trap the visitor in the dialog.
    } finally {
      setBusy(false);
      setStep('exit');
    }
  }

  function handleExit() {
    leavingRef.current = true;
    setBusy(true);
    try {
      // Installed PWA / script-opened tab: a real close is permitted.
      window.close();
    } catch {
      // ignored -- fall through below
    }
    try {
      if (isStandaloneMode()) {
        // Owner instruction 2026-09-05 (round 2): `history.go(-2)` is a dead
        // end for a freshly-launched installed PWA -- armSentinel() only
        // ever pushes ONE synthetic entry on top of the app's single real
        // entry, so by the time the visitor has backed onto that real entry
        // and confirmed exit here, there are no 2 entries left to go back
        // through and nothing happens (the app just sits there). No web API
        // can force-quit an installed PWA/TWA process, so the closest
        // honest equivalent is leaving the app's visible content -- replace
        // the document instead of trying to travel past history it doesn't
        // have.
        window.location.replace('about:blank');
      } else {
        // Sentinel + real entry: two steps back leaves the site for the page
        // (or launcher) the visitor came from.
        window.history.go(-2);
      }
    } catch {
      // ignored
    }
    setTimeout(() => {
      if (document.visibilityState === 'hidden') return;
      // Nothing unloaded us: no prior page and the browser refused
      // window.close(). Say so instead of pretending.
      leavingRef.current = false;
      armSentinel();
      setBusy(false);
      setLeaveRefused(true);
    }, LEAVE_SETTLE_MS);
  }

  const titleId = 'exit-guard-title';
  const isLogout = step === 'logout';

  return (
    <Modal open={gate.open} onClose={close} labelledBy={titleId}>
      <div className="flex flex-col gap-5 pr-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-accent/50 bg-accent/10 text-accent">
            {isLogout ? <LogOut size={20} aria-hidden="true" /> : <Power size={20} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">{t('eyebrow')}</p>
            <h2 id={titleId} className="text-lg font-bold text-white sm:text-xl">
              {isLogout ? t('logoutTitle') : t('exitTitle')}
            </h2>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-gray-300">{isLogout ? t('logoutBody') : t('exitBody')}</p>

        {leaveRefused && (
          <p className="flex items-start gap-2 border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[13px] text-amber-200">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {t('exitManual')}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={isLogout ? () => setStep('exit') : close}
            disabled={busy}
            className="border border-white/20 px-5 py-3 text-sm font-bold text-gray-200 transition-colors hover:border-white/40 hover:text-white disabled:opacity-50"
          >
            {isLogout ? t('logoutSkip') : t('exitCancel')}
          </button>
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={isLogout ? handleLogout : handleExit}
            disabled={busy}
            className={`border px-5 py-3 text-sm font-bold transition-colors disabled:opacity-50 ${
              isLogout
                ? 'border-accent bg-accent/15 text-accent hover:bg-accent/25'
                : 'border-red-400/70 bg-red-500/15 text-red-200 hover:bg-red-500/25'
            }`}
          >
            {isLogout ? t('logoutConfirm') : t('exitConfirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
