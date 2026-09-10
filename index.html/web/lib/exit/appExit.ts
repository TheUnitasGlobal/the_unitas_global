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
//          over, no dead-end notice, no `about:blank`.
//
//          ROUND 16 (owner instruction 2026-09-05, mobile-app hardening,
//          item 2 -- "까만 화면으로 1차 이동되어 멈추는" on a phone): the
//          refusal is DECIDED SYNCHRONOUSLY, inside the gesture, whenever it
//          is certain -- no native shell answered and the window's session
//          history holds more than one entry (Chromium and WebKit both
//          refuse `window.close()` on such a window, without exception) --
//          so the terminal state is reached on the very tap, with none of
//          the LEAVE_SETTLE_MS wait that used to read as a hang. And the
//          sentinel buffer is collapsed to the app's real entry AT ONCE
//          (round 15 collapsed it lazily, on the first back press): the
//          terminated app now sits on its single real entry, so ONE
//          hardware back press lets the OS finish the activity -- the
//          fastest exit a web page can give a phone that has no shell to
//          kill its process. The next time the OS brings that document back
//          to the foreground (a launcher tap on the still-resident activity,
//          a bfcache restore) it reloads itself into a brand-new session
//          that opens on the logo splash, under the round-11 re-entry reset
//          doctrine (lib/pwa/installPrompt.ts).
//
//   ROUND 17 (owner instruction 2026-09-06, "2단계 더블 컨펌 안심 종료"): on
//   the App channel this engine is reached ONLY after two consecutive
//   explicit confirmations -- "종료하시겠습니까?" then "종료 버튼을 한
//   번 더 누르면 앱이 완전히 종료됩니다" -- rendered by ExitGuard from the
//   pure state machine in lib/exit/exitConfirmFlow.ts. The sealed
//   Coming-Soon 'X 종료' joins that flow on the App channel via
//   `requestAppExit()`; online it still calls `executeAppExit()` directly.
//   Nothing below changed: the second 종료 is the gesture this runner needs.
//
//   ROUND 18 (owner instruction 2026-09-06, "모바일 앱 블랙 스크린 렌더링
//   프리즈 긴급 패치"): the second 종료 must collapse the WHOLE history stack
//   the instant it is tapped, so that no extra gesture stands between the
//   tap and the OS ending the activity. Two changes, both inside the tap:
//
//     - `collapseHistoryStackNow()` (replaces round 16's sentinel-only
//       collapse) walks the app down to the FIRST entry of the current
//       document in ONE traversal -- past the sentinel buffer AND past every
//       in-app route entry Next.js pushed above the launch entry -- using the
//       Navigation API's `navigation.currentEntry.index` (Chromium 102+,
//       every Android WebAPK / Samsung Internet standalone app), with the
//       sentinel depth as the fallback where the API is absent. The owner's
//       literal `history.go(-history.length)` is a no-op by spec (an
//       out-of-range delta is ignored), so the maximal VALID delta is used:
//       never past the first entry, never across documents (the Navigation
//       API only ever lists same-document entries, so the terminated
//       document can never be resurrected by a cross-document reload).
//
//     - ExitGuard PRE-COLLAPSES the sentinel buffer the moment the FINAL
//       dialog opens on a phone / tablet app, so the app already sits on its
//       real entry while the visitor reads "종료 버튼을 한 번 더 누르면 앱이
//       완전히 종료됩니다". From there the hardware back press is no longer
//       swallowed by a sentinel: the OS finishes the activity AT ONCE -- no
//       shroud, no wait -- which is the one truly instant exit a web page can
//       give a phone that has no native shell. The 종료 button on that same
//       dialog runs this engine (shell kill / window.close / terminate) and
//       the very next back press ends the app.
//
//   The single web-platform limit this file cannot cross (stated here so it
//   is never "fixed" again by dropping the guard): an installed PHONE app
//   must keep extra history entries under itself to intercept the hardware
//   back button at all, and `window.close()` is honoured ONLY on a
//   single-entry window -- so on a phone without a native shell "back opens
//   the exit confirm" and "종료 closes the process outright" cannot both be
//   true. The buffer wins (owner instruction, rounds 11 + 14 + 16 item 1);
//   the native bridges above are the path to a true process kill. A history
//   entry pushed once can never be un-pushed (traversing back leaves it as a
//   forward entry; a replace keeps the count), so no sequence of web calls
//   brings a parked app back to a single-entry window -- round 18's collapse
//   makes the OS back press the LAST gesture, it cannot remove it.
//
//   ROUND 19 (owner instruction 2026-09-06, "태스크 스위처 빈 카드 잔류 현상
//   격멸"): a terminated app must leave NOTHING behind that the OS task
//   switcher (Android Recents / the iOS App Switcher) or a later relaunch
//   could show as a blank address-bar card or a black ghost frame. Four
//   things now happen inside `terminateInPlace()`, on the confirmed tap:
//
//     1. DOM MEMORY PURGE -- `APP_TERMINATE_EVENT` is fired and
//        `TerminationBoundary` (components/exit/TerminationBoundary.tsx, the
//        outermost client boundary in app/layout.tsx) unmounts the WHOLE
//        React tree beneath <body>: the 3D scene's WebGL context, every
//        AudioContext, every timer / listener / Supabase channel is released
//        through React's own effect cleanups. Next.js never exposes its
//        `hydrateRoot` handle, so this boundary IS the app's `root.unmount()`
//        -- and a better one, since cleanups actually run.
//     2. LOCAL SESSION + FOUNDER ENTRY-TOKEN PURGE -- sessionStorage is wiped
//        (curtain phase, splash flag, debug-panel state), the page-lifetime
//        founder verification memo is dropped (`resetSovereignCache`), and
//        the surviving history entry's URL is rewritten WITHOUT any query or
//        hash (`?sovereign_auth=`, `?dev=`, `?splash=0` -- gone). The signed
//        30-day HttpOnly founder cookie is server-owned and deliberately NOT
//        revoked here: an installed app has no address bar to re-enter the
//        token, so revoking it on every exit would lock the founder out of
//        their own app; revocation stays explicit (`?sovereign_auth=logout`
//        / DELETE /api/sovereign/verify). localStorage (audio / locale /
//        wallet-device preferences) is kept, as before.
//     3. HISTORY STATE RESET -- once the round-18 collapse lands on the
//        document's first entry, that entry is SEALED with
//        `history.replaceState`: a bare `{ __NA: true }` state (no sentinel
//        marker, no depth, nothing of the session) at the app's clean launch
//        URL (`sealedLaunchUrl`: origin + locale root). Sealed from a
//        CAPTURE-phase popstate listener so Next's own router listener --
//        which reads `location.href` on the same event to compute the
//        canonical URL it later re-writes -- already sees the clean URL; and
//        sealed AGAIN on `visibilitychange: hidden` / `pagehide`, the exact
//        moments the OS snapshots the task card. A relaunch from that card
//        therefore opens the clean launch URL of a brand-new session.
//     4. PRISTINE TERMINAL FRAME -- the opaque black shroud now carries the
//        dimmed UNITAS mark (no text, no button, not hit-testable), so the
//        one frame the OS keeps for the task card is the app's own closed
//        cover rather than a featureless black void.
//
//   What stays impossible (and must not be retried): removing the task card
//   itself. Only the OS (or a native shell's `finishAndRemoveTask`) can drop
//   a task from Recents; a web page can only make sure the card is clean and
//   that nothing of the session survives behind it.
//
//   ROUND 24 (owner instruction 2026-09-07, item 3: "종료 클릭 시 진입 페이지
//   리셋 버그 완벽 근절"): the confirmed 종료 sometimes landed the visitor on
//   the site's very first entry page instead of closing anything. ROOT CAUSE,
//   both channels: the engine traversed history ACROSS DOCUMENTS. The
//   Navigation API's `navigation.currentEntry.index` counts every contiguous
//   SAME-ORIGIN entry -- including entries of EARLIER documents of this site
//   still sitting in the tab (a previous visit, a relaunch after a prior
//   exit, a typed URL over a page that was already the site) -- and the
//   round-18 collapse mistook it for the same-DOCUMENT index. `history.go()`
//   with that delta left the document and reloaded an older one; the online
//   channel's `history-back` did the same whenever the entry behind our own
//   was another page of this site. Every such cross-document landing runs
//   the re-entry reset bootstrap (lib/pwa/installPrompt.ts: session wiped,
//   logo page), which the visitor saw as "종료를 눌렀더니 진입 페이지로
//   리셋". Fixes:
//
//     - `readHistoryStackView()` now walks `navigation.entries()` and counts
//       only entries whose `sameDocument` is true beneath the current one
//       (`sameDocumentIndex`); it also reports how many same-origin entries of
//       OTHER documents sit below this document (`siteEntriesBehind`). The
//       whole-stack collapse therefore never leaves the document.
//     - The ONLINE planner steps back to the previous page ONLY when that is
//       provable: the Navigation API says no other document of this site is
//       behind ours, the referrer is an external page, and a cross-origin
//       entry exists in the tab. Anywhere else -- the API absent (Firefox,
//       older WebKit), a site page behind us, no referrer -- it never
//       traverses: it tries `window.close()` where that can work (a fresh
//       single-entry tab or a script-opened window) and otherwise TERMINATES
//       IN PLACE under the round-21 completion guide ("종료가 완료되었습니다.
//       안전하게 앱 또는 브라우저를 닫아주시기 바랍니다."), decided on the
//       tap itself when the close is certain to be refused (multi-entry,
//       not script-opened) so there is no settle-wait hang.
//     - A terminated ONLINE tab is inert: it no longer relaunches itself into
//       a fresh session when the tab regains focus (that too read as "reset
//       to the entry page" after a mobile tab switch). Only an installed App
//       relaunches as a cold start when the OS brings it back, and only after
//       it was genuinely in the background (`RELAUNCH_MIN_HIDDEN_MS`), so a
//       Recents peek does not restart it.
//
//   ROUND 21 (owner instruction 2026-09-06, "모바일 앱 2단계 안심 종료 안내
//   가이드 팝업 + 원복"): round 20's `about:blank` overwrite is REVERTED in
//   full -- on a phone the blank document left an address-bar card in Recents
//   and a relaunch that reloaded from nothing, which read as a bug rather than
//   a closed app. The terminal FRAME of a PHONE / TABLET app is now a
//   floating GLASSMORPHISM GUIDE (`terminate-guide` -> `terminateInPlace
//   ('guide')`): "종료가 완료되었습니다. 안전하게 앱 또는 브라우저를 닫아주시기
//   바랍니다." centred over the app's own void, so the visitor knows the app
//   is finished and leaves it with the device's own navigation (home gesture,
//   Recents swipe, hardware back) with nothing to fear. Everything round 19
//   did to leave nothing behind still runs first -- session + founder-token
//   purge, React-tree unmount, whole-stack collapse, sealed launch entry --
//   the frame itself is what changed: the guide lives on <html> outside
//   React's reach, like the desktop shroud, and the document is NEVER
//   navigated away. A DESKTOP app window keeps round 19's dimmed-mark black
//   shroud (its `window.close()` genuinely closes it, so the shroud is only
//   ever a fallback). The mobile confirm is a SINGLE question again ("로그아웃
//   및 종료하시겠습니까?"): the two "steps" the doctrine names are that
//   confirm and this guide -- see lib/exit/exitConfirmFlow.ts. The
//   web-platform limit above is unchanged: no web call removes the Recents
//   card or kills a resident phone-PWA process -- a terminated document
//   brought back to the foreground relaunches itself as a cold start.
//
// `planExit()` is pure (no DOM) so the branching is unit-tested in
// __tests__/exit/appExit.test.ts; `executeAppExit()` is the thin browser
// runner around it. `findNativeExitBridge()`, `planStackCollapse()`,
// `sealedLaunchUrl()` and `sealedHistoryState()` are pure for the same
// reason. `EXIT_GUARD_BOOTSTRAP` (bottom of this file) is the pre-hydration
// twin of ExitGuard's sentinel arming, injected into <head> by
// app/layout.tsx so the very first tap on the 3s logo page already parks
// the buffer -- long before the React tree has hydrated on a phone.

