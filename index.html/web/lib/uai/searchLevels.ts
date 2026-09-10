/**
 * REV-19 §3 -- the U-AI search bar's four-level back-routing state machine.
 *
 *   L0 home ── focus ──▶ L1 base popup (shortcut strip / live hub)
 *   L1 ── first character ──▶ L2 typing session + L3 text (one gesture, two levels)
 *   back @ L3: the text is cleared at once -> L2 (suggestion popup stays,
 *              showing the empty-state discovery widgets)
 *   back @ L2: the suggestion popup closes -> L1 (base popup restored)
 *   back @ L1: the bar loses focus -> L0 (main home)
 *   back @ L0: ExitGuard's exit confirm (not this module's concern)
 *
 * The typing session is sticky only across a BACK-driven clear: deleting
 * the text by hand ends the session immediately so the base widgets come
 * back the instant the input is empty (REV-19 §13).
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
  typing: 'search:typing',
  text: 'search:text',
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
export function onBlur(s: SearchLevelState): SearchLevelState {
  return IDLE_SEARCH_STATE;
}

/** A hand-typed edit. Text present -> typing session on; hand-emptied ->
 *  session ends (base widgets restored instantly). */
export function onInput(s: SearchLevelState, value: string): SearchLevelState {
  const hasText = value.length > 0;
  return { focused: true, typing: hasText, hasText };
}

/** The layer the deep modal history stack just closed, mapped to the state
 *  the bar must show next. `text` keeps the session alive on purpose. */
export function onLayerBack(s: SearchLevelState, layer: keyof typeof SEARCH_LAYER_IDS): SearchLevelState {
  switch (layer) {
    case 'text':
      return { ...s, hasText: false };
    case 'typing':
      return { ...s, typing: false, hasText: false };
    case 'focus':
    default:
      return IDLE_SEARCH_STATE;
  }
}

/** Which history layers must be open for `s` (bottom -> top). */
export function openLayers(s: SearchLevelState): Array<(typeof SEARCH_LAYER_IDS)[keyof typeof SEARCH_LAYER_IDS]> {
  const out: Array<(typeof SEARCH_LAYER_IDS)[keyof typeof SEARCH_LAYER_IDS]> = [];
  if (!s.focused) return out;
  out.push(SEARCH_LAYER_IDS.focus);
  if (s.typing) out.push(SEARCH_LAYER_IDS.typing);
  if (s.typing && s.hasText) out.push(SEARCH_LAYER_IDS.text);
  return out;
}
