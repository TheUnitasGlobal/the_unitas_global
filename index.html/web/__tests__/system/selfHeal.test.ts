import { describe, expect, it } from 'vitest';
import {
  SELF_HEAL_DELAY_MS,
  SELF_HEAL_MAX_ATTEMPTS,
  SELF_HEAL_WINDOW_MS,
  planSelfHeal,
} from '../../lib/system/selfHeal';

// Pure policy maths only -- no DOM, no fixtures shared with other
// __tests__/** files (see CLAUDE.md "Module-level test isolation").
describe('route error screen self-healing budget (owner instruction 2026-09-07, item 1)', () => {
  it('heals after a short beat, at most twice per window', () => {
    expect(SELF_HEAL_DELAY_MS).toBeGreaterThan(0);
    expect(SELF_HEAL_DELAY_MS).toBeLessThan(3000);
    expect(SELF_HEAL_MAX_ATTEMPTS).toBe(2);
    expect(SELF_HEAL_WINDOW_MS).toBeGreaterThanOrEqual(10_000);
  });

  it('allows the first attempts of a window and refuses once the budget is spent', () => {
    const t0 = 1_000_000;
    const first = planSelfHeal(null, t0);
    expect(first).toEqual({ allowed: true, next: { count: 1, at: t0 } });
    const second = planSelfHeal(first.next, t0 + 500);
    expect(second).toEqual({ allowed: true, next: { count: 2, at: t0 } });
    const third = planSelfHeal(second.next, t0 + 1_000);
    expect(third.allowed).toBe(false);
    expect(third.next).toEqual({ count: 2, at: t0 });
    // Still refused for the rest of the window -- no reload storm.
    expect(planSelfHeal(third.next, t0 + SELF_HEAL_WINDOW_MS - 1).allowed).toBe(false);
  });

  it('opens a fresh window once the old one has elapsed (or the clock went backwards)', () => {
    const t0 = 1_000_000;
    const spent = { count: SELF_HEAL_MAX_ATTEMPTS, at: t0 };
    expect(planSelfHeal(spent, t0 + SELF_HEAL_WINDOW_MS + 1)).toEqual({
      allowed: true,
      next: { count: 1, at: t0 + SELF_HEAL_WINDOW_MS + 1 },
    });
    expect(planSelfHeal(spent, t0 - 10)).toEqual({ allowed: true, next: { count: 1, at: t0 - 10 } });
  });

  it('treats a malformed record as a fresh window', () => {
    expect(planSelfHeal({ count: Number.NaN, at: Number.NaN }, 5).allowed).toBe(true);
    expect(planSelfHeal({ count: -4, at: 5 }, 6)).toEqual({ allowed: true, next: { count: 1, at: 5 } });
  });
});
