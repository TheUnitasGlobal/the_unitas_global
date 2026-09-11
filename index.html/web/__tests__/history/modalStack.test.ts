import { describe, expect, it } from 'vitest';
import {
  DEAD_SKIP_BUDGET,
  DEAD_SKIP_WINDOW_MS,
  MODAL_ACTIVATION_EVENTS,
  MODAL_STACK_KEY,
  TRAVERSAL_TIMEOUT_MS,
  createModalStack,
  deadSkipAllowed,
  readModalStack,
  resolvePop,
  type ModalHistoryHost,
} from '../../lib/history/modalStack';

// REV-19 SPEC.md §1 -- the deep modal history stack, driven through a fake
// session history so every rule (activation-gated push, deferred entries,
// programmatic release, queued hand-off, dead-entry skip, pop claiming)
// is proven without a DOM. Module-level isolation: no fixture is shared
// with any other __tests__/** file.

interface FakeHistory extends ModalHistoryHost {
  entries: Array<Record<string, unknown>>;
  /** URL passed with each pushed entry (undefined = inherited). */
  urls: Array<string | undefined>;
  index: number;
  active: boolean;
  /** Fire the popstate for the last traversal (engines deliver it async). */
  land(): void;
  pendingDelta: number | null;
  timers: Array<{ fn: () => void; ms: number; id: number }>;
  runTimers(): void;
  activation(): void;
  userBack(): void;
  userForward(): void;
  state(): Record<string, unknown>;
  fire(e: unknown): void;
  /** Navigation-API style pre-commit intent (`navigate` / traverse). */
  traversalListeners: Set<() => void>;
  /** The visitor starts a back gesture: the intent fires now, the landing
   *  (`land()`) is delivered later -- exactly the browser's ordering. */
  beginUserBack(): void;
  clock: number;
}

function fakeHistory(): FakeHistory {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  let timerSeq = 0;
  const h: FakeHistory = {
    entries: [{ __NA: true, unitasExitGuard: true, unitasExitDepth: 12 }],
    urls: [undefined],
    index: 0,
    active: true,
    pendingDelta: null,
    timers: [],
    traversalListeners: new Set(),
    clock: 0,
    now: () => h.clock,
    observeTraversals: (listener) => {
      h.traversalListeners.add(listener);
      return () => h.traversalListeners.delete(listener);
    },
    beginUserBack: () => {
      h.pendingDelta = -1;
      for (const fn of h.traversalListeners) fn();
    },
    getState: () => h.entries[h.index],
    pushState: (state, url) => {
      h.entries = h.entries.slice(0, h.index + 1);
      h.urls = h.urls.slice(0, h.index + 1);
      h.entries.push(state);
      h.urls.push(url);
      h.index = h.entries.length - 1;
    },
    go: (delta) => {
      h.pendingDelta = delta;
      // the engine announces the traversal intent before it commits
      for (const fn of h.traversalListeners) fn();
    },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type, fn) => {
      listeners.get(type)?.delete(fn);
    },
    activationActive: () => h.active,
    setTimeout: (fn, ms) => {
      timerSeq += 1;
      h.timers.push({ fn, ms, id: timerSeq });
      return timerSeq;
    },
    clearTimeout: (id) => {
      h.timers = h.timers.filter((t) => t.id !== id);
    },
    land: () => {
      if (h.pendingDelta === null) throw new Error('no traversal pending');
      const next = Math.min(h.entries.length - 1, Math.max(0, h.index + h.pendingDelta));
      h.pendingDelta = null;
      h.index = next;
      const event = { type: 'popstate', state: h.entries[h.index] };
      for (const fn of listeners.get('popstate') ?? []) fn(event);
    },
    runTimers: () => {
      const due = h.timers.splice(0, h.timers.length);
      for (const t of due) t.fn();
    },
    activation: () => {
      for (const fn of listeners.get('click') ?? []) fn({ type: 'click' });
    },
    userBack: () => {
      h.pendingDelta = -1;
      h.land();
    },
    userForward: () => {
      h.pendingDelta = 1;
      h.land();
    },
    state: () => h.entries[h.index],
    fire: (e: unknown) => {
      for (const fn of listeners.get('popstate') ?? []) fn(e);
    },
  };
  return h;
}

