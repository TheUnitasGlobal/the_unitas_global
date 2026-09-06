// Sovereign omni-channel exit doctrine (owner instruction 2026-09-05, round
// 10, items 5 + 6). ONE primitive every "leave the site / close the app"
// affordance routes through -- ExitGuard's confirmed 종료 button and the
// Coming-Soon sealed screen's 'X' -- so the two channels the doctrine names
// behave identically everywhere they are reached from:
//
//   ONLINE (browser tab -- PC, mobile, tablet, anything):
//     return to the page the visitor came from ("이전 검색 페이지로 복귀").
//     A fresh tab with nothing behind it is closed outright when the browser
//     permits (Chromium/Firefox allow `window.close()` on a tab whose session
//     history holds a single document, even one not opened by script); if
//     neither is possible the external referrer is used, and as a last resort
//     the page hard-refreshes in place -- never a dead-end notice, never a
//     blank document.
//
//   APP (installed PWA / native container, any device):
//     terminate immediately and drop the visitor back onto the launcher /
//     desktop -- the app PROCESS / WINDOW must actually end, with no ghost
//     running in the background and no window left on the desktop (owner
//     instruction 2026-09-05, round 15, item 1: "완전한 강제 종료").
//     Three native interface handlers run in order, inside the gesture:
//
//       1. NATIVE CONTAINER BRIDGE (`requestNativeAppExit`, below): when the
//          site is wrapped by a native shell -- Capacitor, Cordova, an Android
//          WebView JavaScript interface, an iOS WKWebView message handler, a
//          React Native WebView, Electron, Tauri, NW.js, Flutter InAppWebView
//          or the UNITAS-specific `UnitasNative` / `UnitasBridge` objects --
//          the shell's own exit API is invoked, which kills the process
//          outright (the only thing that can, on a phone).
//       2. `window.close()` -- the one web API that genuinely ends an
//          installed PWA's window. Chromium / WebKit honour it only while the
//          window's session history holds ONE entry, which is why ExitGuard
//          (components/interaction/ExitGuard.tsx) no longer parks its
//          back-gesture sentinel buffer under a DESKTOP app window (a PC app
//          window has no hardware back button and a single-entry window's
//          Alt+Left / context-menu 뒤로가기 is a no-op anyway): a PC app's
//          종료 / 'X 종료' closes the window for real.
//       3. Where the runtime still refuses (an iOS home-screen app, which
//          exposes no close path at all; a phone / tablet PWA whose
//          hardware-back sentinel buffer is parked, which round 14 requires;
//          an app that has navigated between routes) the app is TERMINATED
//          IN PLACE instead of being restarted on the logo splash (the
//          round-10/11 fallback the owner rejected as "리다이렉트"): the tab's
//          session is wiped, every audio engine is told to stop, and an
//          opaque black shroud covers the document -- the app is visibly
//          over, no dead-end notice, no `about:blank`. While the shroud is
//          up the FIRST hardware back press collapses the whole sentinel
//          buffer to the app's real entry, so the very next press lets the
//          OS finish the activity (round 15) -- the visitor is never asked
//          to mash back a dozen times through a dead app. The next time the
//          OS brings that document back to the foreground (a launcher tap on
//          the still-resident activity, a bfcache restore) it reloads itself
//          into a brand-new session that opens on the logo splash, under the
//          round-11 re-entry reset doctrine (lib/pwa/installPrompt.ts).
//
// `planExit()` is pure (no DOM) so the branching is unit-tested in
// __tests__/exit/appExit.test.ts; `executeAppExit()` is the thin browser
// runner around it. `findNativeExitBridge()` is pure over a host object for
// the same reason.

export type ExitChannel = 'app' | 'online';

/**
 * ExitGuard's sentinel-history contract (components/interaction/ExitGuard.tsx
 * parks the entries; the Coming-Soon 'X 종료' and ExitGuard's own 종료 both
 * hand these to `executeAppExit` so the online channel steps over the whole
 * buffer in one traversal). Owned here so the two callers can never drift.
 */
/** history.state marker of a sentinel entry parked under the page. */
export const EXIT_GUARD_MARKER = 'unitasExitGuard';
/** history.state key holding a sentinel's depth (1 = bottom, N = top). */
export const EXIT_GUARD_DEPTH_KEY = 'unitasExitDepth';
/**
 * How many sentinel entries are parked beneath the page at all times once
 * armed (see ExitGuard for why the buffer is this deep and why it is only
 * ever filled from inside a genuine activation gesture).
 */