import { resetSovereignCache } from '@/lib/foundersGate';
import { PWA_ICON_VERSION } from '@/lib/pwa/iconVersion';
import { clearVisitLedger } from '@/lib/entry/visitLedgerWriter';

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
  /** A native container exit API is present on the host (see
   *  `findNativeExitBridge`). Omitted / false = plain browser or PWA. */
  nativeBridge?: boolean;
  /** Installed as a DESKTOP app window (PC / laptop: fine pointer + hover;
   *  see `isDesktopAppWindow`). Such a window has no hardware back button, so
   *  ExitGuard keeps it at a single launch entry and `window.close()` really
   *  closes it -- its in-place fallback stays the round-19 black shroud. A
   *  PHONE / TABLET app (omitted / false) takes round 21's floating
   *  "종료가 완료되었습니다" guide frame instead. */
  desktopAppWindow?: boolean;
  /** Round 24: how many entries of THIS document sit beneath the current one
   *  per the Navigation API (`sameDocumentIndex` of `readHistoryStackView`).
   *  -1 / omitted = unknown (API absent) -- the sentinel depth is used. */
  documentDepth?: number;
  /** Round 24: how many same-origin entries of OTHER documents of this site
   *  sit beneath this document's first entry (`siteEntriesBehind` of
   *  `readHistoryStackView`). > 0 = a history-back past our own entries
   *  would land on the site again (forbidden). -1 / omitted = unknown. */
  siteEntriesBehind?: number;
  /** Round 24: `navigation.entries().length` -- the contiguous same-origin
   *  run around the current entry. `historyLength` above it means a
   *  cross-origin entry exists somewhere in the tab. -1 / omitted = unknown. */
  sameOriginRunLength?: number;
  /** Round 24: `window.opener` is set -- a script-opened window, which the
   *  engines let `window.close()` close whatever its history length. */
  scriptOpened?: boolean;
}

