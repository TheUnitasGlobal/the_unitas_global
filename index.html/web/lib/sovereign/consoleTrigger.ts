// Sovereign console trigger isolation (owner instruction 2026-09-07, master
// audit item 2: "소버린 콘솔 트리거 완전 분리").
//
// The founder console (components/sovereign/SovereignDebugPanel.tsx) drives
// QA actions -- enter the main site (`?dev=skip`), replay the sequence
// (`?dev=replay`), replay the intro splash (a window event), revoke the
// founder session (a reload). Every one of them used to re-enter the
// VISITOR's audio path by accident: a full navigation wiped the tab session,
// which replayed the 3 s logo page and its entry chime on "메인사이트 진입"
// and "권한 해제" alike; the console's own click also reached the pending
// entry chime's window-level gesture listener, so a QA tap could sound the
// visitor's chime and the console action's own feedback at once ("음향 충돌")
// -- or the wrong sound for the action ("인지 부조화").
//
// Doctrine, single source of truth for both channels and every device:
//
//   * The ENTRY CHIME belongs to a VISITOR's genuine entry only -- a cold
//     entry, or the visitor-facing "다시 재생" on the sealed Coming-Soon
//     screen. A document load that is a CONSOLE ACTION never arms it.
//   * A gesture that lands ON the console is a founder command, not a
//     visitor gesture: the entry chime's gesture listeners ignore it.
//   * The console confirms its own actions with the site's ordinary UI
//     ping through SpatialAudioProvider (a different timbre, a different
//     engine) -- one sound per command, never the login / logo-page cue.
//   * `?dev=skip` (메인사이트 진입) and a revoke reload (권한 해제) skip the
//     logo page outright: "enter" and "sign out" are transitions, not
//     entries. `?dev=replay` restarts the visitor sequence from the entry
//     gate (the curtain's own contract); the logo page has its own console
//     button, which replays it visually -- silently.
//
// Pure module -- no React, no DOM at import time -- so the pre-hydration head
// bootstraps (lib/pwa/installPrompt.ts, lib/audio/logoEntryChime.ts) can
// interpolate the same constants and predicates and never drift from the
// hydrated side. Unit-tested in __tests__/sovereign/consoleTrigger.test.ts.

/** The QA `?dev=` values the console navigates with. `off` is the URL form
 *  of a revoke (lib/foundersGate.ts / ComingSoonCinema). */
export const CONSOLE_DEV_ACTIONS = ['skip', 'replay', 'off'] as const;
export type ConsoleDevAction = (typeof CONSOLE_DEV_ACTIONS)[number];

/** Console actions that survive a document load through storage rather
 *  than the URL (a revoke is a plain `location.reload()`). */
export type ConsoleTriggerKind = ConsoleDevAction | 'revoke' | 'splash';

/**
 * sessionStorage key the console stamps right before a RELOAD-style action
 * (revoke). Read by the head bootstraps on the next document; a reload keeps
 * sessionStorage, every real re-entry wipes it (lib/pwa/installPrompt.ts),
 * so the flag can never leak into a later cold visit.
 */
export const CONSOLE_TRIGGER_STORAGE_KEY = 'unitas_console_trigger';

/**
 * `data-` attribute on the console's root element(s). A gesture whose
 * target sits inside such an element is a founder command -- the visitor
 * audio engines (entry chime) ignore it. Also the selector the ES5
 * bootstraps use, so it is spelled once here.
 */
export const CONSOLE_ROOT_ATTR = 'data-sovereign-console';
export const CONSOLE_ROOT_SELECTOR = `[${CONSOLE_ROOT_ATTR}]`;

/**
 * `detail.source` value the console attaches to SPLASH_REPLAY_EVENT. The
 * visitor-facing replay (the sealed screen's 다시 재생) dispatches the event
 * with no detail and keeps its chime.
 */
export const SPLASH_REPLAY_SOURCE_CONSOLE = 'console';

/**
 * Delay between the console's confirmation ping and a full-document
 * navigation it triggers, so the ping is actually heard before the document
 * unloads. Short enough to still feel instant.
 */
export const CONSOLE_NAV_DELAY_MS = 140;

/**
 * Regex source (no flags, ES5-safe) matching a console `?dev=` navigation in
 * `location.search`. Exported as a STRING so the head bootstraps can inline
 * it verbatim -- the same expression on both sides.
 */