export const EXIT_GUARD_SENTINEL_DEPTH = 12;

export interface ExitEnvironment {
  /** Running as an installed app (display-mode: standalone / iOS standalone). */
  standalone: boolean;
  /** `history.length` -- an upper bound on how many entries sit behind us
   *  (it counts FORWARD entries too, which is why `sentinelCapacity` below
   *  matters). */
  historyLength: number;
  /** How many of ExitGuard's synthetic sentinel entries sit between the
   *  CURRENT entry and the page's real entry, inclusive of the current one:
   *  0 = we are on the real entry, 1 = one sentinel above it, N = we are on
   *  the top of a fully parked N-deep buffer. */
  sentinelDepth: number;
  /** The buffer's FULL depth once armed (0 / omitted = no buffer is ever
   *  parked). When the visitor has stepped down into the buffer with the
   *  back gesture, the entries above them still count in `history.length`
   *  as forward entries; knowing the capacity lets the planner tell "there
   *  is a page behind our real entry" from "those are only our own forward
   *  sentinels", so it never fires a `history.go()` that lands nowhere. */
  sentinelCapacity?: number;
  /** `document.referrer` (may be empty). */
  referrer: string;
  /** `location.origin` -- a same-origin referrer is not "the previous site". */
  origin: string;
}

export type ExitStep =
  /** Ask the native shell (if any) to kill the app process -- see
   *  `requestNativeAppExit`. A no-op in a plain browser / PWA. */
  | { kind: 'native-exit' }
  | { kind: 'close' }
  | { kind: 'history-back'; steps: number }
  | { kind: 'navigate'; url: string; replace: boolean }
  /** Terminate in place: wipe the session, silence every audio engine and
   *  cover the document with an opaque black shroud (App channel only). */
  | { kind: 'terminate' };

export interface ExitPlan {
  channel: ExitChannel;
  /** Fired synchronously, in order, inside the user gesture. */
  immediate: ExitStep[];
  /** Fired only if the document is still visible after LEAVE_SETTLE_MS. */
  fallback: ExitStep;
}

/** Give a leave attempt this long to actually unload before admitting the
 *  runtime refused it and running the plan's fallback. */
export const LEAVE_SETTLE_MS = 450;

/** Pure: is `referrer` an external http(s) page we can hand the visitor back to? */
export function isExternalReferrer(referrer: string, origin: string): boolean {
  if (!referrer) return false;
  try {
    const url = new URL(referrer);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.origin !== origin;
  } catch {
    return false;
  }
}

/**
 * Pure planner. Neither channel navigates back onto the site on refusal any
 * more (round 13): the App channel terminates in place, the online channel
 * hands the visitor to the external page they came from when one is known
 * and otherwise terminates in place as well -- an exit never turns into a
 * restart on the logo splash.
 */
export function planExit(env: ExitEnvironment): ExitPlan {
  if (env.standalone) {
    return {
      channel: 'app',
      // Round 15: the native shell's exit API first (kills the process
      // outright inside a container), then the web window close.
      immediate: [{ kind: 'native-exit' }, { kind: 'close' }],
      // Round 13: a refused close TERMINATES the app in place (session wiped,
      // audio silenced, black shroud) -- never a restart on the logo splash,
      // never `about:blank`.
      fallback: { kind: 'terminate' },
    };
  }

  const depth = Math.max(0, Math.floor(env.sentinelDepth || 0));
  // Entries of OURS between the page's real entry and the top of the buffer:
  // the ones we are standing on (`depth`) plus, when we have stepped down
  // into an armed buffer, the forward sentinels still above us.
  const capacity = Math.max(depth, Math.max(0, Math.floor(env.sentinelCapacity || 0)));
  const ownEntries = 1 + depth;
  const ownFootprint = 1 + (depth > 0 ? capacity : 0);
  const immediate: ExitStep[] =
    env.historyLength > ownFootprint
      ? [{ kind: 'history-back', steps: ownEntries }]
      : [{ kind: 'close' }];

  const fallback: ExitStep = isExternalReferrer(env.referrer, env.origin)
    ? { kind: 'navigate', url: env.referrer, replace: false }
    : { kind: 'terminate' };

  return { channel: 'online', immediate, fallback };
}

