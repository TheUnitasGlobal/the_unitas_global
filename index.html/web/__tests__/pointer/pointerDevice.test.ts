import { afterEach, describe, expect, it, vi } from 'vitest';

// Isolated per CLAUDE.md "Module-level test isolation": this file only exercises
// lib/pointerDevice's scroll-SFX gate against a hand-rolled window stub. No jsdom
// (the repo's vitest env is `node` by design) -- the module just needs `window`
// with addEventListener + matchMedia, so we fake exactly that and dispatch the
// gestures ourselves.

type Listener = (event: unknown) => void;

function installWindow(mq: { coarsePointer: boolean; noHover: boolean }) {
  const listeners = new Map<string, Listener[]>();
  (globalThis as unknown as { window: unknown }).window = {
    addEventListener(type: string, fn: Listener) {
      const arr = listeners.get(type) ?? [];
      arr.push(fn);
      listeners.set(type, arr);
    },
    removeEventListener() {},
    matchMedia(query: string) {
      const matches =
        (query.includes('pointer: coarse') && mq.coarsePointer) ||
        (query.includes('hover: none') && mq.noHover);
      return { matches, media: query, addEventListener() {}, removeEventListener() {} };
    },
  };
  return {
    fire(type: string, event: unknown = {}) {
      for (const fn of listeners.get(type) ?? []) fn(event);
    },
  };
}

async function freshModule(mq: { coarsePointer: boolean; noHover: boolean }) {
  vi.resetModules();
  const bus = installWindow(mq);
  const mod = await import('../../lib/pointerDevice');
  return { ...mod, ...bus };
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  vi.resetModules();
});

const DESKTOP = { coarsePointer: false, noHover: false }; // mouse PC
const HYBRID = { coarsePointer: true, noHover: false }; // touchscreen laptop (can still hover)
const PHONE = { coarsePointer: true, noHover: true }; // handheld, no hover

describe('shouldPlayScrollFocusSfx — PC must stay silent', () => {
  it('is silent on a mouse desktop after a wheel scroll', async () => {
    const m = await freshModule(DESKTOP);
    m.fire('wheel');
    expect(m.shouldPlayScrollFocusSfx()).toBe(false);
  });

  it('is silent on a mouse desktop after a mouse pointer gesture', async () => {
    const m = await freshModule(DESKTOP);
    m.fire('pointerdown', { pointerType: 'mouse' });
    m.fire('pointermove', { pointerType: 'mouse' });
    expect(m.shouldPlayScrollFocusSfx()).toBe(false);
  });

  it('is silent on a TOUCHSCREEN laptop as soon as the mouse is used', async () => {
    const m = await freshModule(HYBRID);
    m.fire('pointermove', { pointerType: 'mouse' });
    m.fire('wheel');
    expect(m.shouldPlayScrollFocusSfx()).toBe(false);
  });

  it('is silent pre-interaction on a fine-pointer desktop', async () => {
    const m = await freshModule(DESKTOP);
    expect(m.shouldPlayScrollFocusSfx()).toBe(false);
  });
});

describe('shouldPlayScrollFocusSfx — mobile must still work', () => {
  it('plays on a phone scrolling by touch', async () => {
    const m = await freshModule(PHONE);
    m.fire('touchstart');
    m.fire('pointermove', { pointerType: 'touch' });
    expect(m.shouldPlayScrollFocusSfx()).toBe(true);
  });

  it('plays pre-interaction on a coarse-primary handheld', async () => {
    const m = await freshModule(PHONE);
    expect(m.shouldPlayScrollFocusSfx()).toBe(true);
  });

  it('follows the most recent modality on a hybrid device', async () => {
    const m = await freshModule(HYBRID);
    m.fire('pointerdown', { pointerType: 'mouse' });
    expect(m.shouldPlayScrollFocusSfx()).toBe(false);
    m.fire('pointermove', { pointerType: 'touch' });
    expect(m.shouldPlayScrollFocusSfx()).toBe(true);
    m.fire('wheel');
    expect(m.shouldPlayScrollFocusSfx()).toBe(false);
  });

  it('ignores a stylus so pen tablets keep the touch cue', async () => {
    const m = await freshModule(PHONE);
    m.fire('pointerdown', { pointerType: 'pen' });
    expect(m.shouldPlayScrollFocusSfx()).toBe(true);
  });
});
