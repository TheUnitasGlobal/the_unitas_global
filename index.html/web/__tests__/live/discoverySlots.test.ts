import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DISCOVERY_ROTATION,
  DISCOVERY_SLOTS,
  FX_BASE,
  FX_QUOTES,
  SLOT_ONE_TARGET,
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
  type FxCompassWidget,
  type MoonPhaseWidget,
  type OmniRadarWidget,
  type SlotKey,
} from '../../lib/live/discoverySlots';
import { AWARD_KEYS } from '../../lib/live/awardsThemes';
import { GEO_IP_STORAGE_KEY } from '../../lib/live/geoIp';
import { NOMAD_NEXUS_HUBS, offsetPoint } from '../../lib/live/omniRadar';
import { sourceById } from '../../lib/uai/sourceRegistry';

// REV-20 SPEC.md §3 -- the unified slot registry's pure invariants: weather
// first, every slot resolvable exactly once, deterministic rotation.
// REV-41 SPEC.md D-7 -- the `uRanking` slot is retired; D-2 / D-3 / D-5 --
// the one-target contract, the fx compass and the omni-radar adapters.
// REV-42 SPEC.md D-1 (founder directive 2026-09-18) -- the `air` slot is
// retired outright; `cosmos` and `gastronomy` lead the rail right after the
// visitor's own sky; D-3 -- the weather card always carries the moon.

