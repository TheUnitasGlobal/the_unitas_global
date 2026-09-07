import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONSOLE_DEV_ACTIONS,
  CONSOLE_DEV_SEARCH_PATTERN,
  CONSOLE_GESTURE_ES5,
  CONSOLE_LOAD_ES5,
  CONSOLE_ROOT_ATTR,
  CONSOLE_ROOT_SELECTOR,
  CONSOLE_TRIGGER_STORAGE_KEY,
  SPLASH_REPLAY_SOURCE_CONSOLE,
  clearConsoleTrigger,
  consoleDevAction,
  isConsoleDevSearch,
  isConsoleGesture,
  isConsoleTriggeredDocument,
  isConsoleTriggeredLoad,
  markConsoleTrigger,
  readConsoleTrigger,
} from '../../lib/sovereign/consoleTrigger';

// Sovereign console trigger isolation (owner instruction 2026-09-07, master
// audit item 2): the founder console's actions must never re-enter the
// visitor's logo-page / login audio path. These guard the pure predicates
// the hydrated side AND the ES5 head bootstraps share.

describe('console `?dev=` navigation detection', () => {
  it('recognises every console action in any query position, and nothing else', () => {
    for (const action of CONSOLE_DEV_ACTIONS) {
      expect(isConsoleDevSearch(`?dev=${action}`)).toBe(true);
      expect(isConsoleDevSearch(`?x=1&dev=${action}`)).toBe(true);
      expect(isConsoleDevSearch(`?dev=${action}&y=2`)).toBe(true);
      expect(consoleDevAction(`?dev=${action}`)).toBe(action);
    }
    expect(isConsoleDevSearch('')).toBe(false);
    expect(isConsoleDevSearch(null)).toBe(false);
    expect(isConsoleDevSearch(undefined)).toBe(false);
    expect(isConsoleDevSearch('?splash=0')).toBe(false);
    expect(isConsoleDevSearch('?dev=skipper')).toBe(false);
    expect(isConsoleDevSearch('?devs=skip')).toBe(false);
    expect(isConsoleDevSearch('?sovereign_auth=abc')).toBe(false);
    expect(consoleDevAction('?dev=nope')).toBeNull();
  });

  it('the ES5 pattern string is the very same expression', () => {
    const re = new RegExp(CONSOLE_DEV_SEARCH_PATTERN);
    expect(re.test('?dev=skip')).toBe(true);
    expect(re.test('?dev=replay&z=1')).toBe(true);
    expect(re.test('?dev=off')).toBe(true);
    expect(re.test('?dev=other')).toBe(false);
  });
});

describe('console-triggered document load (URL or storage)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is true for a console URL, for a storage-carried trigger, and false for a visitor load', () => {
    expect(isConsoleTriggeredLoad('?dev=skip', null)).toBe(true);
    expect(isConsoleTriggeredLoad('', 'revoke')).toBe(true);
    expect(isConsoleTriggeredLoad('', '  ')).toBe(false);
    expect(isConsoleTriggeredLoad('', null)).toBe(false);
    expect(isConsoleTriggeredLoad('?utm_source=google', undefined)).toBe(false);
  });

  it('mark / read / clear ride sessionStorage and never throw without it', () => {
    let stored: string | null = null;
    vi.stubGlobal('window', {
      location: { search: '' },
      sessionStorage: {
        getItem: () => stored,
        setItem: (_k: string, v: string) => {
          stored = v;
        },
        removeItem: () => {
          stored = null;
        },
      },
    });
    expect(isConsoleTriggeredDocument()).toBe(false);
    markConsoleTrigger('revoke');
    expect(readConsoleTrigger()).toBe('revoke');
    expect(isConsoleTriggeredDocument()).toBe(true);
    clearConsoleTrigger();
    expect(readConsoleTrigger()).toBeNull();
    expect(isConsoleTriggeredDocument()).toBe(false);

    vi.stubGlobal('window', { location: { search: '?dev=replay' } });
    expect(isConsoleTriggeredDocument()).toBe(true);
    expect(() => markConsoleTrigger('skip')).not.toThrow();
    expect(readConsoleTrigger()).toBeNull();

    vi.stubGlobal('window', {});
    expect(isConsoleTriggeredDocument()).toBe(false);
  });
});

describe('console gesture detection', () => {
  it('is true only for a target inside the console root, and never throws on odd inputs', () => {
    const inside = { target: { closest: (sel: string) => (sel === CONSOLE_ROOT_SELECTOR ? {} : null) } };
    const outside = { target: { closest: () => null } };
    expect(isConsoleGesture(inside)).toBe(true);
    expect(isConsoleGesture(outside)).toBe(false);
    expect(isConsoleGesture({ target: {} })).toBe(false);
    expect(isConsoleGesture({ target: null })).toBe(false);
    expect(isConsoleGesture({})).toBe(false);
    expect(isConsoleGesture(null)).toBe(false);
    expect(isConsoleGesture(undefined)).toBe(false);
    expect(
      isConsoleGesture({
        target: {
          closest: () => {
            throw new Error('boom');
          },
        },
      }),
    ).toBe(false);
    expect(CONSOLE_ROOT_SELECTOR).toBe(`[${CONSOLE_ROOT_ATTR}]`);
  });
});

describe('ES5 bootstrap twins', () => {
  it('are dependency-free ES5 that parse, and answer exactly like the module', () => {
    for (const src of [CONSOLE_GESTURE_ES5, CONSOLE_LOAD_ES5]) {
      expect(src).not.toContain('=>');
      expect(src).not.toMatch(/\b(let|const)\b/);
    }
    const consoleGesture = new Function('return (' + CONSOLE_GESTURE_ES5.replace(/^function consoleGesture/, 'function') + ')')() as (
      e: unknown,
    ) => boolean;
    expect(consoleGesture({ target: { closest: (sel: string) => (sel === CONSOLE_ROOT_SELECTOR ? {} : null) } })).toBe(true);
    expect(consoleGesture({ target: { closest: () => null } })).toBe(false);
    expect(consoleGesture(null)).toBe(false);

    const loadFor = (win: unknown) =>
      new Function('window', 'return (' + CONSOLE_LOAD_ES5.replace(/^function consoleLoad/, 'function') + ')()')(win) as boolean;
    expect(loadFor({ location: { search: '?dev=skip' } })).toBe(true);
    expect(loadFor({ location: { search: '' }, sessionStorage: { getItem: () => 'revoke' } })).toBe(true);
    expect(loadFor({ location: { search: '' }, sessionStorage: { getItem: () => '   ' } })).toBe(false);
    expect(loadFor({ location: { search: '?q=1' }, sessionStorage: { getItem: () => null } })).toBe(false);
    expect(loadFor({})).toBe(false);
    expect(loadFor({ location: { search: '' } })).toBe(false);
    expect(CONSOLE_LOAD_ES5).toContain(CONSOLE_TRIGGER_STORAGE_KEY);
  });

  it('names the replay source the splash component matches', () => {
    expect(SPLASH_REPLAY_SOURCE_CONSOLE).toBe('console');
  });
});
