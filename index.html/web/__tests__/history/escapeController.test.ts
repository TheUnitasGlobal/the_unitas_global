import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ESCAPE_LOCAL_ATTR,
  SEARCH_LADDER_SELECTOR,
  localEscapeTargetOpen,
  resolveEscape,
  searchLadderActive,
  type EscapeContext,
  type EscapeVerdict,
} from '../../lib/history/escapeController';

// REV-34 SPEC.md §3.5 / D-9 -- the site-wide Escape verdict. Pure decision
// table: no DOM, no fixture shared with any other __tests__/** file.

/** The quiet baseline: nothing open, exit idle, released main home. */
const HOME: EscapeContext = {
  leaving: false,
  localMenuOpen: false,
  confirmOpen: false,
  layersOpen: 0,
  searchLevelActive: false,
  otherGateOwner: false,
  homeReleased: true,
};

const ctx = (patch: Partial<EscapeContext>): EscapeContext => ({ ...HOME, ...patch });

describe('resolveEscape -- the D-9 decision table', () => {
  const table: Array<[string, Partial<EscapeContext>, EscapeVerdict]> = [
    // ① a non-layer menu wins over everything but an exit in flight
    ['attach menu open, nothing else', { localMenuOpen: true }, 'close-local'],
    ['local menu over an open stack', { localMenuOpen: true, layersOpen: 3 }, 'close-local'],
    ['local menu while the confirm is open', { localMenuOpen: true, confirmOpen: true }, 'close-local'],
    ['local menu off the main home', { localMenuOpen: true, homeReleased: false }, 'close-local'],
    // ② the open exit confirm is dismissed (취소) -- the one asymmetry with back
    ['exit confirm open on the home', { confirmOpen: true }, 'dismiss-confirm'],
    ['exit confirm open with a stale layer count', { confirmOpen: true, layersOpen: 1 }, 'dismiss-confirm'],
    ['exit confirm open off the home', { confirmOpen: true, homeReleased: false }, 'dismiss-confirm'],
    // ③ any open layer or search level walks history back exactly once
    ['one popup layer', { layersOpen: 1 }, 'history-back'],
    ['deep stack (card over tower over bar)', { layersOpen: 4 }, 'history-back'],
    ['search bar focused, layer not yet entried', { searchLevelActive: true }, 'history-back'],
    ['suggestion dropdown (listbox) showing', { layersOpen: 2, searchLevelActive: true }, 'history-back'],
    ['layer open while another surface owns the gate (pwa sheet)', { layersOpen: 1, otherGateOwner: true }, 'history-back'],
    ['layer open off the main home (legal notice on the gate)', { layersOpen: 1, homeReleased: false }, 'history-back'],
    // ④ a gate owner without a layer closes itself
    ['gated non-layer surface, empty stack', { otherGateOwner: true }, 'close-local'],
    ['gated non-layer surface off the home', { otherGateOwner: true, homeReleased: false }, 'close-local'],
    // ⑤ released main home with nothing open asks to leave
    ['quiet released home', {}, 'open-confirm'],
    // ⑥ everywhere else Escape is inert, like the back button
    ['logo / gate / ad / sealed phase', { homeReleased: false }, 'ignore'],
    // ⑦ an exit in flight ends every branch
    ['leaving with a local menu', { leaving: true, localMenuOpen: true }, 'ignore'],
    ['leaving with the confirm open', { leaving: true, confirmOpen: true }, 'ignore'],
    ['leaving with layers open', { leaving: true, layersOpen: 2 }, 'ignore'],
    ['leaving on the quiet home', { leaving: true }, 'ignore'],
  ];

  for (const [name, patch, expected] of table) {
    it(`${name} -> ${expected}`, () => {
      expect(resolveEscape(ctx(patch))).toBe(expected);
    });
  }

  it('is a pure function of its input (same context, same verdict, input untouched)', () => {
    const input = ctx({ layersOpen: 2, searchLevelActive: true });
    const snapshot = { ...input };
    expect(resolveEscape(input)).toBe(resolveEscape(input));
    expect(input).toEqual(snapshot);
  });
});

describe('ESCAPE_LOCAL_ATTR', () => {
  it('is the data attribute the non-layer menus are stamped with', () => {
    expect(ESCAPE_LOCAL_ATTR).toBe('data-escape-local');
  });
});

describe('SEARCH_LADDER_SELECTOR', () => {
  it('names the three DOM signals of lib/uai/searchLevels.ts levels 1 / 2-3 / tower', () => {
    expect(SEARCH_LADDER_SELECTOR).toContain('#omni-synapse-search[data-state="focus"]');
    expect(SEARCH_LADDER_SELECTOR).toContain('.qw-search-dropdown[data-search-level]');
    expect(SEARCH_LADDER_SELECTOR).toContain('body[data-fullscreen-tower-open]');
  });
});

