import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HAPTIC_CLICK_GAIN,
  HAPTIC_CLICK_HIGH_HZ,
  HAPTIC_CLICK_LOW_HZ,
  HAPTIC_CLICK_MS,
  HAPTIC_TIC_GAIN,
  HAPTIC_TIC_HZ,
  HAPTIC_TIC_MS,
  __resetHapticsForTests,
  playHapticClick,
  playHapticTic,
} from '../../lib/audio/haptics';
import { AUDIO_PREF_KEY } from '../../lib/audio/audioPreference';
import { APP_EXIT_EVENT, APP_TERMINATE_EVENT } from '../../lib/exit/appExit';

// Regression guards for the REV-13 haptic micro-sounds (spec section 5):
//  - every cue is a sub-40 ms blip whose gain never exceeds .08 -- a tactile
//    tick, not a sound effect;
//  - the persisted 'off' preference silences them without building a context;
//  - the context is created lazily inside the gesture, resumed when
//    suspended, closed on exit, and rebuilt on the next gesture;
//  - nothing ever throws out of the click handler that asked for a cue.
// A minimal Web Audio stand-in records every oscillator and gain automation
// point; no fixtures are shared with other __tests__/** files (see CLAUDE.md
// "Module-level test isolation").

type Listener = (...args: unknown[]) => void;

class FakeParam {
  value = 0;
  /** Every automation target value, in call order. */
  points: number[] = [];
  setValueAtTime(v: number) {
    this.points.push(v);
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.points.push(v);
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.points.push(v);
    return this;
  }
}

class FakeGain {
  gain = new FakeParam();
  connect() {
    return this;
  }
}

class FakeOscillator {
  type = 'sine';
  frequency = new FakeParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  connect() {
    return this;
  }
  start(t: number) {
    this.startedAt = t;
  }
  stop(t: number) {
    this.stoppedAt = t;
  }
  get durationMs(): number {
    if (this.startedAt === null || this.stoppedAt === null) return Number.POSITIVE_INFINITY;
    return (this.stoppedAt - this.startedAt) * 1000;
  }
}

