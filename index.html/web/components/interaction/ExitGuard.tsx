'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LogOut, Power } from 'lucide-react';
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
/** Window event any surface can fire to open the same logout/exit confirm
 *  this component shows on a back-gesture -- see `requestAppExit()` below. */
const EXIT_REQUEST_EVENT = 'unitas:app-exit-request';

interface ExitRequestDetail {
  /**
   * Owner instruction 2026-09-05 (round 2): when window.close() is silently
   * refused by browser security policy (a tab not opened by script, the
   * common case) AND there is no prior history entry to travel back through
   * (a fresh direct visit -- exactly how most Coming-Soon 'X' clicks arrive,
   * with zero back-history), the confirm's "종료" action used to dead-end on
   * a "please close manually" warning. A caller that supplies this hard-
   * navigates here instead once that failure is confirmed, so the visitor
   * always ends up leaving the sealed screen rather than getting stuck.
   */
  forceRedirectTo?: string;
}

/**
 * Ask ExitGuard to open its logout/exit confirm on demand, outside the
 * back-gesture flow -- e.g. the Coming-Soon sealed screen's 'X' button
 * (owner instruction 2026-09-05), which must send a mobile PWA straight to
 * the same confirmed exit rather than bouncing the visitor out unconfirmed.
 * No-ops if ExitGuard isn't mounted (SSR / component removed).
 */
export function requestAppExit(detail?: ExitRequestDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ExitRequestDetail>(EXIT_REQUEST_EVENT, { detail }));
}

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
  const locale = useLocale();
  const { session } = useWallet();
  const { playHoverSfx } = useSpatialAudio();
  const gate = useGatedSurface('exit-guard');
  const [step, setStep] = useState<Step>('exit');
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const leavingRef = useRef(false);
  const forceRedirectRef = useRef<string | null>(null);
  /** Timestamp (ms) before which an incoming popstate is treated as a
   *  spurious/synthetic event rather than a real user back-gesture -- see
   *  the grace-window note below. */
  const guardReadyAtRef = useRef(0);

  const openGate = gate.setOpen;

  useEffect(() => {
    if (!shouldArm()) return;

    // GRACE WINDOW (owner instruction 2026-09-05, round 3): some mobile
    // browsers/PWA runtimes fire a `popstate` that is NOT a real user back
    // gesture -- e.g. WebKit occasionally replays one while restoring an
    // installed PWA's history stack after the OS suspends and resumes it.
    // Without a guard, that synthetic pop landed on the un-marked real entry
    // and opened the exit confirm the instant the visitor merely reopened
    // the app -- "메인 홈페이지 진입 시 팝업 자동 발동". A real back-button
    // press physically cannot land inside this short window measured from
    // mount/resume, so any popstate that does is re-armed silently instead
    // of asked about.
    const arm = () => {
      armSentinel();
      guardReadyAtRef.current = Date.now() + 600;
    };
    // Let Next's own hydration-time replaceState land first, so the
    // sentinel is layered over the router's real entry, not under it.
    const armTimer = setTimeout(arm, 60);

    const onPop = (e: PopStateEvent) => {
      if (leavingRef.current) return;
      const state = e.state as Record<string, unknown> | null;
      if (state?.[GUARD_MARKER]) return; // a tower closed -- still on the sentinel
      if (Date.now() < guardReadyAtRef.current) {
        // Spurious pop inside the grace window -- re-arm and say nothing.
        arm();
        return;
      }
      // We are on the real entry: re-arm at once, then ask.
      arm();
      try {
        (document.activeElement as HTMLElement | null)?.blur?.();
      } catch {
        // nothing focused
      }
      forceRedirectRef.current = null;
      setStep(sessionRef.current ? 'logout' : 'exit');
      openGate(true, { force: true });
    };
    window.addEventListener('popstate', onPop);

    // Re-open the grace window whenever the tab/app regains visibility (the
    // same PWA-resume moment that can produce the synthetic pop above), so
    // the same protection applies after backgrounding, not just on mount.
    const onVisible = () => {
      if (document.visibilityState === 'visible') guardReadyAtRef.current = Date.now() + 600;
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(armTimer);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [openGate]);

  // On-demand open (no back-gesture involved) -- see `requestAppExit()`.
  useEffect(() => {
    const onExitRequest = (e: Event) => {
      try {
        (document.activeElement as HTMLElement | null)?.blur?.();
      } catch {
        // nothing focused
      }
      forceRedirectRef.current = (e as CustomEvent<ExitRequestDetail>).detail?.forceRedirectTo ?? null;
      setStep(sessionRef.current ? 'logout' : 'exit');
      openGate(true, { force: true });
    };
    window.addEventListener(EXIT_REQUEST_EVENT, onExitRequest);
    return () => window.removeEventListener(EXIT_REQUEST_EVENT, onExitRequest);
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
      // window.close()/history.go(-2). Owner instruction 2026-09-05 (round
      // 3): every caller now gets a guaranteed hard redirect to the main
      // observation home instead of a dead-end "please close manually"
      // notice -- same-origin navigation is never blocked by the
      // close/popup policies that just defeated the attempts above.
      window.location.href = forceRedirectRef.current ?? `/${locale}`;
    }, LEAVE_SETTLE_MS);
  }

  const titleId = 'exit-guard-title';
  const isLogout = step === 'logout';

  return (
    <Modal open={gate.open} onClose={close} labelledBy={titleId} hideCloseButton>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-accent/50 bg-accent/10 text-accent">
            {isLogout ? <LogOut size={20} aria-hidden="true" /> : <Power size={20} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            {/* Owner instruction 2026-09-05 (round 4, revised round 5): a
                single, unbroken line for the Korean title -- at 320px
                viewport width the icon leaves too little room for the
                default wrapping size to hold one line. Scoped to
                `locale === 'ko'` only: forcing nowrap + a shrunk size
                globally would overflow the other 19 locales, several of
                which run 35-40+ space-separated characters (et/tr/km) that
                need their natural word-wrap to stay inside the modal.
                Round 5: with the corner 'X' gone (hideCloseButton above) the
                reserved pr-6 gutter is reclaimed, giving this line extra
                breathing room at a slightly larger size, which now reads
                clearly bigger than the shrunk subtext below it -- the prior
                13px sat *under* the old 14px body text. Kept the bump modest
                (13px -> 14px, not further) since the freed width is the only
                new margin available at the narrowest supported viewport and
                nowrap must not push the line past the panel edge. */}
            <h2
              id={titleId}
              className={
                locale === 'ko'
                  ? 'whitespace-nowrap text-[14px] font-bold tracking-tight text-white sm:text-xl sm:tracking-normal'
                  : 'text-base font-bold leading-snug text-white sm:text-xl'
              }
            >
              {isLogout ? t('logoutTitle') : t('exitTitle')}
            </h2>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-gray-300">{isLogout ? t('logoutBody') : t('exitBody')}</p>

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