export type ExitStep =
  /** Ask the native shell (if any) to kill the app process -- see
   *  `requestNativeAppExit`. A no-op in a plain browser / PWA. */
  | { kind: 'native-exit' }
  | { kind: 'close' }
  | { kind: 'history-back'; steps: number }
  | { kind: 'navigate'; url: string; replace: boolean }
  /** Terminate in place: wipe the session, silence every audio engine and
   *  cover the document with an opaque black shroud (DESKTOP App window
   *  only, round 19). */
  | { kind: 'terminate' }
  /** Round 21 (PHONE / TABLET App channel): terminate in place exactly like
   *  `terminate` -- session purge, React-tree unmount, whole-stack collapse,
   *  sealed launch entry -- but the terminal frame is the floating
   *  glassmorphism GUIDE ("종료가 완료되었습니다. 안전하게 앱 또는 브라우저를
   *  닫아주시기 바랍니다.") rather than a bare shroud. The document is never
   *  navigated away (no `about:blank`, owner instruction 2026-09-06). */
  | { kind: 'terminate-guide' };

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

/** Round 24: a terminated INSTALLED app relaunches as a cold start when the
 *  OS brings it back to the foreground only after it was hidden at least
 *  this long -- a Recents peek / notification-shade pull that returns at
 *  once keeps the completion guide instead of restarting the app. */
export const RELAUNCH_MIN_HIDDEN_MS = 1200;

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
    // Round 21: the terminal in-place step splits by device. A DESKTOP app
    // window keeps the round-19 black shroud (`terminate`) -- its
    // `window.close()` genuinely closes the window, so the shroud is only ever
    // a belt-and-braces fallback. A PHONE / TABLET app takes
    // `terminate-guide`: the same in-place termination under the floating
    // "종료가 완료되었습니다" guide, never a navigation away from the document
    // (round 20's about:blank overwrite is reverted -- owner instruction
    // 2026-09-06).
    const terminal: ExitStep = env.desktopAppWindow ? { kind: 'terminate' } : { kind: 'terminate-guide' };
    // Round 15: the native shell's exit API first (kills the process
    // outright inside a container), then the web window close.
    const immediate: ExitStep[] = [{ kind: 'native-exit' }, { kind: 'close' }];
    // Round 16 (item 2): when no shell can kill the process AND the window's
    // session history holds more than one entry, `window.close()` is
    // refused by every engine without exception -- the phone / tablet app
    // with its hardware-back buffer parked, a desktop app window that has
    // opened a tower. Waiting LEAVE_SETTLE_MS to "find out" only shows the
    // visitor a frozen page; terminate on the tap itself instead.
    if (!env.nativeBridge && env.historyLength > 1) immediate.push(terminal);
    return {
      channel: 'app',
      immediate,
      // Round 13: a refused close TERMINATES the app in place -- never a
      // restart on the logo splash. Round 21: mobile shows the completion
      // guide, desktop keeps the black shroud. (Idempotent when the
      // immediate step already ran.)
      fallback: terminal,
    };
  }

  // ---- ONLINE channel (round 24 rewrite -- see the header) -----------------
  const depth = Math.max(0, Math.floor(env.sentinelDepth || 0));
  // Entries of THIS document beneath the current one: the Navigation API's
  // exact same-document count when known (sentinels AND in-app route
  // entries), never less than the sentinel depth we can read ourselves.
  const known = (value: number | undefined): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : -1;
  const documentDepth = known(env.documentDepth);
  const docBelow = documentDepth >= 0 ? Math.max(documentDepth, depth) : depth;
  // Entries of OURS between the page's real entry and the top of the buffer:
  // the ones we are standing on (`docBelow`) plus, when we have stepped down
  // into an armed buffer, the forward sentinels still above us.
  const capacity = Math.max(depth, Math.max(0, Math.floor(env.sentinelCapacity || 0)));
  const ownEntries = 1 + docBelow;
  const ownFootprint = 1 + (depth > 0 ? Math.max(docBelow, capacity) : docBelow);

  // Step back to the previous page ONLY when it is provably NOT this site:
  //   - the Navigation API answered (no guessing on Firefox / old WebKit),
  //   - no other document of this site sits beneath ours,
  //   - the referrer is an external page (the entry behind ours is it), and
  //   - a cross-origin entry actually exists in the tab.
  const siteBehind = known(env.siteEntriesBehind);
  const runLength = known(env.sameOriginRunLength);
  const external = isExternalReferrer(env.referrer, env.origin);
  const traversable =
    documentDepth >= 0 &&
    siteBehind === 0 &&
    external &&
    runLength >= 0 &&
    env.historyLength > Math.max(ownFootprint, runLength);
  if (traversable) {
    return {
      channel: 'online',
      immediate: [{ kind: 'history-back', steps: ownEntries }],
      // A refused traversal still hands the visitor to the external page --
      // a forward navigation never lands on this site.
      fallback: { kind: 'navigate', url: env.referrer, replace: false },
    };
  }

  // Otherwise the session ends HERE, in this document. `window.close()` is
  // honoured only on a single-entry window or one opened by script; on any
  // other window every engine refuses it, so the completion guide is painted
  // on the tap itself -- no settle-wait, no black hang, no traversal.
  const terminal: ExitStep = { kind: 'terminate-guide' };
  const closable = env.historyLength <= 1 || env.scriptOpened === true;
  const immediate: ExitStep[] = closable ? [{ kind: 'close' }] : [{ kind: 'close' }, terminal];
  return { channel: 'online', immediate, fallback: terminal };
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
/**
 * Window event fired by `terminateInPlace()` the instant the terminal shroud
 * is up (round 19). `TerminationBoundary` (components/exit/
 * TerminationBoundary.tsx) listens and unmounts the ENTIRE React tree under
 * <body> -- the app's `root.unmount()` -- so no scene, audio graph, timer or
 * subscription keeps running behind a closed app. Distinct from
 * `APP_EXIT_EVENT`, which also fires on the ONLINE channel where the page
 * must stay rendered until the browser has actually left it.
 */
export const APP_TERMINATE_EVENT = 'unitas:app-terminate';
/** `data-` attribute stamped on <html> while the terminal frame is up. */
export const TERMINATED_ATTR = 'data-unitas-terminated';
/** `data-` attribute stamped on <html> naming WHICH terminal frame is up
 *  (`shroud` / `guide`, see `TerminalFrame`) -- round 21 diagnostics. */
