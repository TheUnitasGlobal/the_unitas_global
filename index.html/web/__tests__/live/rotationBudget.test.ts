import { describe, expect, it } from 'vitest';
import { decideRotationLoad, unattendedLoopRequestCost } from '../../lib/live/rotationBudget';

// REV-24 MISSION 3 -- the zero-cost rolling rule. Pure helpers only; no
// fixtures shared with other __tests__/** files (CLAUDE.md "Module-level
// test isolation").

const NOW = 1_800_000_000_000;
const MIN = 60_000;

describe('decideRotationLoad -- the four-cell table', () => {
  it('cold: fetches once, for the clock and the visitor alike', () => {
    for (const source of ['clock', 'intent'] as const) {
      expect(decideRotationLoad({ cachedAt: undefined, ttlMs: 15 * MIN, source, now: NOW })).toEqual({
        action: 'fetch',
        spendsRequest: true,
        hasPaintableCache: false,
      });
    }
  });

  it('fresh: reads memory, for the clock and the visitor alike', () => {
    for (const source of ['clock', 'intent'] as const) {
      expect(
        decideRotationLoad({ cachedAt: NOW - MIN, ttlMs: 15 * MIN, source, now: NOW }),
      ).toEqual({ action: 'memory', spendsRequest: false, hasPaintableCache: true });
    }
  });

  it('STALE + CLOCK: reads memory -- this is the whole mission', () => {
    expect(decideRotationLoad({ cachedAt: NOW - 99 * MIN, ttlMs: 15 * MIN, source: 'clock', now: NOW })).toEqual({
      action: 'memory',
      spendsRequest: false,
      hasPaintableCache: true,
    });
  });

  it('stale + intent: refreshes, because the visitor asked', () => {
    expect(decideRotationLoad({ cachedAt: NOW - 99 * MIN, ttlMs: 15 * MIN, source: 'intent', now: NOW })).toEqual({
      action: 'refresh',
      spendsRequest: true,
      hasPaintableCache: true,
    });
  });

  it('treats the TTL boundary as expiry, not as freshness', () => {
    const exactlyAtTtl = decideRotationLoad({ cachedAt: NOW - 15 * MIN, ttlMs: 15 * MIN, source: 'intent', now: NOW });
    expect(exactlyAtTtl.action).toBe('refresh');
    const oneMsInside = decideRotationLoad({ cachedAt: NOW - 15 * MIN + 1, ttlMs: 15 * MIN, source: 'intent', now: NOW });
    expect(oneMsInside.action).toBe('memory');
  });

  it('treats a non-finite cache stamp as cold rather than painting NaN', () => {
    expect(decideRotationLoad({ cachedAt: NaN, ttlMs: MIN, source: 'clock', now: NOW }).action).toBe('fetch');
  });

  it('never answers `memory` without something to paint', () => {
    for (const cachedAt of [undefined, NaN]) {
      const d = decideRotationLoad({ cachedAt, ttlMs: MIN, source: 'clock', now: NOW });
      expect(d.action).not.toBe('memory');
      expect(d.hasPaintableCache).toBe(false);
    }
  });
});

describe('an unattended carousel costs nothing, forever', () => {
  // The 16 REV-23 slots with their three real TTLs (weather 10 min, feed
  // 15 min, ranking 6 h -- lib/live/discoverySlots.ts slotTtlMs).
  const TTLS = [
    10 * MIN,
    ...Array.from({ length: 13 }, () => 15 * MIN),
    6 * 60 * MIN,
    6 * 60 * MIN,
  ];

  it('spends ZERO requests on a full loop once every slot has been filled once', () => {
    const filled = TTLS.map((ttlMs) => ({ cachedAt: NOW, ttlMs }));
    // A full 16-slot loop is 16 x 7s = 112s.
    expect(unattendedLoopRequestCost(filled, NOW + 112_000)).toBe(0);
  });

  it('still spends ZERO after twenty-four hours of every entry being stale', () => {
    const filled = TTLS.map((ttlMs) => ({ cachedAt: NOW, ttlMs }));
    for (let hour = 1; hour <= 24; hour++) {
      expect(unattendedLoopRequestCost(filled, NOW + hour * 60 * MIN), `hour ${hour}`).toBe(0);
    }
  });

  it('is exactly the regression it replaces: intent over the same stale set WOULD have cost 16', () => {
    // The pre-REV-24 behaviour is what the `intent` column still does, and
    // this is the number the clock used to pay once per TTL, forever.
    const filled = TTLS.map((ttlMs) => ({ cachedAt: NOW, ttlMs }));
    const asIntent = filled.reduce(
      (n, e) => n + (decideRotationLoad({ ...e, source: 'intent', now: NOW + 24 * 60 * MIN }).spendsRequest ? 1 : 0),
      0,
    );
    expect(asIntent).toBe(16);
  });

  it('charges the first fill exactly once per slot, never again', () => {
    const cold = TTLS.map((ttlMs) => ({ cachedAt: undefined as number | undefined, ttlMs }));
    const firstPass = cold.reduce(
      (n, e) => n + (decideRotationLoad({ ...e, source: 'clock', now: NOW }).spendsRequest ? 1 : 0),
      0,
    );
    expect(firstPass).toBe(16);
    // Every resolve writes the cache, so the second pass is free.
    const afterFill = TTLS.map((ttlMs) => ({ cachedAt: NOW, ttlMs }));
    expect(unattendedLoopRequestCost(afterFill, NOW + 112_000)).toBe(0);
  });
});
