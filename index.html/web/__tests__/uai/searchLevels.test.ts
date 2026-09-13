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

// The U-AI search bar's back-routing sequence, proven as a pure state
// machine (the history entries themselves are covered by
// __tests__/history/modalStack.test.ts).
//
// REV-23 M2.4 rewrote the tail: the founder's requirement is exactly three
// presses after the last popup closes -- clear the box, main home, exit
// confirm -- so the old separate `typing` history layer is gone.

describe('search levels', () => {
  it('walks L0 -> L1 -> L3 on focus + first character', () => {
    let s = IDLE_SEARCH_STATE;
    expect(searchLevel(s)).toBe(0);
    s = onFocus(s);
    expect(searchLevel(s)).toBe(1);
    expect(openLayers(s)).toEqual([SEARCH_LAYER_IDS.focus]);
    s = onInput(s, 'ㅅ');
    expect(searchLevel(s)).toBe(3);
    expect(openLayers(s)).toEqual([SEARCH_LAYER_IDS.focus, SEARCH_LAYER_IDS.text]);
  });

  it('the bar owns exactly two history layers -- never a third for `typing`', () => {
    const typed = onInput(onFocus(IDLE_SEARCH_STATE), '서울');
    expect(openLayers(typed)).toHaveLength(2);
    expect(openLayers(typed)).not.toContain('search:typing');
  });

  it('M2.4 tail: back clears the box, the next back leaves for the main home', () => {
    let s = onInput(onFocus(IDLE_SEARCH_STATE), '서울');
    s = onLayerBack(s, 'text');
    // One press emptied the box AND closed the suggestion dropdown.
    expect(s.hasText).toBe(false);
    expect(s.typing).toBe(false);
    expect(searchLevel(s)).toBe(1);
    expect(openLayers(s)).toEqual([SEARCH_LAYER_IDS.focus]);
    s = onLayerBack(s, 'focus');
    expect(searchLevel(s)).toBe(0);
    expect(s).toEqual(IDLE_SEARCH_STATE);
    // From here the next back belongs to ExitGuard -- the bar owns nothing.
    expect(openLayers(s)).toEqual([]);
  });

  it('a hand-emptied input ends the typing session at once (base widgets restored)', () => {
    let s = onInput(onFocus(IDLE_SEARCH_STATE), '서');
    s = onInput(s, '');
    expect(searchLevel(s)).toBe(1);
    expect(s.typing).toBe(false);
    expect(openLayers(s)).toEqual([SEARCH_LAYER_IDS.focus]);
  });

  it('typing again after a cleared box returns to L3 with both layers', () => {
    let s = onLayerBack(onInput(onFocus(IDLE_SEARCH_STATE), 'a'), 'text');
    expect(searchLevel(s)).toBe(1);
    s = onInput(s, 'b');
    expect(searchLevel(s)).toBe(3);
    expect(openLayers(s)).toEqual([SEARCH_LAYER_IDS.focus, SEARCH_LAYER_IDS.text]);
  });

  it('the tower marker is the id DialogTower registers, so the ladder is one stack', () => {
    expect(SEARCH_LAYER_IDS.tower).toBe('unitasUaiSearchTower');
  });

  it('blur resets everything; focus is idempotent', () => {
    const s = onInput(onFocus(IDLE_SEARCH_STATE), 'x');
    expect(onBlur(s)).toEqual(IDLE_SEARCH_STATE);
    expect(onFocus(s)).toBe(s);
  });
});