export const TERMINAL_FRAME_ATTR = 'data-unitas-terminal-frame';
/** `data-` attribute on the terminal cover element itself (the round-19
 *  black shroud AND the round-21 guide frame both carry it). */
export const TERMINAL_SHROUD_ATTR = 'data-unitas-shroud';
/**
 * The brand mark painted on the terminal frame (round 19): the single-source
 * master mark, with the same content-versioned query every other icon href
 * carries so the OS snapshot never shows a stale cached mark.
 */
export const TERMINAL_MARK_HREF = `/assets/svg/unitas-mark.svg?v=${PWA_ICON_VERSION}`;

/** Wipe the tab's session -- the session is OVER the moment an exit is
 *  confirmed, whatever the runtime does next. localStorage (audio / locale
 *  preferences, the wallet's remembered device) is deliberately kept: those
 *  are the visitor's settings, not this session's state.
 *
 *  Round 19: the page-lifetime founder verification memo goes with it, so a
 *  terminated document holds no answer about the founder in memory. The
 *  signed HttpOnly founder cookie itself is server-owned and is NOT revoked
 *  here (see the ROUND 19 note at the top of this file). */
function clearSession(): void {
  try {
    window.sessionStorage.clear();
  } catch {
    /* storage blocked -- nothing to clear */
  }
  try {
    resetSovereignCache();
  } catch {
    /* no-op */
  }
  // REV-17 (SPEC.md §3.2): the visit ledger LIVES in localStorage (so it can
  // survive the sessionStorage wipe an installed App's cold relaunch always
  // gets) but it encodes SESSION state -- which curtain phase/surface was
  // open -- not a visitor preference, so a confirmed exit clears it too.
  // Round 19's "localStorage preferences survive" policy above is about
  // audio/locale settings; this is deliberately the one exception.
  try {
    clearVisitLedger();
  } catch {
    /* no-op */
  }
}

function announceExit(): void {
  try {
    window.dispatchEvent(new CustomEvent(APP_EXIT_EVENT));
  } catch {
    /* no-op */
  }
}

function announceTerminate(): void {
  try {
    window.dispatchEvent(new CustomEvent(APP_TERMINATE_EVENT));
  } catch {
    /* no-op */
  }
}

