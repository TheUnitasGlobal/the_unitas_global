// U-Shield / U-Signature behavioural gate -- CLIENT side (REV-13, spec §6 +
// §10 items 12/16).
//
// A one-click U-COIN investment must never be triggered by a headless
// browser, a replay script or a form-filler. Before the wallet RPC fires,
// `attestUSignature()` scores the visitor's *behaviour* so far on this page
// (pointer curvature and velocity variance, event-timing variance, dwell,
// touch/mouse mix, the headless `navigator.webdriver` flag and a honeypot
// field) and asks `/api/u-shield/attest` for a short-lived HMAC token. The
// server is authoritative -- the client score is only a hint plus a
// cheap pre-filter -- and EVERY failure path (no collector, bad network,
// timeout, 4xx/5xx, malformed answer) resolves to `{ ok: false }`: the gate
// is FAIL-CLOSED, it can only ever refuse to open, never open by accident.
//
// Constraints honoured here:
//  - importable from client components AND from vitest's Node environment:
//    every window / document / navigator / performance access is guarded;
//  - one collector per page (`startUSignatureCollector` is idempotent and
//    hands back the same stop function on every call);
//  - listeners are passive + capture so they can never block scrolling or be
//    swallowed by `stopPropagation()` in a child;
//  - every buffer is a fixed 64-slot ring, so a bot spamming events cannot
//    grow memory (Low-Memory Armor);
//  - the collector also stops itself on the app-exit / terminate events so a
//    terminated app leaves no listeners behind (spec §10 item 12);
//  - the scorer is a pure, deterministic function of a snapshot, so it is
//    unit-testable without a DOM (`__tests__/security/uSignature.test.ts`).
//
// Obfuscation posture (spec §6): internals live in module-private closures
// and `#private` class fields (mangled by SWC), signal names are assembled
// at runtime rather than shipped as one greppable table, and no source maps
// leave the build.

import { APP_EXIT_EVENT, APP_TERMINATE_EVENT } from '@/lib/exit/appExit';

/** Field name of the hidden honeypot input (see components/security/USignatureHoneypot.tsx). */
export const U_SIGNATURE_HONEYPOT_NAME = 'u_contact_alt';
/** Attest endpoint (POST only). */
export const U_SHIELD_ATTEST_PATH = '/api/u-shield/attest';
/** Below this the client does not even ask the server (mirrors the route). */
export const U_SIGNATURE_MIN_SCORE = 0.35;
/** Ring-buffer capacity per channel. */
export const U_SIGNATURE_BUFFER_SIZE = 64;
/** Network budget for the attest round trip before we fail closed. */
export const U_SIGNATURE_ATTEST_TIMEOUT_MS = 4000;

export type PointerSampleKind = 'mouse' | 'touch' | 'pen';

export interface PointerSample {
  /** ms since page load (performance.now() domain). */
  t: number;
  x: number;
  y: number;
  kind: PointerSampleKind;
}

/**
 * Everything the scorer looks at. Plain data (no DOM handles) so it can be
 * built by hand in tests and serialised for diagnostics if ever needed.
 */
export interface USignatureSnapshot {
  /** `navigator.webdriver === true` -- Selenium / Puppeteer / Playwright. */
  webdriver: boolean;
  /** Device advertises touch points or coarse pointer. */
  touchCapable: boolean;
  /** Recent pointermove samples, oldest first (<= 64). */
  pointerSamples: PointerSample[];
  /** pointerdown timestamps (ms since load, <= 64). */
  pointerDownTimes: number[];
  /** Intervals between consecutive keydown events in ms (<= 64). */
  keyIntervals: number[];
  /** scroll timestamps (ms since load, <= 64). */
  scrollTimes: number[];
  /** touchstart events observed. */
  touchCount: number;
  /** Intervals between consecutive events of ANY kind in ms (<= 64). */
  eventDeltas: number[];
  /** ms since load of the first pointerdown, or null if none yet. */
  firstClickAtMs: number | null;
  /** ms the page has been alive when the snapshot was taken. */
  dwellMs: number;
  /** visibilitychange events observed. */
  visibilityChanges: number;
  /** Honeypot input carried a value. */
  honeypotFilled: boolean;
}

export interface USignatureScore {
  /** 0..1, clamped. */
  score: number;
  /** Which heuristics fired, for diagnostics / the server hint. */
  signals: string[];
}

export interface USignatureAttestation {
  ok: boolean;
  /** Server-minted `usig1.` token when `ok`. */
  token?: string;
  /** Client-side score that was (or would have been) submitted. */
  score: number;
}

/* ------------------------------------------------------------------ */
/* Bounded ring buffer                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fixed-capacity FIFO. `#private` fields (mangled at build time) keep the
 * internals off the public surface of the bundle.
 */
