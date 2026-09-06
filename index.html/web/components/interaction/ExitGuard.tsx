'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { LogOut, Power } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { getGateOwner } from '@/lib/uiGate';
import {
  EXIT_GUARD_ACTIVATION_EVENTS,
  EXIT_GUARD_DEPTH_KEY,
  EXIT_GUARD_MARKER,
  EXIT_GUARD_SENTINEL_DEPTH,
  collapseSentinelBufferNow,
  executeAppExit,
  isDesktopAppWindow,
  isExitInProgress,
  isStandaloneApp,
  readSentinelDepth,
} from '@/lib/exit/appExit';
import {
  EXIT_REQUEST_EVENT,
  advanceExitConfirm,
  exitConfirmPosition,
  initialExitConfirmStep,
  needsDoubleExitConfirm,
  requestAppExit,
  type ExitConfirmStep,
} from '@/lib/exit/exitConfirmFlow';
import { CINEMA_PHASE_EVENT } from '@/lib/foundersGate';

// Re-exported so existing callers keep their import path; the primitive now
// lives with the pure confirm-flow state machine (round 17).
export { requestAppExit };

/** history.state marker of a sentinel entry parked under the page. */
const GUARD_MARKER = EXIT_GUARD_MARKER;
/** history.state key holding a sentinel's depth (1 = bottom, N = top). */
const GUARD_DEPTH = EXIT_GUARD_DEPTH_KEY;
/**
 * How many sentinel entries are parked beneath the page at all times.
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
 * second. So the buffer is (a) DEEP -- a burst of presses has to chew
 * through this many entries before the site's real entry is even reached --
 * and (b) re-filled ONLY from genuine activation gestures (a tap on the
 * dialog's 취소, any touch on the page, the mousedown of a right-click),
 * never from popstate. Every entry is therefore pushed WITH activation and
 * none is ever skippable; a visitor mashing back simply steps down the
 * buffer, and the very next gesture tops it back up. The `beforeunload`
 * gate below is the last line if a burst somehow exhausts it.
 */
const SENTINEL_DEPTH = EXIT_GUARD_SENTINEL_DEPTH;
/** Gate id in the site-wide single-open-surface registry (lib/uiGate.ts). */
const GATE_ID = 'exit-guard';
/** Grace window (ms) after arming / regaining visibility during which an
 *  incoming popstate is treated as synthetic (WebKit PWA history restore,
 *  bfcache resume) rather than a user's back gesture. */
const SPURIOUS_POP_GRACE_MS = 600;
/** The curtain phase on which a back / forward traversal OPENS THE EXIT
 *  CONFIRM: the MAIN HOME. On every other page -- the logo page, the entry
 *  gate, ad stages 1-4 and the sealed Coming-Soon screen -- the same
 *  traversal is swallowed silently: the sentinel buffer absorbs it and
 *  nothing happens (owner instruction 2026-09-05, checklist items 2 + 3:
 *  "무반응"). */
const RELEASED_PHASE = 'released';

type Step = ExitConfirmStep;

