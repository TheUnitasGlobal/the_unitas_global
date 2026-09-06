import { describe, expect, it } from 'vitest';
import {
  APP_EXIT_EVENT,
  EXIT_GUARD_DEPTH_KEY,
  EXIT_GUARD_MARKER,
  EXIT_GUARD_SENTINEL_DEPTH,
  LEAVE_SETTLE_MS,
  isExternalReferrer,
  planExit,
  readSentinelDepth,
  type ExitEnvironment,
} from '../../lib/exit/appExit';

// Pure planner maths only -- no DOM, no fixtures shared with other
// __tests__/** files (see CLAUDE.md "Module-level test isolation").
const ORIGIN = 'https://www.theunitas.global';

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

  it('announces every exit on one window event so audio engines can fall silent', () => {
    expect(APP_EXIT_EVENT).toMatch(/^unitas:/);
  });

  describe('APP channel (installed PWA)', () => {
    it('terminates immediately via window.close and, if refused, terminates IN PLACE -- never a restart, never about:blank', () => {
      const plan = planExit(env({ standalone: true, historyLength: 1 }));
      expect(plan.channel).toBe('app');
      expect(plan.immediate).toEqual([{ kind: 'close' }]);
      expect(plan.fallback).toEqual({ kind: 'terminate' });
      expect(JSON.stringify(plan)).not.toContain('about:blank');
      expect(JSON.stringify(plan)).not.toContain('navigate');
    });

    it('ignores history/referrer entirely -- an app has no "previous page"', () => {
      const plan = planExit(
        env({ standalone: true, historyLength: 7, sentinelDepth: 12, referrer: 'https://www.google.com/search?q=unitas' }),
      );
      expect(plan.channel).toBe('app');
      expect(plan.immediate).toEqual([{ kind: 'close' }]);
      expect(plan.fallback).toEqual({ kind: 'terminate' });
    });
  });

  describe('ONLINE channel (browser tab)', () => {
    it('returns to the previous page: one step back when no sentinel is parked', () => {
      const plan = planExit(env({ historyLength: 3 }));
      expect(plan.channel).toBe('online');
      expect(plan.immediate).toEqual([{ kind: 'history-back', steps: 1 }]);
    });

    it("steps over ExitGuard's sentinel entry as well when it is on top", () => {
      const plan = planExit(env({ historyLength: 3, sentinelDepth: 1 }));
      expect(plan.immediate).toEqual([{ kind: 'history-back', steps: 2 }]);
    });

    it('steps over the whole deep sentinel buffer of the main home', () => {
      const plan = planExit(env({ historyLength: 14, sentinelDepth: 12 }));
      expect(plan.immediate).toEqual([{ kind: 'history-back', steps: 13 }]);
      // Malformed depths never over-step: negatives / fractions clamp sanely.
      expect(planExit(env({ historyLength: 4, sentinelDepth: -3 })).immediate).toEqual([
        { kind: 'history-back', steps: 1 },
      ]);
      expect(planExit(env({ historyLength: 4, sentinelDepth: 1.9 })).immediate).toEqual([
        { kind: 'history-back', steps: 2 },
      ]);
    });

    it('closes a fresh tab outright when nothing sits behind our own entries', () => {
      expect(planExit(env({ historyLength: 1 })).immediate).toEqual([{ kind: 'close' }]);
      expect(planExit(env({ historyLength: 2, sentinelDepth: 1 })).immediate).toEqual([{ kind: 'close' }]);
      expect(planExit(env({ historyLength: 13, sentinelDepth: 12 })).immediate).toEqual([{ kind: 'close' }]);
    });

    it('counts our own FORWARD sentinels when the visitor has stepped down into an armed buffer (checklist items 2 + 3)', () => {
      const capacity = EXIT_GUARD_SENTINEL_DEPTH;
      expect(capacity).toBe(12);
      // Fresh tab: [real, s1..s12] = 13 entries, visitor pressed back 3
      // times (depth 9). Without the capacity the planner would have fired
      // a history.go(-10) that lands nowhere; with it, it knows those 3
      // forward entries are ours and closes / falls back instead.
      expect(planExit(env({ historyLength: 13, sentinelDepth: 9, sentinelCapacity: capacity })).immediate).toEqual([
        { kind: 'close' },
      ]);
      // A page really is behind us: step over exactly the entries we stand
      // on (the forward ones vanish with the traversal).
      expect(planExit(env({ historyLength: 14, sentinelDepth: 9, sentinelCapacity: capacity })).immediate).toEqual([
        { kind: 'history-back', steps: 10 },
      ]);
      // On the top of the buffer the capacity changes nothing.
      expect(planExit(env({ historyLength: 14, sentinelDepth: 12, sentinelCapacity: capacity })).immediate).toEqual([
        { kind: 'history-back', steps: 13 },
      ]);
      // On the real entry the capacity is not assumed to have been parked.
      expect(planExit(env({ historyLength: 2, sentinelDepth: 0, sentinelCapacity: capacity })).immediate).toEqual([
        { kind: 'history-back', steps: 1 },
      ]);
      // A capacity smaller than the depth actually observed never under-counts.
      expect(planExit(env({ historyLength: 13, sentinelDepth: 12, sentinelCapacity: 2 })).immediate).toEqual([
        { kind: 'close' },
      ]);
    });

    it('shares one sentinel contract with ExitGuard and the Coming-Soon exit control', () => {
      expect(EXIT_GUARD_MARKER).toBe('unitasExitGuard');
      expect(EXIT_GUARD_DEPTH_KEY).toBe('unitasExitDepth');
      expect(EXIT_GUARD_SENTINEL_DEPTH).toBeGreaterThanOrEqual(2);
    });

    it('falls back to the external referrer (the search page) when a step is refused', () => {
      const referrer = 'https://www.google.com/search?q=unitas';
      const plan = planExit(env({ historyLength: 1, referrer }));
      expect(plan.fallback).toEqual({ kind: 'navigate', url: referrer, replace: false });
    });

    it('with no external page to return to, a refused exit terminates in place -- never a restart on the site', () => {
      expect(planExit(env({ referrer: `${ORIGIN}/en/u-ai` })).fallback).toEqual({ kind: 'terminate' });
      expect(planExit(env({ referrer: 'javascript:alert(1)' })).fallback).toEqual({ kind: 'terminate' });
      expect(planExit(env({ referrer: '' })).fallback).toEqual({ kind: 'terminate' });
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
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 12 }, MARKER, DEPTH)).toBe(12);
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
