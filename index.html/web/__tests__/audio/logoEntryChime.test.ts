import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENTRY_CHIME_BOOTSTRAP,
  ENTRY_CHIME_CLOSE_MS,
  ENTRY_CHIME_NOTES,
  ENTRY_CHIME_REPLAY_DEDUPE_MS,
  ENTRY_CHIME_SHARED_KEY,
  armLogoEntryChime,
  cancelLogoEntryChime,
  readEntryChimeShared,
} from '../../lib/audio/logoEntryChime';
import { ACTIVATION_UNLOCK_EVENTS } from '../../lib/audio/activationUnlock';
import { APP_EXIT_EVENT, APP_TERMINATE_EVENT, TERMINATED_ATTR } from '../../lib/exit/appExit';

// Regression guards for the logo-page entry chime:
//  - the "Sovereign Core Error on entry" root cause (owner instruction
//    2026-09-07, item 1): arming must never throw, whichever state a fresh
//    AudioContext starts in;
//  - the MOBILE ONLINE BROWSER silence (owner instruction 2026-09-07,
//    "모바일 온라인 브라우저 첫 로그페이지 진입 오디오"): the chime must survive
//    the end of the 3 s logo page and fire on the first activation gesture
//    however late it comes, and the pre-hydration head bootstrap must arm
//    the very same engine from the document's first byte.
// A minimal Web Audio stand-in drives every branch; no fixtures are shared
// with other __tests__/** files (see CLAUDE.md "Module-level test isolation").

type Listener = (...args: unknown[]) => void;

class FakeParam {
  value = 0;
  setValueAtTime() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  type = 'sine';
  buffer: unknown = null;
  connect() {
    return this;
  }
  start() {}
  stop() {}
}

class FakeAudioContext {
  static created: FakeAudioContext[] = [];
  /** Document-level sticky activation: a fresh context's first resume() is honoured. */
  static sticky = false;
  state: 'running' | 'suspended' | 'closed';
  currentTime = 0;
  destination = {};
  listeners = new Map<string, Set<Listener>>();
  nodesBuilt = 0;
  closed = false;
  constructor(initial: 'running' | 'suspended') {
    this.state = initial;
    FakeAudioContext.created.push(this);
  }
  createGain() {
    this.nodesBuilt += 1;
    return new FakeNode();
  }
  createOscillator() {
    this.nodesBuilt += 1;
    return new FakeNode();
  }
  createBufferSource() {
    return new FakeNode();
  }
  createBuffer() {
    return {};
  }
  /** Real engines honour `resume()` only once the page has user activation. */
  activated = FakeAudioContext.sticky;
  resume() {
    if (this.state === 'suspended' && this.activated) {
      this.state = 'running';
      this.emit('statechange');
    }
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    this.closed = true;
    return Promise.resolve();
  }
  addEventListener(type: string, fn: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type: string) {
    for (const fn of Array.from(this.listeners.get(type) ?? [])) fn();
  }
}

/** Activation listeners + the two exit-event listeners a live engine holds. */
const ARMED_LISTENERS = ACTIVATION_UNLOCK_EVENTS.length + 2;

function makeWindow(initial: 'running' | 'suspended') {
  const listeners = new Map<string, Set<Listener>>();
  let pref: string | null = null;
  const win = {
    AudioContext: class extends FakeAudioContext {
      constructor() {
        super(initial);
      }
    },
    localStorage: {
      getItem: (): string | null => pref,
      setItem: (_k: string, v: string) => {
        pref = v;
      },
    },
    performance: { now: () => 1000 },
    addEventListener(type: string, fn: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.get(type)?.delete(fn);
    },
    fire(type: string) {
      for (const fn of Array.from(listeners.get(type) ?? [])) fn({ type });
    },
    listenerCount() {
      return Array.from(listeners.values()).reduce((n, set) => n + set.size, 0);
    },
    setPref(v: string | null) {
      pref = v;
    },
  } as Record<string, unknown> & {
    AudioContext: unknown;
    localStorage: { getItem: () => string | null; setItem: (k: string, v: string) => void };
    fire: (type: string) => void;
    listenerCount: () => number;
    setPref: (v: string | null) => void;
  };
  return win;
}

