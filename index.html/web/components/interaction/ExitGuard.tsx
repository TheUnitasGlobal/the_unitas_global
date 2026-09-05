'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LogOut, Power } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { getGateOwner } from '@/lib/uiGate';
import { executeAppExit, readSentinelDepth } from '@/lib/exit/appExit';
import { CINEMA_PHASE_EVENT } from '@/lib/foundersGate';

/** history.state marker of a sentinel entry parked under the page. */
const GUARD_MARKER = 'unitasExitGuard';
/** history.state key holding a sentinel's depth (1 = bottom, N = top). */
const GUARD_DEPTH = 'unitasExitDepth';
/**
 * How many sentinel entries are parked beneath the main home at all times.
 *
 * Owner instruction 2026-09-05 (hardening patch, item 4): pressing back
 * "2번 이상" on the main home used to force the visitor out. The round-12
 * TWO-entry buffer was re-filled from INSIDE the popstate handler -- and a
 * history entry pushed right after a user-initiated back traversal, without
 * a fresh user activation in between, is exactly what Chromium's history
 * manipulation intervention marks as skippable (it consumes the document's
 * "history-action" activation on every traversal -- the HTML spec now names
 * the concept). Once a document's entries are skippable the next back press
 * jumps over ALL of them at once: modal on the first press, ejection on the
 * second. So the buffer is now (a) DEEP -- a burst of presses has to chew
 * through this many entries before the site's real entry is even reached --
 * and (b) re-filled ONLY from genuine activation gestures (a tap on the
 * dialog's 취소, any touch on the page), never from popstate. Every entry is
 * therefore pushed WITH activation and none is ever skippable; a visitor
 * mashing back simply steps down the buffer with the dialog open, and the
 * very next touch tops it back up. The `beforeunload` gate below is the last
 * line if a burst somehow exhausts it.
 */
const SENTINEL_DEPTH = 12;
/** Gate id in the site-wide single-open-surface registry (lib/uiGate.ts). */
const GATE_ID = 'exit-guard';
/** Window event any surface can fire to open the same logout/exit confirm
 *  this component shows on a back-gesture -- see `requestAppExit()` below. */
const EXIT_REQUEST_EVENT = 'unitas:app-exit-request';
/** Grace window (ms) after arming / regaining visibility during which an
 *  incoming popstate is treated as synthetic (WebKit PWA history restore,
 *  bfcache resume) rather than a user's back gesture. */
const SPURIOUS_POP_GRACE_MS = 600;
/** The curtain phase on which the back-gesture guard is live: the MAIN HOME
 *  only. The logo page, the entry gate, ad stages 1-4 and the sealed
 *  Coming-Soon screen leave the device's back gesture native (owner
 *  instruction 2026-09-05, hardening patch, item 4). */
const RELEASED_PHASE = 'released';

interface ExitRequestDetail {
  /** Same-origin URL for the exit engine's in-place fallback (defaults to
   *  the current locale's root). */
  forceRedirectTo?: string;
}

/**
 * Ask ExitGuard to open its logout/exit confirm on demand, outside the
 * back-gesture flow. No-ops if ExitGuard isn't mounted (SSR / removed).
 * (The Coming-Soon 'X' does not go through here -- owner instruction
 * 2026-09-05 round 10 item 6 tunnels it straight into `executeAppExit()`.)
 */
export function requestAppExit(detail?: ExitRequestDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ExitRequestDetail>(EXIT_REQUEST_EVENT, { detail }));
}

type Step = 'logout' | 'exit';

