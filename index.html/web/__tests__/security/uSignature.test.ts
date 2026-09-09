import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  U_SIGNATURE_ATTEST_TIMEOUT_MS,
  U_SIGNATURE_BUFFER_SIZE,
  U_SIGNATURE_HONEYPOT_NAME,
  U_SIGNATURE_MIN_SCORE,
  attestUSignature,
  isUSignatureCollectorRunning,
  readHoneypot,
  scoreUSignature,
  snapshotUSignature,
  startUSignatureCollector,
  type PointerSample,
  type USignatureSnapshot,
} from '../../lib/security/uSignature';
import { APP_EXIT_EVENT, APP_TERMINATE_EVENT } from '../../lib/exit/appExit';

// Regression guards for the REV-13 U-Signature behavioural gate (spec §6):
//  - the five documented bot heuristics (headless flag, blind zero-sample
//    click, perfectly linear path, machine-regular event timing, the
//    honeypot) each independently push a snapshot below the 0.35 floor;
//  - a plausible human snapshot (organic velocity, real dwell, native touch)
//    clears 0.6;
//  - the scorer is a pure function of its input (same snapshot -> same
//    score/signals, every time, clamped to [0,1]);
//  - the passive+capture collector is idempotent, ring-buffers every
//    channel at U_SIGNATURE_BUFFER_SIZE, and tears itself down on the app
//    exit/terminate events with no leaked listeners;
//  - attestUSignature() is fail-closed on every path: pre-filtered low
//    score, missing fetch, network error, timeout, non-OK response and a
//    malformed answer all resolve `{ ok: false }`, never by throwing.
// No fixtures are shared with other __tests__/** files (see CLAUDE.md
// "Module-level test isolation"); this file's own module-singleton
// collector is torn down after every test that starts one.

function neutralSnapshot(overrides: Partial<USignatureSnapshot> = {}): USignatureSnapshot {
  return {
    webdriver: false,
    touchCapable: false,
    pointerSamples: [],
    pointerDownTimes: [],
    keyIntervals: [],
    scrollTimes: [],
    touchCount: 0,
    eventDeltas: [],
    firstClickAtMs: null,
    dwellMs: 0,
    visibilityChanges: 0,
    honeypotFilled: false,
    ...overrides,
  };
}

/** A straight-line pointer path -- zero curvature, constant speed. */
function linearPointerSamples(count: number): PointerSample[] {
  const out: PointerSample[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ t: i * 30, x: i * 10, y: i * 10, kind: 'mouse' });
  }
  return out;
}

/** A spiraling, alternating-cadence path -- real curvature and speed variance. */
function organicPointerSamples(count: number): PointerSample[] {
  const out: PointerSample[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.4; // golden-angle-ish spiral step -> strong, non-repeating curvature
    const radius = 24 + i * 7;
    const x = 300 + radius * Math.cos(angle);
    const y = 260 + radius * Math.sin(angle);
    t += i % 2 === 0 ? 18 : 95; // alternating fast/slow cadence -> real speed variance
    out.push({ t, x, y, kind: 'mouse' });
  }
  return out;
}

describe('scoreUSignature -- bot heuristics (each alone clears the floor downward)', () => {
  it('navigator.webdriver true', () => {
    const { score, signals } = scoreUSignature(neutralSnapshot({ webdriver: true }));
    expect(score).toBeLessThan(U_SIGNATURE_MIN_SCORE);
    expect(signals).toContain('webdriver-flag');
  });

  it('zero pointer samples but a click within 400ms of load', () => {
    const { score, signals } = scoreUSignature(
      neutralSnapshot({ pointerSamples: [], firstClickAtMs: 200 }),
    );
    expect(score).toBeLessThan(U_SIGNATURE_MIN_SCORE);
    expect(signals).toContain('click-blind');
  });

  it('a perfectly linear pointer path over >= 12 samples', () => {
    const { score, signals } = scoreUSignature(
      neutralSnapshot({ pointerSamples: linearPointerSamples(12) }),
    );
    expect(score).toBeLessThan(U_SIGNATURE_MIN_SCORE);
    expect(signals).toContain('path-linear');
  });

  it('identical inter-event deltas (machine-regular timing)', () => {
    const { score, signals } = scoreUSignature(
      neutralSnapshot({ eventDeltas: new Array(10).fill(25) }),
    );
    expect(score).toBeLessThan(U_SIGNATURE_MIN_SCORE);
    expect(signals).toContain('timing-regular');
  });

  it('honeypot field filled', () => {
    const { score, signals } = scoreUSignature(neutralSnapshot({ honeypotFilled: true }));
    expect(score).toBeLessThan(U_SIGNATURE_MIN_SCORE);
    expect(signals).toContain('honeypot-filled');
  });

  it('stacked bot signals still just clamp at 0, never negative', () => {
    const { score } = scoreUSignature(
      neutralSnapshot({ webdriver: true, honeypotFilled: true, eventDeltas: new Array(10).fill(1) }),
    );
    expect(score).toBe(0);
  });
});

