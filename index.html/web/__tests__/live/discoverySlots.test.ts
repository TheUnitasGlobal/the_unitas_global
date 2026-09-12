import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_ROTATION,
  DISCOVERY_SLOTS,
  SLOT_PROVIDER,
  SLOT_QID,
  discoverySlotAt,
  findDiscoverySlot,
  slotTtlMs,
} from '../../lib/live/discoverySlots';
import { HUB_THEME_KEYS } from '../../lib/live/hubThemes';
import { GLOBAL_RANKING_THEMES } from '../../lib/globalRankings';
import { MODULE_REGISTRY } from '../../lib/unitasRankings';

// REV-20 SPEC.md §3 -- the unified slot registry's pure invariants: weather
// first, every slot resolvable exactly once, deterministic rotation.
// REV-21 SPEC.md §1.3 -- the two REV-19 ranking widgets join as slots (24).

describe('discovery slots registry', () => {
  it('ships exactly 24 slots: weather + 9 news + 12 feed + 2 ranking', () => {
    expect(DISCOVERY_SLOTS.length).toBe(24);
    expect(DISCOVERY_ROTATION.length).toBe(24);
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

  it('exactly 12 feed-kind slots (the REV-20 themes) and 2 ranking-kind slots (REV-21)', () => {
    expect(DISCOVERY_SLOTS.filter((s) => s.kind === 'feed').length).toBe(12);
    expect(DISCOVERY_SLOTS.filter((s) => s.kind === 'ranking').map((s) => s.key)).toEqual(['worldRanking', 'unitasRanking']);
  });

  it('ranking slots load instantly with sub-tabs and detail actions, and honour a tab cursor', async () => {
    const world = findDiscoverySlot('worldRanking')!;
    const card = await world.load({ locale: 'ko', country: 'KR' });
    expect(card.tabs?.map((t) => t.key)).toEqual(GLOBAL_RANKING_THEMES.map((t) => t.key));
    expect(card.activeTab).toBe(GLOBAL_RANKING_THEMES[0].key);
    expect(card.items.length).toBeGreaterThan(0);
    expect(card.items[0].action).toEqual({ kind: 'rankingDetail', theme: GLOBAL_RANKING_THEMES[0].key, rank: 1 });
    expect(card.facts.some((f) => f.emphasis)).toBe(true);
    const gdp = await world.load({ locale: 'en' }, { tab: 'gdp' });
    expect(gdp.activeTab).toBe('gdp');
    expect(gdp.items[0].action).toMatchObject({ theme: 'gdp' });

    const unitas = findDiscoverySlot('unitasRanking')!;
    const u = await unitas.load({ locale: 'ko', country: 'KR' });
    expect(u.tabs?.length).toBe(MODULE_REGISTRY.length);
    expect(u.items[0].action).toMatchObject({ kind: 'unitasProfile', moduleKey: MODULE_REGISTRY[0].key, rank: 1 });
    expect(u.items.every((it) => it.url === undefined)).toBe(true);
  });

  it('discoverySlotAt wraps modulo the slot count, both directions', () => {
    const n = DISCOVERY_SLOTS.length;
    expect(discoverySlotAt(n).key).toBe(discoverySlotAt(0).key);
    expect(discoverySlotAt(n + 3).key).toBe(discoverySlotAt(3).key);
    expect(discoverySlotAt(-1).key).toBe(discoverySlotAt(n - 1).key);
  });

  it('every slot has a non-empty color, an icon component and a named provider', () => {
    for (const slot of DISCOVERY_SLOTS) {
      expect(slot.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(slot.icon).toBeTruthy();
      expect(SLOT_PROVIDER[slot.key].name.length).toBeGreaterThan(0);
      expect(SLOT_PROVIDER[slot.key].url).toMatch(/^https:\/\//);
    }
  });

  it('entity anchors are Wikidata ids and the air slot points at Q7391292', () => {
    for (const qid of Object.values(SLOT_QID)) expect(qid).toMatch(/^Q\d+$/);
    expect(SLOT_QID.air).toBe('Q7391292');
  });

  it('TTL is kind-scoped: weather/news 10min, feed 15min, ranking 6h', () => {
    expect(slotTtlMs('weather')).toBe(10 * 60 * 1000);
    expect(slotTtlMs('news')).toBe(10 * 60 * 1000);
    expect(slotTtlMs('feed')).toBe(15 * 60 * 1000);
    expect(slotTtlMs('ranking')).toBe(6 * 60 * 60 * 1000);
  });
});