function installWindow(initial: 'running' | 'suspended') {
  const win = makeWindow(initial);
  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', {});
  return win;
}

describe('logo-page entry chime (lib/audio/logoEntryChime.ts) -- hydrated engine', () => {
  beforeEach(() => {
    FakeAudioContext.created.length = 0;
    FakeAudioContext.sticky = false;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('never throws when the engine starts the context RUNNING at once -- plays immediately, exactly once, then releases its context', () => {
    const win = installWindow('running');
    expect(() => armLogoEntryChime()).not.toThrow();
    const ctx = FakeAudioContext.created[0];
    expect(ctx).toBeDefined();
    // The two-note chime built its oscillator graph on the spot.
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    // No listener of any kind is left armed once it has played.
    expect(win.listenerCount()).toBe(0);
    const built = ctx.nodesBuilt;
    win.fire('click');
    expect(ctx.nodesBuilt).toBe(built);
    // The shared record says so, and the context is released shortly after.
    const shared = readEntryChimeShared();
    expect(shared?.played).toBe(true);
    expect(shared?.source).toBe('module');
    expect(ctx.closed).toBe(false);
    vi.advanceTimersByTime(ENTRY_CHIME_CLOSE_MS);
    expect(ctx.closed).toBe(true);
    expect(shared?.ctx).toBeNull();
  });

  it('on a SUSPENDED context waits for the first activation gesture, resumes inside it, and fires once the context runs', () => {
    const win = installWindow('suspended');
    armLogoEntryChime();
    const ctx = FakeAudioContext.created[0];
    // Nothing scheduled yet (the pre-gesture resume was refused); every
    // activation event plus the exit events are armed.
    expect(ctx.state).toBe('suspended');
    expect(ctx.nodesBuilt).toBe(0);
    expect(win.listenerCount()).toBe(ARMED_LISTENERS);

    // The tap grants activation; the resume inside it is honoured.
    ctx.activated = true;
    win.fire('touchend');
    expect(ctx.state).toBe('running');
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    // Plays once; listeners are gone.
    const built = ctx.nodesBuilt;
    win.fire('click');
    win.fire('keydown');
    expect(ctx.nodesBuilt).toBe(built);
    expect(win.listenerCount()).toBe(0);
    expect(readEntryChimeShared()?.gestureAt).toBeGreaterThan(0);
  });

  it('MOBILE BROWSER: stays armed past the end of the logo page -- a gesture long after the splash has gone still plays it', () => {
    const win = installWindow('suspended');
    armLogoEntryChime();
    const ctx = FakeAudioContext.created[0];
    // The splash unmounts (3.45 s) and a phone visitor keeps watching -- the
    // engine is NOT torn down: context open, listeners in place.
    vi.advanceTimersByTime(30_000);
    expect(ctx.closed).toBe(false);
    expect(win.listenerCount()).toBe(ARMED_LISTENERS);
    expect(readEntryChimeShared()?.played).toBe(false);
    // First tap on the sealed Coming-Soon page, half a minute later.
    ctx.activated = true;
    win.fire('pointerup');
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    expect(readEntryChimeShared()?.played).toBe(true);
  });

  it('is idempotent on a cold entry: a second arm (a shield remount of the splash) adopts the pending engine and builds no second context', () => {
    const win = installWindow('suspended');
    armLogoEntryChime();
    armLogoEntryChime();
    armLogoEntryChime();
    expect(FakeAudioContext.created.length).toBe(1);
    expect(win.listenerCount()).toBe(ARMED_LISTENERS);
    const ctx = FakeAudioContext.created[0];
    ctx.activated = true;
    win.fire('click');
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    // Once played, a further cold-entry arm is a no-op.
    armLogoEntryChime();
    expect(FakeAudioContext.created.length).toBe(1);
  });

  it('honours sticky activation gained before hydration: the arm-time resume itself plays it', () => {
    const win = installWindow('suspended');
    // Simulate an engine whose document was already activated (a tap before
    // the bundle ran): the very first resume() is honoured.
    FakeAudioContext.sticky = true;
    armLogoEntryChime();
    const ctx = FakeAudioContext.created[0];
    expect(ctx.state).toBe('running');
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    expect(win.listenerCount()).toBe(0);
  });

  it('stands down on a confirmed exit (APP_EXIT_EVENT / APP_TERMINATE_EVENT): listeners gone, context closed, never plays later', () => {
    const win = installWindow('suspended');
    armLogoEntryChime();
    const ctx = FakeAudioContext.created[0];
    win.fire(APP_EXIT_EVENT);
    expect(win.listenerCount()).toBe(0);
    expect(ctx.closed).toBe(true);
    expect(readEntryChimeShared()?.cancelled).toBe(true);
    ctx.activated = true;
    win.fire('touchend');
    expect(ctx.nodesBuilt).toBe(0);
    // The terminate event on a fresh engine behaves the same.
    FakeAudioContext.created.length = 0;
    delete (win as Record<string, unknown>)[ENTRY_CHIME_SHARED_KEY];
    armLogoEntryChime();
    win.fire(APP_TERMINATE_EVENT);
    expect(FakeAudioContext.created[0].closed).toBe(true);
    expect(win.listenerCount()).toBe(0);
  });

  it('never plays on a terminated document or once sound has been switched off in the meantime', () => {
    const win = installWindow('suspended');
    armLogoEntryChime();
    const ctx = FakeAudioContext.created[0];
    // Sound switched off between arming and the first gesture.
    win.setPref('off');
    ctx.activated = true;
    win.fire('click');
    expect(ctx.nodesBuilt).toBe(0);
    expect(ctx.closed).toBe(true);
    expect(win.listenerCount()).toBe(0);

    // Terminal frame up (the exit engine's <html data-unitas-terminated>).
    FakeAudioContext.created.length = 0;
    delete (win as Record<string, unknown>)[ENTRY_CHIME_SHARED_KEY];
    win.setPref(null);
    vi.stubGlobal('document', {
      documentElement: { hasAttribute: (name: string) => name === TERMINATED_ATTR },
    });
    armLogoEntryChime();
    const ctx2 = FakeAudioContext.created[0];
    ctx2.activated = true;
    win.fire('click');
    expect(ctx2.nodesBuilt).toBe(0);
    expect(ctx2.closed).toBe(true);
  });

  it('cancelLogoEntryChime() disarms a pending chime and is a harmless no-op afterwards', () => {
    const win = installWindow('suspended');
    armLogoEntryChime();
    expect(win.listenerCount()).toBe(ARMED_LISTENERS);
    cancelLogoEntryChime();
    expect(win.listenerCount()).toBe(0);
    expect(FakeAudioContext.created[0].closed).toBe(true);
    expect(() => cancelLogoEntryChime()).not.toThrow();
  });

  it('REPLAY supersedes a pending chime with its own, never doubles a chime that just played, and chimes again for a later replay', () => {
    const win = installWindow('suspended');
    armLogoEntryChime();
    const first = FakeAudioContext.created[0];
    // Replay while the cold-entry chime is still pending: the old engine is
    // stood down and the replay gets a fresh one.
    armLogoEntryChime({ replay: true });
    expect(first.closed).toBe(true);
    expect(FakeAudioContext.created.length).toBe(2);
    const second = FakeAudioContext.created[1];
    expect(win.listenerCount()).toBe(ARMED_LISTENERS);
    second.activated = true;
    win.fire('touchend');
    expect(second.nodesBuilt).toBeGreaterThan(0);

    // A replay armed right after the chime played (the tap that started the
    // replay fired it in the capture phase): no second chime.
    const shared = readEntryChimeShared()!;
    expect(shared.played).toBe(true);
    shared.playedAt = 1000; // == fake performance.now()
    armLogoEntryChime({ replay: true });
    expect(FakeAudioContext.created.length).toBe(2);

    // A replay well after the last chime chimes again -- immediately, since
    // the document now has sticky activation.
    shared.playedAt = 1000 - ENTRY_CHIME_REPLAY_DEDUPE_MS - 1;
    FakeAudioContext.sticky = true;
    armLogoEntryChime({ replay: true });
    expect(FakeAudioContext.created.length).toBe(3);
    expect(FakeAudioContext.created[2].nodesBuilt).toBeGreaterThan(0);
  });

  it('is a silent no-op without Web Audio or with sound switched off', () => {
    const win = installWindow('running');
    win.AudioContext = undefined;
    expect(() => armLogoEntryChime()).not.toThrow();
    expect(FakeAudioContext.created.length).toBe(0);
    expect(readEntryChimeShared()).toBeNull();

    const muted = installWindow('running');
    muted.setPref('off');
    expect(() => armLogoEntryChime()).not.toThrow();
    expect(FakeAudioContext.created.length).toBe(0);
  });
});

describe('pre-hydration entry-chime bootstrap (ENTRY_CHIME_BOOTSTRAP)', () => {
  beforeEach(() => {
    FakeAudioContext.created.length = 0;
    FakeAudioContext.sticky = false;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function makeDocument(opts: { splashOff?: boolean; terminated?: boolean } = {}) {
    return {
      documentElement: {
        getAttribute: (name: string) => (name === 'data-splash' && opts.splashOff ? 'off' : null),
        hasAttribute: (name: string) => name === TERMINATED_ATTR && opts.terminated === true,
      },
    };
  }

  /** The bootstrap only touches these globals. */
  function run(win: ReturnType<typeof makeWindow>, doc: ReturnType<typeof makeDocument> = makeDocument()) {
    new Function('window', 'document', 'navigator', ENTRY_CHIME_BOOTSTRAP)(win, doc, {});
  }

  it('is dependency-free ES5 that parses and never throws on a bare host', () => {
    expect(() => new Function(ENTRY_CHIME_BOOTSTRAP)).not.toThrow();
    expect(() => new Function('window', 'document', 'navigator', ENTRY_CHIME_BOOTSTRAP)({}, {}, {})).not.toThrow();
    expect(ENTRY_CHIME_BOOTSTRAP).not.toContain('=>');
    expect(ENTRY_CHIME_BOOTSTRAP).not.toMatch(/\b(let|const)\b/);
  });

  it('carries the module\'s exact note table and listens for the full activation-unlock event set', () => {
    for (const note of ENTRY_CHIME_NOTES) expect(ENTRY_CHIME_BOOTSTRAP).toContain(String(note.freq));
    for (const type of ACTIVATION_UNLOCK_EVENTS) expect(ENTRY_CHIME_BOOTSTRAP).toContain(`"${type}"`);
    expect(ENTRY_CHIME_BOOTSTRAP).toContain(APP_EXIT_EVENT);
    expect(ENTRY_CHIME_BOOTSTRAP).toContain(APP_TERMINATE_EVENT);
    expect(ENTRY_CHIME_BOOTSTRAP).toContain(TERMINATED_ATTR);
  });

  it('arms from the first byte: builds the context, publishes the shared record, and plays on the FIRST tap -- before any hydration', () => {
    const win = makeWindow('suspended');
    run(win);
    expect(FakeAudioContext.created.length).toBe(1);
    const ctx = FakeAudioContext.created[0];
    const shared = win[ENTRY_CHIME_SHARED_KEY] as { played: boolean; source: string; ctx: unknown; gestureAt: number };
    expect(shared).toBeDefined();
    expect(shared.source).toBe('bootstrap');
    expect(shared.played).toBe(false);
    expect(win.listenerCount()).toBe(ARMED_LISTENERS);
    // The refused pre-gesture resume scheduled nothing.
    expect(ctx.nodesBuilt).toBe(0);
    // A touchstart alone carries no activation -- still nothing.
    win.fire('touchstart');
    expect(ctx.nodesBuilt).toBe(0);
    // The activating touchend of the same finger: plays right there.
    ctx.activated = true;
    win.fire('touchend');
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    expect(shared.played).toBe(true);
    expect(shared.gestureAt).toBeGreaterThan(0);
    expect(win.listenerCount()).toBe(0);
    // Plays once only.
    const built = ctx.nodesBuilt;
    win.fire('click');
    expect(ctx.nodesBuilt).toBe(built);
    // Releases its context shortly after.
    vi.advanceTimersByTime(ENTRY_CHIME_CLOSE_MS);
    expect(ctx.closed).toBe(true);
    expect(shared.ctx).toBeNull();
  });

  it('plays at first paint where autoplay is allowed (installed PWA / engaged origin)', () => {
    const win = makeWindow('running');
    run(win);
    const ctx = FakeAudioContext.created[0];
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    expect((win[ENTRY_CHIME_SHARED_KEY] as { played: boolean }).played).toBe(true);
    expect(win.listenerCount()).toBe(0);
  });

  it('HAND-OFF: the hydrated arm adopts the bootstrap\'s pending chime -- one context, one chime, whichever side the gesture reaches', () => {
    const win = makeWindow('suspended');
    run(win);
    vi.stubGlobal('window', win);
    vi.stubGlobal('navigator', {});
    // Hydration lands 2 s into the logo page: adopt, do not rebuild.
    vi.advanceTimersByTime(2000);
    armLogoEntryChime();
    expect(FakeAudioContext.created.length).toBe(1);
    expect(win.listenerCount()).toBe(ARMED_LISTENERS);
    const ctx = FakeAudioContext.created[0];
    ctx.activated = true;
    win.fire('click');
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    const built = ctx.nodesBuilt;
    // Any later cold-entry arm is a no-op; a replay right after is deduped.
    armLogoEntryChime();
    armLogoEntryChime({ replay: true });
    expect(FakeAudioContext.created.length).toBe(1);
    expect(ctx.nodesBuilt).toBe(built);
  });

  it('is skipped wherever the logo page is skipped (data-splash="off"), when sound is off, without Web Audio, and when a record already exists', () => {
    const off = makeWindow('suspended');
    run(off, makeDocument({ splashOff: true }));
    expect(FakeAudioContext.created.length).toBe(0);
    expect(off[ENTRY_CHIME_SHARED_KEY]).toBeUndefined();

    const muted = makeWindow('suspended');
    muted.setPref('off');
    run(muted);
    expect(FakeAudioContext.created.length).toBe(0);

    const bare = makeWindow('suspended');
    bare.AudioContext = undefined;
    run(bare);
    expect(FakeAudioContext.created.length).toBe(0);

    const twice = makeWindow('suspended');
    run(twice);
    run(twice);
    expect(FakeAudioContext.created.length).toBe(1);
  });

  it('stands down on a confirmed exit and never plays on a terminated document', () => {
    const win = makeWindow('suspended');
    run(win);
    const ctx = FakeAudioContext.created[0];
    win.fire(APP_EXIT_EVENT);
    expect(win.listenerCount()).toBe(0);
    expect(ctx.closed).toBe(true);
    ctx.activated = true;
    win.fire('touchend');
    expect(ctx.nodesBuilt).toBe(0);

    FakeAudioContext.created.length = 0;
    const term = makeWindow('suspended');
    run(term, makeDocument({ terminated: true }));
    const ctx2 = FakeAudioContext.created[0];
    ctx2.activated = true;
    term.fire('click');
    expect(ctx2.nodesBuilt).toBe(0);
    expect(ctx2.closed).toBe(true);
  });
});
