import { describe, expect, it } from 'vitest';
import {
  LEAVE_SETTLE_MS,
  isExternalReferrer,
  planExit,
  readSentinelDepth,
  type ExitEnvironment,
} from '../../lib/exit/appExit';

// Pure planner maths only -- no DOM, no fixtures shared with other
// __tests__/** files (see CLAUDE.md "Module-level test isolation").
const ORIGIN = 'https://www.theunitas.global';
const FALLBACK = '/ko';

function env(overrides: Partial<ExitEnvironment> = {}): ExitEnvironment {
  return {
    standalone: false,
    historyLength: 1,
    sentinelDepth: 0,
    referrer: '',
    origin: ORIGIN,
    ...overrides,
  };
}

describe('sovereign omni-channel exit planner', () => {
  it('waits a bounded settle window before admitting the runtime refused', () => {
    expect(LEAVE_SETTLE_MS).toBeGreaterThan(0);
    expect(LEAVE_SETTLE_MS).toBeLessThan(1000);
  });

  describe('APP channel (installed PWA)', () => {
    it('terminates immediately via window.close and never falls back to about:blank', () => {
      const plan = planExit(env({ standalone: true, historyLength: 1 }), FALLBACK);
      expect(plan.channel).toBe('app');
      expect(plan.immediate).toEqual([{ kind: 'close' }]);
      expect(plan.fallback).toEqual({ kind: 'navigate', url: FALLBACK, replace: true });
      expect(JSON.stringify(plan)).not.toContain('about:blank');
    });

    it('ignores history/referrer entirely -- an app has no "previous page"', () => {
      const plan = planExit(
        env({ standalone: true, historyLength: 7, sentinelDepth: 2, referrer: 'https://www.google.com/search?q=unitas' }),
        FALLBACK,
      );
      expect(plan.channel).toBe('app');
      expect(plan.immediate).toEqual([{ kind: 'close' }]);
      expect(plan.fallback).toEqual({ kind: 'navigate', url: FALLBACK, replace: true });
    });
  });

  describe('ONLINE channel (browser tab)', () => {
    it('returns to the previous page: one step back when no sentinel is parked', () => {
      const plan = planExit(env({ historyLength: 3 }), FALLBACK);
      expect(plan.channel).toBe('online');
      expect(plan.immediate).toEqual([{ kind: 'history-back', steps: 1 }]);
    });

    it('steps over ExitGuard\'s sentinel entry as well when it is on top', () => {
      const plan = planExit(env({ historyLength: 3, sentinelDepth: 1 }), FALLBACK);
      expect(plan.immediate).toEqual([{ kind: 'history-back', steps: 2 }]);
    });

    it('steps over the whole double-tap sentinel buffer (7-point hardening, item 7)', () => {
      const plan = planExit(env({ historyLength: 4, sentinelDepth: 2 }), FALLBACK);
      expect(plan.immediate).toEqual([{ kind: 'history-back', steps: 3 }]);
      // Malformed depths never over-step: negatives / fractions clamp sanely.
      expect(planExit(env({ historyLength: 4, sentinelDepth: -3 }), FALLBACK).immediate).toEqual([
        { kind: 'history-back', steps: 1 },
      ]);
      expect(planExit(env({ historyLength: 4, sentinelDepth: 1.9 }), FALLBACK).immediate).toEqual([
        { kind: 'history-back', steps: 2 },
      ]);
    });

    it('closes a fresh tab outright when nothing sits behind our own entries', () => {
      expect(planExit(env({ historyLength: 1 }), FALLBACK).immediate).toEqual([{ kind: 'close' }]);
      expect(planExit(env({ historyLength: 2, sentinelDepth: 1 }), FALLBACK).immediate).toEqual([
        { kind: 'close' },
      ]);
      expect(planExit(env({ historyLength: 3, sentinelDepth: 2 }), FALLBACK).immediate).toEqual([
        { kind: 'close' },
      ]);
    });

    it('falls back to the external referrer (the search page) when a step is refused', () => {
      const referrer = 'https://www.google.com/search?q=unitas';
      const plan = planExit(env({ historyLength: 1, referrer }), FALLBACK);
      expect(plan.fallback).toEqual({ kind: 'navigate', url: referrer, replace: false });
    });

    it('never treats a same-origin or non-http referrer as "the previous site"', () => {
      expect(planExit(env({ referrer: `${ORIGIN}/en/u-ai` }), FALLBACK).fallback).toEqual({
        kind: 'navigate',
        url: FALLBACK,
        replace: false,
      });
      expect(planExit(env({ referrer: 'javascript:alert(1)' }), FALLBACK).fallback).toEqual({
        kind: 'navigate',
        url: FALLBACK,
        replace: false,
      });
    });
  });

  it('readSentinelDepth reads the parked depth off history.state defensively', () => {
    const MARKER = 'unitasExitGuard';
    const DEPTH = 'unitasExitDepth';
    expect(readSentinelDepth(null, MARKER, DEPTH)).toBe(0);
    expect(readSentinelDepth(undefined, MARKER, DEPTH)).toBe(0);
    expect(readSentinelDepth('junk', MARKER, DEPTH)).toBe(0);
    expect(readSentinelDepth({ __NA: true }, MARKER, DEPTH)).toBe(0);
    // A marked entry with no depth is the legacy single sentinel.
    expect(readSentinelDepth({ [MARKER]: true }, MARKER, DEPTH)).toBe(1);
    expect(readSentinelDepth({ [MARKER]: true }, MARKER, undefined)).toBe(1);
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 2 }, MARKER, DEPTH)).toBe(2);
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 2.7 }, MARKER, DEPTH)).toBe(2);
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 0 }, MARKER, DEPTH)).toBe(1);
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 'x' }, MARKER, DEPTH)).toBe(1);
    // No marker configured -> never counts anything.
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 2 }, undefined, DEPTH)).toBe(0);
  });

  it('isExternalReferrer is strict and never throws', () => {
    expect(isExternalReferrer('', ORIGIN)).toBe(false);
    expect(isExternalReferrer('not a url', ORIGIN)).toBe(false);
    expect(isExternalReferrer('ftp://example.com/x', ORIGIN)).toBe(false);
    expect(isExternalReferrer(`${ORIGIN}/ko`, ORIGIN)).toBe(false);
    expect(isExternalReferrer('https://duckduckgo.com/?q=unitas', ORIGIN)).toBe(true);
    expect(isExternalReferrer('http://example.org/', ORIGIN)).toBe(true);
  });
});
