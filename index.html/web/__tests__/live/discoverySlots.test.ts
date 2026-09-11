import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_ROTATION,
  DISCOVERY_SLOTS,
  discoverySlotAt,
  findDiscoverySlot,
  slotTtlMs,
} from '../../lib/live/discoverySlots';
import { HUB_THEME_KEYS } from '../../lib/live/hubThemes';

// REV-20 SPEC.md §3 -- the unified 22-slot registry's pure invariants:
// weather first, every slot resolvable exactly once, deterministic rotation.

describe('discovery slots registry', () => {
  it('ships exactly 22 slots: weather + the 9 REV-19 news themes + 12 REV-20 feed themes', () => {
    expect(DISCOVERY_SLOTS.length).toBe(22);
    expect(DISCOVERY_ROTATION.length).toBe(22);
  });

  it('every rotation key resolves to a registered slot with a matching key, no duplicates', () => {
    const seen = new Set<string>();
    for (const key of DISCOVERY_ROTATION) {
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      const slot = findDiscoverySlot(key);
      expect(slot).toBeTruthy();
      expect(slot?.key).toBe(key);
    }
  });

  it('weather is slot 0 -- SSR and CSR must always agree on the first frame', () => {
    expect(DISCOVERY_ROTATION[0]).toBe('weather');
    expect(discoverySlotAt(0).key).toBe('weather');
    expect(DISCOVERY_SLOTS[0].kind).toBe('weather');
  });

  it('every REV-19 hub theme still has a slot, each kind "news"', () => {
    for (const key of HUB_THEME_KEYS) {
      const slot = findDiscoverySlot(key);
      expect(slot).toBeTruthy();
      expect(slot?.kind).toBe('news');
    }
  });

  it('exactly 12 feed-kind slots (the new REV-20 themes)', () => {
    expect(DISCOVERY_SLOTS.filter((s) => s.kind === 'feed').length).toBe(12);
  });

  it('discoverySlotAt wraps modulo the slot count, both directions', () => {
    const n = DISCOVERY_SLOTS.length;
    expect(discoverySlotAt(n).key).toBe(discoverySlotAt(0).key);
    expect(discoverySlotAt(n + 3).key).toBe(discoverySlotAt(3).key);
    expect(discoverySlotAt(-1).key).toBe(discoverySlotAt(n - 1).key);
  });

  it('every slot has a non-empty color and an icon component', () => {
    for (const slot of DISCOVERY_SLOTS) {
      expect(slot.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(slot.icon).toBeTruthy();
    }
  });

  it('TTL is kind-scoped: weather/news 10min, feed 15min', () => {
    expect(slotTtlMs('weather')).toBe(10 * 60 * 1000);
    expect(slotTtlMs('news')).toBe(10 * 60 * 1000);
    expect(slotTtlMs('feed')).toBe(15 * 60 * 1000);
  });
});
