/**
 * The U-AI search bar's back-routing state machine.
 *
 * REV-23 M2.4 (founder directive 2026-09-13) -- THE BACK LIFECYCLE. The
 * founder's requirement is exact: from ANY popup depth, back unwinds the
 * popups in reverse order of opening, and the tail of that walk is
 *
 *     [clear the search box] -> [main home] -> [exit confirm]
 *
 * The old machine had a separate `typing` history layer between `text` and
 * `focus`, so the tail was four presses, not three: clear text, close the
 * suggestion popup, leave the bar, exit. `typing` is now UI state ONLY --
 * whether the suggestion dropdown is showing -- and no longer owns a history
 * entry. The stack, bottom to top, is:
 *
 *   focus   the bar is focused (base popup)          back -> main home
 *   text    the bar has text                          back -> clear the box
 *   tower   the fullscreen result is open             back -> collapse it
 *   card    a card / theme popup inside the result    back -> close it
 *
 * `tower` and `card` are owned by DialogTower / Modal through the same
 * `useHistoryLayer` hook, so they nest above these two automatically; they
 * are named here so the whole ladder is documented in one place.
 *
 * `text` deliberately survives the tower: collapsing the result leaves the
 * query in the bar for refinement (closeSearchTower), so the very next back
 * is the "검색창 내용 초기화" step the founder asked for.
 *
 * Pure, framework-free; the React binding lives in OmniSynapseSearch.tsx.
 */

export type SearchLevel = 0 | 1 | 2 | 3;

export interface SearchLevelState {
  focused: boolean;
  typing: boolean;
  hasText: boolean;
}

export const SEARCH_LAYER_IDS = {
  focus: 'search:focus',
  text: 'search:text',
  /** Owned by the result DialogTower (historyMarker). */
  tower: 'unitasUaiSearchTower',
} as const;

export const IDLE_SEARCH_STATE: SearchLevelState = { focused: false, typing: false, hasText: false };

export function searchLevel(s: SearchLevelState): SearchLevel {
  if (!s.focused) return 0;
  if (!s.typing) return 1;
  return s.hasText ? 3 : 2;
}

/** The bar gained focus (a click / tab) -- never changes an active session. */
export function onFocus(s: SearchLevelState): SearchLevelState {
  return s.focused ? s : { ...s, focused: true };
}

/** Focus left the bar entirely (outside click, hand-off to a tower). */
export function onBlur(_s: SearchLevelState): SearchLevelState {
  return IDLE_SEARCH_STATE;
}

/** A hand-typed edit. Text present -> typing session on; hand-emptied ->
 *  session ends (base widgets restored instantly). */
export function onInput(_s: SearchLevelState, value: string): SearchLevelState {
  const hasText = value.length > 0;
  return { focused: true, typing: hasText, hasText };
}

/**
 * The layer the deep modal history stack just closed, mapped to the state
 * the bar must show next.
 *
 * `text` clears the box AND ends the typing session in one press -- that is
 * the M2.4 collapse: one "초기화" step, then home. The suggestion dropdown
 * closing is a consequence of the box being empty, not its own back press.
 */
export function onLayerBack(s: SearchLevelState, layer: 'focus' | 'text'): SearchLevelState {
  switch (layer) {
    case 'text':
      return { ...s, typing: false, hasText: false };
    case 'focus':
    default:
      return IDLE_SEARCH_STATE;
  }
}

/** Which history layers the BAR owns for `s` (bottom -> top). The tower and
 *  any card popup above it register themselves. */
export function openLayers(s: SearchLevelState): Array<(typeof SEARCH_LAYER_IDS)[keyof typeof SEARCH_LAYER_IDS]> {
  const out: Array<(typeof SEARCH_LAYER_IDS)[keyof typeof SEARCH_LAYER_IDS]> = [];
  if (!s.focused) return out;
  out.push(SEARCH_LAYER_IDS.focus);
  if (s.hasText) out.push(SEARCH_LAYER_IDS.text);
  return out;
}