/** True once `terminateInPlace()` has run on this document. */
export function isDocumentTerminated(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return document.documentElement.hasAttribute(TERMINATED_ATTR);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// terminal frames: desktop black shroud (round 19) / mobile guide (round 21)
// ---------------------------------------------------------------------------

/** Which cover a terminated document wears. `shroud` = the round-19 opaque
 *  black frame with the dimmed mark (DESKTOP app window). `guide` = the
 *  round-21 floating glassmorphism completion guide (PHONE / TABLET app). */
export type TerminalFrame = 'shroud' | 'guide';

/** `data-` attribute on the round-21 guide card itself (E2E / diagnostics). */
export const TERMINAL_GUIDE_ATTR = 'data-unitas-exit-guide';
/** DOM id of the guide's title -- `aria-labelledby` target and E2E anchor. */
export const TERMINAL_GUIDE_TITLE_ID = 'unitas-exit-guide-title';

/** The localized copy the round-21 guide paints. ExitGuard resolves it from
 *  the visitor's locale (`ExitGuard.appExitDoneTitle` / `appExitDoneBody`)
 *  and hands it to `executeAppExit()`; the built-in default below is the
 *  English fallback for any caller that passes none. */
export interface TerminalGuideCopy {
  /** "종료가 완료되었습니다." */
  title: string;
  /** "안전하게 앱 또는 브라우저를 닫아주시기 바랍니다." */
  body: string;
}

export const DEFAULT_TERMINAL_GUIDE: TerminalGuideCopy = {
  title: 'Shutdown complete.',
  body: 'Please close the app or browser safely.',
};

/** The copy the next `terminate-guide` step paints (set by `executeAppExit`
 *  from the caller's locale; the plan's fallback step reads it later). */
let pendingGuideCopy: TerminalGuideCopy = DEFAULT_TERMINAL_GUIDE;

/**
 * Pure: sanitise caller-supplied guide copy -- a missing / blank string falls
 * back to the English default field by field, so the frame never paints an
 * empty title or body whatever an i18n gap does.
 */
export function resolveTerminalGuideCopy(copy: Partial<TerminalGuideCopy> | null | undefined): TerminalGuideCopy {
  const clean = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  return {
    title: clean(copy?.title, DEFAULT_TERMINAL_GUIDE.title),
    body: clean(copy?.body, DEFAULT_TERMINAL_GUIDE.body),
  };
}

/** Round 19: the pristine DESKTOP terminal frame -- opaque black, the dimmed
 *  master mark centred, not hit-testable, no text, no control. */
function buildShroudFrame(): HTMLElement {
  const shroud = document.createElement('div');
  shroud.setAttribute('role', 'presentation');
  shroud.setAttribute('aria-hidden', 'true');
  shroud.setAttribute(TERMINAL_SHROUD_ATTR, '1');
  shroud.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:#000;pointer-events:auto;touch-action:none;overscroll-behavior:none;';
  const mark = document.createElement('img');
  mark.setAttribute('src', TERMINAL_MARK_HREF);
  mark.setAttribute('alt', '');
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('decoding', 'async');
  mark.setAttribute('draggable', 'false');
  mark.style.cssText =
    'position:absolute;left:50%;top:50%;width:min(26vmin,132px);height:auto;transform:translate(-50%,-50%);opacity:.38;filter:saturate(.4);pointer-events:none;user-select:none;-webkit-user-select:none;';
  shroud.appendChild(mark);
  return shroud;
}

/**
 * Round 21: the PHONE / TABLET terminal frame -- the app's own void with a
 * floating glassmorphism guide card centred on it. Built with the site's own
 * tokens (void #030305 / quantum #0f1016 / gold #d4af37 / neon #00f3ff,
 * JetBrains Mono + Cinzel through the font variables next/font leaves on
 * <html>) so it reads as the same design system as the confirm dialog it
 * follows. Plain DOM on purpose: it must outlive the React tree that
 * `announceTerminate()` unmounts a beat later. Not interactive -- there is
 * nothing left to do in a finished app; the device's own navigation (home
 * gesture, Recents swipe, hardware back on the collapsed single entry) is how
 * the visitor leaves.
 *
 * ROUND 23 layout (owner instruction 2026-09-06, exit UX hardening item 5):
 * the master mark,
 * then the "UNITAS" wordmark directly beneath it, then one long expanded
 * rule, then the completion title + body -- in that reading order. The prior
 * layout floated a thin animated line ACROSS THE TOP of the card (a "halo")
 * before the mark; the owner flagged it as reading like a tappable control
 * ("상단 버튼 오인 소지 유발 효과선") on a frame that has nothing to tap. It
 * is removed outright, not just relocated -- the rule below is a static
 * (non-animated) divider between the brand block and the message, not a
 * repositioned halo.
 */
function buildGuideFrame(copy: TerminalGuideCopy): HTMLElement {
  const frame = document.createElement('div');
  frame.setAttribute('role', 'presentation');
  frame.setAttribute(TERMINAL_SHROUD_ATTR, '1');
  frame.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
    'padding:max(24px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));' +
    'box-sizing:border-box;background:radial-gradient(120% 80% at 50% 0%,rgba(212,175,55,.10),rgba(3,3,5,0) 55%),radial-gradient(90% 60% at 50% 100%,rgba(0,243,255,.06),rgba(3,3,5,0) 60%),#030305;' +
    'pointer-events:auto;touch-action:none;overscroll-behavior:none;user-select:none;-webkit-user-select:none;';

  const style = document.createElement('style');
  style.textContent =
    '@keyframes unitas-exit-guide-in{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}' +
    `[${TERMINAL_GUIDE_ATTR}]{animation:unitas-exit-guide-in .55s cubic-bezier(.22,1,.36,1) both}` +
    `@media (prefers-reduced-motion:reduce){[${TERMINAL_GUIDE_ATTR}]{animation:none}}`;
  frame.appendChild(style);

  const card = document.createElement('section');
  card.setAttribute(TERMINAL_GUIDE_ATTR, '1');
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  card.setAttribute('aria-labelledby', TERMINAL_GUIDE_TITLE_ID);
  card.style.cssText =
    'position:relative;box-sizing:border-box;width:100%;max-width:400px;max-height:calc(100dvh - 48px);overflow:hidden;padding:32px 28px 30px;text-align:center;' +
    'color:#e5e7eb;font-family:var(--font-jetbrains-mono),ui-monospace,SFMono-Regular,Menlo,monospace;' +
    'background:linear-gradient(160deg,rgba(255,255,255,.085),rgba(255,255,255,.028) 55%,rgba(15,16,22,.55));' +
    'border:1px solid rgba(212,175,55,.32);' +
    'box-shadow:0 0 0 1px rgba(255,255,255,.03) inset,0 1px 0 rgba(255,255,255,.14) inset,0 0 48px rgba(0,243,255,.07),0 28px 90px rgba(0,0,0,.72);' +
    '-webkit-backdrop-filter:blur(26px) saturate(1.35);backdrop-filter:blur(26px) saturate(1.35);';

  // 1. Master mark.
  const mark = document.createElement('img');
  mark.setAttribute('src', TERMINAL_MARK_HREF);
  mark.setAttribute('alt', '');
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('decoding', 'async');
  mark.setAttribute('draggable', 'false');
  mark.style.cssText =
    'display:block;width:52px;height:52px;margin:0 auto 12px;opacity:.92;filter:drop-shadow(0 0 14px rgba(212,175,55,.35));pointer-events:none;';
  card.appendChild(mark);

  // 2. "UNITAS" wordmark, directly beneath the mark.
  const wordmark = document.createElement('div');
  wordmark.setAttribute('aria-hidden', 'true');
  wordmark.textContent = 'UNITAS';
  wordmark.style.cssText =
    'margin:0 0 18px;font-family:var(--font-cinzel),Georgia,serif;font-size:12px;letter-spacing:.42em;text-indent:.42em;color:rgba(212,175,55,.85);';
  card.appendChild(wordmark);

  // 3. One long expanded rule, separating the brand block from the message.
  const rule = document.createElement('div');
  rule.setAttribute('aria-hidden', 'true');
  rule.style.cssText =
    'height:1px;margin:0 auto 22px;width:82%;background:linear-gradient(90deg,rgba(212,175,55,0),rgba(212,175,55,.65),rgba(212,175,55,0));';
  card.appendChild(rule);

  // 4. Completion title + body.
  const title = document.createElement('h2');
  title.id = TERMINAL_GUIDE_TITLE_ID;
  title.textContent = copy.title;
  title.style.cssText =
    'margin:0 0 12px;font-size:19px;line-height:1.35;font-weight:700;letter-spacing:-.01em;color:#fff;' +
    'text-shadow:0 0 18px rgba(212,175,55,.22);word-break:keep-all;overflow-wrap:break-word;';
  card.appendChild(title);

  const body = document.createElement('p');
  body.textContent = copy.body;
  body.style.cssText =
    'margin:0;font-size:13px;line-height:1.75;color:rgba(229,231,235,.82);word-break:keep-all;overflow-wrap:break-word;';
  card.appendChild(body);

  frame.appendChild(card);
  return frame;
}

/**
 * Terminate in place (App channel, runtime refused `window.close()`): the
 * session is purged, every audio engine falls silent, the whole React tree is
 * unmounted, the history stack collapses to the sealed launch entry, and the
 * document is covered by its terminal frame -- the round-19 black shroud with
 * the dimmed mark on a DESKTOP app window, the round-21 floating "종료가
 * 완료되었습니다" guide on a PHONE / TABLET app. Nothing underneath is
 * reachable, the document is never navigated away, and the next time the OS
 * brings this (still resident) document back to the foreground it relaunches
 * as a cold start from the clean launch URL.
 */
function terminateInPlace(frame: TerminalFrame): void {
  clearSession();
  announceExit();
  try {
    if (document.documentElement.hasAttribute(TERMINATED_ATTR)) return;
    document.documentElement.setAttribute(TERMINATED_ATTR, '1');
    document.documentElement.setAttribute(TERMINAL_FRAME_ATTR, frame);
    const cover = frame === 'guide' ? buildGuideFrame(pendingGuideCopy) : buildShroudFrame();
    document.documentElement.appendChild(cover);
    document.documentElement.style.background = frame === 'guide' ? '#030305' : '#000';
    try {
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      /* nothing focused */
    }
    // Resident activity brought back to the foreground (launcher tap, task
    // switcher, bfcache restore): the app was closed, so this is a LAUNCH --
    // start over as a cold start from the clean launch URL (round 21:
    // `location.replace` to the sealed URL, so no query / hash / deep route
    // of the finished session can come back; a plain reload is the fallback).
    //
    // Round 24: INSTALLED APP ONLY, and only after the app was genuinely in
    // the background for `RELAUNCH_MIN_HIDDEN_MS`. A terminated ONLINE tab
    // stays inert under its guide -- it used to reload itself into the entry
    // page the moment the tab regained focus (a tab-switcher peek on a
    // phone, an alt-tab on a PC), which the visitor saw as "종료를 눌렀더니
    // 진입 페이지로 리셋". The bfcache `pageshow` relaunch is App-only too:
    // a tab brought back by the browser's own back / forward button simply
    // shows the guide again.
    if (isStandaloneApp()) {
      let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : -1;
      const relaunch = () => {
        try {
          const url = sealedLaunchUrl(window.location.href);
          if (url) window.location.replace(url);
          else window.location.reload();
        } catch {
          try {
            window.location.reload();
          } catch {
            /* no-op */
          }
        }
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          hiddenAt = Date.now();
          return;
        }
        if (hiddenAt >= 0 && Date.now() - hiddenAt >= RELAUNCH_MIN_HIDDEN_MS) relaunch();
      });
      window.addEventListener('pageshow', (e) => {
        if ((e as PageTransitionEvent).persisted) relaunch();
      });
    }
    // Round 19 (item 1): purge the DOM -- the whole React tree under <body>
    // unmounts through TerminationBoundary (scene, audio, timers, channels
    // all released by their own effect cleanups). The frame above lives on
    // <html>, outside React's reach, so it survives the purge untouched.
    announceTerminate();
    // Round 16 (item 2): a terminated app must die on the very NEXT back
    // press. ExitGuard parks a deep sentinel buffer under the page (phones /
    // tablets), so collapse the whole buffer to the app's real entry RIGHT
    // NOW (a same-document traversal needs no activation and leaves the
    // frame untouched): the terminated document then sits on its single
    // real entry, and the first hardware back press leaves it -- on an
    // installed app the OS finishes the activity, in a tab the browser goes
    // to the page before the site. Round 15 did this lazily, on the first
    // press, which cost the visitor one dead press on a black screen.
    //
    // Round 18: the collapse now walks down to the FIRST entry of the
    // document -- past the buffer AND past every in-app route entry -- in
    // one hop, so the terminated app always sits on the launch entry and
    // exactly ONE back press ends it, however deep the visitor navigated.
    const delta = collapseHistoryStackNow();
    // Round 19 (item 2): once the collapse lands, SEAL the surviving entry --
    // clean launch URL, bare router state, no sentinel marker, no token --
    // and keep it sealed at every OS snapshot moment.
    sealLandingEntry(delta);
    // Safety net: should any sentinel survive (the traversal above refused,
    // a pop landing mid-buffer), the next press collapses the rest.
    collapseSentinelsOnNextPop();
  } catch {
    /* DOM unavailable -- the session wipe above is still done */
  }
}