// ---------------------------------------------------------------------------
// browser runner
// ---------------------------------------------------------------------------

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
      window.matchMedia?.('(display-mode: minimal-ui)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/**
 * An installed app running as a DESKTOP window (PC / laptop: a fine pointer
 * that can hover). Such a window has no hardware back button, so ExitGuard
 * leaves its session history at the single launch entry and `window.close()`
 * genuinely closes the window on 종료 (round 15, item 1). Phones and tablets
 * (coarse pointer) are NOT desktop windows even when installed.
 */
export function isDesktopAppWindow(): boolean {
  if (!isStandaloneApp()) return false;
  try {
    return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// native container bridges (round 15, item 1)
// ---------------------------------------------------------------------------

/** A native shell's exit entry point, resolved against the host `window`. */
export interface NativeExitBridge {
  /** Which shell answered (for diagnostics / tests). */
  name: string;
  /** Invoke the shell's exit. May throw -- callers swallow. */
  invoke: () => void;
}

type AnyRecord = Record<string, unknown>;

function rec(value: unknown): AnyRecord | null {
  return value && (typeof value === 'object' || typeof value === 'function') ? (value as AnyRecord) : null;
}

function fn(value: unknown): ((...args: unknown[]) => unknown) | null {
  return typeof value === 'function' ? (value as (...args: unknown[]) => unknown) : null;
}

/** Message every postMessage-style bridge receives. */
export const NATIVE_EXIT_MESSAGE = 'unitas:exit';

/**
 * Pure: find the FIRST native shell exit API exposed on `host` (normally
 * `window`). Probed in order, most specific first:
 *
 *   UnitasNative.exitApp() / UnitasBridge.exit()      -- UNITAS's own shells
 *   Capacitor.Plugins.App.exitApp()                   -- Capacitor 3+
 *   navigator.app.exitApp()                           -- Cordova
 *   Android.exitApp() / Android.finish()              -- Android WebView
 *   AndroidInterface.exitApp()                          JavascriptInterface
 *   webkit.messageHandlers.unitasExit.postMessage()   -- iOS WKWebView
 *   webkit.messageHandlers.exitApp.postMessage()
 *   ReactNativeWebView.postMessage('unitas:exit')     -- React Native WebView
 *   flutter_inappwebview.callHandler('exitApp')       -- Flutter InAppWebView
 *   electronAPI.exitApp() / unitasDesktop.exit()      -- Electron preload
 *   electron.close()
 *   __TAURI__.process.exit(0) / window.getCurrent().close() -- Tauri
 *   nw.App.quit()                                     -- NW.js
 *
 * Returns null in a plain browser / PWA, where no shell exists.
 */
export function findNativeExitBridge(host: unknown): NativeExitBridge | null {
  const w = rec(host);
  if (!w) return null;

  // [display name, owner object, method name, call arguments]
  const direct: Array<[string, unknown, string, unknown[]]> = [
    ['UnitasNative.exitApp', w.UnitasNative, 'exitApp', []],
    ['UnitasNative.exit', w.UnitasNative, 'exit', []],
    ['UnitasBridge.exitApp', w.UnitasBridge, 'exitApp', []],
    ['UnitasBridge.exit', w.UnitasBridge, 'exit', []],
    ['Capacitor.Plugins.App.exitApp', rec(rec(w.Capacitor)?.Plugins)?.App, 'exitApp', []],
    ['navigator.app.exitApp', rec(w.navigator)?.app, 'exitApp', []],
    ['Android.exitApp', w.Android, 'exitApp', []],
    ['Android.finish', w.Android, 'finish', []],
    ['AndroidInterface.exitApp', w.AndroidInterface, 'exitApp', []],
    ['AndroidInterface.finish', w.AndroidInterface, 'finish', []],
    ['electronAPI.exitApp', w.electronAPI, 'exitApp', []],
    ['electronAPI.close', w.electronAPI, 'close', []],
    ['unitasDesktop.exit', w.unitasDesktop, 'exit', []],
    ['electron.close', w.electron, 'close', []],
    ['__TAURI__.process.exit', rec(w.__TAURI__)?.process, 'exit', [0]],
    ['nw.App.quit', rec(w.nw)?.App, 'quit', []],
  ];
  for (const [name, owner, method, args] of direct) {
    const target = rec(owner);
    const call = target ? fn(target[method]) : null;
    if (target && call) {
      return { name, invoke: () => void call.apply(target, args) };
    }
  }

  // Tauri v1/v2 window handle.
  const tauriWindow = rec(rec(w.__TAURI__)?.window);
  const getCurrent = tauriWindow ? fn(tauriWindow.getCurrentWindow) ?? fn(tauriWindow.getCurrent) : null;
  if (tauriWindow && getCurrent) {
    return {
      name: '__TAURI__.window.getCurrent().close',
      invoke: () => {
        const current = rec(getCurrent.call(tauriWindow));
        const close = current ? fn(current.close) : null;
        if (current && close) void close.call(current);
      },
    };
  }

  // iOS WKWebView script message handlers.
  const handlers = rec(rec(w.webkit)?.messageHandlers);
  for (const key of ['unitasExit', 'exitApp', 'closeApp']) {
    const handler = handlers ? rec(handlers[key]) : null;
    const post = handler ? fn(handler.postMessage) : null;
    if (handler && post) {
      return { name: `webkit.messageHandlers.${key}`, invoke: () => void post.call(handler, NATIVE_EXIT_MESSAGE) };
    }
  }

  // React Native WebView.
  const rn = rec(w.ReactNativeWebView);
  const rnPost = rn ? fn(rn.postMessage) : null;
  if (rn && rnPost) {
    return {
      name: 'ReactNativeWebView.postMessage',
      invoke: () => void rnPost.call(rn, JSON.stringify({ type: NATIVE_EXIT_MESSAGE })),
    };
  }

  // Flutter InAppWebView.
  const flutter = rec(w.flutter_inappwebview);
  const callHandler = flutter ? fn(flutter.callHandler) : null;
  if (flutter && callHandler) {
    return { name: 'flutter_inappwebview.callHandler(exitApp)', invoke: () => void callHandler.call(flutter, 'exitApp') };
  }

  return null;
}

/**
 * Invoke the native shell's exit if one is present. Returns true when a
 * bridge was found and called (the process is expected to die; nothing after
 * this needs to succeed). False in a plain browser / PWA.
 */
export function requestNativeAppExit(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = findNativeExitBridge(window);
  if (!bridge) return false;
  try {
    bridge.invoke();
  } catch {
    /* a broken bridge must never throw out of the gesture handler */
  }
  return true;
}

/**
 * Window event fired the instant an exit is confirmed (before the first
 * step runs) and again if the runtime refuses and the app is terminated in
 * place. Every audio engine on the page (the Coming-Soon ambient bed, the
 * site-wide spatial SFX provider, the splash score) listens and goes silent,
 * so a black terminated app can never keep humming underneath.
 */
export const APP_EXIT_EVENT = 'unitas:app-exit';
/** `data-` attribute stamped on <html> while the terminal shroud is up. */
export const TERMINATED_ATTR = 'data-unitas-terminated';

/** Wipe the tab's session -- the session is OVER the moment an exit is
 *  confirmed, whatever the runtime does next. localStorage (audio / locale
 *  preferences, the wallet's remembered device) is deliberately kept: those
 *  are the visitor's settings, not this session's state. */
function clearSession(): void {
  try {
    window.sessionStorage.clear();
  } catch {
    /* storage blocked -- nothing to clear */
  }
}

function announceExit(): void {
  try {
    window.dispatchEvent(new CustomEvent(APP_EXIT_EVENT));
  } catch {
    /* no-op */
  }
}

/**
 * Terminate in place (App channel, runtime refused `window.close()`): the
 * document goes opaque black, nothing underneath is reachable, and the next
 * time the OS brings this (still resident) document back to the foreground
 * it reloads into a fresh session that starts on the logo splash. No text,
 * no button -- a closed app shows nothing.
 */
function terminateInPlace(): void {
  clearSession();
  announceExit();
  try {
    if (document.documentElement.hasAttribute(TERMINATED_ATTR)) return;
    document.documentElement.setAttribute(TERMINATED_ATTR, '1');
    const shroud = document.createElement('div');
    shroud.setAttribute('role', 'presentation');
    shroud.setAttribute('aria-hidden', 'true');
    shroud.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:#000;pointer-events:auto;touch-action:none;overscroll-behavior:none;';
    document.documentElement.appendChild(shroud);
    document.documentElement.style.background = '#000';
    try {
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      /* nothing focused */
    }
    // Resident activity brought back to the foreground (launcher tap, task
    // switcher, bfcache restore): start over from the logo page.
    let wasHidden = document.visibilityState === 'hidden';
    const revive = () => {
      try {
        window.location.reload();
      } catch {
        /* no-op */
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
        return;
      }
      if (wasHidden) revive();
    });
    window.addEventListener('pageshow', (e) => {
      if ((e as PageTransitionEvent).persisted) revive();
    });
    // Round 15: a terminated app must not need a dozen back presses to die.
    // ExitGuard parks a deep sentinel buffer under the page (phones /
    // tablets); the FIRST hardware back press after termination lands on a
    // sentinel, and we immediately collapse the rest of the buffer to the
    // app's real entry (a traversal needs no activation). The very NEXT back
    // press then leaves the document -- on an installed app the OS finishes
    // the activity, in a tab the browser goes to the page before the site.
    collapseSentinelsOnNextPop();
  } catch {
    /* DOM unavailable -- the session wipe above is still done */
  }
}

/** After termination: one back press walks the sentinel buffer down to the
 *  real entry so the next one exits (see `terminateInPlace`). */
function collapseSentinelsOnNextPop(): void {
  const onPop = (e: PopStateEvent) => {
    const depth = readSentinelDepth(e.state, EXIT_GUARD_MARKER, EXIT_GUARD_DEPTH_KEY);
    if (depth <= 0) return;
    try {
      window.history.go(-depth);
    } catch {
      /* no-op */
    }
  };
  window.addEventListener('popstate', onPop);
}

function runStep(step: ExitStep): void {
  try {
    switch (step.kind) {
      case 'native-exit':
        requestNativeAppExit();
        return;
      case 'close':
        window.close();
        return;
      case 'history-back':
        window.history.go(-step.steps);
        return;
      case 'navigate':
        if (step.replace) window.location.replace(step.url);
        else window.location.href = step.url;
        return;
      case 'terminate':
        terminateInPlace();
        return;
    }
  } catch {
    /* a refused step must never throw out of the gesture handler */
  }
}

let leaving = false;

/** True once an exit has been started on this document (callers can dedupe). */
export function isExitInProgress(): boolean {
  return leaving;
}

export interface ExecuteAppExitOptions {
  /** ExitGuard's sentinel-history marker key, if the caller parks one. */
  sentinelMarker?: string;
  /** history.state key holding the sentinel's depth (1 = bottom sentinel,
   *  N = top of the buffer). A marked entry without it counts as depth 1. */
  sentinelDepthKey?: string;
  /** Full depth of the buffer once armed (see `ExitEnvironment`). */
  sentinelCapacity?: number;
}

/** Pure: how many sentinel entries the current history.state says we sit on. */
export function readSentinelDepth(
  state: unknown,
  marker: string | undefined,
  depthKey: string | undefined,
): number {
  if (!marker) return 0;
  const record = state && typeof state === 'object' ? (state as Record<string, unknown>) : null;
  if (!record?.[marker]) return 0;
  const raw = depthKey ? record[depthKey] : undefined;
  const depth = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 1;
  return Math.max(1, depth);
}

/**
 * Runs the plan for the live environment. MUST be called synchronously inside
 * a user gesture -- `window.close()` and history traversal are both
 * activation-gated. Returns the channel that was executed.
 */
export function executeAppExit(options: ExecuteAppExitOptions = {}): ExitChannel {
  if (typeof window === 'undefined') return 'online';
  let sentinelDepth = 0;
  try {
    sentinelDepth = readSentinelDepth(window.history.state, options.sentinelMarker, options.sentinelDepthKey);
  } catch {
    sentinelDepth = 0;
  }

  const plan = planExit({
    standalone: isStandaloneApp(),
    historyLength: (() => {
      try {
        return window.history.length;
      } catch {
        return 1;
      }
    })(),
    sentinelDepth,
    sentinelCapacity: options.sentinelCapacity,
    referrer: typeof document === 'undefined' ? '' : document.referrer || '',
    origin: window.location.origin,
  });

  leaving = true;
  // The session ends HERE, on the confirmed gesture -- whatever the runtime
  // does with the steps below, nothing of this visit is restored later.
  clearSession();
  announceExit();
  for (const step of plan.immediate) runStep(step);

  window.setTimeout(() => {
    if (document.visibilityState === 'hidden') {
      // Something DID take us away (app backgrounded / tab hidden). If the
      // visitor ever returns to this exact document -- an app resumed from
      // the launcher, a bfcache restore -- give them a fresh start rather
      // than a dialog frozen mid-exit.
      const revive = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', revive);
        window.removeEventListener('pageshow', revive);
        leaving = false;
        try {
          window.location.reload();
        } catch {
          /* no-op */
        }
      };
      document.addEventListener('visibilitychange', revive);
      window.addEventListener('pageshow', revive);
      return;
    }
    // Nothing unloaded us -- the runtime refused every immediate step.
    runStep(plan.fallback);
  }, LEAVE_SETTLE_MS);

  return plan.channel;
}