describe('discovery slots registry', () => {
  // REV-23 M3.1: 24 -> 16 (the nine RSS news wires out, `awards` in).
  // REV-29 M3: 16 -> 17 -- the `newProducts` launch wire joins, second in
  // the rotation right after the visitor's own sky.
  // REV-35 M1: 17 -> 16 -- `uRanking` replaced `worldRanking` in place and
  // the trailing `unitasRanking` slot was deleted.
  // REV-41 D-7: 16 -> 15 -- `uRanking` retired outright.
  // REV-42 D-1: 15 -> 16 -- `air` retired outright, `cosmos` + `gastronomy` in.
  it('ships exactly 16 slots: weather + 15 feed (incl. awards + newProducts + cosmos + gastronomy)', () => {
    expect(DISCOVERY_SLOTS.length).toBe(16);
    expect(DISCOVERY_ROTATION.length).toBe(16);
  });

  it('M3 (REV-29) / REV-42 D-1: the new-products theme is a feed slot right after the three flagships with a product anchor', () => {
    const slot = findDiscoverySlot('newProducts');
    expect(slot?.kind).toBe('feed');
    expect(DISCOVERY_ROTATION[3]).toBe('newProducts');
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

  it('exactly 15 feed-kind slots (11 REV-20 themes + awards + newProducts + cosmos + gastronomy) and no third kind', () => {
    expect(DISCOVERY_SLOTS.filter((s) => s.kind === 'feed').length).toBe(15);
    for (const slot of DISCOVERY_SLOTS) expect(['weather', 'feed']).toContain(slot.kind);
  });

  // REV-42 D-1: the three flagships lead (sky, cosmos, table), the launch
  // wire follows, and the tail keeps its REV-41 order with the `air` seat
  // closed up.
  it('D-1 (REV-42): the exact sixteen-seat order -- flagships 0/1/2, newProducts 3, nation/library/nearby the tail', () => {
    expect([...DISCOVERY_ROTATION]).toEqual([
      'weather',
      'cosmos',
      'gastronomy',
      'newProducts',
      'mostRead',
      'awards',
      'history',
      'crypto',
      'quake',
      'paper',
      'fx',
      'art',
      'devPulse',
      'nation',
      'library',
      'nearby',
    ]);
    expect(DISCOVERY_ROTATION[0]).toBe('weather');
    expect(DISCOVERY_ROTATION[1]).toBe('cosmos');
    expect(DISCOVERY_ROTATION[2]).toBe('gastronomy');
    expect(DISCOVERY_ROTATION[3]).toBe('newProducts');
    expect(DISCOVERY_ROTATION[13]).toBe('nation');
    expect(DISCOVERY_ROTATION[14]).toBe('library');
    expect(DISCOVERY_ROTATION[15]).toBe('nearby');
  });

  it('the retired slots -- worldRanking, unitasRanking, uRanking and (REV-42 D-1) air -- are gone for good', () => {
    for (const key of ['worldRanking', 'unitasRanking', 'uRanking', 'air']) {
      expect(findDiscoverySlot(key as never), key).toBeUndefined();
      expect(DISCOVERY_ROTATION as readonly string[]).not.toContain(key);
      expect(key in SLOT_SOURCES, key).toBe(false);
      expect(key in SLOT_PROVIDER, key).toBe(false);
      expect(key in SLOT_QID, key).toBe(false);
    }
    expect(DISCOVERY_SLOTS.some((s) => (s.kind as string) === 'ranking')).toBe(false);
    expect(DISCOVERY_SLOTS.some((s) => (s.kind as string) === 'uRanking')).toBe(false);
  });

  // REV-41 D-2 (1-C): the single-target contract as data, and the flag on
  // every slot object in agreement with it.
  it('D-2: SLOT_ONE_TARGET names the ten URL-less slots (REV-42: -air +cosmos +gastronomy) and every slot flag agrees', () => {
    expect([...SLOT_ONE_TARGET].sort()).toEqual(['cosmos', 'crypto', 'fx', 'gastronomy', 'library', 'nation', 'nearby', 'paper', 'quake', 'weather']);
    for (const slot of DISCOVERY_SLOTS) {
      const listed = SLOT_ONE_TARGET.includes(slot.key);
      expect(slot.oneTarget === true, slot.key).toBe(listed);
    }
  });

  it('D-6: only the launch wire autoplays its tabs', () => {
    for (const slot of DISCOVERY_SLOTS) {
      expect(slot.tabAutoplay === true, slot.key).toBe(slot.key === 'newProducts');
    }
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

  it('entity anchors are Wikidata ids; cosmos is the universe (Q1), gastronomy is food (Q2095), the air anchor is gone', () => {
    for (const qid of Object.values(SLOT_QID)) expect(qid).toMatch(/^Q\d+$/);
    expect(SLOT_QID.cosmos).toBe('Q1');
    expect(SLOT_QID.gastronomy).toBe('Q2095');
    expect('air' in SLOT_QID).toBe(false);
    expect(Object.values(SLOT_QID)).not.toContain('Q7391292');
  });

  it('TTL is kind-scoped: weather 10min, feed 15min (the 6h ranking window died with its kind)', () => {
    expect(slotTtlMs('weather')).toBe(10 * 60 * 1000);
    expect(slotTtlMs('feed')).toBe(15 * 60 * 1000);
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
    // REV-41 D-3: the compass names both of its engines; Frankfurter leads.
    expect(SLOT_SOURCES.fx).toEqual(['frankfurter', 'coinGecko']);
    expect(SLOT_PROVIDER.fx.name).toBe('Frankfurter (ECB) · CoinGecko');
    expect(SLOT_PROVIDER.fx.url).toBe('https://frankfurter.dev/');
    // REV-42 D-1: both catalogues are bundled; Wikipedia is the outbound
    // corpus (and the gastronomy local-eats beam), never a card request.
    expect(SLOT_SOURCES.cosmos).toEqual(['wikipedia']);
    expect(SLOT_SOURCES.gastronomy).toEqual(['wikipedia']);
    expect('air' in SLOT_SOURCES).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* REV-42 D-1 / D-3 / D-6 / D-7: the three flagships                     */
/* ------------------------------------------------------------------ */

describe('REV-42 flagship adapters', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // D-3: the moon is computed before the forecast is asked for and rides on
  // every outcome, so a visitor whose forecast cannot be read still sees
  // tonight's moon, the lunar date and the solar term.
  it('weather carries the moon-phase widget even when the forecast fetch rejects', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const card = await findDiscoverySlot('weather')!.load({ locale: 'ko', country: 'KR' });
    expect(card.facts).toEqual([]);
    expect(card.items).toEqual([]);
    expect(card.widget?.kind).toBe('moonPhase');
    const widget = card.widget as MoonPhaseWidget;
    expect(typeof widget.nowMs).toBe('number');
    expect(widget.gregorian.m).toBeGreaterThanOrEqual(1);
    expect(widget.gregorian.m).toBeLessThanOrEqual(12);
    expect(typeof widget.phaseKey).toBe('string');
    expect(typeof widget.termKey).toBe('string');
  });

  it.each(['cosmos', 'gastronomy'] as const)('%s resolves as a one-target feed slot and loads with zero network', async (key) => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      throw new Error('no network on the card');
    });
    const slot = findDiscoverySlot(key);
    expect(slot).toBeTruthy();
    expect(slot?.kind).toBe('feed');
    expect(slot?.oneTarget).toBe(true);
    expect(slot?.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(SLOT_ONE_TARGET).toContain(key);
    const card = await slot!.load({ locale: 'ko', country: 'KR' });
    expect(Array.isArray(card.facts)).toBe(true);
    expect(Array.isArray(card.items)).toBe(true);
    expect(typeof card.updatedAt).toBe('number');
    expect(Array.isArray(card.sections)).toBe(true);
    // The card is a bundled catalogue: whatever the module renders, it never
    // reached for the network to do it.
    expect(calls).toBe(0);
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
    expect(FX_BASE).toBe('USD');
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

/* ------------------------------------------------------------------ */
/* REV-41 D-3: the fx compass adapter                                    */
/* ------------------------------------------------------------------ */

type Fetch = (input: string) => Promise<Response>;

const DATES = ['2026-08-14', '2026-09-11', '2026-09-12'];
const WINDOW: Record<string, [number, number, number]> = {
  EUR: [0.92, 0.91, 0.9],
  JPY: [150, 147, 147.1],
  GBP: [0.8, 0.79, 0.78],
  CNY: [7.2, 7.1, 7.12],
  CAD: [1.36, 1.35, 1.35],
  SEK: [10.5, 10.4, 10.4],
  CHF: [0.9, 0.88, 0.88],
  KRW: [1400, 1385, 1390.5],
};

/** Answers the quotes the request actually asked for -- shuffled, so the
 *  parser's ordering is exercised -- and a CoinGecko body unless told to fail. */
function fxFetch(opts: { coinGeckoOk?: boolean; frankfurterOk?: boolean } = {}): Fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: string) => {
    calls.push(input);
    if (input.includes('api.frankfurter.dev')) {
      if (opts.frankfurterOk === false) return new Response('', { status: 500 });
      const quotes = (new URL(input).searchParams.get('quotes') ?? '').split(',');
      const rows = quotes.flatMap((q) => (WINDOW[q] ?? []).map((rate, i) => ({ date: DATES[i], base: 'USD', quote: q, rate })));
      rows.reverse();
      return new Response(JSON.stringify(rows), { status: 200 });
    }
    if (input.includes('api.coingecko.com')) {
      if (opts.coinGeckoOk === false) return new Response('', { status: 429 });
      return new Response(
        JSON.stringify({
          bitcoin: { usd: 65000, krw: 90000000, usd_24h_change: 1.5, krw_24h_change: 1.4 },
          ethereum: { usd: 3000, krw: 4150000, usd_24h_change: -0.5 },
          'pax-gold': { usd: 2600.5, krw: 3600000 },
        }),
        { status: 200 },
      );
    }
    return new Response('', { status: 404 });
  }) as Fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}

describe('fx compass adapter (REV-41 D-3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('spends ONE Frankfurter window request and renders the home pair, the board, the index and the parity rows', async () => {
    const fetch = fxFetch();
    vi.stubGlobal('fetch', fetch);
    const card = await findDiscoverySlot('fx')!.load({ locale: 'ko', country: 'KR' });
    const fx = fetch.calls.filter((u) => u.includes('api.frankfurter.dev'));
    expect(fx).toHaveLength(1);
    const params = new URL(fx[0]).searchParams;
    expect(params.get('base')).toBe('USD');
    expect(params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const q of ['EUR', 'JPY', 'GBP', 'CNY', 'CAD', 'SEK', 'CHF', 'KRW']) expect(params.get('quotes')).toContain(q);
    expect(fetch.calls.filter((u) => u.includes('api.coingecko.com'))).toHaveLength(1);

    const widget = card.widget as FxCompassWidget;
    expect(widget.kind).toBe('fxCompass');
    expect(widget.base).toBe('USD');
    expect(widget.home).toBe('KRW');
    expect(widget.date).toBe('2026-09-12');
    expect(widget.hero.code).toBe('KRW');
    expect(widget.hero.rate).toBe(1390.5);
    expect(widget.hero.change24h).toBeCloseTo(((1390.5 - 1385) / 1385) * 100, 6);
    expect(widget.hero.change30d).toBeCloseTo(((1390.5 - 1400) / 1400) * 100, 6);
    expect(widget.hero.series.map((p) => p.date)).toEqual(DATES);
    expect(widget.majors.map((m) => m.code)).toEqual(['EUR', 'JPY', 'GBP', 'CNY']);
    expect(widget.dollarIndex).not.toBeNull();
    expect(widget.dollarIndex!.series[0].rate).toBeCloseTo(100, 9);
    expect(widget.dollarIndex!.value).toBeLessThan(100);
    expect(widget.dollarIndex!.value).toBeGreaterThan(90);
    expect(widget.parity.map((p) => p.symbol)).toEqual(['BTC', 'ETH', 'PAXG']);
    expect(widget.parity[0].home).toBe(90000000);

    // Rows, not facts: the "0건" meta line is structurally impossible now.
    expect(card.items.length).toBe(5 + 3);
    expect(card.items[0]).toMatchObject({ id: 'fx:USD/KRW', title: 'USD/KRW 1390.50', meta: '+0.40%', scope: 'country' });
    expect(card.items[0].url).toBeUndefined();
    expect(card.items.find((i) => i.id === 'fx:USD/EUR')).toMatchObject({ title: 'USD/EUR 0.9000', meta: '-1.10%', scope: 'global' });
    const btc = card.items.find((i) => i.id === 'fx:parity:bitcoin')!;
    expect(btc.title).toMatch(/^BTC .*65,000$/);
    expect(btc.meta).toMatch(/90,000,000/);
    expect(card.facts).toEqual([
      { labelKey: 'Rev41.fx.facts.home', value: 'KRW' },
      { labelKey: 'Rev41.fx.facts.pairs', value: '5' },
    ]);
    expect(card.facts.some((f) => f.emphasis)).toBe(false);
    expect(card.sections?.map((s) => s.scope)).toEqual(['global', 'country']);
    expect(card.sections?.[1].items.map((i) => i.id)).toEqual(['fx:USD/KRW']);
  });

  it('falls back to EUR as the hero for a USD visitor and keeps the card global-only', async () => {
    vi.stubGlobal('fetch', fxFetch());
    const card = await findDiscoverySlot('fx')!.load({ locale: 'en', country: 'US' });
    const widget = card.widget as FxCompassWidget;
    expect(widget.home).toBe('EUR');
    expect(widget.hero.code).toBe('EUR');
    expect(card.items[0]).toMatchObject({ id: 'fx:USD/EUR', scope: 'global' });
    expect(card.items.filter((i) => i.id.startsWith('fx:USD/')).map((i) => i.id)).toEqual(['fx:USD/EUR', 'fx:USD/JPY', 'fx:USD/GBP', 'fx:USD/CNY']);
    expect(card.sections?.map((s) => s.scope)).toEqual(['global']);
    expect(card.facts[1]).toEqual({ labelKey: 'Rev41.fx.facts.pairs', value: '4' });
  });

  it('survives CoinGecko failing (no parity rows) and yields the empty card when Frankfurter fails', async () => {
    vi.stubGlobal('fetch', fxFetch({ coinGeckoOk: false }));
    const noParity = await findDiscoverySlot('fx')!.load({ locale: 'ko', country: 'KR' });
    expect((noParity.widget as FxCompassWidget).parity).toEqual([]);
    expect(noParity.items.length).toBe(5);
    vi.unstubAllGlobals();

    vi.stubGlobal('fetch', fxFetch({ frankfurterOk: false }));
    const empty = await findDiscoverySlot('fx')!.load({ locale: 'ko', country: 'KR' });
    expect(empty.facts).toEqual([]);
    expect(empty.items).toEqual([]);
    expect(empty.widget).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* REV-41 D-5: the omni-radar adapter                                    */
/* ------------------------------------------------------------------ */

interface BeamPage {
  pageid: number;
  title: string;
  description?: string;
  coordinates?: Array<{ lat: number; lon: number }>;
}

/** Answers every Wikipedia beam with pages laid out around the beam's own
 *  centre (read back from `ggscoord`), so the hits are the same whatever
 *  place the adapter resolved -- including one page 1 m past 10 km. */
function radarFetch(opts: { fail?: boolean; pages?: (centre: { lat: number; lon: number }) => BeamPage[] } = {}): Fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: string) => {
    calls.push(input);
    if (!input.includes('generator=geosearch')) return new Response('', { status: 404 });
    if (opts.fail) return new Response('', { status: 503 });
    const [lat, lon] = (new URL(input).searchParams.get('ggscoord') ?? '0|0').split('|').map(Number);
    const centre = { lat, lon };
    const pages = opts.pages ? opts.pages(centre) : [];
    const byId: Record<string, BeamPage> = {};
    for (const p of pages) byId[String(p.pageid)] = p;
    return new Response(JSON.stringify({ query: { pages: byId } }), { status: 200 });
  }) as Fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}

const ring = (centre: { lat: number; lon: number }): BeamPage[] => [
  { pageid: 1, title: '국립중앙박물관', description: '박물관', coordinates: [offsetPoint(centre.lat, centre.lon, 90, 2)] },
  { pageid: 2, title: '카페 거리', description: '카페', coordinates: [offsetPoint(centre.lat, centre.lon, 180, 9.9)] },
  { pageid: 3, title: '너무 먼 곳', coordinates: [offsetPoint(centre.lat, centre.lon, 270, 10.001)] },
  { pageid: 4, title: '좌표 없음' },
];

describe('omni-radar adapter (REV-41 D-5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('10 km = one beam; every blip is haversine-measured and a hit 1 m outside is dropped', async () => {
    const fetch = radarFetch({ pages: ring });
    vi.stubGlobal('fetch', fetch);
    const card = await findDiscoverySlot('nearby')!.load({ locale: 'ko', country: 'KR' });
    // Two blips is under RADAR_SPARSE_FLOOR, so the one local beam is
    // followed by the one English relief beam (same centre, same limit);
    // its pages sit on the same coordinates and collapse into the local ones.
    expect(fetch.calls).toHaveLength(2);
    expect(fetch.calls[0]).toContain('ko.wikipedia.org');
    expect(fetch.calls[0]).toContain('ggsradius=10000');
    expect(fetch.calls[0]).toContain('ggslimit=50');
    expect(fetch.calls[1]).toContain('en.wikipedia.org');
    expect(fetch.calls[1]).toContain('ggslimit=50');
    const widget = card.widget as OmniRadarWidget;
    expect(widget.kind).toBe('omniRadar');
    expect(widget.radiusKey).toBe('r10');
    expect(widget.radiusKm).toBe(10);
    expect(widget.beams).toBe(2);
    expect(widget.failedBeams).toBe(0);
    expect(widget.blips.map((b) => b.title)).toEqual(['국립중앙박물관', '카페 거리']);
    for (const b of widget.blips) expect(b.distKm).toBeLessThanOrEqual(10);
    expect(widget.blips[0].lens).toBe('inspiration');
    expect(widget.blips[1].lens).toBe('nomad');
    expect(widget.blips[0].bearing).toBeCloseTo(90, 6);
    expect(card.items.map((i) => i.meta)).toEqual(['2.0km', '9.9km']);
    expect(card.items[0].url).toContain('ko.wikipedia.org/wiki/');
    expect(card.tabs?.map((t) => t.key)).toEqual(['r10', 'r50', 'r100', 'global']);
    expect(card.tabs?.map((t) => t.labelKey)).toEqual(['Rev41.nearby.radius.r10', 'Rev41.nearby.radius.r50', 'Rev41.nearby.radius.r100', 'Rev41.nearby.radius.global']);
    expect(new Set(card.tabs?.map((t) => t.color)).size).toBe(4);
    expect(card.activeTab).toBe('r10');
    expect(card.facts).toEqual([
      { labelKey: 'Rev41.nearby.facts.radius', value: '10km' },
      { labelKey: 'Rev41.nearby.facts.detected', value: '2' },
      { labelKey: 'Rev41.nearby.facts.nearest', value: '2.0km' },
      { labelKey: 'Rev41.nearby.facts.beams', value: '2' },
    ]);
    expect(card.sections?.map((s) => s.scope)).toEqual(['country']);
  });

  it('50 km sweeps seven beams in parallel and de-duplicates the article every beam returned', async () => {
    const fetch = radarFetch({ pages: ring });
    vi.stubGlobal('fetch', fetch);
    const card = await findDiscoverySlot('nearby')!.load({ locale: 'ko', country: 'KR' }, { tab: 'r50' });
    // Seven local beams, then -- three blips being sparse -- seven English
    // relief beams whose pages collapse onto the local ones by position.
    expect(fetch.calls).toHaveLength(14);
    expect(fetch.calls.slice(0, 7).every((u) => u.includes('ko.wikipedia.org'))).toBe(true);
    expect(fetch.calls.slice(7).every((u) => u.includes('en.wikipedia.org'))).toBe(true);
    const widget = card.widget as OmniRadarWidget;
    expect(widget.radiusKm).toBe(50);
    expect(widget.beams).toBe(14);
    // Same page ids from every beam collapse to one blip each; the ring
    // beams sit 32 km out so their pages land 22-42 km from the visitor.
    expect(new Set(widget.blips.map((b) => b.id)).size).toBe(widget.blips.length);
    expect(widget.blips.map((b) => b.id)).toEqual(['wiki:ko:1', 'wiki:ko:2', 'wiki:ko:3']);
    for (const b of widget.blips) expect(b.distKm).toBeLessThanOrEqual(50);
    expect(card.activeTab).toBe('r50');
    expect(card.facts[0]).toEqual({ labelKey: 'Rev41.nearby.facts.radius', value: '50km' });
    expect(card.facts[3]).toEqual({ labelKey: 'Rev41.nearby.facts.beams', value: '14' });
  });

  // Sparse-region relief: the English leg runs only under the floor, only
  // when at least one local beam answered, and adds only what the locale
  // wiki did not already place within 50 m.
  it('tops up a sparse locale sweep from English Wikipedia, and never spends the leg on a dense one or an English reader', async () => {
    const dense = (centre: { lat: number; lon: number }): BeamPage[] =>
      Array.from({ length: 9 }, (_, i) => ({ pageid: 100 + i, title: `Spot ${i}`, coordinates: [offsetPoint(centre.lat, centre.lon, i * 40, 1 + i * 0.5)] }));
    const denseFetch = radarFetch({ pages: dense });
    vi.stubGlobal('fetch', denseFetch);
    const denseCard = await findDiscoverySlot('nearby')!.load({ locale: 'ko', country: 'KR' });
    expect(denseFetch.calls).toHaveLength(1);
    expect((denseCard.widget as OmniRadarWidget).blips).toHaveLength(9);
    expect((denseCard.widget as OmniRadarWidget).beams).toBe(1);
    vi.unstubAllGlobals();

    // An English reader has no second edition to lean on.
    const enFetch = radarFetch({ pages: ring });
    vi.stubGlobal('fetch', enFetch);
    const enCard = await findDiscoverySlot('nearby')!.load({ locale: 'en', country: 'US' });
    expect(enFetch.calls).toHaveLength(1);
    expect(enFetch.calls[0]).toContain('en.wikipedia.org');
    expect((enCard.widget as OmniRadarWidget).blips).toHaveLength(2);
    vi.unstubAllGlobals();

    // A sparse ko sweep: ko.wikipedia answers the ring, en.wikipedia answers
    // two pages of its own -- the English leg adds the place the locale wiki
    // lacks (new coordinates) and drops the twin of one it already has.
    const koFetch = radarFetch({ pages: ring });
    const enFetch2 = radarFetch({
      pages: (centre) => [
        { pageid: 7, title: 'Hidden Garden', description: 'botanical garden', coordinates: [offsetPoint(centre.lat, centre.lon, 45, 4)] },
        { pageid: 8, title: 'National Museum of Korea', description: 'museum', coordinates: [offsetPoint(centre.lat, centre.lon, 90, 2.02)] },
      ],
    });
    vi.stubGlobal('fetch', (input: string) => (input.includes('en.wikipedia.org') ? enFetch2(input) : koFetch(input)));
    const card = await findDiscoverySlot('nearby')!.load({ locale: 'ko', country: 'KR' });
    expect(koFetch.calls).toHaveLength(1);
    expect(enFetch2.calls).toHaveLength(1);
    const widget = card.widget as OmniRadarWidget;
    expect(widget.beams).toBe(2);
    expect(widget.failedBeams).toBe(0);
    // The two ko blips, plus only the English page on a spot the local sweep
    // did not cover; the museum twin (20 m off the ko one, well inside
    // 50 m) is dropped, and the ko page keeps its own title and link.
    expect(widget.blips.map((b) => b.id)).toEqual(['wiki:ko:1', 'wiki:en:7', 'wiki:ko:2']);
    expect(widget.blips.find((b) => b.id === 'wiki:en:7')?.title).toBe('Hidden Garden');
    expect(widget.blips.find((b) => b.id === 'wiki:en:7')?.lens).toBe('inspiration');
    expect(widget.blips.some((b) => b.id === 'wiki:en:8')).toBe(false);
    expect(card.items[0].url).toContain('ko.wikipedia.org/wiki/');
    for (const b of widget.blips) expect(b.distKm).toBeLessThanOrEqual(10);
  });

  it('every beam failing yields the empty card WITH the widget so the renderer can say unreadable', async () => {
    vi.stubGlobal('fetch', radarFetch({ fail: true }));
    const card = await findDiscoverySlot('nearby')!.load({ locale: 'ko', country: 'KR' }, { tab: 'r100' });
    expect(card.facts).toEqual([]);
    expect(card.items).toEqual([]);
    const widget = card.widget as OmniRadarWidget;
    expect(widget.beams).toBe(13);
    expect(widget.failedBeams).toBe(13);
    expect(widget.blips).toEqual([]);
    expect(card.tabs).toHaveLength(4);
    expect(card.activeTab).toBe('r100');
  });

  it('Global is the sixteen-hub constellation with zero network, six rows on the card and all of them deep', async () => {
    const fetch = radarFetch({ fail: true });
    vi.stubGlobal('fetch', fetch);
    const card = await findDiscoverySlot('nearby')!.load({ locale: 'ko', country: 'KR' }, { tab: 'global' });
    expect(fetch.calls).toHaveLength(0);
    const widget = card.widget as OmniRadarWidget;
    expect(widget.radiusKey).toBe('global');
    expect(widget.radiusKm).toBeNull();
    expect(widget.beams).toBe(0);
    expect(widget.blips).toHaveLength(NOMAD_NEXUS_HUBS.length);
    expect(widget.blips[0].title).toBe('Seoul');
    expect(card.items).toHaveLength(6);
    expect(card.items[0].meta).toMatch(/m$/);
    expect(card.facts[0]).toEqual({ labelKey: 'Rev41.nearby.radius.global', value: '' });
    expect(card.facts.some((f) => f.labelKey === 'Rev41.nearby.facts.beams')).toBe(false);
    const deep = await findDiscoverySlot('nearby')!.load({ locale: 'ko', country: 'KR' }, { tab: 'global', deep: 1 });
    expect(deep.items).toHaveLength(16);
  });

  // REV-41 D-4: with no weather search on record the radar centres on the
  // Geo-IP fix -- the visitor's real city -- unless the selected country
  // says otherwise, in which case that country's capital wins as before.
  it('centres on the Geo-IP fix when the weather cache is empty, filtered through the selected country', async () => {
    const store: Record<string, string> = {
      [GEO_IP_STORAGE_KEY]: JSON.stringify({ country: 'PT', lat: 38.7223, lon: -9.1393, city: 'Lisbon', at: Date.now() }),
    };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal('fetch', radarFetch({ pages: ring }));
    const lisbon = await findDiscoverySlot('nearby')!.load({ locale: 'ko', country: 'PT' });
    expect((lisbon.widget as OmniRadarWidget).center).toEqual({ lat: 38.7223, lon: -9.1393, name: 'Lisbon' });
    const seoul = await findDiscoverySlot('nearby')!.load({ locale: 'ko', country: 'KR' });
    expect((seoul.widget as OmniRadarWidget).center.name).not.toBe('Lisbon');
    expect((seoul.widget as OmniRadarWidget).center.lat).toBeCloseTo(37.57, 1);
  });

  it('SlotKey is closed over the sixteen keys', () => {
    const keys: SlotKey[] = [...DISCOVERY_ROTATION];
    expect(keys).toHaveLength(16);
  });
});