describe('resolvePop (pure)', () => {
  it('closes the open layers the landed entry no longer names, top first', () => {
    expect(resolvePop(['a#1', 'b#2', 'c#3'], ['a#1'])).toEqual({ close: ['c#3', 'b#2'], dead: false });
  });
  it('flags a landed entry that names a token nothing open owns', () => {
    expect(resolvePop([], ['a#1'])).toEqual({ close: [], dead: true });
    expect(resolvePop(['b#2'], ['a#1', 'b#2'])).toEqual({ close: [], dead: true });
  });
  it('is a no-op when landed and open agree', () => {
    expect(resolvePop(['a#1'], ['a#1'])).toEqual({ close: [], dead: false });
    expect(resolvePop([], [])).toEqual({ close: [], dead: false });
  });
});

describe('readModalStack', () => {
  it('reads only string tokens and tolerates junk', () => {
    expect(readModalStack(null)).toEqual([]);
    expect(readModalStack({ [MODAL_STACK_KEY]: ['a#1', 3, 'b#2'] })).toEqual(['a#1', 'b#2']);
    expect(readModalStack({ [MODAL_STACK_KEY]: 'nope' })).toEqual([]);
  });
});

describe('createModalStack', () => {
  it('pushes one entry per layer inside activation, inheriting the base state', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('qw:cluster', () => closed.push('cluster'));
    stack.push('qw:entry', () => closed.push('entry'));
    expect(h.entries).toHaveLength(3);
    expect(h.state().unitasExitDepth).toBe(12);
    expect(h.state().__NA).toBe(true);
    expect(readModalStack(h.state())).toEqual(['qw:cluster#1', 'qw:entry#2']);
    expect(stack.openCount()).toBe(2);
  });

  it('a back press closes exactly the top layer, the next one the layer below', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('qw:cluster', () => closed.push('cluster'));
    stack.push('qw:entry', () => closed.push('entry'));
    h.userBack();
    expect(closed).toEqual(['entry']);
    expect(stack.openCount()).toBe(1);
    h.userBack();
    expect(closed).toEqual(['entry', 'cluster']);
    expect(stack.openCount()).toBe(0);
    expect(h.index).toBe(0); // sentinel entry -- ExitGuard's turn from here
  });

  it('claimPop answers the same for every listener and is false on a bare sentinel pop', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    stack.push('modal', () => undefined);
    const event = { type: 'popstate' };
    // Ask BEFORE the module's own listener would have mutated anything.
    expect(stack.claimPop(event)).toBe(true);
    h.userBack();
    expect(stack.claimPop(event)).toBe(true); // memoised verdict
    const bare = { type: 'popstate' };
    expect(stack.claimPop(bare)).toBe(false);
  });

  it('programmatic release walks history back over the layer entry and suppresses onBack', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    let backs = 0;
    const handle = stack.push('modal', () => {
      backs += 1;
    });
    expect(h.entries).toHaveLength(2);
    handle.release();
    expect(stack.openCount()).toBe(0);
    expect(h.pendingDelta).toBe(-1);
    h.land();
    expect(backs).toBe(0);
    expect(h.index).toBe(0);
    handle.release(); // idempotent
    expect(h.pendingDelta).toBeNull();
  });

  it('queues a push issued while a release traversal is in flight and replays it after landing', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const a = stack.push('search:focus', () => undefined);
    a.release(); // go(-1) pending
    const b = stack.push('tower', () => undefined);
    expect(h.entries).toHaveLength(2); // nothing pushed yet
    expect(stack.openCount()).toBe(1);
    h.land();
    // queue replayed synchronously on landing: the tower entry now sits
    // directly on the sentinel (the search entry is gone).
    expect(h.index).toBe(1);
    expect(h.entries).toHaveLength(2);
    expect(readModalStack(h.entries[0])).toEqual([]);
    expect(readModalStack(h.state())).toEqual([b.token]);
  });

  it('a new push queued behind three nested layers releasing in the same tick survives the dead-entry skip that unwinds them (REV-20 keyword-panel race)', () => {
    // Reproduces the search dropdown's L1/L2/L3 layers (focus -> typing ->
    // text) all collapsing in one React commit -- exactly what
    // OmniSynapseSearch's closeBrowseHub() does -- while, in that SAME
    // commit, a brand new layer (the keyword-result panel) is pushed. Only
    // the topmost release actually starts a real traversal; the other two
    // leave dead tokens on the landings that traversal unwinds through, and
    // the fresh push must not get swept up by the corrective skips that
    // clear those dead tokens.
    const h = fakeHistory();
    const stack = createModalStack(h);
    let closedD = false;
    const a = stack.push('search:focus', () => undefined);
    const b = stack.push('search:typing', () => undefined);
    const c = stack.push('search:text', () => undefined);
    expect(h.entries).toHaveLength(4);

    // React's effect-cleanup batch: all three release synchronously, in
    // HOOK DECLARATION ORDER (React runs changed-dependency cleanups top
    // to bottom, not reversed -- reversal is only for unmount) -- so the
    // OUTERMOST layer (focus) releases first, same as OmniSynapseSearch's
    // three `useHistoryLayer(focused, ...)` / `(focused && typing, ...)` /
    // `(focused && typing && hasText, ...)` calls -- then the new layer
    // pushes from the newly-rendered sibling's own effect.
    a.release();
    b.release();
    c.release();
    const d = stack.push('unitasKeywordPanel', () => {
      closedD = true;
    });
    expect(stack.openCount()).toBe(1); // only d is tracked as open

    // Land every traversal the unwind needs (real releases + dead-entry
    // skips) until nothing is left pending -- exactly what a real browser
    // delivers, one popstate per go() call.
    for (let i = 0; i < 10 && h.pendingDelta !== null; i += 1) h.land();

    expect(closedD).toBe(false);
    expect(stack.openCount()).toBe(1);
    expect(readModalStack(h.state())).toEqual([d.token]);
  });

  it('proceeds without the popstate after the traversal timeout', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const a = stack.push('x', () => undefined);
    a.release();
    stack.push('y', () => undefined);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(TRAVERSAL_TIMEOUT_MS);
    h.runTimers();
    expect(h.entries.at(-1)?.[MODAL_STACK_KEY]).toEqual(['y#2']);
  });

  it('defers the entry of a layer opened outside a user activation to the next gesture, yet back still closes it', () => {
    const h = fakeHistory();
    h.active = false;
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('restored', () => closed.push('restored'));
    expect(h.entries).toHaveLength(1); // deferred
    // a back press before any gesture: closes the layer off the open list
    h.userBack();
    expect(closed).toEqual(['restored']);
    expect(stack.openCount()).toBe(0);

    // second run: the gesture arrives first, then back walks its entry
    stack.push('restored2', () => closed.push('restored2'));
    h.active = true;
    h.activation();
    expect(h.entries).toHaveLength(2);
    expect(readModalStack(h.state())).toEqual(['restored2#2']);
    h.userBack();
    expect(closed).toEqual(['restored', 'restored2']);
  });

  it('a deferred lower layer is flushed by the gesture that opens the layer above it, keeping order', () => {
    const h = fakeHistory();
    h.active = false;
    const stack = createModalStack(h);
    stack.push('popout', () => undefined);
    h.active = true;
    h.activation(); // the tap's capture-phase activation flushes the deferred entry ...
    stack.push('gate', () => undefined); // ... before the click handler opens the next layer
    expect(h.entries.map((e) => readModalStack(e))).toEqual([[], ['popout#1'], ['popout#1', 'gate#2']]);
  });

  it('skips a dead entry transparently with one more traversal (forward onto a closed layer)', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('modal', () => closed.push('modal'));
    h.userBack();
    expect(closed).toEqual(['modal']);
    h.userForward(); // lands on the dead {modal} entry
    expect(h.pendingDelta).toBe(-1); // module answered with another back
    const ev = { type: 'popstate' };
    expect(stack.claimPop(ev)).toBe(true); // the follow-up pop is ours too
    h.land();
    expect(h.index).toBe(0);
    expect(h.pendingDelta).toBeNull();
  });

  it('releasing a layer that is no longer the current entry (router replace) does not traverse', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const a = stack.push('modal', () => undefined);
    // simulate Next's router.replace dropping our key from the current entry
    h.entries[h.index] = { __NA: true };
    a.release();
    expect(h.pendingDelta).toBeNull();
    expect(stack.openCount()).toBe(0);
  });

  it('releasing a middle layer never traverses; the next back closes the top and skips the dead entry', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    const a = stack.push('a', () => closed.push('a'));
    stack.push('b', () => closed.push('b'));
    a.release();
    expect(h.pendingDelta).toBeNull();
    h.userBack(); // lands on {a} -> closes b, then a's entry is dead -> back again
    expect(closed).toEqual(['b']);
    expect(h.pendingDelta).toBe(-1);
    h.land();
    expect(h.index).toBe(0);
  });

  it('a layer may own its entry URL: the router keys are stripped for that push, every other key survives', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    stack.push('qw:cluster', () => undefined, { url: '/ko#core/cognitive' });
    stack.push('qw:entry', () => undefined, { url: () => '/ko#core/cognitive/ecosystem:echo' });
    expect(h.urls[1]).toBe('/ko#core/cognitive');
    expect(h.entries[1].__NA).toBeUndefined(); // Next re-attaches it on the slow path
    expect(h.entries[1].unitasExitDepth).toBe(12);
    expect(h.urls[2]).toBe('/ko#core/cognitive/ecosystem:echo');
    expect(readModalStack(h.entries[2])).toEqual(['qw:cluster#1', 'qw:entry#2']);
    // a layer without a URL keeps the fast path (no URL, other keys intact)
    stack.push('plain', () => undefined);
    expect(h.urls[3]).toBeUndefined();
    expect(h.entries[3].unitasExitGuard).toBe(true);
  });

  it('ignores a null-state popstate (same-URL fragment navigation) -- layers stay open, nothing is claimed', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    let backs = 0;
    stack.push('modal', () => {
      backs += 1;
    });
    const ev = { type: 'popstate', state: null };
    // deliver the artefact straight to the listeners (the fake's land()
    // always carries an entry state, so dispatch by hand)
    h.fire(ev);
    expect(stack.claimPop(ev)).toBe(false);
    expect(backs).toBe(0);
    expect(stack.openCount()).toBe(1);
  });

  it('dispose removes every listener', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    stack.push('m', () => undefined);
    stack.dispose();
    expect(stack.openCount()).toBe(0);
    expect(MODAL_ACTIVATION_EVENTS).toContain('keydown');
  });
});