class FakeAudioContext {
  static created: FakeAudioContext[] = [];
  /** State a fresh context is born in (the autoplay policy decides this). */
  static initial: 'running' | 'suspended' = 'running';
  state: 'running' | 'suspended' | 'closed' = FakeAudioContext.initial;
  currentTime = 2.5;
  destination = {};
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  resumeCalls = 0;
  closed = false;
  constructor() {
    FakeAudioContext.created.push(this);
  }
  createOscillator() {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  resume() {
    this.resumeCalls += 1;
    if (this.state === 'suspended') this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    this.closed = true;
    return Promise.resolve();
  }
  /** Highest gain automation value scheduled on any node of this context. */
  get peakGain(): number {
    return this.gains.reduce((max, g) => Math.max(max, ...g.gain.points), 0);
  }
}

function makeWindow(withAudio = true) {
  const listeners = new Map<string, Set<Listener>>();
  let pref: string | null = null;
  const win = {
    ...(withAudio ? { AudioContext: FakeAudioContext } : {}),
    localStorage: {
      getItem: (k: string): string | null => (k === AUDIO_PREF_KEY ? pref : null),
      setItem: (_k: string, v: string) => {
        pref = v;
      },
    },
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
  };
  return win;
}

function installWindow(withAudio = true) {
  const win = makeWindow(withAudio);
  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', {});
  return win;
}

describe('haptic micro-sounds (lib/audio/haptics.ts)', () => {
  beforeEach(() => {
    FakeAudioContext.created.length = 0;
    FakeAudioContext.initial = 'running';
  });
  afterEach(() => {
    __resetHapticsForTests();
    vi.unstubAllGlobals();
  });

  it('tic: one 2.4 kHz sine of at most 12 ms peaking at gain .05 (<= .08), built inside the gesture', () => {
    installWindow();
    expect(FakeAudioContext.created).toHaveLength(0);
    expect(() => playHapticTic()).not.toThrow();
    // The context exists only once the gesture asked for a cue.
    expect(FakeAudioContext.created).toHaveLength(1);
    const ctx = FakeAudioContext.created[0];
    expect(ctx.oscillators).toHaveLength(1);
    const [osc] = ctx.oscillators;
    expect(osc.type).toBe('sine');
    expect(osc.frequency.points).toContain(HAPTIC_TIC_HZ);
    expect(osc.durationMs).toBeLessThanOrEqual(40);
    expect(osc.durationMs).toBeCloseTo(HAPTIC_TIC_MS, 5);
    expect(ctx.peakGain).toBeLessThanOrEqual(0.08);
    expect(ctx.peakGain).toBeCloseTo(HAPTIC_TIC_GAIN, 5);
  });

  it('click: two triangle stages (1.2 kHz -> 2.8 kHz) totalling 38 ms, every gain <= .08', () => {
    installWindow();
    expect(() => playHapticClick()).not.toThrow();
    const ctx = FakeAudioContext.created[0];
    expect(ctx.oscillators).toHaveLength(2);
    const [low, high] = ctx.oscillators;
    expect(low.type).toBe('triangle');
    expect(high.type).toBe('triangle');
    expect(low.frequency.points).toContain(HAPTIC_CLICK_LOW_HZ);
    expect(high.frequency.points).toContain(HAPTIC_CLICK_HIGH_HZ);
    // The second stage starts exactly where the first ends -- no gap, no overlap.
    expect(high.startedAt).toBeCloseTo(low.stoppedAt as number, 6);
    for (const osc of ctx.oscillators) expect(osc.durationMs).toBeLessThanOrEqual(40);
    const total = ((high.stoppedAt as number) - (low.startedAt as number)) * 1000;
    expect(total).toBeCloseTo(HAPTIC_CLICK_MS, 5);
    expect(total).toBeLessThanOrEqual(40);
    expect(ctx.peakGain).toBeLessThanOrEqual(0.08);
    expect(ctx.peakGain).toBeCloseTo(HAPTIC_CLICK_GAIN, 5);
  });

  it('reuses one context across cues and never schedules a gain above .08', () => {
    installWindow();
    playHapticTic();
    playHapticClick();
    playHapticTic();
    expect(FakeAudioContext.created).toHaveLength(1);
    const ctx = FakeAudioContext.created[0];
    expect(ctx.oscillators).toHaveLength(4);
    expect(ctx.peakGain).toBeLessThanOrEqual(0.08);
  });

  it("is silent -- and builds no context -- while the persisted preference is 'off'", () => {
    const win = installWindow();
    win.setPref('off');
    expect(() => {
      playHapticTic();
      playHapticClick();
    }).not.toThrow();
    expect(FakeAudioContext.created).toHaveLength(0);
    // Flipping sound back on makes the very next cue audible again.
    win.setPref('on');
    playHapticTic();
    expect(FakeAudioContext.created).toHaveLength(1);
    expect(FakeAudioContext.created[0].oscillators).toHaveLength(1);
  });

  it('resumes a suspended context inside the gesture before scheduling the cue', () => {
    installWindow();
    FakeAudioContext.initial = 'suspended';
    playHapticTic();
    const ctx = FakeAudioContext.created[0];
    expect(ctx.resumeCalls).toBe(1);
    expect(ctx.state).toBe('running');
    expect(ctx.oscillators).toHaveLength(1);
    // A running context is not asked to resume again.
    playHapticClick();
    expect(ctx.resumeCalls).toBe(1);
  });

  it('closes its context on APP_EXIT_EVENT / APP_TERMINATE_EVENT and rebuilds on the next gesture', () => {
    const win = installWindow();
    playHapticTic();
    const first = FakeAudioContext.created[0];
    // Exit listeners are armed lazily with the first context, once each.
    expect(win.listenerCount()).toBe(2);
    win.fire(APP_EXIT_EVENT);
    expect(first.closed).toBe(true);
    // A later gesture (a re-entry without reload) gets a fresh engine.
    playHapticClick();
    expect(FakeAudioContext.created).toHaveLength(2);
    const second = FakeAudioContext.created[1];
    expect(second.closed).toBe(false);
    expect(win.listenerCount()).toBe(2);
    win.fire(APP_TERMINATE_EVENT);
    expect(second.closed).toBe(true);
    // Firing the events again with no context is harmless.
    expect(() => win.fire(APP_EXIT_EVENT)).not.toThrow();
  });

  it('skips silently when Web Audio is unavailable, when storage throws, or when the engine refuses', () => {
    // No AudioContext at all (an old WebView).
    installWindow(false);
    expect(() => {
      playHapticTic();
      playHapticClick();
    }).not.toThrow();
    expect(FakeAudioContext.created).toHaveLength(0);
    __resetHapticsForTests();
    vi.unstubAllGlobals();

    // Storage blocked (privacy mode): sound stays ON, cue plays.
    const blocked = makeWindow();
    blocked.localStorage.getItem = () => {
      throw new Error('storage blocked');
    };
    vi.stubGlobal('window', blocked);
    vi.stubGlobal('navigator', {});
    expect(() => playHapticTic()).not.toThrow();
    expect(FakeAudioContext.created).toHaveLength(1);
    __resetHapticsForTests();
    vi.unstubAllGlobals();

    // The engine throws from the constructor (hardware context cap).
    const refusing = makeWindow();
    refusing.AudioContext = class {
      constructor() {
        throw new Error('too many contexts');
      }
    } as unknown as typeof FakeAudioContext;
    vi.stubGlobal('window', refusing);
    vi.stubGlobal('navigator', {});
    expect(() => playHapticClick()).not.toThrow();
  });

  it('is a no-op without a window (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(() => {
      playHapticTic();
      playHapticClick();
    }).not.toThrow();
    expect(FakeAudioContext.created).toHaveLength(0);
  });
});