// ---------------------------------------------------------------------------
// history stack collapse (round 16 sentinel-only -> round 18 whole stack)
// ---------------------------------------------------------------------------

/** What the collapse planner needs to know about the live session history. */
export interface HistoryStackView {
  /** How many entries of THIS document sit beneath the current one: the
   *  count of contiguous `navigation.entries()` below `currentEntry` whose
   *  `sameDocument` is true (0 = we are on the document's first entry).
   *  Round 24: NOT `currentEntry.index` -- that counts every contiguous
   *  SAME-ORIGIN entry, including earlier documents of this site still in
   *  the tab, and a traversal by that number leaves the document (and lands
   *  on the re-entry reset). -1 when the Navigation API is unavailable
   *  (WebKit < 26, old Chromium, Firefox). */
  sameDocumentIndex: number;
  /** `history.length` -- the hard ceiling on how far back any delta can go. */
  historyLength: number;
  /** ExitGuard's sentinel depth per `history.state` (fallback measure). */
  sentinelDepth: number;
  /** Round 24: same-origin entries of OTHER documents beneath this
   *  document's first entry (`currentEntry.index - sameDocumentIndex`).
   *  -1 / omitted when unknown. */
  siteEntriesBehind?: number;
  /** Round 24: `navigation.entries().length` (the contiguous same-origin
   *  run). -1 / omitted when unknown. */
  sameOriginRunLength?: number;
}

/**
 * Pure: the `history.go()` delta that collapses the stack to the document's
 * first entry in ONE traversal (0 = nothing to do). Prefers the Navigation
 * API's exact index (past sentinels AND in-app route entries alike, never
 * across documents); falls back to the sentinel depth. Clamped so it can
 * never exceed the entries actually behind us -- an out-of-range delta is
 * silently ignored by every engine, which is exactly why the owner's literal
 * `history.go(-history.length)` could never fire.
 */
export function planStackCollapse(view: HistoryStackView): number {
  const ceiling = Math.max(0, Math.floor(Number.isFinite(view.historyLength) ? view.historyLength : 1) - 1);
  const exact = Number.isFinite(view.sameDocumentIndex) ? Math.floor(view.sameDocumentIndex) : -1;
  const fallback = Math.max(0, Math.floor(Number.isFinite(view.sentinelDepth) ? view.sentinelDepth : 0));
  const steps = Math.min(exact >= 0 ? exact : fallback, ceiling);
  return steps > 0 ? -steps : 0;
}

/** Read the live `HistoryStackView` off a host window, defensively (the
 *  Navigation API is probed structurally so a host without it, or a
 *  test stand-in, never throws). */
export function readHistoryStackView(host: unknown, marker = EXIT_GUARD_MARKER, depthKey = EXIT_GUARD_DEPTH_KEY): HistoryStackView {
  const w = rec(host);
  const history = rec(w?.history);
  let historyLength = 1;
  let sentinelDepth = 0;
  try {
    const raw = history?.length;
    historyLength = typeof raw === 'number' && Number.isFinite(raw) ? raw : 1;
    sentinelDepth = readSentinelDepth(history?.state, marker, depthKey);
  } catch {
    /* history unreadable -- treat as a single entry */
  }
  let sameDocumentIndex = -1;
  let siteEntriesBehind = -1;
  let sameOriginRunLength = -1;
  try {
    const navigation = rec(w?.navigation);
    const current = rec(navigation?.currentEntry);
    const index = current?.index;
    const entriesFn = navigation ? fn(navigation.entries) : null;
    if (navigation && entriesFn && typeof index === 'number' && Number.isFinite(index) && index >= 0) {
      const entries = entriesFn.call(navigation);
      if (Array.isArray(entries) && index < entries.length) {
        // Walk down from the current entry while the entries still belong
        // to THIS document. The first foreign one (an earlier document of
        // this origin) ends the document's run; everything beneath it is
        // "the site, but not us".
        let below = 0;
        for (let i = index - 1; i >= 0; i -= 1) {
          const entry = rec(entries[i]);
          if (entry && entry.sameDocument === true) below += 1;
          else break;
        }
        sameDocumentIndex = below;
        siteEntriesBehind = Math.max(0, index - below);
        sameOriginRunLength = entries.length;
      }
    }
  } catch {
    /* Navigation API absent or the document is not fully active */
  }
  return { sameDocumentIndex, historyLength, sentinelDepth, siteEntriesBehind, sameOriginRunLength };
}

/**
 * Collapse the session history to the document's FIRST entry in one
 * traversal (round 18). Same-document by construction, so it needs no user
 * activation, never reloads, and leaves the terminal shroud untouched.
 * Returns the delta that was fired (0 = already at the bottom).
 */
export function collapseHistoryStackNow(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const delta = planStackCollapse(readHistoryStackView(window));
    if (delta < 0) window.history.go(delta);
    return delta;
  } catch {
    return 0;
  }
}

