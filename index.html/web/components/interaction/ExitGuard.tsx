'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LogOut, Power } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { CINEMA_PHASE_EVENT } from '@/lib/foundersGate';
import { CINEMA_PHASE_STORAGE_KEY } from '@/lib/splash/splashTimeline';
import { executeAppExit, isStandaloneApp } from '@/lib/exit/appExit';

/** history.state marker of the sentinel entry parked under the home page. */
const GUARD_MARKER = 'unitasExitGuard';
/** Window event any surface can fire to open the same logout/exit confirm
 *  this component shows on a back-gesture -- see `requestAppExit()` below. */
const EXIT_REQUEST_EVENT = 'unitas:app-exit-request';
/** Curtain phase in which the real site is visible and the guard may arm. */
const RELEASED_PHASE = 'released';

interface ExitRequestDetail {
  /** Same-origin URL for the exit engine's in-place fallback (defaults to
   *  the current locale's root). */
  forceRedirectTo?: string;
}

/**
 * Ask ExitGuard to open its logout/exit confirm on demand, outside the
 * back-gesture flow. No-ops if ExitGuard isn't mounted (SSR / removed).
 * (The Coming-Soon 'X' no longer goes through here -- owner instruction
 * 2026-09-05 round 10 item 6 tunnels it straight into `executeAppExit()`.)
 */
export function requestAppExit(detail?: ExitRequestDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ExitRequestDetail>(EXIT_REQUEST_EVENT, { detail }));
}

type Step = 'logout' | 'exit';

/**
 * Only the ONLINE channel arms the back-gesture sentinel. In the App channel
 * (installed PWA) the doctrine is "exit = terminate immediately" (owner
 * instruction 2026-09-05, round 10, item 5): the OS back on a single-entry
 * app window already closes it, and -- decisively -- parking a second
 * history entry would make Chromium refuse `window.close()` for the rest
 * of the session, breaking the 'X' / 종료 force-close. So: never in
 * standalone mode; otherwise a touch / narrow viewport as before.
 */
function shouldArm(): boolean {
  if (typeof window === 'undefined') return false;
  if (isStandaloneApp()) return false;
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth <= 1024;
    return coarse || narrow;
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

/** Live curtain phase: the DOM attribute the curtain stamps, else storage. */
function readCinemaPhase(): string {
  if (typeof document === 'undefined') return 'gate';
  const stamped = document.documentElement.dataset.cinemaPhase;
  if (stamped) return stamped;
  try {
    return sessionStorage.getItem(CINEMA_PHASE_STORAGE_KEY) ?? 'gate';
  } catch {
    return 'gate';
  }
}

/**
 * Mobile "back = leave" double gate (owner instruction 2026-09-03) for the
 * ONLINE channel. On a touch / narrow browser viewport, once the real site
 * is visible, the page parks one extra same-URL history entry beneath
 * itself; the device's back gesture -- including the second press after one
 * has only dismissed the virtual keyboard -- pops to the real entry, and
 * instead of bouncing the visitor out this opens the two-step confirm:
 * "로그아웃을 하시겠습니까?" (only while signed in) then "종료하시겠습니까?".
 * The sentinel is re-armed immediately, so the site only actually unloads on
 * an explicit tap of 종료 (which runs the shared exit engine -- online: back
 * to the previous page; app: immediate termination). Every other path (취소,
 * backdrop, Escape) leaves the visitor exactly where they were.
 *
 * ENTRY-POPUP ERADICATION (owner instruction 2026-09-05, round 10, item 4):
 * the guard used to arm 60ms after mount, on every route, under the opaque
 * pre-launch curtain -- so a synthetic load/resume `popstate` (WebKit PWA
 * history restore) or a stray exit request could open this confirm while
 * nothing on screen had asked for it, and, because the Modal layer sat
 * BELOW the curtain, the dialog stayed invisible until the founder entered
 * the main home -- surfacing there as "팝업 자동 발동". Now the sentinel is
 * only ever parked when ALL of these hold: the curtain phase is `released`
 * (the real site is visible), the visitor has produced at least one real
 * pointer/key gesture since mount (a load-time synthetic pop physically
 * precedes any gesture), and the channel is online. The popstate listener
 * itself is not even attached before that. The confirm renders on the
 * top-most modal layer so it can never be hidden behind the curtain.
 *
 * Mounted once in app/[locale]/layout.tsx (after the curtain), so the same
 * guard serves every route rather than only the home page.
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
   *  spurious/synthetic event rather than a real user back-gesture. */
  const guardReadyAtRef = useRef(0);

  const openGate = gate.setOpen;

  useEffect(() => {
    if (!shouldArm()) return;

    let released = readCinemaPhase() === RELEASED_PHASE;
    let gestureSeen = false;
    let armed = false;

    const arm = () => {
      armSentinel();
      guardReadyAtRef.current = Date.now() + 600;
    };

    const onPop = (e: PopStateEvent) => {
      if (leavingRef.current) return;
      const state = e.state as Record<string, unknown> | null;
      if (state?.[GUARD_MARKER]) return; // a tower closed -- still on the sentinel
      if (document.visibilityState !== 'visible' || Date.now() < guardReadyAtRef.current) {
        // Spurious pop (grace window / background resume) -- re-arm silently.
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

    const tryArm = () => {
      if (armed || !released || !gestureSeen) return;
      armed = true;
      arm();
      window.addEventListener('popstate', onPop);
    };

    const onGesture = () => {
      gestureSeen = true;
      tryArm();
    };
    const gestureOpts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('pointerdown', onGesture, gestureOpts);
    window.addEventListener('touchstart', onGesture, gestureOpts);
    window.addEventListener('keydown', onGesture, gestureOpts);

    const onPhase = (event: Event) => {
      released = (event as CustomEvent<string>).detail === RELEASED_PHASE;
      tryArm();
    };
    window.addEventListener(CINEMA_PHASE_EVENT, onPhase);

    // Re-open the grace window whenever the tab/app regains visibility (the
    // PWA-resume moment that can replay a synthetic pop).
    const onVisible = () => {
      if (document.visibilityState === 'visible') guardReadyAtRef.current = Date.now() + 600;
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('pointerdown', onGesture, gestureOpts);
      window.removeEventListener('touchstart', onGesture, gestureOpts);
      window.removeEventListener('keydown', onGesture, gestureOpts);
      window.removeEventListener(CINEMA_PHASE_EVENT, onPhase);
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
    // Owner instruction 2026-09-05 (round 10, item 5): one shared engine
    // decides the channel -- online: back to the previous (search) page;
    // App: immediate termination, and a clean in-place restart (never a
    // blank document) if the runtime refuses to close.
    executeAppExit({
      fallbackUrl: forceRedirectRef.current ?? `/${locale}`,
      sentinelMarker: GUARD_MARKER,
    });
  }

  const titleId = 'exit-guard-title';
  const isLogout = step === 'logout';

  return (
    <Modal open={gate.open} onClose={close} labelledBy={titleId} hideCloseButton layer="top">
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
