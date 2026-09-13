import { describe, expect, it } from 'vitest';
import { captureScroll, reserveHeight } from '../../lib/ui/scrollAnchor';

// Pure helpers only -- no fixtures shared with other __tests__/** files
// (see CLAUDE.md "Module-level test isolation"). The DOM half of
// captureScroll is exercised by the E2E rail suites; what is asserted here
// is the contract that has to hold with no DOM at all (SSR) and the pure
// height-reservation rule that stops a shorter payload shrinking the page.

describe('captureScroll', () => {
  it('is SSR-safe: returns a working no-op when there is no window', () => {
    // The vitest config runs the node environment, so `window` is genuinely
    // absent here -- this is the real SSR path, not a mock of it.
    expect(typeof window).toBe('undefined');
    const snap = captureScroll(null);
    expect(() => snap.restore()).not.toThrow();
    expect(() => snap.restoreNow()).not.toThrow();
  });

  it('always hands back both a deferred and an immediate restore', () => {
    const snap = captureScroll();
    expect(typeof snap.restore).toBe('function');
    expect(typeof snap.restoreNow).toBe('function');
  });
});

describe('reserveHeight', () => {
  it('starts null and takes the first real measurement', () => {
    expect(reserveHeight(null, 0)).toBe(null);
    expect(reserveHeight(null, 240)).toBe(240);
  });

  it('only ever GROWS within a session -- the whole point', () => {
    // A card that got shorter must not release the space the previous one
    // held, or the very next rotation tick jumps again.
    expect(reserveHeight(240, 180)).toBe(240);
    expect(reserveHeight(240, 300)).toBe(300);
    expect(reserveHeight(300, 300)).toBe(300);
  });

  it('ignores junk measurements rather than poisoning the reservation', () => {
    expect(reserveHeight(240, 0)).toBe(240);
    expect(reserveHeight(240, -50)).toBe(240);
    expect(reserveHeight(240, Number.NaN)).toBe(240);
    expect(reserveHeight(240, Number.POSITIVE_INFINITY)).toBe(240);
    expect(reserveHeight(null, Number.NaN)).toBe(null);
  });

  it('is monotonic across a whole rotation cycle', () => {
    let seen: number | null = null;
    for (const h of [200, 320, 180, 260, 90, 320]) seen = reserveHeight(seen, h);
    expect(seen).toBe(320);
  });
});