/**
 * Walk ExitGuard's sentinel buffer down to the page's REAL entry in one
 * traversal, leaving in-app route entries beneath it alone. Used by
 * ExitGuard to pre-collapse the buffer under the FINAL confirm dialog
 * (round 18): the page the visitor is on stays exactly as it is, and the
 * next hardware back press is no longer swallowed by a sentinel. No-op on
 * the real entry. Returns the delta fired.
 */
export function collapseSentinelBufferNow(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const depth = readSentinelDepth(window.history.state, EXIT_GUARD_MARKER, EXIT_GUARD_DEPTH_KEY);
    const delta = planStackCollapse({ sameDocumentIndex: -1, historyLength: window.history.length, sentinelDepth: depth });
    if (delta < 0) window.history.go(delta);
    return delta;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// history entry seal (round 19: task-switcher card hygiene)
// ---------------------------------------------------------------------------

/** Next.js app-router's private "this entry is mine" flag (Next 14.2). A
 *  popstate onto an entry WITHOUT it makes the router reload the page --
 *  asserted by __tests__/exit/appExit.test.ts so an upgrade cannot silently
 *  break the sealed entry. */
export const NEXT_ROUTER_STATE_FLAG = '__NA';
/** Next.js app-router's private router-tree key (Next 14.2), carried along
 *  on the sealed entry so a later restore keeps the router coherent. */
export const NEXT_ROUTER_TREE_KEY = '__PRIVATE_NEXTJS_INTERNALS_TREE';

/** A leading locale segment: `/ko`, `/pt-BR`, `/zh-Hant` (matches the
 *  `[locale]` route group -- see lib/i18n). */
const LOCALE_SEGMENT = /^\/([a-z]{2}(?:-[A-Za-z]{2,4})?)(?=\/|$)/;

/**
 * Pure: the clean LAUNCH URL a terminated app's surviving history entry is
 * rewritten to -- the origin plus the locale root (`https://…/ko`), or the
 * bare origin when the path carries no locale. Every query and hash is
 * dropped: `?sovereign_auth=` (the founder entry token), `?dev=`, `?splash=0`
 * and any deep in-app route are all things of the session that is over. A
 * relaunch from the OS task card therefore opens the app exactly as a cold
 * launch would. `null` for anything that is not an http(s) URL (never
 * rewrite to something a browser could refuse).
 */
export function sealedLaunchUrl(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const locale = LOCALE_SEGMENT.exec(url.pathname)?.[1];
    return locale ? `${url.origin}/${locale}` : `${url.origin}/`;
  } catch {
    return null;
  }
}

/**
 * Pure: the bare `history.state` a sealed entry carries -- Next's own router
 * flag (so a popstate onto it restores instead of reloading) and, when
 * present, the router tree it already held. Nothing else survives: no
 * sentinel marker or depth, no tower / modal key, nothing of the session.
 */
export function sealedHistoryState(state: unknown): Record<string, unknown> {
  const sealed: Record<string, unknown> = { [NEXT_ROUTER_STATE_FLAG]: true };
  const record = state && typeof state === 'object' ? (state as Record<string, unknown>) : null;
  if (record && Object.prototype.hasOwnProperty.call(record, NEXT_ROUTER_TREE_KEY)) {
    sealed[NEXT_ROUTER_TREE_KEY] = record[NEXT_ROUTER_TREE_KEY];
  }
  return sealed;
}

/**
 * Rewrite the CURRENT history entry in place to the clean launch URL with a
 * bare router state (`history.replaceState` -- the entry count is untouched,
 * nothing navigates, nothing re-renders). Idempotent. Returns the URL the
 * entry now carries, or null when nothing could be sealed.
 */
export function sealHistoryEntryNow(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = sealedLaunchUrl(window.location.href);
    if (!url) return null;
    window.history.replaceState(sealedHistoryState(window.history.state), '', url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Seal the entry the round-18 collapse lands on, and keep it sealed.
 *
 * `history.go()` is asynchronous: the traversal lands in a later task and
 * announces itself with `popstate`, so sealing right after `go()` would
 * rewrite the entry we are LEAVING. The seal therefore runs from a popstate
 * listener -- registered in the CAPTURE phase on purpose: Next's app-router
 * listens on the same target in the bubble phase and, on that very event,
 * reads `location.href` to derive the canonical URL its `HistoryUpdater`
 * re-writes into the entry once the restore commits. Capture listeners on
 * the target run first, so the router already sees the sealed URL and keeps
 * it (its `preserveCustomHistoryState` restore keeps our bare state too).
 * A pop that lands mid-buffer (the traversal refused part-way) is left to
 * `collapseSentinelsOnNextPop`; the seal waits for the real entry.
 *
 * Belt and braces: the entry is re-sealed on `visibilitychange: hidden` and
 * `pagehide` -- exactly the moments the OS captures the task-switcher card
 * and decides what a relaunch opens -- so whatever any engine did to the
 * entry in between, the card and the relaunch are clean.
 */
function sealLandingEntry(delta: number): void {
  const reseal = () => {
    sealHistoryEntryNow();
  };
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') reseal();
    });
    window.addEventListener('pagehide', reseal);
  } catch {
    /* no-op */
  }
  if (delta === 0) {
    reseal();
    return;
  }
  const onLanded = (e: PopStateEvent) => {
    if (readSentinelDepth(e.state, EXIT_GUARD_MARKER, EXIT_GUARD_DEPTH_KEY) > 0) return;
    window.removeEventListener('popstate', onLanded, true);
    reseal();
  };
  window.addEventListener('popstate', onLanded, true);
}

/** After termination: a back press that still lands on a sentinel walks the
 *  rest of the buffer down to the real entry so the next one exits. */
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
        terminateInPlace('shroud');
        return;
      case 'terminate-guide':
        terminateInPlace('guide');
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
  /** Round 21: the localized copy the PHONE / TABLET app's terminal guide
   *  paints ("종료가 완료되었습니다." / "안전하게 앱 또는 브라우저를 닫아주시기
   *  바랍니다."). Falls back to `DEFAULT_TERMINAL_GUIDE` field by field. */
  guide?: Partial<TerminalGuideCopy>;
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

  // Round 24: the live same-document / same-origin picture, so the online
  // planner can PROVE the entry behind us is not this site before it ever
  // traverses (see the header).
  const stack = readHistoryStackView(window);
  let scriptOpened = false;
  try {
    scriptOpened = window.opener != null;
  } catch {
    scriptOpened = false;
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
    nativeBridge: findNativeExitBridge(window) !== null,
    desktopAppWindow: isDesktopAppWindow(),
    documentDepth: stack.sameDocumentIndex,
    siteEntriesBehind: stack.siteEntriesBehind,
    sameOriginRunLength: stack.sameOriginRunLength,
    scriptOpened,
  });

  leaving = true;
  // Round 21: the guide copy is fixed for this exit before any step runs --
  // the plan's deferred fallback step reads the same copy later.
  pendingGuideCopy = resolveTerminalGuideCopy(options.guide);
  // The session ends HERE, on the confirmed gesture -- whatever the runtime
  // does with the steps below, nothing of this visit is restored later.
  clearSession();
  announceExit();
  for (const step of plan.immediate) runStep(step);

  window.setTimeout(() => {
    // Round 24: a document already terminated in place owns its own
    // foreground policy (App: cold relaunch after a real background stay;
    // online: inert under the guide). The revive-by-reload below is only for
    // a LIVE document whose exit attempt got it backgrounded mid-way -- on
    // a terminated one it would reload the entry page the moment a visitor
    // who tapped 종료 and switched tabs at once came back.
    if (isDocumentTerminated()) return;
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

// ---------------------------------------------------------------------------
// pre-hydration back-guard bootstrap (round 16, item 1)
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    /** Set by ExitGuard while mounted: the React guard now owns the sentinel
     *  buffer and the head bootstrap below stands down. */
    __unitasExitGuardLive?: boolean;
  }
}

