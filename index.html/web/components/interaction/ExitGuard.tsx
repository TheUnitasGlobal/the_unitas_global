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

/** history.state marker of a sentinel entry parked under the page. */
const GUARD_MARKER = 'unitasExitGuard';
/** history.state key holding a sentinel's depth (1 = bottom, 2 = top). */
const GUARD_DEPTH = 'unitasExitDepth';
/** How many sentinel entries are parked beneath the page at all times.
 *  Owner instruction 2026-09-05 (7-point hardening, item 7): ONE sentinel
 *  was beatable by a rapid double-tap of the back button -- the second press
 *  could be committed by the browser before the popstate handler for the
 *  first had re-parked the entry, so the second traversal left the site
 *  outright with the dialog barely painted. Two entries mean a double-tap
 *  merely lands on the page's real entry (still on the site, dialog open);
 *  every pop re-fills the buffer back to two. */
const SENTINEL_DEPTH = 2;
/** Gate id in the site-wide single-open-surface registry (lib/uiGate.ts). */
const GATE_ID = 'exit-guard';
/** Window event any surface can fire to open the same logout/exit confirm
 *  this component shows on a back-gesture -- see `requestAppExit()` below. */
const EXIT_REQUEST_EVENT = 'unitas:app-exit-request';
/** Grace window (ms) after arming / regaining visibility during which an
 *  incoming popstate is treated as synthetic (WebKit PWA history restore,
 *  bfcache resume) rather than a user's back gesture. */
const SPURIOUS_POP_GRACE_MS = 600;

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
 * BOTH channels arm the back-gesture sentinel on a touch / narrow device
 * (owner instruction 2026-09-05, round 11, item 1).
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
 * `executeAppExit()` then falls through to a clean restart at the app root,
 * which -- under the round-11 re-entry reset doctrine
 * (lib/pwa/installPrompt.ts) -- is a brand-new session starting from the
 * logo splash, never the view the visitor left. A desktop App window (fine
 * pointer, wide) has no back button and keeps `window.close()` intact by
 * never arming; it gets the right-click / ESC paths instead.
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

/** PC environment (owner instruction 2026-09-05, 7-point hardening, item
 *  3): a hover-capable fine pointer -- desktop / laptop, online tab or
 *  installed App window alike. Right-click is intercepted only here; a
 *  long-press "context menu" on a phone is a different gesture and stays
 *  native. */
function isDesktopPointer(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

/** Editable targets keep the native context menu (cut / copy / paste --
 *  none of which can navigate away) and are never blocked. */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return Boolean(el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
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

/** Re-fill the sentinel buffer so exactly SENTINEL_DEPTH entries sit above
 *  the page's real entry, whatever depth we are currently parked at. */
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
 * Sovereign exit confirm -- one dialog, every trigger, every channel.
 *
 * MOBILE / TABLET (online tab AND installed App): the "back = leave" gate
 * (owner instruction 2026-09-03; App channel 2026-09-05 round 11 item 1;
 * hardened 2026-09-05 by the 7-point patch, item 7). Once the visitor has
 * produced a single real gesture on the document, the page parks a TWO-deep
 * buffer of same-URL history entries beneath itself; the device's back
 * gesture -- on EVERY page of the funnel: the logo splash, the entry gate,
 * ad stages 1-4, the sealed Coming-Soon screen and the main home alike --
 * pops into that buffer, and instead of bouncing the visitor out (online) or
 * killing the app (App) this opens the confirm: "로그아웃을 하시겠습니까?"
 * (only while signed in) then "종료하시겠습니까?". The buffer is re-filled on
 * every pop, so even a rapid double-tap of the back button only lands on the
 * page's own entry with the dialog open -- the site unloads ONLY on an
 * explicit tap of 종료, which runs the shared exit engine (online: back to the
 * previous page; app: terminate, else a clean restart from the logo
 * splash). Every other path (취소, backdrop, Escape) leaves the visitor
 * exactly where they were.
 *
 * Why a gesture must precede arming: Chromium's history-manipulation
 * intervention marks entries pushed WITHOUT user activation as skippable,
 * and the back button then skips straight past them -- a sentinel parked
 * before the first touch would be silently ignored. The first tap anywhere
 * (the gate button, the screen itself) grants sticky activation and arms
 * the guard for the rest of the document's life. The round-10 curtain-phase
 * precondition (`released` only) is gone: the guard now serves the whole
 * pre-launch funnel, and the phantom-popup bug it worked around was fixed at
 * its root when this dialog moved to the top modal layer (z-680).
 *
 * PC (owner instruction 2026-09-05, 7-point hardening, item 3): a mouse
 * RIGHT-CLICK anywhere (except inside an editable field) suppresses the
 * browser context menu -- whose Back / Reload / Close items are exit paths
 * -- and opens the same confirm; the ESC key TOGGLES it (opens when closed,
 * closes when open). Escape defers to whichever other popup currently holds
 * the site-wide UI gate, so it still closes that popup first.
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

  // --- mobile / tablet: back-gesture sentinel buffer ---------------------------
  useEffect(() => {
    if (!shouldArmBackGuard()) return;

    let gestureSeen = false;
    let armed = false;

    const arm = () => {
      refillSentinels();
      guardReadyAtRef.current = Date.now() + SPURIOUS_POP_GRACE_MS;
    };

    const onPop = (e: PopStateEvent) => {
      if (leavingRef.current) return;
      const depth = readSentinelDepth(e.state, GUARD_MARKER, GUARD_DEPTH);
      // Landed on the TOP sentinel: a tower/popup that had pushed its own
      // entry above us just closed -- not a back-out of the page.
      if (depth >= SENTINEL_DEPTH) return;
      if (document.visibilityState !== 'visible' || Date.now() < guardReadyAtRef.current) {
        // Spurious pop (grace window / background resume) -- re-fill silently.
        arm();
        return;
      }
      // Depth 1 (one press) or 0 (a rapid double-tap ate both entries): we are
      // still on the site. Re-fill the buffer at once, then ask.
      arm();
      openConfirm(null);
    };

    const tryArm = () => {
      if (armed || !gestureSeen) return;
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

    // Re-open the grace window whenever the tab/app regains visibility (the
    // PWA-resume moment that can replay a synthetic pop).
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        guardReadyAtRef.current = Date.now() + SPURIOUS_POP_GRACE_MS;
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('pointerdown', onGesture, gestureOpts);
      window.removeEventListener('touchstart', onGesture, gestureOpts);
      window.removeEventListener('keydown', onGesture, gestureOpts);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [openConfirm]);

  // --- PC: right-click -> confirm; ESC -> toggle ----------------------------------
  useEffect(() => {
    if (!isDesktopPointer()) return;
    const onContextMenu = (e: MouseEvent) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      if (getGateOwner() === GATE_ID) return; // already open -- stay put
      if (getGateOwner() !== null || anotherOverlayOpen()) return; // never stack on a popup
      openConfirm(null);
    };
    window.addEventListener('contextmenu', onContextMenu);
    return () => window.removeEventListener('contextmenu', onContextMenu);
  }, [openConfirm]);

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
    // App: immediate termination, and a clean in-place restart (never a
    // blank document) if the runtime refuses to close.
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
