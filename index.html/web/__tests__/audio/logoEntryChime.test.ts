import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armLogoEntryChime } from '../../lib/audio/logoEntryChime';
import { ACTIVATION_UNLOCK_EVENTS } from '../../lib/audio/activationUnlock';

// Regression guard for the "Sovereign Core Error on entry" root cause (owner
// instruction 2026-09-07, item 1): on an engine whose autoplay policy lets a
// fresh AudioContext start at once, `armLogoEntryChime()` used to throw a
// ReferenceError (temporal dead zone) from CinematicIntroSplash's mount
// effect -- straight into the root error boundary. A minimal Web Audio
// stand-in is enough to drive both branches; no fixtures shared with other
// __tests__/** files (see CLAUDE.md "Module-level test isolation").

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
  activated = false;
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

function installWindow(initial: 'running' | 'suspended') {
  const listeners = new Map<string, Set<Listener>>();
  const win = {
    AudioContext: class extends FakeAudioContext {
      constructor() {
        super(initial);
      }
    },
    localStorage: {
      getItem: (): string | null => null,
      setItem: () => {},
    },
    addEventListener(type: string, fn: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.get(type)?.delete(fn);
    },
    fire(type: string) {
      for (const fn of Array.from(listeners.get(type) ?? [])) fn();
    },
    listenerCount() {
      return Array.from(listeners.values()).reduce((n, set) => n + set.size, 0);
    },
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', {});
  return win;
}

describe('logo-page entry chime (lib/audio/logoEntryChime.ts)', () => {
  beforeEach(() => {
    FakeAudioContext.created.length = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never throws when the engine starts the context RUNNING at once -- plays immediately, exactly once, and leaves no listener behind', () => {
    const win = installWindow('running');
    let disarm: (() => void) | undefined;
    expect(() => {
      disarm = armLogoEntryChime();
    }).not.toThrow();
    const ctx = FakeAudioContext.created[0];
    expect(ctx).toBeDefined();
    // The two-note chime built its oscillator graph on the spot.
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    // No gesture listeners are left armed once it has played.
    expect(win.listenerCount()).toBe(0);
    const built = ctx.nodesBuilt;
    win.fire('click');
    expect(ctx.nodesBuilt).toBe(built);
    disarm?.();
    expect(ctx.closed).toBe(true);
  });

  it('on a SUSPENDED context waits for the first activation gesture, resumes inside it, and fires once the context runs', async () => {
    const win = installWindow('suspended');
    const disarm = armLogoEntryChime();
    const ctx = FakeAudioContext.created[0];
    // Nothing scheduled yet (the pre-gesture resume was refused); every
    // activation event is armed.
    expect(ctx.state).toBe('suspended');
    expect(ctx.nodesBuilt).toBe(0);
    expect(win.listenerCount()).toBe(ACTIVATION_UNLOCK_EVENTS.length);

    // The tap grants activation; the resume inside it is honoured.
    ctx.activated = true;
    win.fire('touchend');
    await Promise.resolve();
    expect(ctx.state).toBe('running');
    expect(ctx.nodesBuilt).toBeGreaterThan(0);
    // Plays once; listeners are gone.
    const built = ctx.nodesBuilt;
    win.fire('click');
    win.fire('keydown');
    expect(ctx.nodesBuilt).toBe(built);
    expect(win.listenerCount()).toBe(0);
    disarm();
    expect(ctx.closed).toBe(true);
  });

  it('disarming before any gesture removes every listener and closes the context', () => {
    const win = installWindow('suspended');
    const disarm = armLogoEntryChime();
    expect(win.listenerCount()).toBe(ACTIVATION_UNLOCK_EVENTS.length);
    disarm();
    expect(win.listenerCount()).toBe(0);
    expect(FakeAudioContext.created[0].closed).toBe(true);
    // A second disarm is harmless.
    expect(() => disarm()).not.toThrow();
  });

  it('is a silent no-op without Web Audio or with sound switched off', () => {
    const win = installWindow('running');
    (win as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    expect(() => armLogoEntryChime()()).not.toThrow();
    expect(FakeAudioContext.created.length).toBe(0);

    const muted = installWindow('running');
    muted.localStorage.getItem = () => 'off';
    expect(() => armLogoEntryChime()()).not.toThrow();
    expect(FakeAudioContext.created.length).toBe(0);
  });
});