/**
 * EVERY device and BOTH channels arm the history sentinel buffer, on EVERY
 * page of the funnel (owner instruction 2026-09-05, checklist items 2 + 3;
 * supersedes round 13's "main home only" and round 11's "touch / narrow
 * only").
 *
 * PC (online tab or installed App window): the browser's right-click context
 * menu carries 뒤로가기 / 앞으로가기, the mouse has X1 / X2 buttons, the
 * keyboard has Alt+Left/Right -- every one of them is a history traversal,
 * and on a single-entry document each one used to eject the visitor. The
 * mousedown of the right-click itself is an activation gesture, so the
 * buffer is parked BEFORE the context menu even opens; its 뒤로가기 then
 * lands inside the buffer (no reaction on the logo / gate / ad / Coming-Soon
 * pages; the exit confirm on the main home) and its 앞으로가기 only ever
 * walks back up our own entries.
 *
 * MOBILE / TABLET (online tab or installed App): the hardware / software back
 * button must NOT close the app or the tab outright; on the main home it
 * opens the z-680 exit confirm and only an explicit 종료 leaves, on every
 * other page it does nothing. The only way a web page can intercept the OS
 * back is to hold extra history entries beneath itself, so the buffer is
 * parked in standalone mode too.
 *
 * DESKTOP APP WINDOW -- the one exception (owner instruction 2026-09-05,
 * round 15, item 1: a PC app's 종료 must genuinely close the window, never
 * leave a black window on the desktop). Chromium refuses `window.close()`
 * while the window's session history holds more than one entry, so an
 * installed app running as a desktop window (fine pointer + hover) keeps its
 * SINGLE launch entry: no sentinel is ever parked under it. It loses
 * nothing -- a desktop window has no hardware back button, and on a
 * single-entry window the context menu's 뒤로가기, Alt+Left and mouse X1 are
 * all no-ops already ("무반응" for free); the main home's exit confirm stays
 * reachable through ESC and the nav's 종료. Phones and tablets keep the
 * buffer (the hardware back button MUST open the confirm on the main home
 * and do nothing elsewhere), so there a refused close still terminates the
 * app IN PLACE (`executeAppExit()`: session wiped, audio silenced, black
 * shroud, one back press collapses the buffer so the next one lets the OS
 * finish the activity) -- a browser-level limit, not fixable with web APIs.
 * A native container (Capacitor / WebView bridge, see lib/exit/appExit.ts)
 * is what ends the process outright on a phone.
 */