class Ring<T> {
  readonly #items: T[];
  readonly #cap: number;
  #head = 0;
  #size = 0;

  constructor(cap: number) {
    this.#cap = Math.max(1, Math.floor(cap));
    this.#items = new Array<T>(this.#cap);
  }

  push(item: T): void {
    const idx = (this.#head + this.#size) % this.#cap;
    this.#items[idx] = item;
    if (this.#size < this.#cap) {
      this.#size += 1;
    } else {
      this.#head = (this.#head + 1) % this.#cap;
    }
  }

  get size(): number {
    return this.#size;
  }

  last(): T | undefined {
    if (this.#size === 0) return undefined;
    return this.#items[(this.#head + this.#size - 1) % this.#cap];
  }

  /** Oldest -> newest copy. */
  toArray(): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.#size; i++) {
      out.push(this.#items[(this.#head + i) % this.#cap] as T);
    }
    return out;
  }

  clear(): void {
    this.#head = 0;
    this.#size = 0;
  }
}

/* ------------------------------------------------------------------ */
/* Environment guards                                                  */
/* ------------------------------------------------------------------ */

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function readWebdriver(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}

function readTouchCapable(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0) return true;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  }
  return false;
}

/** True when the hidden honeypot input carries any value (bots auto-fill it). */
export function readHoneypot(): boolean {
  if (!hasWindow()) return false;
  try {
    const nodes = document.querySelectorAll<HTMLInputElement>(
      `input[name="${U_SIGNATURE_HONEYPOT_NAME}"]`,
    );
    for (let i = 0; i < nodes.length; i++) {
      if ((nodes[i]?.value ?? '').trim().length > 0) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Collector (module singleton)                                        */
/* ------------------------------------------------------------------ */

interface CollectorState {
  pointer: Ring<PointerSample>;
  downs: Ring<number>;
  keys: Ring<number>;
  scrolls: Ring<number>;
  deltas: Ring<number>;
  touchCount: number;
  visibilityChanges: number;
  lastEventAt: number | null;
  lastKeyAt: number | null;
  firstClickAt: number | null;
  startedAt: number;
}

function freshState(): CollectorState {
  return {
    pointer: new Ring<PointerSample>(U_SIGNATURE_BUFFER_SIZE),
    downs: new Ring<number>(U_SIGNATURE_BUFFER_SIZE),
    keys: new Ring<number>(U_SIGNATURE_BUFFER_SIZE),
    scrolls: new Ring<number>(U_SIGNATURE_BUFFER_SIZE),
    deltas: new Ring<number>(U_SIGNATURE_BUFFER_SIZE),
    touchCount: 0,
    visibilityChanges: 0,
    lastEventAt: null,
    lastKeyAt: null,
    firstClickAt: null,
    startedAt: nowMs(),
  };
}

let state: CollectorState | null = null;
let stopFn: (() => void) | null = null;

function pointerKind(type: string | undefined): PointerSampleKind {
  if (type === 'touch') return 'touch';
  if (type === 'pen') return 'pen';
  return 'mouse';
}

/**
 * Starts the page-level collector (once). Returns a stop function; calling
 * `startUSignatureCollector()` again while running returns the SAME stop
 * function, so React StrictMode double-mounts and multiple gateways on one
 * page share one set of listeners. The collector also stops itself on the
 * app exit / terminate events (spec §10 item 12).
 */
export function startUSignatureCollector(): () => void {
  if (stopFn) return stopFn;
  if (!hasWindow()) {
    // SSR / tests without a DOM: nothing to collect, but callers still get a
    // valid no-op stop so their cleanup code stays uniform.
    const noop = (): void => {};
    return noop;
  }

  const s = freshState();
  state = s;

  const tick = (): number => {
    const t = nowMs() - s.startedAt;
    if (s.lastEventAt !== null) s.deltas.push(t - s.lastEventAt);
    s.lastEventAt = t;
    return t;
  };

  const onPointerMove = (e: Event): void => {
    const t = tick();
    const pe = e as PointerEvent;
    const x = typeof pe.clientX === 'number' ? pe.clientX : 0;
    const y = typeof pe.clientY === 'number' ? pe.clientY : 0;
    s.pointer.push({ t, x, y, kind: pointerKind(pe.pointerType) });
  };
  const onPointerDown = (): void => {
    const t = tick();
    s.downs.push(t);
    if (s.firstClickAt === null) s.firstClickAt = t;
  };
  const onKeyDown = (): void => {
    const t = tick();
    if (s.lastKeyAt !== null) s.keys.push(t - s.lastKeyAt);
    s.lastKeyAt = t;
  };
  const onScroll = (): void => {
    const t = tick();
    s.scrolls.push(t);
  };
  const onTouchStart = (): void => {
    tick();
    s.touchCount += 1;
  };
  const onVisibility = (): void => {
    tick();
    s.visibilityChanges += 1;
  };

  const opts: AddEventListenerOptions = { passive: true, capture: true };
  window.addEventListener('pointermove', onPointerMove, opts);
  window.addEventListener('pointerdown', onPointerDown, opts);
  window.addEventListener('keydown', onKeyDown, opts);
  window.addEventListener('scroll', onScroll, opts);
  window.addEventListener('touchstart', onTouchStart, opts);
  document.addEventListener('visibilitychange', onVisibility, opts);

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener('pointermove', onPointerMove, opts);
    window.removeEventListener('pointerdown', onPointerDown, opts);
    window.removeEventListener('keydown', onKeyDown, opts);
    window.removeEventListener('scroll', onScroll, opts);
    window.removeEventListener('touchstart', onTouchStart, opts);
    document.removeEventListener('visibilitychange', onVisibility, opts);
    window.removeEventListener(APP_EXIT_EVENT, stop);
    window.removeEventListener(APP_TERMINATE_EVENT, stop);
    if (stopFn === stop) stopFn = null;
    if (state === s) state = null;
  };
  // Exit doctrine: a terminated app must leave no live listeners behind.
  window.addEventListener(APP_EXIT_EVENT, stop);
  window.addEventListener(APP_TERMINATE_EVENT, stop);

  stopFn = stop;
  return stop;
}

/** True while a collector is attached (diagnostics / tests). */
export function isUSignatureCollectorRunning(): boolean {
  return stopFn !== null;
}

/**
 * Plain-data view of what has been observed so far. Safe to call before the
 * collector started (yields an empty, environment-only snapshot) and in
 * Node (everything false / empty).
 */
export function snapshotUSignature(): USignatureSnapshot {
  const s = state;
  const dwell = s ? Math.max(0, nowMs() - s.startedAt) : 0;
  return {
    webdriver: readWebdriver(),
    touchCapable: readTouchCapable(),
    pointerSamples: s ? s.pointer.toArray() : [],
    pointerDownTimes: s ? s.downs.toArray() : [],
    keyIntervals: s ? s.keys.toArray() : [],
    scrollTimes: s ? s.scrolls.toArray() : [],
    touchCount: s ? s.touchCount : 0,
    eventDeltas: s ? s.deltas.toArray() : [],
    firstClickAtMs: s ? s.firstClickAt : null,
    dwellMs: dwell,
    visibilityChanges: s ? s.visibilityChanges : 0,
    honeypotFilled: readHoneypot(),
  };
}

/* ------------------------------------------------------------------ */
/* Scoring (pure)                                                      */
/* ------------------------------------------------------------------ */

const BASE_SCORE = 0.5;
/** Minimum samples before a path-shape heuristic is trusted. */
const MIN_PATH_SAMPLES = 12;
/** Minimum samples before velocity variance is trusted. */
const MIN_VELOCITY_SAMPLES = 8;
/** Minimum deltas before timing variance is trusted. */
const MIN_DELTA_SAMPLES = 8;
/** Mean |sin(turn angle)| below which a path is "perfectly linear". */
const LINEAR_CURVATURE_EPS = 0.01;
/** Coefficient of variation of speed above which motion looks organic. */
const NATURAL_VELOCITY_CV = 0.2;
/** Variance (ms^2) below which inter-event timing is machine-regular. */
const REGULAR_DELTA_VARIANCE = 1;
const EARLY_CLICK_MS = 400;
const DWELL_BONUS_MS = 1500;

/** Signal names are assembled at runtime (not one static, greppable table). */
function sig(a: string, b: string): string {
  return `${a}-${b}`;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function variance(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i] as number;
  const mean = sum / n;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const d = (values[i] as number) - mean;
    acc += d * d;
  }
  return acc / n;
}

/** Mean |sin(angle)| between consecutive movement segments (0 = straight). */
function meanCurvature(samples: PointerSample[]): number | null {
  let acc = 0;
  let count = 0;
  for (let i = 2; i < samples.length; i++) {
    const p0 = samples[i - 2] as PointerSample;
    const p1 = samples[i - 1] as PointerSample;
    const p2 = samples[i] as PointerSample;
    const ax = p1.x - p0.x;
    const ay = p1.y - p0.y;
    const bx = p2.x - p1.x;
    const by = p2.y - p1.y;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la === 0 || lb === 0) continue;
    acc += Math.abs(ax * by - ay * bx) / (la * lb);
    count += 1;
  }
  return count === 0 ? null : acc / count;
}