/**
 * BOTH channels arm the back-gesture sentinel on a touch / narrow device
 * (owner instruction 2026-09-05, round 11, item 1) -- but only on the main
 * home (round 13, see `RELEASED_PHASE`).
 *
 * ONLINE (browser tab): back opens the confirm, 종료 returns to the previous
 * page.
 *
 * APP (installed PWA / native container) on mobile & tablet: the hardware /
 * software back button must NOT close the app outright; it opens the same
 * z-680 exit confirm, and only an explicit 종료 leaves. The only way a web
 * page can intercept the OS back is to hold extra history entries beneath
 * itself, so the sentinel buffer is parked in standalone mode too. Known,
 * accepted trade-off: Chromium refuses `window.close()` while the window's
 * session history holds more than one entry, so once the buffer exists the
 * confirmed 종료 can no longer hard-terminate a Chromium app window;
 * `executeAppExit()` then terminates the app IN PLACE (session wiped, audio
 * silenced, black shroud) and the next foreground resume starts a fresh
 * session on the logo splash. A desktop App window (fine pointer, wide) has
 * no back button and keeps `window.close()` intact by never arming.
 */
function shouldArmBackGuard(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth <= 1024;
    return coarse || narrow;
  } catch {
    return false;
  }
}

/** Live curtain phase, stamped on <html> by ComingSoonCinema from its very
 *  first render (and kept current through CINEMA_PHASE_EVENT). */
function readCinemaPhase(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    return document.documentElement.dataset.cinemaPhase ?? null;
  } catch {
    return null;
  }
}

/** Some OTHER overlay is open ON TOP (a dialog / tower / expanded picker
 *  that does not go through the UI gate) -- ESC belongs to it, not to the
 *  exit confirm. "On top" matters: the site's audio gate is a `role="dialog"`
 *  that sits BENEATH the pre-launch curtain for a visitor's whole stay, so a
 *  bare selector match would have silenced ESC on every funnel page. Each
 *  candidate must actually be hit-testable at its own centre. The exit
 *  confirm itself is not in the DOM while closed. */
function anotherOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const candidates = document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [aria-modal="true"], [role="menu"], [role="listbox"], [aria-expanded="true"]',
    );
    for (const el of Array.from(candidates)) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Current sentinel depth per history.state (0 = the page's real entry). */
function currentDepth(): number {
  try {
    return readSentinelDepth(window.history.state, GUARD_MARKER, GUARD_DEPTH);
  } catch {
    return 0;
  }
}

/**
 * True when the CURRENT history entry belongs to some other in-page surface
 * (a DialogTower parks its own `unitas*Tower` / `unitas*Modal` marked entry
 * above ours, inheriting our keys). Topping the buffer up on top of such an
 * entry would make that surface's own back gesture land on a sentinel and
 * open the exit confirm instead of closing it -- so the refill waits until
 * the surface has popped its entry.
 */
function foreignEntryOnTop(): boolean {
  try {
    const state = window.history.state as Record<string, unknown> | null;
    if (!state || typeof state !== 'object') return false;
    return Object.keys(state).some(
      (key) => key.startsWith('unitas') && key !== GUARD_MARKER && key !== GUARD_DEPTH,
    );
  } catch {
    return false;
  }
}

/** Fill the sentinel buffer so exactly SENTINEL_DEPTH entries sit above the
 *  page's real entry, whatever depth we are currently parked at. MUST be
 *  called from inside a genuine activation gesture (see SENTINEL_DEPTH). */
function refillSentinels(): void {
  try {
    let depth = currentDepth();
    while (depth < SENTINEL_DEPTH) {
      depth += 1;
      const base = (window.history.state as Record<string, unknown> | null) ?? {};
      window.history.pushState({ ...base, [GUARD_MARKER]: true, [GUARD_DEPTH]: depth }, '');
    }
  } catch {
    // history unavailable -- nothing to guard with.
  }
}

/**
 * The events browsers treat as ACTIVATION-TRIGGERING input (HTML spec):
 * `mousedown`, a non-mouse `pointerup`, `touchend`, `click`, `keydown`. A
 * touch `pointerdown` / `touchstart` is deliberately NOT here -- it carries
 * no activation, and a sentinel pushed inside it would be born skippable.
 */
const ACTIVATION_EVENTS = ['mousedown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

/**
 * Sovereign exit confirm -- one dialog, every trigger, every channel.
 *
 * MOBILE / TABLET (online tab AND installed App) -- MAIN HOME ONLY (owner
 * instruction 2026-09-05, hardening patch, item 4): the "back = leave" gate
 * (owner instruction 2026-09-03; App channel 2026-09-05 round 11 item 1).
 * Once the curtain has RELEASED the main home and the visitor has produced a
 * single genuine activation gesture on it, the page parks a deep buffer of
 * same-URL history entries beneath itself; the device's back gesture pops
 * into that buffer and -- instead of bouncing the visitor out (online) or
 * killing the app (App) -- opens the confirm: "로그아웃을 하시겠습니까?"
 * (only while signed in) then "종료하시겠습니까?". Further back presses only
 * step down the buffer with the dialog open; every activation gesture (the
 * tap on 취소 included) tops it back up. The site unloads ONLY on an explicit
 * tap of 종료, which runs the shared exit engine (online: back to the
 * previous page; App: terminate). Every other path (취소, backdrop, Escape)
 * leaves the visitor exactly where they were. Should a burst of presses ever
 * exhaust the buffer while the dialog is open, `beforeunload` raises the
 * browser's own leave prompt as the last gate -- so no sequence of back
 * presses, however long, can end the session without an explicit tap.
 *
 * On the logo page, the entry gate, ad stages 1-4 and the sealed Coming-Soon
 * screen the back gesture is NATIVE: no sentinel, no dialog (item 4 --
 * "오직 메인 홈페이지에서만"). That also keeps a freshly launched app on its
 * single history entry there, so the sealed screen's 'X' can genuinely
 * `window.close()` it.
 *
 * Why a gesture must precede arming: Chromium's history-manipulation
 * intervention marks entries pushed WITHOUT user activation as skippable,
 * and the back button then skips straight past them -- a sentinel parked
 * before the first touch would be silently ignored.
 *
 * PC: the mouse RIGHT-CLICK interception of round 12 is GONE (owner
 * instruction 2026-09-05, hardening patch, item 1) -- the native context
 * menu is back on every page. The ESC key still TOGGLES the confirm (opens
 * when closed, closes when open), deferring to whichever other popup holds
 * the site-wide UI gate.
 *
 * Mounted once in app/[locale]/layout.tsx (after the curtain), so the same
 * guard serves every route rather than only the home page.
 */
export function ExitGuard() {
  const t = useTranslations('ExitGuard');
  const locale = useLocale();
  const { session } = useWallet();
  const { playHoverSfx } = useSpatialAudio();
  const gate = useGatedSurface(GATE_ID);
  const [step, setStep] = useState<Step>('exit');
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const leavingRef = useRef(false);
  const forceRedirectRef = useRef<string | null>(null);
  /** Timestamp (ms) before which an incoming popstate is treated as a
   *  spurious/synthetic event rather than a real user back-gesture. */
  const guardReadyAtRef = useRef(0);
  const openRef = useRef(gate.open);
  openRef.current = gate.open;

  const openGate = gate.setOpen;

  /** Open the confirm (logout step first while signed in). */
  const openConfirm = useCallback(
    (forceRedirectTo: string | null = null) => {
      if (leavingRef.current) return;
      try {
        (document.activeElement as HTMLElement | null)?.blur?.();
      } catch {
        // nothing focused
      }
      forceRedirectRef.current = forceRedirectTo;
      setStep(sessionRef.current ? 'logout' : 'exit');
      openGate(true, { force: true });
    },
    [openGate],
  );

  // --- mobile / tablet, MAIN HOME only: back-gesture sentinel buffer -----------
  useEffect(() => {
    if (!shouldArmBackGuard()) return;

    let phase = readCinemaPhase();
    let armed = false;

    const onHome = () => phase === RELEASED_PHASE;

    const topUp = () => {
      if (foreignEntryOnTop()) return;
      refillSentinels();
    };

    const arm = () => {
      if (armed) return;
      armed = true;
      topUp();
      guardReadyAtRef.current = Date.now() + SPURIOUS_POP_GRACE_MS;
      window.addEventListener('popstate', onPop);
    };

    // Genuine activation gesture on the released main home: arm on the
    // first, top the buffer back up on every later one. Never inside
    // popstate (see SENTINEL_DEPTH).
    const onActivation = () => {
      if (leavingRef.current || !onHome()) return;
      if (!armed) {
        arm();
        return;
      }
      topUp();
    };

    function onPop(e: PopStateEvent) {
      if (leavingRef.current) return;
      // The founder replayed the funnel from the main home: the guard stands
      // down (no dialog off the curtain's sub-views) and never pushes again.
      if (!onHome()) return;
      const depth = readSentinelDepth(e.state, GUARD_MARKER, GUARD_DEPTH);
      // Landed on the TOP sentinel: a tower/popup that had pushed its own
      // entry above us just closed -- not a back-out of the page.
      if (depth >= SENTINEL_DEPTH) return;
      // Spurious pop (grace window / background resume): ignore -- the next
      // gesture tops the buffer up again.
      if (document.visibilityState !== 'visible' || Date.now() < guardReadyAtRef.current) return;
      // A real back press landed inside the buffer (or, after a burst, on the
      // page's own entry): still on the site -- ask. No push here.
      openConfirm(null);
    }

    // Live curtain phase. Nothing is pushed off this event: when the curtain
    // releases the main home, the NEXT genuine gesture on it arms the guard
    // (the founder's own entry tap is already over by the time the phase
    // flips, and a sentinel must be born inside an activation).
    const onPhase = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === 'string') phase = detail;
    };

    const gestureOpts: AddEventListenerOptions = { passive: true, capture: true };
    for (const type of ACTIVATION_EVENTS) window.addEventListener(type, onActivation, gestureOpts);
    window.addEventListener(CINEMA_PHASE_EVENT, onPhase);

    // Re-open the grace window whenever the tab/app regains visibility (the
    // PWA-resume moment that can replay a synthetic pop).
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        guardReadyAtRef.current = Date.now() + SPURIOUS_POP_GRACE_MS;
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // LAST GATE: while the confirm is open on an armed device, the browser's
    // own leave prompt stands behind the buffer -- a burst of back presses
    // that somehow steps past every sentinel still cannot unload the page
    // without an explicit tap. Not registered while the dialog is closed, so
    // a pull-to-refresh or an ordinary link never prompts.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leavingRef.current || !openRef.current || !onHome()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      for (const type of ACTIVATION_EVENTS) window.removeEventListener(type, onActivation, gestureOpts);
      window.removeEventListener(CINEMA_PHASE_EVENT, onPhase);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [openConfirm]);

  // --- PC: ESC toggles the confirm -----------------------------------------------
  useEffect(() => {
    // Capture phase on `window` runs before the Modal's own bubble-phase
    // Escape listener; marking the event handled (preventDefault) tells the
    // Modal to leave it alone so a single key press never closes-then-reopens.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat || e.defaultPrevented) return;
      if (leavingRef.current) return;
      const owner = getGateOwner();
      if (owner === GATE_ID) {
        e.preventDefault();
        if (!busy) openGate(false);
        return;
      }
      if (owner !== null) return; // another popup owns Escape -- let it close
      if (anotherOverlayOpen()) return; // ...same for non-gated overlays
      e.preventDefault();
      openConfirm(null);
    };
    const opts: AddEventListenerOptions = { capture: true };
    window.addEventListener('keydown', onKeyDown, opts);
    return () => window.removeEventListener('keydown', onKeyDown, opts);
  }, [busy, openConfirm, openGate]);

  // On-demand open (no back-gesture involved) -- see `requestAppExit()`.
  useEffect(() => {
    const onExitRequest = (e: Event) => {
      openConfirm((e as CustomEvent<ExitRequestDetail>).detail?.forceRedirectTo ?? null);
    };
    window.addEventListener(EXIT_REQUEST_EVENT, onExitRequest);
    return () => window.removeEventListener(EXIT_REQUEST_EVENT, onExitRequest);
  }, [openConfirm]);

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
    // App: immediate termination, else terminated in place (never a blank
    // document, never a restart on the logo splash).
    executeAppExit({
      fallbackUrl: forceRedirectRef.current ?? `/${locale}`,
      sentinelMarker: GUARD_MARKER,
      sentinelDepthKey: GUARD_DEPTH,
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