describe('deadSkipAllowed (pure)', () => {
  it('allows skips up to the budget inside the window and refills after it', () => {
    expect(deadSkipAllowed(0, 0, 10)).toBe(true);
    expect(deadSkipAllowed(DEAD_SKIP_BUDGET - 1, 0, 10)).toBe(true);
    expect(deadSkipAllowed(DEAD_SKIP_BUDGET, 0, 10)).toBe(false);
    expect(deadSkipAllowed(DEAD_SKIP_BUDGET, 0, DEAD_SKIP_WINDOW_MS)).toBe(true);
  });
});

describe('createModalStack -- integrity lock (rapid / abnormal traversals)', () => {
  it('a burst of back presses closes the layers one per press, top to bottom, each onBack exactly once', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('a', () => closed.push('a'));
    stack.push('b', () => closed.push('b'));
    stack.push('c', () => closed.push('c'));
    h.userBack();
    h.userBack();
    h.userBack();
    expect(closed).toEqual(['c', 'b', 'a']);
    expect(stack.openCount()).toBe(0);
    expect(h.index).toBe(0);
    // presses beyond the stack are not ours (ExitGuard's sentinels answer)
    const ev = { type: 'popstate', state: h.state() };
    expect(stack.claimPop(ev)).toBe(false);
  });

  it('a duplicated popstate for the same landing (swipe replay) is a no-op', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('a', () => closed.push('a'));
    stack.push('b', () => closed.push('b'));
    h.userBack();
    expect(closed).toEqual(['b']);
    h.fire({ type: 'popstate', state: h.state() }); // engine replays the same landing
    expect(closed).toEqual(['b']);
    expect(stack.openCount()).toBe(1);
    expect(h.pendingDelta).toBeNull();
  });

  it('resolves against the event state even when history.state lags it', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('a', () => closed.push('a'));
    stack.push('b', () => closed.push('b'));
    // deliver the landing for the entry below while getState() still answers the top
    const laggingEvent = { type: 'popstate', state: h.entries[1] };
    h.fire(laggingEvent);
    expect(closed).toEqual(['b']);
    expect(stack.claimPop(laggingEvent)).toBe(true);
  });

  it('back press racing a programmatic close: the release adds NO second traversal (no double close)', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('b', () => closed.push('b'));
    const a = stack.push('a', () => closed.push('a'));
    // the visitor presses back (intent announced, landing not yet delivered) ...
    h.beginUserBack();
    expect(stack.locked()).toBe(true);
    // ... and taps X on the same layer inside that window
    a.release();
    expect(stack.openCount()).toBe(1);
    // the visitor's traversal lands on b's entry: nothing else closes, no go(-1) of ours was added
    h.land();
    expect(closed).toEqual([]);
    expect(stack.openCount()).toBe(1);
    expect(h.pendingDelta).toBeNull();
    expect(stack.locked()).toBe(false);
    expect(readModalStack(h.state())).toEqual(['b#1']);
  });

  it('attributes our own go(-1) intent to us: a release still traverses when no user traversal is in flight', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const a = stack.push('a', () => undefined);
    a.release();
    expect(h.pendingDelta).toBe(-1);
    expect(stack.locked()).toBe(true);
    h.land();
    expect(stack.locked()).toBe(false);
    // a later visitor traversal is recognised as theirs again
    h.beginUserBack();
    expect(stack.locked()).toBe(true);
    h.land();
    expect(stack.locked()).toBe(false);
  });

  it("a push issued while the visitor's traversal is in flight waits for the landing", () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('a', () => closed.push('a'));
    h.beginUserBack();
    const b = stack.push('b', () => closed.push('b'));
    expect(h.entries).toHaveLength(2); // not pushed into the moving history
    h.land(); // a closes, then b's entry is written on the landing
    expect(closed).toEqual(['a']);
    expect(h.entries).toHaveLength(2);
    expect(readModalStack(h.state())).toEqual([b.token]);
  });

  it('a user traversal intent that never lands releases the lock after the timeout', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    h.beginUserBack();
    expect(stack.locked()).toBe(true);
    expect(h.timers.some((t) => t.ms === TRAVERSAL_TIMEOUT_MS)).toBe(true);
    h.pendingDelta = null; // the traversal was cancelled / cross-document
    h.runTimers();
    expect(stack.locked()).toBe(false);
  });

  it('queued work replays one item at a time and stops when an item starts a traversal', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const a = stack.push('a', () => undefined);
    const b = stack.push('b', () => undefined);
    b.release(); // go(-1) pending
    a.release(); // parked: its own traversal must wait for b's landing
    const c = stack.push('c', () => undefined); // parked behind a's release
    expect(h.entries).toHaveLength(3);
    h.land(); // b's traversal lands -> a's release runs -> its go(-1) locks again -> c waits
    expect(h.pendingDelta).toBe(-1);
    expect(h.entries).toHaveLength(3);
    h.land(); // a's traversal lands -> c is pushed on the sentinel
    expect(h.index).toBe(1);
    expect(readModalStack(h.state())).toEqual([c.token]);
    expect(stack.openCount()).toBe(1);
  });

  it('a popstate delivered re-entrantly from inside an onBack is processed after the current one', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const order: string[] = [];
    stack.push('a', () => order.push('a'));
    stack.push('b', () => {
      order.push('b:start');
      // an onBack that itself lands the next entry synchronously (hostile engine)
      h.userBack();
      order.push('b:end');
    });
    h.userBack();
    expect(order).toEqual(['b:start', 'b:end', 'a']);
    expect(stack.openCount()).toBe(0);
  });

  it('a throwing onBack does not strand the layers beneath it', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    const closed: string[] = [];
    stack.push('a', () => closed.push('a'));
    stack.push('b', () => {
      throw new Error('boom');
    });
    stack.push('c', () => closed.push('c'));
    // one press that lands on the page entry (an engine collapsing several entries)
    h.pendingDelta = -3;
    h.land();
    expect(closed).toEqual(['c', 'a']);
    expect(stack.openCount()).toBe(0);
  });

  it('caps the dead-entry skip walk at DEAD_SKIP_BUDGET inside one window, then refills', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    // a history whose every landing is a dead entry (the engine keeps
    // answering our go(-1) with the same dead state)
    h.entries = [{ __NA: true }, { __NA: true, [MODAL_STACK_KEY]: ['ghost#1'] }];
    h.urls = [undefined, undefined];
    h.index = 1;
    let traversals = 0;
    h.go = (delta) => {
      traversals += 1;
      h.pendingDelta = delta;
      for (const fn of h.traversalListeners) fn();
    };
    h.land = () => {
      h.pendingDelta = null;
      h.fire({ type: 'popstate', state: h.entries[1] });
    };
    h.fire({ type: 'popstate', state: h.entries[1] });
    for (let i = 0; i < DEAD_SKIP_BUDGET + 8; i++) {
      if (h.pendingDelta === null) break;
      h.land();
    }
    expect(traversals).toBe(DEAD_SKIP_BUDGET);
    expect(stack.locked()).toBe(false);
    // the window elapses: the budget refills
    h.clock += DEAD_SKIP_WINDOW_MS;
    h.fire({ type: 'popstate', state: h.entries[1] });
    expect(traversals).toBe(DEAD_SKIP_BUDGET + 1);
  });

  it('dispose unsubscribes the traversal observer', () => {
    const h = fakeHistory();
    const stack = createModalStack(h);
    expect(h.traversalListeners.size).toBe(1);
    stack.dispose();
    expect(h.traversalListeners.size).toBe(0);
  });
});