/** Speeds (px/ms) of consecutive segments with a positive time delta. */
function segmentSpeeds(samples: PointerSample[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] as PointerSample;
    const b = samples[i] as PointerSample;
    const dt = b.t - a.t;
    if (dt <= 0) continue;
    out.push(Math.hypot(b.x - a.x, b.y - a.y) / dt);
  }
  return out;
}

/**
 * Pure, deterministic behavioural score (0..1). Base 0.5; each heuristic
 * adds or subtracts (spec §6); clamped at the end. Same snapshot in, same
 * score out -- no clocks, no globals.
 */
export function scoreUSignature(snapshot: USignatureSnapshot): USignatureScore {
  const signals: string[] = [];
  let score = BASE_SCORE;

  if (snapshot.honeypotFilled) {
    score -= 1;
    signals.push(sig('honeypot', 'filled'));
  }
  if (snapshot.webdriver) {
    score -= 0.6;
    signals.push(sig('webdriver', 'flag'));
  }

  const samples = snapshot.pointerSamples;
  const firstClick = snapshot.firstClickAtMs;
  if (samples.length === 0 && firstClick !== null && firstClick >= 0 && firstClick < EARLY_CLICK_MS) {
    score -= 0.35;
    signals.push(sig('click', 'blind'));
  }

  if (samples.length >= MIN_PATH_SAMPLES) {
    const curvature = meanCurvature(samples);
    if (curvature !== null && curvature < LINEAR_CURVATURE_EPS) {
      score -= 0.3;
      signals.push(sig('path', 'linear'));
    }
  }

  const deltas = snapshot.eventDeltas;
  if (deltas.length >= MIN_DELTA_SAMPLES && variance(deltas) < REGULAR_DELTA_VARIANCE) {
    score -= 0.3;
    signals.push(sig('timing', 'regular'));
  }
  const keys = snapshot.keyIntervals;
  if (keys.length >= MIN_DELTA_SAMPLES && variance(keys) < REGULAR_DELTA_VARIANCE) {
    score -= 0.3;
    signals.push(sig('keys', 'regular'));
  }

  if (samples.length >= MIN_VELOCITY_SAMPLES) {
    const speeds = segmentSpeeds(samples);
    if (speeds.length >= MIN_VELOCITY_SAMPLES - 1) {
      let sum = 0;
      for (let i = 0; i < speeds.length; i++) sum += speeds[i] as number;
      const mean = sum / speeds.length;
      if (mean > 0) {
        const cv = Math.sqrt(variance(speeds)) / mean;
        if (cv > NATURAL_VELOCITY_CV) {
          score += 0.25;
          signals.push(sig('velocity', 'organic'));
        }
      }
    }
  }

  if (snapshot.dwellMs >= DWELL_BONUS_MS) {
    score += 0.15;
    signals.push(sig('dwell', 'settled'));
  }

  if (snapshot.touchCapable && snapshot.touchCount > 0) {
    score += 0.2;
    signals.push(sig('touch', 'native'));
  }

  return { score: clamp01(score), signals };
}

