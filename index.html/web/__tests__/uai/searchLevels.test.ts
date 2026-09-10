import { describe, expect, it } from 'vitest';
import {
  IDLE_SEARCH_STATE,
  SEARCH_LAYER_IDS,
  onBlur,
  onFocus,
  onInput,
  onLayerBack,
  openLayers,
  searchLevel,
} from '../../lib/uai/searchLevels';

// REV-19 SPEC.md §3 -- the four-level back-routing sequence of the U-AI
// search bar, proven as a pure state machine (the history entries
// themselves are covered by __tests__/history/modalStack.test.ts).

describe('search levels', () => {
  it('walks L0 -> L1 -> L3 on focus + first character', () => {
    let s = IDLE_SEARCH_STATE;
    expect(searchLevel(s)).toBe(0);
    s = onFocus(s);
    expect(searchLevel(s)).toBe(1);
    expect(openLayers(s)).toEqual([SEARCH_LAYER_IDS.focus]);
    s = onInput(s, 'ㅅ');
    expect(searchLevel(s)).toBe(3);
    expect(openLayers(s)).toEqual([SEARCH_LAYER_IDS.focus, SEARCH_LAYER_IDS.typing, SEARCH_LAYER_IDS.text]);
  });

  it('back @ L3 clears the text but keeps the suggestion popup (L2); back @ L2 -> L1; back @ L1 -> L0', () => {
    let s = onInput(onFocus(IDLE_SEARCH_STATE), '서울');
    s = onLayerBack(s, 'text');
    expect(searchLevel(s)).toBe(2);
    expect(s.typing).toBe(true);
    expect(openLayers(s)).toEqual([SEARCH_LAYER_IDS.focus, SEARCH_LAYER_IDS.typing]);
    s = onLayerBack(s, 'typing');
    expect(searchLevel(s)).toBe(1);
    s = onLayerBack(s, 'focus');
    expect(searchLevel(s)).toBe(0);
    expect(s).toEqual(IDLE_SEARCH_STATE);
  });

  it('a hand-emptied input ends the typing session at once (base widgets restored)', () => {
    let s = onInput(onFocus(IDLE_SEARCH_STATE), '서');
    s = onInput(s, '');
    expect(searchLevel(s)).toBe(1);
    expect(s.typing).toBe(false);
  });

  it('typing again from the empty L2 session returns to L3', () => {
    let s = onLayerBack(onInput(onFocus(IDLE_SEARCH_STATE), 'a'), 'text');
    expect(searchLevel(s)).toBe(2);
    s = onInput(s, 'b');
    expect(searchLevel(s)).toBe(3);
  });

  it('blur resets everything; focus is idempotent', () => {
    const s = onInput(onFocus(IDLE_SEARCH_STATE), 'x');
    expect(onBlur(s)).toEqual(IDLE_SEARCH_STATE);
    expect(onFocus(s)).toBe(s);
  });
});