function shouldArmBackGuard(): boolean {
  if (typeof window === 'undefined') return false;
  return !isDesktopAppWindow();
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
 * Owned by lib/exit/appExit.ts so the pre-hydration head bootstrap
 * (`EXIT_GUARD_BOOTSTRAP`) listens for exactly the same gestures.
 */
const ACTIVATION_EVENTS = EXIT_GUARD_ACTIVATION_EVENTS;

/**
 * Sovereign exit confirm -- one dialog, every trigger, every channel.
 *
 * HISTORY TRAVERSAL GUARD, EVERY DEVICE, EVERY PAGE (owner instruction
 * 2026-09-05, checklist items 2 + 3; first shipped for mobile 2026-09-03,
 * App channel round 11, main-home-only round 13 -- now superseded): from the
 * visitor's first genuine activation gesture on any page (a tap, a click, a
 * key, the mousedown of a right-click) the page parks a deep buffer of
 * same-URL history entries beneath itself. Every back / forward traversal
 * -- the phone's back button, the PC context menu's 뒤로가기 / 앞으로가기,
 * mouse X1/X2, Alt+arrows, the toolbar buttons -- then lands inside that
 * buffer, on the same document, and:
 *
 *   - on the logo page, the entry gate, ad stages 1-4 and the sealed
 *     Coming-Soon screen: NOTHING happens ("무반응"). No dialog, no exit.
 *   - on the MAIN HOME: the confirm opens -- "로그아웃을 하시겠습니까?" (only
 *     while signed in) then "종료하시겠습니까?" -- and the site unloads ONLY
 *     on an explicit tap of 종료, which runs the shared exit engine
 *     (online: back to the page the visitor came from; App: terminate).
 *     Every other path (취소, backdrop, Escape) leaves the visitor exactly
 *     where they were.
 *
 * TWO-STEP DOUBLE CONFIRM ON THE APP CHANNEL (round 17, owner instruction
 * 2026-09-06): an installed app's confirmed exit is terminal (process kill /
 * window close / black shroud), so there the exit question is asked TWICE in
 * two consecutive dialogs of the same design -- "정말 종료하시겠습니까?" and
 * then "종료 버튼을 한 번 더 누르면 앱이 완전히 종료됩니다" -- and only the
 * second explicit 종료 runs the engine, which collapses the sentinel buffer
 * and ends the app on that very tap. The sealed Coming-Soon screen's 'X 종료'
 * joins this flow on the App channel through `requestAppExit()` (online it
 * still tunnels straight into the engine, round 10 item 6). The sequence is
 * the pure state machine in lib/exit/exitConfirmFlow.ts.
 *
 * FINAL-DIALOG PRE-COLLAPSE ON PHONE / TABLET APPS (round 18, owner
 * instruction 2026-09-06, "블랙 스크린 렌더링 프리즈 긴급 패치"): the instant
 * the FINAL dialog opens, the sentinel buffer is collapsed to the page's
 * real entry (a same-document `history.go(-depth)` -- no activation needed,
 * nothing re-renders, the dialog stays). While the visitor reads "종료
 * 버튼을 한 번 더 누르면 앱이 완전히 종료됩니다" the app therefore already
 * sits on its launch entry, and the hardware back press -- the only thing
 * that can end a shell-less PWA's activity -- is no longer swallowed by a
 * sentinel: the OS finishes the app AT ONCE, with no black shroud and no
 * further gesture. The 종료 button on that dialog runs the shared engine
 * (shell kill / window.close / terminate-in-place with the whole stack
 * collapsed), after which the very next back press ends the app. To keep
 * the collapsed state, the activation gesture of that final tap does NOT
 * top the buffer back up (`finalArmedRef`); 취소 / backdrop / Escape on the
 * final dialog re-park the full buffer from inside their own gesture, so
 * the page is exactly as guarded as before the visitor ever pressed back.
 *
 * Further presses only step down the buffer; every activation gesture (the
 * tap on 취소 included) tops it back up. Should a burst of presses ever
 * exhaust the buffer while the dialog is open, `beforeunload` raises the
 * browser's own leave prompt as the last gate -- so no sequence of back
 * presses, however long, can end the session without an explicit tap.
 *
 * Why a gesture must precede arming: Chromium's history-manipulation
 * intervention marks entries pushed WITHOUT user activation as skippable,
 * and the back button then skips straight past them -- a sentinel parked
 * before the first touch would be silently ignored. A back press on the 3s
 * logo page before the visitor has touched anything therefore stays native;
 * that is a browser-level limit, not a bug to retry.
 *
 * THE LOGO PAGE (round 16, owner instruction 2026-09-05 mobile-app
 * hardening, item 1): this component lives inside the `[locale]` layout and
 * hydrates LATE on a phone -- often after most of the 3s logo page -- so a
 * tap on the logo page used to arm nothing and the next hardware back press
 * finished the installed app. The head bootstrap `EXIT_GUARD_BOOTSTRAP`
 * (lib/exit/appExit.ts, injected by app/layout.tsx) now parks the very
 * same buffer from the first gesture of the document; on mount this
 * component adopts whatever depth it finds (listens for traversals at once,
 * pushes nothing until the next gesture) and raises `__unitasExitGuardLive`
 * so the bootstrap stands down.
 *
 * PC: the native right-click context menu is left intact (round 13) -- its
 * 뒤로가기 / 앞으로가기 are neutralised by the buffer, not by hiding the
 * menu. The ESC key still TOGGLES the confirm (opens when closed, closes
 * when open), deferring to whichever other popup holds the site-wide UI
 * gate.
 *
 * Desktop APP windows are the single exception (round 15): they keep a
 * one-entry history so 종료 can genuinely close the window -- see
 * `shouldArmBackGuard()`.
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
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>('exit');
  /** App channel: the exit question is asked twice (round 17). Resolved on
   *  every open, never at render time -- `isStandaloneApp()` needs `window`. */
  const [doubleConfirm, setDoubleConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const leavingRef = useRef(false);
  /** Timestamp (ms) before which an incoming popstate is treated as a
   *  spurious/synthetic event rather than a real user back-gesture. */
  const guardReadyAtRef = useRef(0);
  const openRef = useRef(gate.open);
  openRef.current = gate.open;
  /** Round 18: the FINAL App-channel dialog is showing with the sentinel
   *  buffer pre-collapsed beneath it -- activation gestures must not re-park
   *  the buffer until the visitor backs out of the dialog. */
  const finalArmedRef = useRef(false);

  const openGate = gate.setOpen;

  /** Open the confirm (logout step first while signed in). While it is
   *  already open -- a second back press, a repeated ESC / exit request --
   *  the dialog keeps the step the visitor is on: a press on the final
   *  App-channel confirm must never quietly rewind it to step one. */
  const openConfirm = useCallback(() => {
    if (leavingRef.current) return;
    if (openRef.current) return;
    try {
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      // nothing focused
    }
    setDoubleConfirm(needsDoubleExitConfirm(isStandaloneApp()));
    setStep(initialExitConfirmStep(Boolean(sessionRef.current)));
    openGate(true, { force: true });
  }, [openGate]);

  // --- every device, every page: history-traversal sentinel buffer -------------
  useEffect(() => {
    if (!shouldArmBackGuard()) return;

    // Round 16 (item 1): from here on the React guard owns the buffer; the
    // pre-hydration head bootstrap (lib/exit/appExit.ts EXIT_GUARD_BOOTSTRAP)
    // stands down on its next gesture.
    window.__unitasExitGuardLive = true;

    let phase = readCinemaPhase();
    let armed = false;

    const onHome = () => phase === RELEASED_PHASE;

    const topUp = () => {
      if (foreignEntryOnTop()) return;
      refillSentinels();
    };

    const arm = (push: boolean) => {
      if (armed) return;
      armed = true;
      if (push) topUp();
      guardReadyAtRef.current = Date.now() + SPURIOUS_POP_GRACE_MS;
      window.addEventListener('popstate', onPop);
    };

    // Genuine activation gesture ANYWHERE in the funnel -- logo page, entry
    // gate, ad stages, sealed Coming-Soon, main home: arm on the first, top
    // the buffer back up on every later one. Never inside popstate (see
    // SENTINEL_DEPTH). On a PC the `mousedown` of a right-click is such a
    // gesture, so the buffer is in place before the context menu opens.
    const onActivation = () => {
      // A confirmed exit (this dialog's 종료 OR the Coming-Soon 'X 종료',
      // which tunnels straight into the engine) ends all arming: a tap on
      // the terminal shroud must not re-park the buffer that the shroud's
      // own back handler is collapsing (round 15).
      if (leavingRef.current || isExitInProgress()) return;
      // Round 18: under the FINAL dialog the buffer is deliberately
      // collapsed -- the gesture of the final 종료 tap (this very event, in
      // the capture phase, before the button's onClick) must not re-park
      // it. 취소 / backdrop / Escape re-arm explicitly from their handlers.
      if (finalArmedRef.current) return;
      if (!armed) {
        arm(true);
        return;
      }
      topUp();
    };

    function onPop(e: PopStateEvent) {
      if (leavingRef.current || isExitInProgress()) return;
      const depth = readSentinelDepth(e.state, GUARD_MARKER, GUARD_DEPTH);
      // Landed on the TOP sentinel: a tower/popup that had pushed its own
      // entry above us just closed (or a forward traversal walked back up
      // our own buffer) -- not a back-out of the page.
      if (depth >= SENTINEL_DEPTH) return;
      // Off the main home (logo / gate / ad / Coming-Soon): the buffer has
      // absorbed the traversal and the visitor is still exactly where they
      // were -- "무반응". No dialog, no push.
      if (!onHome()) return;
      // Spurious pop (grace window / background resume): ignore -- the next
      // gesture tops the buffer up again.
      if (document.visibilityState !== 'visible' || Date.now() < guardReadyAtRef.current) return;
      // A real back / forward press landed inside the buffer (or, after a
      // burst, on the page's own entry) on the main home: still on the site
      // -- ask. No push here.
      openConfirm();
    }

    // Live curtain phase. Nothing is pushed off this event -- a sentinel must
    // be born inside an activation; the buffer parked on the earlier pages
    // simply carries over into the main home.
    const onPhase = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === 'string') phase = detail;
    };

    const gestureOpts: AddEventListenerOptions = { passive: true, capture: true };
    for (const type of ACTIVATION_EVENTS) window.addEventListener(type, onActivation, gestureOpts);
    window.addEventListener(CINEMA_PHASE_EVENT, onPhase);

    // Round 16 (item 1): the head bootstrap may already have parked the
    // buffer on a gesture that landed BEFORE this component hydrated (a tap
    // on the 3s logo page). Adopt it: listen for traversals from this very
    // moment so a back press inside that buffer is handled here, but push
    // NOTHING -- a sentinel must be born inside an activation gesture, and
    // the next gesture tops the buffer up through `onActivation` anyway.
    if (!isExitInProgress() && currentDepth() > 0) arm(false);

    // Re-open the grace window whenever the tab/app regains visibility (the
    // PWA-resume moment that can replay a synthetic pop).
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        guardReadyAtRef.current = Date.now() + SPURIOUS_POP_GRACE_MS;
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // LAST GATE: while the confirm is open on the main home, the browser's
    // own leave prompt stands behind the buffer -- a burst of back presses
    // that somehow steps past every sentinel still cannot unload the page
    // without an explicit tap. Not registered while the dialog is closed, so
    // a pull-to-refresh, an F5 or an ordinary link never prompts.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leavingRef.current || !openRef.current || !onHome()) return;
      // Round 18: on the FINAL App-channel dialog the buffer is collapsed on
      // purpose so the OS back press ends the app -- that unload IS the
      // visitor's second confirmation, never something to prompt about.
      if (finalArmedRef.current) return;
      e.preventDefault();
      // Legacy engines (Chromium < 119) prompt only on a truthy returnValue.
      e.returnValue = true;
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      delete window.__unitasExitGuardLive;
      for (const type of ACTIVATION_EVENTS) window.removeEventListener(type, onActivation, gestureOpts);
      window.removeEventListener(CINEMA_PHASE_EVENT, onPhase);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [openConfirm]);

  /** Dismiss the dialog (취소, backdrop, Escape) -- the visitor stays exactly
   *  where they were. Round 18: leaving the FINAL App-channel dialog re-parks
   *  the sentinel buffer that was pre-collapsed beneath it, from inside this
   *  very gesture (the only place a non-skippable entry can be born), so the
   *  page is as guarded as before the visitor ever pressed back. */
  const close = useCallback(() => {
    if (busy) return;
    if (finalArmedRef.current) {
      finalArmedRef.current = false;
      if (shouldArmBackGuard() && !foreignEntryOnTop()) refillSentinels();
    }
    openGate(false);
  }, [busy, openGate]);

  // Round 18: whatever closes the gate (another surface claiming it, a
  // programmatic close) ends the final-dialog state; the buffer is then
  // topped back up by the visitor's next activation gesture as usual.
  useEffect(() => {
    if (!gate.open) finalArmedRef.current = false;
  }, [gate.open]);

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
        close();
        return;
      }
      if (owner !== null) return; // another popup owns Escape -- let it close
      if (anotherOverlayOpen()) return; // ...same for non-gated overlays
      e.preventDefault();
      openConfirm();
    };
    const opts: AddEventListenerOptions = { capture: true };
    window.addEventListener('keydown', onKeyDown, opts);
    return () => window.removeEventListener('keydown', onKeyDown, opts);
  }, [close, openConfirm]);

  // On-demand open (no back-gesture involved) -- see `requestAppExit()`.
  useEffect(() => {
    const onExitRequest = () => openConfirm();
    window.addEventListener(EXIT_REQUEST_EVENT, onExitRequest);
    return () => window.removeEventListener(EXIT_REQUEST_EVENT, onExitRequest);
  }, [openConfirm]);

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
    if (busy || leavingRef.current) return;
    // Round 17: on the App channel the first 종료 only advances to the
    // FINAL confirm ("종료 버튼을 한 번 더 누르면 앱이 완전히 종료됩니다");
    // nothing leaves, nothing is wiped. Online the single confirm is final.
    const next = advanceExitConfirm(step, doubleConfirm);
    if (next) {
      setStep(next);
      // Round 18: the FINAL dialog opens over an already-collapsed sentinel
      // buffer on a phone / tablet app (this tap's activation topped it up
      // in the capture phase a moment ago; the same-document traversal here
      // needs none). The app now sits on its real entry: the hardware back
      // press ends the activity outright -- no shroud, no extra gesture --
      // and the 종료 button below still runs the full engine.
      if (next === 'exit-final' && shouldArmBackGuard()) {
        finalArmedRef.current = true;
        collapseSentinelBufferNow();
      }
      return;
    }
    leavingRef.current = true;
    finalArmedRef.current = false;
    setBusy(true);
    // Owner instruction 2026-09-05 (round 10, item 5): one shared engine
    // decides the channel -- online: back to the previous (search) page;
    // App: immediate termination, else terminated in place (never a blank
    // document, never a restart on the logo splash). Round 16: on a phone
    // app the sentinel buffer collapses to the real entry on this very tap;
    // round 18: the WHOLE stack, down to the document's launch entry;
    // round 19: the React tree is unmounted (this dialog included), the
    // session + founder-token remnants purged and the surviving history
    // entry sealed to the clean launch URL -- nothing is left for the OS
    // task switcher to keep but the app's own closed cover.
    executeAppExit({
      sentinelMarker: GUARD_MARKER,
      sentinelDepthKey: GUARD_DEPTH,
      sentinelCapacity: SENTINEL_DEPTH,
    });
  }

  const titleId = 'exit-guard-title';
  const isLogout = step === 'logout';
  const isFinal = step === 'exit-final';
  const position = exitConfirmPosition(step, doubleConfirm);
  const title = isLogout
    ? t('logoutTitle')
    : isFinal
      ? t('appExitFinalTitle')
      : doubleConfirm
        ? t('appExitTitle')
        : t('exitTitle');
  const body = isLogout
    ? t('logoutBody')
    : isFinal
      ? t('appExitFinalBody')
      : doubleConfirm
        ? t('appExitBody')
        : t('exitBody');

  return (
    <Modal open={gate.open} onClose={close} labelledBy={titleId} hideCloseButton layer="top">
      {/* Keyed on the step so every advance (logout -> exit -> final) plays
          as a fresh dialog sliding into the same glass panel -- the App
          channel's second confirm reads as a NEW popup opening in sequence,
          not as a title silently changing under the visitor's thumb. */}
      <motion.div
        key={step}
        className="flex flex-col gap-5"
        initial={reducedMotion ? false : { opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center border ${
              isFinal
                ? 'animate-pulse border-red-400/70 bg-red-500/15 text-red-200'
                : 'border-accent/50 bg-accent/10 text-accent'
            }`}
          >
            {isLogout ? <LogOut size={20} aria-hidden="true" /> : <Power size={20} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            {position && (
              /* Round 17: the App channel's "1 / 2 -> 2 / 2" progress -- the
                 visitor always knows one more explicit tap stands between
                 them and a closed app. */
              <div className="mb-1 flex items-center gap-2">
                <span className="flex items-center gap-1" aria-hidden="true">
                  {Array.from({ length: position.total }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1 w-4 transition-colors ${
                        i < position.current ? (isFinal ? 'bg-red-300' : 'bg-accent') : 'bg-white/15'
                      }`}
                    />
                  ))}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-[0.22em] ${isFinal ? 'text-red-200/90' : 'text-accent/80'}`}
                >
                  {t('appExitStep', { current: position.current, total: position.total })}
                </span>
              </div>
            )}
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
                nowrap must not push the line past the panel edge.
                Round 17: the App channel's FINAL title ("종료 버튼을 한 번 더
                누르면 앱이 완전히 종료됩니다") is a full sentence that no
                single line can hold at 320px -- it takes the wrapping style. */}
            <h2
              id={titleId}
              className={
                locale === 'ko' && !isFinal
                  ? 'whitespace-nowrap text-[14px] font-bold tracking-tight text-white sm:text-xl sm:tracking-normal'
                  : isFinal
                    ? 'text-[15px] font-bold leading-snug text-white sm:text-lg'
                    : 'text-base font-bold leading-snug text-white sm:text-xl'
              }
            >
              {title}
            </h2>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-gray-300">{body}</p>

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
                : isFinal
                  ? 'border-red-400 bg-red-500/30 text-red-50 shadow-[0_0_28px_rgba(248,113,113,0.35)] hover:bg-red-500/40'
                  : 'border-red-400/70 bg-red-500/15 text-red-200 hover:bg-red-500/25'
            }`}
          >
            {isLogout ? t('logoutConfirm') : t('exitConfirm')}
          </button>
        </div>
      </motion.div>
    </Modal>
  );
}