/** `window` flag ExitGuard raises while mounted (see `EXIT_GUARD_BOOTSTRAP`). */
export const EXIT_GUARD_LIVE_FLAG = '__unitasExitGuardLive';

/**
 * The events browsers treat as ACTIVATION-TRIGGERING input (HTML spec):
 * `mousedown`, a non-mouse `pointerup`, `touchend`, `click`, `keydown`. A
 * touch `pointerdown` / `touchstart` is deliberately NOT here -- it carries
 * no activation, and a sentinel pushed inside it would be born skippable
 * under Chromium's history-manipulation intervention. Shared by ExitGuard
 * and the head bootstrap so the two can never drift.
 */
export const EXIT_GUARD_ACTIVATION_EVENTS = ['mousedown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

/**
 * Pre-hydration twin of ExitGuard's sentinel arming. Injected verbatim into
 * <head> by app/layout.tsx (dependency-free ES5, runs before any bundle).
 *
 * WHY (owner instruction 2026-09-05, mobile-app hardening, item 1): on a
 * phone the React tree takes most of the 3-second logo page to hydrate, and
 * ExitGuard (components/interaction/ExitGuard.tsx, mounted inside the
 * `[locale]` layout) cannot park a single history entry before it has
 * mounted. A visitor who tapped the logo page and then pressed the hardware
 * back button therefore left a SINGLE-entry window -- and the OS finished
 * the installed app on the spot ("앱이 즉시 강제 종료"). This script
 * listens for the very first activation gesture from the first byte of the
 * document and parks the same EXIT_GUARD_SENTINEL_DEPTH-deep buffer, with the
 * same marker / depth keys, that ExitGuard would have parked: the logo page
 * is guarded exactly like the entry gate, the ad stages, the sealed
 * Coming-Soon screen and the main home. A back press on it then lands
 * inside the buffer on the same document and nothing happens ("무반응").
 *
 * The one thing no web page can do: intercept a back press BEFORE the
 * visitor's first gesture. Chromium marks history entries pushed without
 * user activation as skippable and steps straight over them, so a sentinel
 * parked on load would be ignored and would ALSO poison the buffer pushed
 * later (a skippable flag is never cleared). Hence arming waits for the
 * first activation, exactly as ExitGuard does -- a browser-level limit, not
 * a bug to retry.
 *
 * Contract with the rest of the site:
 *  - identical sentinel shape (`EXIT_GUARD_MARKER` / `EXIT_GUARD_DEPTH_KEY`,
 *    depth 1..N), so ExitGuard's `currentDepth()` sees the parked buffer at
 *    mount and tops it up instead of parking a second one, and
 *    `executeAppExit()` steps over it correctly.
 *  - every pushed state carries `__NA: true`. Next.js's app router reloads
 *    the page when a popstate lands on an entry it did not write (one whose
 *    state lacks `__NA`); with the flag present it restores its CURRENT
 *    tree instead (`restoreReducer`: `tree || state.tree`, Next 14.2). The
 *    post-hydration buffer inherits the flag naturally because ExitGuard
 *    spreads the live `history.state`; the pre-hydration buffer has to set
 *    it by hand. Pinned to Next 14.2's private flag on purpose -- asserted
 *    by __tests__/exit/appExit.test.ts so an upgrade cannot silently drop it.
 *  - stands down the moment ExitGuard is mounted (`EXIT_GUARD_LIVE_FLAG`),
 *    never pushes on top of a foreign `unitas*` entry (a DialogTower's own
 *    back entry), never after a confirmed exit (`TERMINATED_ATTR`), and
 *    never under a DESKTOP app window (fine pointer + hover) -- exactly the
 *    one place ExitGuard keeps a single-entry history so `window.close()`
 *    can genuinely close the window (round 15).
 */
export const EXIT_GUARD_BOOTSTRAP = `(function(){try{
var M=${JSON.stringify(EXIT_GUARD_MARKER)},D=${JSON.stringify(EXIT_GUARD_DEPTH_KEY)},N=${EXIT_GUARD_SENTINEL_DEPTH},L=${JSON.stringify(EXIT_GUARD_LIVE_FLAG)},T=${JSON.stringify(TERMINATED_ATTR)};
var EV=${JSON.stringify([...EXIT_GUARD_ACTIVATION_EVENTS])};
function mq(q){try{var m=window.matchMedia;return !!(m&&m.call(window,q).matches);}catch(_){return false;}}
function standalone(){return mq('(display-mode: standalone)')||mq('(display-mode: window-controls-overlay)')||mq('(display-mode: minimal-ui)')||navigator.standalone===true;}
function desktopApp(){return standalone()&&mq('(hover: hover) and (pointer: fine)');}
function state(){try{var s=window.history.state;return s&&typeof s==='object'?s:null;}catch(_){return null;}}
function depth(){var s=state();if(!s||!s[M])return 0;var d=s[D];return typeof d==='number'&&isFinite(d)?Math.max(1,Math.floor(d)):1;}
function foreign(){var s=state();if(!s)return false;for(var k in s){if(Object.prototype.hasOwnProperty.call(s,k)&&k.indexOf('unitas')===0&&k!==M&&k!==D)return true;}return false;}
function fill(){try{var d=depth();while(d<N){d+=1;var b=state(),n={__NA:true};if(b){for(var k in b){if(Object.prototype.hasOwnProperty.call(b,k))n[k]=b[k];}}n[M]=true;n[D]=d;window.history.pushState(n,'');}}catch(_){}}
function off(){for(var i=0;i<EV.length;i++){window.removeEventListener(EV[i],on,true);}}
function on(){if(window[L]){off();return;}try{if(document.documentElement.hasAttribute(T))return;}catch(_){}if(desktopApp()||foreign())return;fill();}
if(!desktopApp()){for(var i=0;i<EV.length;i++){window.addEventListener(EV[i],on,true);}}
}catch(_){}})();`;