export const CONSOLE_DEV_SEARCH_PATTERN = `[?&]dev=(${CONSOLE_DEV_ACTIONS.join('|')})(&|$)`;

const CONSOLE_DEV_SEARCH_RE = new RegExp(CONSOLE_DEV_SEARCH_PATTERN);

/** Pure: does this `location.search` carry a console `?dev=` action? */
export function isConsoleDevSearch(search: string | null | undefined): boolean {
  if (!search) return false;
  return CONSOLE_DEV_SEARCH_RE.test(search);
}

/** Pure: the console action named by `location.search`, if any. */
export function consoleDevAction(search: string | null | undefined): ConsoleDevAction | null {
  if (!search) return null;
  const match = CONSOLE_DEV_SEARCH_RE.exec(search);
  if (!match) return null;
  const value = match[1] as ConsoleDevAction;
  return (CONSOLE_DEV_ACTIONS as readonly string[]).includes(value) ? value : null;
}

/** Stamp a storage-carried console trigger for the NEXT document (reload). */
export function markConsoleTrigger(kind: ConsoleTriggerKind): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CONSOLE_TRIGGER_STORAGE_KEY, kind);
  } catch {
    /* storage blocked -- the URL form (where one exists) still carries it */
  }
}

/** The storage-carried console trigger on this document, if any. */
export function readConsoleTrigger(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(CONSOLE_TRIGGER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Clear the storage-carried trigger (a later in-place refresh is ordinary). */
export function clearConsoleTrigger(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CONSOLE_TRIGGER_STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

/**
 * Pure: is THIS document load a console action? True for a `?dev=` URL or a
 * storage-carried trigger. Both the hydrated splash and the head bootstraps
 * answer this the same way, so the logo page and the entry chime stand down
 * together for a console load and never for a visitor's.
 */
export function isConsoleTriggeredLoad(search: string | null | undefined, storedTrigger: string | null | undefined): boolean {
  if (isConsoleDevSearch(search)) return true;
  return typeof storedTrigger === 'string' && storedTrigger.trim().length > 0;
}

/** Live twin of `isConsoleTriggeredLoad` for the hydrated side. */
export function isConsoleTriggeredDocument(): boolean {
  if (typeof window === 'undefined') return false;
  let search = '';
  try {
    search = window.location.search;
  } catch {
    search = '';
  }
  return isConsoleTriggeredLoad(search, readConsoleTrigger());
}

/**
 * Pure: did this DOM event originate inside the founder console? Accepts any
 * event-like object -- the bootstraps and the hydrated engines both call it
 * from window-level capture listeners. Never throws.
 */
export function isConsoleGesture(event: unknown): boolean {
  try {
    const target = (event as { target?: unknown } | null)?.target as
      | { closest?: (selector: string) => unknown }
      | null
      | undefined;
    if (!target || typeof target.closest !== 'function') return false;
    return target.closest(CONSOLE_ROOT_SELECTOR) != null;
  } catch {
    return false;
  }
}

/**
 * ES5 source of `isConsoleGesture` for the head bootstraps (a function
 * expression named `consoleGesture`). Interpolated verbatim, so the selector
 * is the one constant above.
 */
export const CONSOLE_GESTURE_ES5 = `function consoleGesture(e){try{var t=e&&e.target;return !!(t&&typeof t.closest==='function'&&t.closest(${JSON.stringify(CONSOLE_ROOT_SELECTOR)}));}catch(_){return false;}}`;

/**
 * ES5 source of `isConsoleTriggeredDocument` for the head bootstraps (a
 * function expression named `consoleLoad`). Reads `location.search` and the
 * storage flag, each fenced.
 */
export const CONSOLE_LOAD_ES5 = `function consoleLoad(){var s='';try{s=String(window.location.search||'');}catch(_){s='';}if(new RegExp(${JSON.stringify(CONSOLE_DEV_SEARCH_PATTERN)}).test(s))return true;try{var v=window.sessionStorage.getItem(${JSON.stringify(CONSOLE_TRIGGER_STORAGE_KEY)});return !!(v&&String(v).replace(/^\\s+|\\s+$/g,'').length);}catch(_){return false;}}`;