/* ------------------------------------------------------------------ */
/* Attestation                                                         */
/* ------------------------------------------------------------------ */

const NONCE_BYTES = 16;

/** 32 hex chars; falls back to a Math.random nonce only if Web Crypto is absent. */
function makeNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  let filled = false;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      crypto.getRandomValues(bytes);
      filled = true;
    } catch {
      filled = false;
    }
  }
  if (!filled) {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += (bytes[i] as number).toString(16).padStart(2, '0');
  return out;
}

/**
 * Scores the current behaviour and, when it clears the floor, asks the
 * server for a `usig1.` token. FAIL-CLOSED: every error, timeout or odd
 * response resolves `{ ok: false }` -- it never throws.
 */
export async function attestUSignature(): Promise<USignatureAttestation> {
  const snapshot = snapshotUSignature();
  const { score, signals } = scoreUSignature(snapshot);
  if (score < U_SIGNATURE_MIN_SCORE) return { ok: false, score };
  if (typeof fetch !== 'function') return { ok: false, score };

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), U_SIGNATURE_ATTEST_TIMEOUT_MS)
    : null;
  try {
    const res = await fetch(U_SHIELD_ATTEST_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller?.signal,
      body: JSON.stringify({ score, signals, nonce: makeNonce(), ts: Date.now() }),
    });
    if (!res.ok) return { ok: false, score };
    const data: unknown = await res.json();
    if (
      typeof data === 'object' &&
      data !== null &&
      (data as { ok?: unknown }).ok === true &&
      typeof (data as { token?: unknown }).token === 'string' &&
      ((data as { token: string }).token.length > 0)
    ) {
      return { ok: true, token: (data as { token: string }).token, score };
    }
    return { ok: false, score };
  } catch {
    return { ok: false, score };
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
