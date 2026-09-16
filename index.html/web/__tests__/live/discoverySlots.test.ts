import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_ROTATION,
  DISCOVERY_SLOTS,
  FX_QUOTES,
  SLOT_PROVIDER,
  SLOT_QID,
  SLOT_SOURCES,
  discoverySlotAt,
  findDiscoverySlot,
  frankfurterRatesUrl,
  isoDaysAgo,
  parseFrankfurterSeries,
  parseFrankfurterV2,
  slotTtlMs,
} from '../../lib/live/discoverySlots';
import { AWARD_KEYS } from '../../lib/live/awardsThemes';
import { U_RANKINGS_COUNT, uRankDayIndex, uRankingsFor } from '../../lib/square/uRankings';
import { MODULE_REGISTRY } from '../../lib/module-registry';
import { sourceById } from '../../lib/uai/sourceRegistry';

// REV-20 SPEC.md §3 -- the unified slot registry's pure invariants: weather
// first, every slot resolvable exactly once, deterministic rotation.
// REV-35 SPEC.md D-1 -- the two ranking slots are gone; the one `uRanking`
// slot (the U-Square 유랭킹 rail) sits where the world ranking was.

describe('discovery slots registry', () => {
  // REV-23 M3.1: 24 -> 16 (the nine RSS news wires out, `awards` in).
  // REV-29 M3: 16 -> 17 -- the `newProducts` launch wire joins, second in
  // the rotation right after the visitor's own sky.
  // REV-35 M1: 17 -> 16 -- `uRanking` replaces `worldRanking` in place and
  // the trailing `unitasRanking` slot is deleted.
  it('ships exactly 16 slots: weather + 14 feed (incl. awards + newProducts) + 1 uRanking', () => {
    expect(DISCOVERY_SLOTS.length).toBe(16);
    expect(DISCOVERY_ROTATION.length).toBe(16);
  });

  it('M3 (REV-29): the new-products theme is a feed slot in second position with a product anchor', () => {
    const slot = findDiscoverySlot('newProducts');
    expect(slot?.kind).toBe('feed');
    expect(DISCOVERY_ROTATION[1]).toBe('newProducts');
    expect(SLOT_QID.newProducts).toBe('Q2424752');
    expect(SLOT_SOURCES.newProducts).toEqual(['wikipedia']);
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

  // REV-23 M3.1: the nine RSS news wires are OFF this rail -- they were the
  // same Google/Bing material the 실시간 뉴스 rail below already carried.
  it('carries no news wire any more: the nine hub themes have no slot', () => {
    for (const key of ['game', 'sports', 'movie', 'bestseller', 'shopping', 'stock', 'webtoon', 'fashion', 'food']) {
      expect(findDiscoverySlot(key as never), key).toBeUndefined();
      expect(DISCOVERY_ROTATION as readonly string[]).not.toContain(key);
    }
    expect(DISCOVERY_SLOTS.some((s) => (s.kind as string) === 'news')).toBe(false);
  });

  it('M3.4: the awards theme is on the rail and knows all sixteen prizes', () => {
    const slot = findDiscoverySlot('awards');
    expect(slot?.kind).toBe('feed');
    expect(DISCOVERY_ROTATION).toContain('awards');
    expect(AWARD_KEYS).toHaveLength(16);
    expect(new Set(AWARD_KEYS).size).toBe(16);
  });

  it('exactly 14 feed-kind slots (12 REV-20 themes + awards + newProducts) and 1 uRanking-kind slot', () => {
    expect(DISCOVERY_SLOTS.filter((s) => s.kind === 'feed').length).toBe(14);
    expect(DISCOVERY_SLOTS.filter((s) => s.kind === 'uRanking').map((s) => s.key)).toEqual(['uRanking']);
  });

  // REV-35 M1 (D-1 / D-6): the one leaderboard sits in the world ranking's
  // old seat, opens UNITAS' own activity index and is the only slot whose
  // items carry an in-app action.
  it('the uRanking slot takes index 12, is its own kind and names the UNITAS index as its source', () => {
    expect(DISCOVERY_ROTATION[12]).toBe('uRanking');
    expect(findDiscoverySlot('uRanking')?.kind).toBe('uRanking');
    expect(SLOT_SOURCES.uRanking).toEqual(['unitasIndex']);
    expect(SLOT_PROVIDER.uRanking.name).toBe(sourceById('unitasIndex').displayName.en);
    expect(SLOT_QID.uRanking).toBeUndefined();
  });

  it('the retired ranking slots are gone from the registry and the rotation for good', () => {
    for (const key of ['worldRanking', 'unitasRanking']) {
      expect(findDiscoverySlot(key as never), key).toBeUndefined();
      expect(DISCOVERY_ROTATION as readonly string[]).not.toContain(key);
    }
    expect(DISCOVERY_SLOTS.some((s) => (s.kind as string) === 'ranking')).toBe(false);
  });

  it('the uRanking slot loads the twelve seeded entries instantly, each with a uRankEntry action and a stable id', async () => {
    const slot = findDiscoverySlot('uRanking')!;
    const card = await slot.load({ locale: 'ko', country: 'KR' });
    const ladder = uRankingsFor(uRankDayIndex());
    expect(card.items.length).toBe(U_RANKINGS_COUNT);
    expect(card.items.map((it) => it.id)).toEqual(ladder.map((e) => e.id));
    expect(card.items.map((it) => it.title)).toEqual(ladder.map((e) => e.name));
    expect(card.items.map((it) => it.rank)).toEqual(ladder.map((e) => e.rank));
    for (const item of card.items) {
      expect(item.action).toEqual({ kind: 'uRankEntry', id: item.id });
      expect(item.url).toBeUndefined();
      expect(MODULE_REGISTRY.some((m) => item.meta?.endsWith(m.key))).toBe(true);
    }
    // The card body is the rail itself: nothing sits between the title row
    // and the cards, and the sections wrapper still yields one global group.
    expect(card.facts).toEqual([]);
    expect(card.tabs).toBeUndefined();
    expect(card.subject).toEqual({ term: 'UNITAS' });
    expect(card.sections?.map((s) => s.scope)).toEqual(['global']);
    // Deterministic: the same UTC day yields the same ids on every call.
    const again = await slot.load({ locale: 'en' });
    expect(again.items.map((it) => it.id)).toEqual(card.items.map((it) => it.id));
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

  it('TTL is kind-scoped: weather 10min, feed 15min, uRanking 6h (the retired ranking window, D-6)', () => {
    expect(slotTtlMs('weather')).toBe(10 * 60 * 1000);
    expect(slotTtlMs('feed')).toBe(15 * 60 * 1000);
    expect(slotTtlMs('uRanking')).toBe(6 * 60 * 60 * 1000);
  });

  // The provider row derives from the source registry -- never a synthetic
  // hand-written label.
  it('derives every provider from the source registry', () => {
    for (const slot of DISCOVERY_SLOTS) {
      const ids = SLOT_SOURCES[slot.key];
      expect(ids.length, slot.key).toBeGreaterThan(0);
      for (const id of ids) expect(sourceById(id), `${slot.key}:${id}`).toBeTruthy();
      expect(SLOT_PROVIDER[slot.key].sources).toBe(ids);
      expect(SLOT_PROVIDER[slot.key].url).toBe(sourceById(ids[0]).homepage);
    }
    expect(SLOT_PROVIDER.awards.sources).toEqual(['wikidata']);
    expect(SLOT_PROVIDER.fx.name).toBe('Frankfurter (ECB)');
    expect(SLOT_PROVIDER.fx.url).toBe('https://frankfurter.dev/');
  });
});

// REV-21 D-26: Frankfurter v1 (api.frankfurter.app) answers with a
// Deprecation header; the fx slot moved to the v2 host and shape.
describe('Frankfurter v2', () => {
  const live = [
    { date: '2026-09-13', base: 'USD', quote: 'EUR', rate: 0.86094 },
    { date: '2026-09-13', base: 'USD', quote: 'GBP', rate: 0.73895 },
    { date: '2026-09-13', base: 'USD', quote: 'JPY', rate: 154.08 },
    { date: '2026-09-12', base: 'USD', quote: 'KRW', rate: 1343.37 },
  ];

  it('builds v2 URLs on the .dev host with `quotes`, never the deprecated .app host', () => {
    const url = frankfurterRatesUrl('USD', FX_QUOTES);
    expect(url).toBe('https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR%2CJPY%2CGBP%2CKRW');
    expect(frankfurterRatesUrl('USD', ['EUR'], '2026-09-01', '2026-09-10')).toContain('&from=2026-09-01&to=2026-09-10');
    expect(url).not.toContain('frankfurter.app');
  });

  it('parses the flat row array back into the requested quote order with the newest date', () => {
    const parsed = parseFrankfurterV2(live, FX_QUOTES);
    expect(parsed?.base).toBe('USD');
    expect(parsed?.date).toBe('2026-09-13');
    expect(parsed?.pairs.map((p) => p.code)).toEqual(['EUR', 'JPY', 'GBP', 'KRW']);
    expect(parsed?.pairs[3]).toEqual({ code: 'KRW', rate: 1343.37, date: '2026-09-12' });
    expect(parseFrankfurterV2({ amount: 1, rates: { EUR: 0.86 } }, FX_QUOTES)).toBeNull(); // the v1 shape is rejected
    expect(parseFrankfurterV2([], FX_QUOTES)).toBeNull();
  });

  it('turns a from/to window into a date-ordered series for one quote', () => {
    const series = parseFrankfurterSeries(
      [
        { date: '2026-09-03', base: 'USD', quote: 'EUR', rate: 0.86186 },
        { date: '2026-09-01', base: 'USD', quote: 'EUR', rate: 0.86203 },
        { date: '2026-09-02', base: 'USD', quote: 'KRW', rate: 1390 },
        { date: '2026-09-02', base: 'USD', quote: 'EUR', rate: 0.86291 },
      ],
      'EUR',
    );
    expect(series.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(isoDaysAgo(30, Date.UTC(2026, 8, 13))).toBe('2026-08-14');
  });
});