describe('scoreUSignature -- a plausible human clears 0.6', () => {
  it('organic velocity + settled dwell + native touch', () => {
    const snapshot = neutralSnapshot({
      touchCapable: true,
      touchCount: 3,
      pointerSamples: organicPointerSamples(16),
      dwellMs: 2000,
      firstClickAtMs: 1800,
    });
    const { score } = scoreUSignature(snapshot);
    expect(score).toBeGreaterThan(0.6);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('scoreUSignature -- pure, deterministic, clamped', () => {
  it('same snapshot in -> identical score and signals every time', () => {
    const snapshot = neutralSnapshot({
      touchCapable: true,
      touchCount: 1,
      pointerSamples: organicPointerSamples(14),
      dwellMs: 1600,
    });
    const first = scoreUSignature(snapshot);
    const second = scoreUSignature(snapshot);
    expect(second).toEqual(first);
  });

  it('never returns outside [0, 1]', () => {
    const low = scoreUSignature(neutralSnapshot({ webdriver: true, honeypotFilled: true }));
    const high = scoreUSignature(
      neutralSnapshot({
        touchCapable: true,
        touchCount: 5,
        pointerSamples: organicPointerSamples(20),
        dwellMs: 10_000,
      }),
    );
    expect(low.score).toBeGreaterThanOrEqual(0);
    expect(high.score).toBeLessThanOrEqual(1);
  });
});

/* -------------------------------------------------------------------- */
/* Fake DOM for the collector + honeypot                                 */
/* -------------------------------------------------------------------- */

type Listener = (evt: { type: string }) => void;

function makeEventTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener(type: string, fn: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type: string, detail: Record<string, unknown> = {}) {
      for (const fn of Array.from(listeners.get(type) ?? [])) fn({ type, ...detail } as never);
    },
    listenerCount(type?: string): number {
      if (type) return listeners.get(type)?.size ?? 0;
      return Array.from(listeners.values()).reduce((n, set) => n + set.size, 0);
    },
  };
}

interface FakeInput {
  value: string;
}

function installDom(honeypotInputs: FakeInput[] = []) {
  const win = makeEventTarget();
  const doc = Object.assign(makeEventTarget(), {
    querySelectorAll: (selector: string) => {
      if (selector.includes(U_SIGNATURE_HONEYPOT_NAME)) return honeypotInputs;
      return [];
    },
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', {});
  return { win, doc };
}

describe('readHoneypot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false without a DOM', () => {
    expect(readHoneypot()).toBe(false);
  });

  it('is false when every honeypot input is empty', () => {
    installDom([{ value: '' }, { value: '   ' }]);
    expect(readHoneypot()).toBe(false);
  });

  it('is true the moment any honeypot input carries a value', () => {
    installDom([{ value: '' }, { value: 'bot@example.com' }]);
    expect(readHoneypot()).toBe(true);
  });
});

describe('startUSignatureCollector', () => {
  let stop: (() => void) | null = null;

  afterEach(() => {
    stop?.();
    stop = null;
    vi.unstubAllGlobals();
  });

  it('is a no-op stop function without a DOM (SSR / plain Node)', () => {
    stop = startUSignatureCollector();
    expect(() => stop!()).not.toThrow();
    expect(isUSignatureCollectorRunning()).toBe(false);
  });

  it('is idempotent -- a second call while running returns the SAME stop function', () => {
    installDom();
    stop = startUSignatureCollector();
    const again = startUSignatureCollector();
    expect(again).toBe(stop);
  });

  it('records pointer/keyboard/scroll/touch/visibility activity into the snapshot', () => {
    const { win, doc } = installDom();
    stop = startUSignatureCollector();
    expect(isUSignatureCollectorRunning()).toBe(true);

    win.dispatch('pointermove', { clientX: 10, clientY: 20, pointerType: 'mouse' });
    win.dispatch('pointermove', { clientX: 15, clientY: 22, pointerType: 'mouse' });
    win.dispatch('pointerdown', {});
    win.dispatch('keydown', {});
    win.dispatch('keydown', {});
    win.dispatch('keydown', {});
    win.dispatch('scroll', {});
    win.dispatch('touchstart', {});
    win.dispatch('touchstart', {});
    doc.dispatch('visibilitychange', {});

    const snap = snapshotUSignature();
    expect(snap.pointerSamples).toHaveLength(2);
    expect(snap.pointerSamples[1]).toMatchObject({ x: 15, y: 22, kind: 'mouse' });
    expect(snap.pointerDownTimes).toHaveLength(1);
    expect(snap.firstClickAtMs).not.toBeNull();
    expect(snap.keyIntervals).toHaveLength(2); // 3 keydowns -> 2 intervals
    expect(snap.scrollTimes).toHaveLength(1);
    expect(snap.touchCount).toBe(2);
    expect(snap.visibilityChanges).toBe(1);
  });

  it('caps every ring buffer at U_SIGNATURE_BUFFER_SIZE regardless of event volume', () => {
    const { win } = installDom();
    stop = startUSignatureCollector();
    const flood = U_SIGNATURE_BUFFER_SIZE + 40;
    for (let i = 0; i < flood; i++) {
      win.dispatch('pointermove', { clientX: i, clientY: i, pointerType: 'mouse' });
      win.dispatch('scroll', {});
    }
    const snap = snapshotUSignature();
    expect(snap.pointerSamples).toHaveLength(U_SIGNATURE_BUFFER_SIZE);
    expect(snap.scrollTimes).toHaveLength(U_SIGNATURE_BUFFER_SIZE);
    // FIFO: the oldest samples were evicted, so the last x is the most recent one.
    expect(snap.pointerSamples[snap.pointerSamples.length - 1]?.x).toBe(flood - 1);
  });

  it('tears itself down (all listeners) on APP_EXIT_EVENT, with no leak on repeat dispatch', () => {
    const { win, doc } = installDom();
    stop = startUSignatureCollector();
    expect(win.listenerCount() + doc.listenerCount()).toBeGreaterThan(0);
    win.dispatch(APP_EXIT_EVENT);
    expect(win.listenerCount()).toBe(0);
    expect(doc.listenerCount()).toBe(0);
    expect(isUSignatureCollectorRunning()).toBe(false);
    expect(() => win.dispatch(APP_EXIT_EVENT)).not.toThrow();
    stop = null; // already torn down
  });

  it('also tears itself down on APP_TERMINATE_EVENT', () => {
    const { win, doc } = installDom();
    stop = startUSignatureCollector();
    win.dispatch(APP_TERMINATE_EVENT);
    expect(win.listenerCount()).toBe(0);
    expect(doc.listenerCount()).toBe(0);
    stop = null;
  });

  it('starting again after a stop begins a fresh collector', () => {
    installDom();
    const first = startUSignatureCollector();
    first();
    expect(isUSignatureCollectorRunning()).toBe(false);
    stop = startUSignatureCollector();
    expect(stop).not.toBe(first);
    expect(isUSignatureCollectorRunning()).toBe(true);
  });
});

/* -------------------------------------------------------------------- */
/* attestUSignature -- fail-closed on every path                         */
/* -------------------------------------------------------------------- */

describe('attestUSignature', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('never even calls fetch when the pre-filter score is below the floor', async () => {
    vi.stubGlobal('navigator', { webdriver: true });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await attestUSignature();
    expect(result.ok).toBe(false);
    expect(result.score).toBeLessThan(U_SIGNATURE_MIN_SCORE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined);
    const result = await attestUSignature();
    expect(result).toEqual({ ok: false, score: expect.any(Number) });
  });

  it('fails closed on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const result = await attestUSignature();
    expect(result.ok).toBe(false);
  });

  it('fails closed on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );
    const result = await attestUSignature();
    expect(result.ok).toBe(false);
  });

  it('fails closed on a malformed (tokenless) answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    );
    const result = await attestUSignature();
    expect(result.ok).toBe(false);
  });

  it('resolves ok with the server token on a well-formed answer, posting the expected shape', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true, token: 'usig1.1.2.B.abc.def' }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await attestUSignature();
    expect(result).toEqual({ ok: true, token: 'usig1.1.2.B.abc.def', score: expect.any(Number) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/u-shield/attest');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    const body = JSON.parse(init.body as string) as { score: number; signals: string[]; nonce: string; ts: number };
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(body.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(typeof body.ts).toBe('number');
    expect(Array.isArray(body.signals)).toBe(true);
  });

  it('fails closed when the round trip exceeds the attest timeout', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const pending = attestUSignature();
    await vi.advanceTimersByTimeAsync(U_SIGNATURE_ATTEST_TIMEOUT_MS + 50);
    const result = await pending;
    expect(aborted).toBe(true);
    expect(result.ok).toBe(false);
  });
});
