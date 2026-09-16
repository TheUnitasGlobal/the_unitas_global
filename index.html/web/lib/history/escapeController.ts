/**
 * REV-34 M3 (SPEC.md §3.5, decision D-9) -- the site-wide Escape verdict.
 *
 * WHY: before REV-34 the Escape key was routed ad hoc. ExitGuard's capture
 * listener opened the exit confirm whenever no `role=dialog|menu|listbox`
 * element answered a hit-test, and every popup closed itself on its own
 * bubble-phase listener. Two defects followed: over the U-AI suggestion
 * dropdown (a `role="listbox"`) Escape was dead, and at search level 1 it
 * opened the exit confirm OVER the still-open search popup. The founder's
 * requirement is that Escape behaves exactly like the device back button:
 * LIFO through the deep modal history stack (card -> tower -> clear text ->
 * leave the bar -> main home -> exit confirm).
 *
 * This module is the pure decision. ExitGuard feeds it a snapshot of the UI
 * and acts on the verdict; the stack itself (lib/history/modalStack.ts) is
 * never touched here -- `history-back` means ExitGuard calls
 * `window.history.back()` once, which the Navigation API attributes as a USER
 * traversal, i.e. the very path a phone's back button takes.
 *
 * Verdict order (D-9), first match wins:
 *   1. an exit is in flight                       -> ignore
 *   2. a `[data-escape-local]` menu is on screen  -> close-local
 *   3. the exit confirm is open                   -> dismiss-confirm
 *   4. a stack layer or a search level is open    -> history-back
 *   5. another surface owns the UI gate           -> close-local
 *   6. released main home                         -> open-confirm
 *   7. anything else (logo/gate/ad/sealed, routes) -> ignore
 *
 * Framework-free and deterministic; the DOM helper at the bottom is the one
 * place a document is read, and it is guarded for SSR.
 */

/** Stamped on a NON-layer popup (attach menu, language picker, pinned hint)
 *  so Escape closes that popup alone before the history stack is consulted.
 *  The device back button ignores these popups (they hold no history
 *  entry), which is the one place Escape deliberately does more than back. */
export const ESCAPE_LOCAL_ATTR = 'data-escape-local';

export type EscapeVerdict = 'close-local' | 'dismiss-confirm' | 'history-back' | 'open-confirm' | 'ignore';

export interface EscapeContext {
  /** A confirmed exit is running (ExitGuard `leavingRef` / exit engine). */
  leaving: boolean;
  /** A `[data-escape-local]` popup is open and hit-testable on top. */
  localMenuOpen: boolean;
  /** ExitGuard's own confirm dialog owns the UI gate. */
  confirmOpen: boolean;
  /** `getModalStack().openCount()` -- layers registered as open. */
  layersOpen: number;
  /** The U-AI search ladder is at level >= 1 per the DOM (focused bar,
   *  suggestion dropdown or fullscreen tower). Normally redundant with
   *  `layersOpen` -- every level is a stack layer -- but it covers the frame
   *  between the bar's focus state and its layer effect, and a stack whose
   *  push was refused (history unavailable). */
  searchLevelActive: boolean;
  /** Some surface other than the exit confirm owns the UI gate (an auth /
   *  language / settings popup that is not a history layer). */
  otherGateOwner: boolean;
  /** The curtain has been released: the main home is on screen. */
  homeReleased: boolean;
}

export function resolveEscape(ctx: EscapeContext): EscapeVerdict {
  if (ctx.leaving) return 'ignore';
  if (ctx.localMenuOpen) return 'close-local';
  if (ctx.confirmOpen) return 'dismiss-confirm';
  if (ctx.layersOpen > 0 || ctx.searchLevelActive) return 'history-back';
  if (ctx.otherGateOwner) return 'close-local';
  if (ctx.homeReleased) return 'open-confirm';
  return 'ignore';
}

/** Selectors that prove the U-AI search ladder is at level >= 1 (see
 *  lib/uai/searchLevels.ts): the bar's `data-state="focus"` (level 1, layer
 *  `search:focus`), the dropdown's `data-search-level` (levels 2/3) and the
 *  body flag DialogTower sets while the fullscreen result is up (`tower`).
 *
 *  WHY the DOM and not searchLevels.ts: that module is a pure reducer whose
 *  `SearchLevelState` lives inside OmniSynapseSearch's React state -- there
 *  is no singleton to read from ExitGuard, and exporting one would add a
 *  second source of truth beside the history stack. The three attributes
 *  above are already E2E contracts (rev19-search-back, rev20-fullscreen-nav)
 *  and are written by the very components that own those levels, so they
 *  are as reliable as the state and need no new event bus. `data-state`
 *  reads "drag" during a pointer drag over the bar; that frame is covered by
 *  the bar's `search:focus` layer in `layersOpen`, not by this selector. */
export const SEARCH_LADDER_SELECTOR =
  '#omni-synapse-search[data-state="focus"], .qw-search-dropdown[data-search-level], body[data-fullscreen-tower-open]';

/** True when the DOM shows the search ladder at level >= 1. */
export function searchLadderActive(doc: Document | null = typeof document === 'undefined' ? null : document): boolean {
  if (!doc) return false;
  try {
    return doc.querySelector(SEARCH_LADDER_SELECTOR) !== null;
  } catch {
    return false;
  }
}

/** True when a `[data-escape-local]` popup is open ON TOP. Hidden menus
 *  (`hidden`, collapsed to a zero rect) are skipped, and a candidate must
 *  answer the hit-test at its own centre -- a popup left in the DOM beneath
 *  a full-screen curtain or dialog must not swallow the key. */
export function localEscapeTargetOpen(doc: Document | null = typeof document === 'undefined' ? null : document): boolean {
  if (!doc || typeof window === 'undefined') return false;
  try {
    const candidates = doc.querySelectorAll<HTMLElement>(`[${ESCAPE_LOCAL_ATTR}]`);
    for (const el of Array.from(candidates)) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = doc.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) return true;
    }
    return false;
  } catch {
    return false;
  }
}