describe('DOM helpers without a document (SSR)', () => {
  it('report nothing open instead of throwing', () => {
    expect(searchLadderActive(null)).toBe(false);
    expect(localEscapeTargetOpen(null)).toBe(false);
  });

  it('searchLadderActive reads the selector off the document it is given', () => {
    const seen: string[] = [];
    const doc = {
      querySelector: (selector: string) => {
        seen.push(selector);
        return {};
      },
    } as unknown as Document;
    expect(searchLadderActive(doc)).toBe(true);
    expect(seen).toEqual([SEARCH_LADDER_SELECTOR]);
    const empty = { querySelector: () => null } as unknown as Document;
    expect(searchLadderActive(empty)).toBe(false);
  });

  it('searchLadderActive swallows a broken document', () => {
    const broken = {
      querySelector: () => {
        throw new Error('detached');
      },
    } as unknown as Document;
    expect(searchLadderActive(broken)).toBe(false);
  });
});

/** A stand-in for one `[data-escape-local]` element: its box and whether the
 *  hit-test at its centre lands on it (or a child of it) or on something
 *  else that covers it. The helper only ever calls these three members. */
interface FakeLocalTarget {
  rect: { left: number; top: number; width: number; height: number };
  /** What `elementFromPoint` answers at this element's centre. */
  hit: 'self' | 'child' | 'covered';
}

function fakeDocument(targets: FakeLocalTarget[], selectors: string[] = []) {
  const nodes = targets.map((target) => {
    const child = { parent: null as unknown };
    const el = {
      getBoundingClientRect: () => ({ ...target.rect }),
      contains: (node: unknown) => node === el || node === child,
    };
    child.parent = el;
    return { el, child, target };
  });
  /** Whatever sits on top of a covered menu -- only its identity matters. */
  const cover = {};
  const doc = {
    querySelectorAll: (selector: string) => {
      selectors.push(selector);
      return nodes.map((n) => n.el);
    },
    elementFromPoint: (x: number, y: number) => {
      const owner = nodes.find(({ target }) => {
        const { left, top, width, height } = target.rect;
        return x >= left && x <= left + width && y >= top && y <= top + height;
      });
      if (!owner) return null;
      if (owner.target.hit === 'self') return owner.el;
      if (owner.target.hit === 'child') return owner.child;
      return cover;
    },
  } as unknown as Document;
  return doc;
}

describe('localEscapeTargetOpen -- the [data-escape-local] hit-test', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const withWindow = () => vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720 });

  it('reports nothing when the page has no window at all (SSR)', () => {
    const doc = fakeDocument([{ rect: { left: 10, top: 10, width: 100, height: 100 }, hit: 'self' }]);
    expect(localEscapeTargetOpen(doc)).toBe(false);
  });

  it('queries exactly the ESCAPE_LOCAL_ATTR selector', () => {
    withWindow();
    const seen: string[] = [];
    localEscapeTargetOpen(fakeDocument([], seen));
    expect(seen).toEqual([`[${ESCAPE_LOCAL_ATTR}]`]);
  });

  it('is true for a visible menu that answers the hit-test at its centre', () => {
    withWindow();
    const doc = fakeDocument([{ rect: { left: 100, top: 100, width: 200, height: 120 }, hit: 'self' }]);
    expect(localEscapeTargetOpen(doc)).toBe(true);
  });

  it('is true when the centre lands on a child of the menu (a menu item)', () => {
    withWindow();
    const doc = fakeDocument([{ rect: { left: 100, top: 100, width: 200, height: 120 }, hit: 'child' }]);
    expect(localEscapeTargetOpen(doc)).toBe(true);
  });

  it('skips a collapsed menu (zero rect -- closed but still in the DOM)', () => {
    withWindow();
    const doc = fakeDocument([{ rect: { left: 100, top: 100, width: 0, height: 0 }, hit: 'self' }]);
    expect(localEscapeTargetOpen(doc)).toBe(false);
  });

  it('ignores a menu that something else covers -- a curtain or dialog on top owns Escape', () => {
    withWindow();
    const doc = fakeDocument([{ rect: { left: 100, top: 100, width: 200, height: 120 }, hit: 'covered' }]);
    expect(localEscapeTargetOpen(doc)).toBe(false);
  });

  it('finds an open menu among covered and collapsed ones', () => {
    withWindow();
    const doc = fakeDocument([
      { rect: { left: 0, top: 0, width: 0, height: 0 }, hit: 'self' },
      { rect: { left: 400, top: 40, width: 120, height: 300 }, hit: 'covered' },
      { rect: { left: 900, top: 500, width: 160, height: 90 }, hit: 'child' },
    ]);
    expect(localEscapeTargetOpen(doc)).toBe(true);
  });

  it('clamps an off-screen centre into the viewport before hit-testing', () => {
    withWindow();
    const seen: Array<[number, number]> = [];
    const doc = {
      querySelectorAll: () => [
        {
          getBoundingClientRect: () => ({ left: 1200, top: 700, width: 400, height: 400 }),
          contains: () => false,
        },
      ],
      elementFromPoint: (x: number, y: number) => {
        seen.push([x, y]);
        return null;
      },
    } as unknown as Document;
    expect(localEscapeTargetOpen(doc)).toBe(false);
    expect(seen).toEqual([[1279, 719]]);
  });

  it('swallows a broken document', () => {
    withWindow();
    const broken = {
      querySelectorAll: () => {
        throw new Error('detached');
      },
    } as unknown as Document;
    expect(localEscapeTargetOpen(broken)).toBe(false);
  });
});
