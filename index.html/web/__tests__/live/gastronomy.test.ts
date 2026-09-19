import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COUNTRY_DISHES,
  FLAVOR_KEYS,
  FOOD_SCIENCE,
  FOOD_TRENDS,
  GASTRO_LOCAL_MAX_ITEMS,
  GASTRO_LOCAL_STORAGE_KEY,
  GASTRO_LOCAL_VERSION,
  I18N_ITEM_PREFIX,
  MEAL_SLOTS,
  TRENDING_POOL,
  buildGastronomyCard,
  dishesFor,
  foodScienceOf,
  gastroPlaceKey,
  globalDishPicks,
  isFoodPlace,
  loadLocalEats,
  localHourAt,
  mealSlotOf,
  regionName,
  sunAreaDays,
  trendingPick,
  trendsForDay,
  type MealSlot,
} from '@/lib/live/gastronomy';
import type { StorageLike } from '@/lib/live/weatherDeep';

// REV-42 SPEC.md D-7 / §4-A (founder directive 2026-09-18, mission 3) --
// the gastronomy catalogue pinned without a network: the 24 / 10 / 30x2 /
// 8 / 10 / 5 key sets the content lane translated, the meal-slot clock, the
// day-seeded rotations, the sunlight arithmetic, the multilingual food-place
// filter, the one Wikipedia beam under a stubbed fetch, and the card shape
// the carousel renders. Source scan: no Math.random, no Date.now.

const SEOUL = { lat: 37.5665, lon: 126.978 };
const NOW = Date.UTC(2026, 8, 18, 3); // 2026-09-18T03:00Z = 12:00 solar at 127°E
const DAY = Math.floor(NOW / 86_400_000);

/** A storage double the cache helpers accept. */
function memoryStorage(seed: Record<string, string> = {}): StorageLike & { store: Record<string, string> } {
  const store = { ...seed };
  return {
    store,
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => {
      store[k] = v;
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
}

interface GeoPage {
  pageid: number;
  title: string;
  description?: string;
  coordinates?: Array<{ lat: number; lon: number }>;
}

function geoJson(pages: GeoPage[]) {
  return { batchcomplete: '', query: { pages: Object.fromEntries(pages.map((p) => [String(p.pageid), p])) } };
}

function okFetch(body: unknown) {
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    return { ok: true, json: async () => body };
  };
  return Object.assign(fetch, { calls });
}

const RING: GeoPage[] = [
  { pageid: 11, title: '광장시장', description: '서울 종로구의 전통 시장', coordinates: [{ lat: 37.5701, lon: 126.9996 }] },
  { pageid: 12, title: '남산공원', description: '서울의 공원', coordinates: [{ lat: 37.5512, lon: 126.9882 }] },
  { pageid: 13, title: '을지면옥', description: '냉면 식당', coordinates: [{ lat: 37.5665, lon: 126.9915 }] },
  { pageid: 14, title: '국립중앙박물관', description: '박물관', coordinates: [{ lat: 37.5239, lon: 126.9804 }] },
  { pageid: 15, title: 'Coffee Libre', description: 'café in Seoul', coordinates: [{ lat: 37.5589, lon: 126.9367 }] },
  { pageid: 16, title: 'No coordinates', description: '맛집' },
  { pageid: 17, title: '통인시장', description: '서촌의 시장', coordinates: [{ lat: 37.5803, lon: 126.9699 }] },
  { pageid: 18, title: '망원시장', description: '마포구의 시장', coordinates: [{ lat: 37.5559, lon: 126.9058 }] },
  { pageid: 19, title: '남대문시장', description: '', coordinates: [{ lat: 37.5592, lon: 126.9774 }] },
  { pageid: 20, title: '이태원 제과', description: '빵집', coordinates: [{ lat: 37.5345, lon: 126.9946 }] },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gastronomy · catalogue integrity (SPEC §4-A)', () => {
  it('ships 24 trending plates, 10 trends, 30 countries x 2 dishes, 8 science rows, 10 flavours, 5 meal slots', () => {
    expect(TRENDING_POOL).toHaveLength(24);
    expect(FOOD_TRENDS).toHaveLength(10);
    expect(Object.keys(COUNTRY_DISHES)).toHaveLength(30);
    for (const [cc, keys] of Object.entries(COUNTRY_DISHES)) {
      expect(cc).toMatch(/^[A-Z]{2}$/);
      expect(keys).toHaveLength(2);
      expect(new Set(keys).size).toBe(2);
    }
    expect(FOOD_SCIENCE).toHaveLength(8);
    expect(FLAVOR_KEYS).toHaveLength(10);
    expect(MEAL_SLOTS).toHaveLength(5);
    for (const arr of [TRENDING_POOL.map((d) => d.key), FOOD_TRENDS, FOOD_SCIENCE.map((s) => s.key), FLAVOR_KEYS, MEAL_SLOTS]) {
      expect(new Set(arr).size).toBe(arr.length);
    }
  });

  it('matches the SPEC §4-A trending rows exactly (key · originCc · mealSlots · flavour · ingredient)', () => {
    const rows = TRENDING_POOL.map((d) => `${d.key} ${d.originCc} ${d.mealSlots.join(',')} ${d.flavorKey} ${d.ingredientKey}`);
    expect(rows).toEqual([
      'bibimbap KR noon,evening umami rice',
      'kimchiJjigae KR noon,evening,night fermented cabbageFerment',
      'tteokbokki KR afternoon,night spicy rice',
      'ramen JP noon,night umami wheat',
      'sushi JP noon,evening fresh rice',
      'onigiri JP morning,afternoon fresh rice',
      'dimSum CN morning,noon umami wheat',
      'mapoTofu CN noon,evening spicy chili',
      'pho VN morning,noon herbal rice',
      'banhMi VN morning,noon fresh wheat',
      'padThai TH noon,evening sweet rice',
      'tomYum TH evening,night sour chili',
      'nasiGoreng ID morning,noon smoky rice',
      'tacosAlPastor MX evening,night smoky maize',
      'neapolitanPizza IT evening,night rich wheat',
      'cacioEPepe IT evening rich wheat',
      'croissant FR morning rich wheat',
      'shakshuka TN morning,noon sour tomato',
      'avocadoToast AU morning fresh wheat',
      'flatWhite AU morning,afternoon bitter coffee',
      'pourOverCoffee ET afternoon bitter coffee',
      'darkChocolate EC afternoon bitter cacao',
      'greekSalad GR noon,evening fresh tomato',
      'birria MX noon,night rich chili',
    ]);
  });

  it('every trending row points at a science row, a flavour and real meal slots, with an English label and an ISO-2 origin', () => {
    const scienceKeys = new Set(FOOD_SCIENCE.map((s) => s.key));
    for (const dish of TRENDING_POOL) {
      expect(scienceKeys.has(dish.ingredientKey), dish.key).toBe(true);
      expect(foodScienceOf(dish.ingredientKey)?.key).toBe(dish.ingredientKey);
      expect(FLAVOR_KEYS).toContain(dish.flavorKey);
      expect(dish.mealSlots.length).toBeGreaterThan(0);
      for (const slot of dish.mealSlots) expect(MEAL_SLOTS).toContain(slot);
      expect(dish.originCc).toMatch(/^[A-Z]{2}$/);
      expect(dish.label.trim().length).toBeGreaterThan(0);
      expect(dish.key).toMatch(/^[a-z][A-Za-z]*$/);
    }
    expect(foodScienceOf('olive')).toBeUndefined();
  });

  it('science rows carry the §4-A pathway and kcal/100 g reference values', () => {
    expect(FOOD_SCIENCE.map((s) => `${s.key} ${s.pathway} ${s.kcalPer100g}`)).toEqual([
      'rice c3 130',
      'wheat c3 265',
      'maize c4 218',
      'coffee c3 2',
      'cacao c3 598',
      'chili c3 40',
      'tomato c3 18',
      'cabbageFerment c3 15',
    ]);
  });

  it('the trends and the 30 countries are the §4-A lists', () => {
    expect([...FOOD_TRENDS]).toEqual([
      'fermentation',
      'plantForward',
      'hyperLocal',
      'zeroWaste',
      'koreanWave',
      'regenerative',
      'functionalDrinks',
      'fireCooking',
      'thirdWaveCoffee',
      'nightMarkets',
    ]);
    expect(Object.keys(COUNTRY_DISHES).sort()).toEqual(
      ['KR', 'JP', 'CN', 'US', 'EE', 'ES', 'KH', 'FR', 'DE', 'PT', 'VN', 'ID', 'RU', 'IN', 'IT', 'TR', 'TH', 'PL', 'NL', 'PH', 'GB', 'MX', 'BR', 'AR', 'GR', 'EG', 'MA', 'ET', 'PE', 'AU'].sort(),
    );
    expect(COUNTRY_DISHES.KR).toEqual(['kimchi', 'samgyetang']);
    expect(COUNTRY_DISHES.EE).toEqual(['mulgikapsad', 'kama']);
    expect(COUNTRY_DISHES.AU).toEqual(['meatPie', 'lamington']);
  });

  it('the catalogue keys resolve in the en draft (docs/rev42/i18n/en.json)', () => {
    const draft = JSON.parse(readFileSync(fileURLToPath(new URL('../../../docs/rev42/i18n/en.json', import.meta.url)), 'utf8')) as {
      Rev42: { gastronomy: Record<string, Record<string, unknown>> };
    };
    const g = draft.Rev42.gastronomy;
    for (const dish of TRENDING_POOL) {
      expect(g.trending[dish.key], dish.key).toBeTruthy();
      expect(g.flavors[dish.flavorKey], dish.flavorKey).toBeTruthy();
    }
    for (const key of FOOD_TRENDS) expect(g.trends[key], key).toBeTruthy();
    for (const [cc, keys] of Object.entries(COUNTRY_DISHES)) {
      for (const key of keys) expect((g.dishes[cc] as Record<string, unknown> | undefined)?.[key], `${cc}.${key}`).toBeTruthy();
    }
    for (const row of FOOD_SCIENCE) {
      expect(g.science[row.key], row.key).toBeTruthy();
      expect(g.pathway[row.pathway], row.pathway).toBeTruthy();
    }
    for (const slot of MEAL_SLOTS) expect(g.mealSlots[slot], slot).toBeTruthy();
    expect(g.sections.localEatsFallback).toBeTruthy();
    expect(g.trendMeta).toBeTruthy();
    expect(g.facts.origin).toBeTruthy();
  });
});

describe('gastronomy · the diner\'s hour', () => {
  it('mealSlotOf: morning 5-10 / noon 10-14 / afternoon 14-17 / evening 17-21 / night 21-5, bounds to the later slot', () => {
    const expectSlot = (h: number, slot: MealSlot) => expect(mealSlotOf(h), `hour ${h}`).toBe(slot);
    expectSlot(4, 'night');
    expectSlot(5, 'morning');
    expectSlot(9, 'morning');
    expectSlot(10, 'noon');
    expectSlot(13, 'noon');
    expectSlot(14, 'afternoon');
    expectSlot(16, 'afternoon');
    expectSlot(17, 'evening');
    expectSlot(20, 'evening');
    expectSlot(21, 'night');
    expectSlot(23, 'night');
    expectSlot(0, 'night');
    expectSlot(24, 'night');
    expectSlot(-1, 'night');
    expectSlot(Number.NaN, 'night');
  });

  it('localHourAt: solar hour from UTC and longitude (15° per hour), wrapping both ways', () => {
    expect(localHourAt(Date.UTC(2026, 8, 18, 0), 0)).toBe(0);
    expect(localHourAt(Date.UTC(2026, 8, 18, 0), 127)).toBe(8);
    expect(localHourAt(Date.UTC(2026, 8, 18, 22), 127)).toBe(6);
    expect(localHourAt(Date.UTC(2026, 8, 18, 3), -74)).toBe(22);
    expect(localHourAt(Date.UTC(2026, 8, 18, 3), 180)).toBe(15);
    expect(localHourAt(Date.UTC(2026, 8, 18, 3), Number.NaN)).toBe(3);
    for (const lon of [-180, -74, 0, 127, 179.9]) {
      const h = localHourAt(NOW, lon);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(24);
      expect(Number.isInteger(h)).toBe(true);
    }
  });
});

describe('gastronomy · day-seeded rotations', () => {
  it('trendingPick is deterministic for a day, honours the slot and walks the slot pool over days', () => {
    for (const slot of MEAL_SLOTS) {
      const a = trendingPick(DAY, slot);
      const b = trendingPick(DAY, slot);
      expect(a).toBe(b);
      expect(a.mealSlots).toContain(slot);
      const seen = new Set<string>();
      const poolSize = TRENDING_POOL.filter((d) => d.mealSlots.includes(slot)).length;
      for (let d = 0; d < poolSize; d += 1) {
        const pick = trendingPick(DAY + d, slot);
        expect(pick.mealSlots).toContain(slot);
        seen.add(pick.key);
      }
      expect(seen.size).toBe(poolSize);
    }
    expect(trendingPick(-3, 'night').mealSlots).toContain('night');
    expect(trendingPick(Number.NaN, 'morning').mealSlots).toContain('morning');
  });

  it('trendsForDay rotates the ten trends by the day and clamps the count', () => {
    expect(trendsForDay(0, 3)).toEqual(['fermentation', 'plantForward', 'hyperLocal']);
    expect(trendsForDay(9, 3)).toEqual(['nightMarkets', 'fermentation', 'plantForward']);
    expect(trendsForDay(DAY, 10)).toHaveLength(10);
    expect(new Set(trendsForDay(DAY, 10)).size).toBe(10);
    expect(trendsForDay(DAY, 99)).toHaveLength(10);
    expect(trendsForDay(DAY, 0)).toEqual([]);
    expect(trendsForDay(-1, 2)).toEqual(['nightMarkets', 'fermentation']);
  });

  it('dishesFor: the selected country, else the locale country, else null (never an invented entry)', () => {
    expect(dishesFor('KR', 'en')).toEqual({ cc: 'KR', keys: ['kimchi', 'samgyetang'] });
    expect(dishesFor('kr', 'en')?.cc).toBe('KR');
    expect(dishesFor('ZZ', 'ko')).toEqual({ cc: 'KR', keys: ['kimchi', 'samgyetang'] });
    expect(dishesFor(undefined, 'ja')?.cc).toBe('JP');
    expect(dishesFor(null, 'et')?.cc).toBe('EE');
    expect(dishesFor('GB', 'ko')?.cc).toBe('GB');
    // An unknown locale implies US (slotContext.localeCountry's last fallback),
    // which the catalogue covers -- so null is reachable only for a locale
    // whose implied country is outside the thirty.
    expect(dishesFor('ZZ', 'xx')).toEqual({ cc: 'US', keys: ['hamburger', 'gumbo'] });
  });

  it('globalDishPicks: three pairs from three different catalogue countries, deterministic per day', () => {
    for (const day of [0, 1, DAY, -7, 12345]) {
      const picks = globalDishPicks(day);
      expect(picks).toHaveLength(3);
      expect(new Set(picks.map((p) => p.cc)).size).toBe(3);
      for (const { cc, key } of picks) expect(COUNTRY_DISHES[cc]).toContain(key);
      expect(globalDishPicks(day)).toEqual(picks);
    }
    expect(globalDishPicks(0)).not.toEqual(globalDishPicks(1));
  });
});

describe('gastronomy · sunlight behind a plate', () => {
  it('sunAreaDays(130) ≈ 15.1 m²·day under 1 kWh/m²/day and 1 % efficiency; guards the degenerate inputs', () => {
    expect(sunAreaDays(130)).toBeCloseTo(15.1, 5);
    expect(sunAreaDays(598)).toBeCloseTo(69.5, 5);
    expect(sunAreaDays(2)).toBeCloseTo(0.2, 5);
    expect(sunAreaDays(0)).toBe(0);
    expect(sunAreaDays(-5)).toBe(0);
    expect(sunAreaDays(Number.NaN)).toBe(0);
    for (const row of FOOD_SCIENCE) expect(sunAreaDays(row.kcalPer100g)).toBeGreaterThan(0);
  });
});

describe('gastronomy · isFoodPlace across scripts', () => {
  it('accepts documented food places in ko / ja / zh / th / vi / es / fr / de / ru / tr / id / en', () => {
    const positives: Array<[string, string | undefined]> = [
      ['광장시장', '서울의 전통 시장'],
      ['을지면옥', undefined],
      ['Some Place', '맛집으로 유명한 곳'],
      ['築地市場', '東京都中央区の市場'],
      ['一蘭', 'ラーメン店'],
      ['全聚德', '北京烤鸭餐厅'],
      ['士林夜市', '台北市的夜市'],
      ['ตลาดน้ำดำเนินสะดวก', undefined],
      ['Somewhere', 'ร้านอาหารในกรุงเทพ'],
      ['Chợ Bến Thành', 'Chợ ở Thành phố Hồ Chí Minh'],
      ['Phở Thìn', 'quán phở'],
      ['Mercado de San Miguel', 'mercado en Madrid'],
      ['El Celler de Can Roca', 'restaurante en Girona'],
      ['Marché des Enfants Rouges', 'marché couvert'],
      ['Poilâne', 'boulangerie parisienne'],
      ['Viktualienmarkt', 'Markt in München'],
      ['Hofbräuhaus', 'Brauerei und Gasthaus'],
      ['Даниловский рынок', undefined],
      ['Кафе Пушкинъ', 'ресторан в Москве'],
      ['Kapalıçarşı', 'Grand Bazaar'],
      ['Mısır Çarşısı', 'spice pazar'],
      ['Pasar Baru', 'pasar di Jakarta'],
      ['Warung Tegal', undefined],
      ['Borough Market', 'food market in London'],
      ['Noma', 'restaurant in Copenhagen'],
      ['Tartine', 'bakery in San Francisco'],
      ['Cafe Landtmann', 'café in Vienna'],
      ['Balti Jaama Turg', 'turg Tallinnas'],
      ['Palengke ng Quiapo', undefined],
      ['ផ្សារធំថ្មី', undefined],
    ];
    for (const [title, desc] of positives) expect(isFoodPlace(title, desc), title).toBe(true);
  });

  it('rejects parks, museums, stations, universities and word fragments in the same scripts', () => {
    const negatives: Array<[string, string | undefined]> = [
      ['남산공원', '서울의 공원'],
      ['국립중앙박물관', '박물관'],
      ['서울역', '기차역'],
      ['東京タワー', '電波塔'],
      ['故宫', '博物馆'],
      ['วัดพระแก้ว', 'วัด'],
      ['Nhà thờ Đức Bà', 'nhà thờ'],
      ['Museo del Prado', 'museo en Madrid'],
      ['Tour Eiffel', 'monument à Paris'],
      ['Universität Wien', 'Universität'],
      ['Тургенев', 'писатель'],
      ['Третьяковская галерея', 'музей'],
      ['Ayasofya', 'müze'],
      ['Monas', 'monumen'],
      ['Marketing Tower', 'office building'],
      ['Supermarket Chain HQ', 'headquarters'],
      ['Republic Square', 'public square'],
      ['', undefined],
      ['   ', ''],
    ];
    for (const [title, desc] of negatives) expect(isFoodPlace(title, desc), title || '<blank>').toBe(false);
  });
});

describe('gastronomy · loadLocalEats (one beam, stubbed)', () => {
  it('data: one geosearch beam on the locale wiki, food places only, haversine-sorted, six at most, cached 24 h', async () => {
    const fetch = okFetch(geoJson(RING));
    vi.stubGlobal('fetch', fetch);
    const storage = memoryStorage();
    const result = await loadLocalEats(SEOUL, 'ko', undefined, { nowMs: NOW, storage });
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0]).toMatch(/^https:\/\/ko\.wikipedia\.org\/w\/api\.php\?/);
    expect(fetch.calls[0]).toContain('generator=geosearch');
    expect(fetch.calls[0]).toContain('ggsradius=10000');
    expect(result.state).toBe('data');
    expect(result.items.length).toBeLessThanOrEqual(GASTRO_LOCAL_MAX_ITEMS);
    expect(result.items.map((i) => i.title)).toEqual(['남대문시장', '을지면옥', '통인시장', '광장시장', 'Coffee Libre', '이태원 제과']);
    // The seventh food place (망원시장, 6.5 km) is cut by the six-item ceiling.
    expect(result.items.some((i) => i.title === '망원시장')).toBe(false);
    for (const item of result.items) {
      expect(item.id).toMatch(/^local:\d+$/);
      expect(item.url).toMatch(/^https:\/\/ko\.wikipedia\.org\/wiki\//);
      expect(item.meta).toMatch(/^[\d.,]+(m|km) · Wikipedia$/);
      expect(item.scope).toBe('country');
    }
    // Nothing without a food word and nothing without a coordinate survives.
    expect(result.items.some((i) => i.title === '남산공원' || i.title === '국립중앙박물관' || i.title === 'No coordinates')).toBe(false);
    // Cached under the ledger key, versioned, keyed by the ~11 m cell.
    const raw = storage.store[GASTRO_LOCAL_STORAGE_KEY];
    expect(raw).toBeTruthy();
    const entry = JSON.parse(raw) as { v: string; key: string; at: number; data: { state: string; items: unknown[] } };
    expect(entry.v).toBe(GASTRO_LOCAL_VERSION);
    expect(entry.key).toBe(`ko:${gastroPlaceKey(SEOUL.lat, SEOUL.lon)}`);
    expect(entry.at).toBe(NOW);
    expect(entry.data.state).toBe('data');
    expect(entry.data.items).toHaveLength(6);
    expect(gastroPlaceKey(SEOUL.lat, SEOUL.lon)).toBe('37.5665,126.9780');
  });

  it('cache hit: a fresh entry answers without a fetch; a stale one is refetched', async () => {
    const storage = memoryStorage();
    storage.setItem(
      GASTRO_LOCAL_STORAGE_KEY,
      JSON.stringify({
        v: GASTRO_LOCAL_VERSION,
        key: `ko:${gastroPlaceKey(SEOUL.lat, SEOUL.lon)}`,
        at: NOW - 60_000,
        data: { state: 'data', items: [{ id: 'local:1', title: '캐시된 시장', url: 'https://ko.wikipedia.org/wiki/x', meta: '100m · Wikipedia', scope: 'country' }] },
      }),
    );
    vi.stubGlobal('localStorage', storage);
    const fetch = okFetch(geoJson(RING));
    vi.stubGlobal('fetch', fetch);
    const hit = await loadLocalEats(SEOUL, 'ko', undefined, { nowMs: NOW, storage });
    expect(fetch.calls).toHaveLength(0);
    expect(hit.state).toBe('data');
    expect(hit.items[0].title).toBe('캐시된 시장');
    const stale = await loadLocalEats(SEOUL, 'ko', undefined, { nowMs: NOW + 25 * 60 * 60 * 1000, storage });
    expect(fetch.calls).toHaveLength(1);
    expect(stale.items[0].title).toBe('남대문시장');
  });

  it('empty: a beam that answers with no food place is `empty` (cached); unreadable: a rejected / non-ok / malformed beam is `unreadable` (not cached)', async () => {
    const storage = memoryStorage();
    vi.stubGlobal('fetch', okFetch(geoJson([RING[1], RING[3]])));
    const none = await loadLocalEats(SEOUL, 'ko', undefined, { nowMs: NOW, storage });
    expect(none).toEqual({ items: [], state: 'empty' });
    expect(JSON.parse(storage.store[GASTRO_LOCAL_STORAGE_KEY]).data.state).toBe('empty');

    const fresh = memoryStorage();
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    expect(await loadLocalEats(SEOUL, 'ko', undefined, { nowMs: NOW, storage: fresh })).toEqual({ items: [], state: 'unreadable' });
    vi.stubGlobal('fetch', async () => ({ ok: false, json: async () => ({}) }));
    expect(await loadLocalEats(SEOUL, 'ko', undefined, { nowMs: NOW, storage: fresh })).toEqual({ items: [], state: 'unreadable' });
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => null }));
    expect(await loadLocalEats(SEOUL, 'ko', undefined, { nowMs: NOW, storage: fresh })).toEqual({ items: [], state: 'unreadable' });
    expect(fresh.store[GASTRO_LOCAL_STORAGE_KEY]).toBeUndefined();
    // Wikipedia's zero-result shape (no `query`) is an honest empty.
    vi.stubGlobal('fetch', okFetch({ batchcomplete: '' }));
    expect(await loadLocalEats(SEOUL, 'ko', undefined, { nowMs: NOW, storage: fresh })).toEqual({ items: [], state: 'empty' });
  });

  it('an already-aborted signal yields unreadable without throwing; no clock means no cache', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = async (_url: string, init?: { signal?: AbortSignal }) => {
      if (init?.signal?.aborted) throw new Error('aborted');
      return { ok: true, json: async () => geoJson(RING) };
    };
    vi.stubGlobal('fetch', fetch);
    expect(await loadLocalEats(SEOUL, 'ko', controller.signal, { nowMs: NOW, storage: memoryStorage() })).toEqual({ items: [], state: 'unreadable' });
    const storage = memoryStorage();
    const noClock = await loadLocalEats(SEOUL, 'en', undefined, { storage });
    expect(noClock.state).toBe('data');
    expect(storage.store[GASTRO_LOCAL_STORAGE_KEY]).toBeUndefined();
  });
});

describe('gastronomy · buildGastronomyCard', () => {
  it('card (no cursor): four facts + three trend rows, no network, no throw even with fetch rejected', async () => {
    let called = 0;
    vi.stubGlobal('fetch', async () => {
      called += 1;
      throw new Error('offline');
    });
    const card = await buildGastronomyCard({ locale: 'ko', country: 'KR' }, undefined, NOW);
    expect(called).toBe(0);
    expect(card.facts).toHaveLength(4);
    const [hero, slot, flavor, origin] = card.facts;
    expect(hero.emphasis).toBe(true);
    expect(hero.value).toBe('');
    expect(hero.labelKey).toMatch(/^Rev42\.gastronomy\.trending\.[A-Za-z]+\.name$/);
    expect(slot).toEqual({ labelKey: expect.stringMatching(/^Rev42\.gastronomy\.mealSlots\.(morning|noon|afternoon|evening|night)$/), value: '' });
    expect(flavor).toEqual({ labelKey: expect.stringMatching(/^Rev42\.gastronomy\.flavors\.[a-z]+$/), value: '' });
    expect(origin.labelKey).toBe('Rev42.gastronomy.facts.origin');
    expect(origin.value.length).toBeGreaterThan(0);
    expect(card.items).toHaveLength(3);
    for (const item of card.items) {
      expect(item.id).toMatch(/^trend:[A-Za-z]+$/);
      expect(item.title).toMatch(/^i18n:Rev42\.gastronomy\.trends\.[A-Za-z]+\.title$/);
      expect(item.description).toMatch(/^i18n:Rev42\.gastronomy\.trends\.[A-Za-z]+\.line$/);
      expect(item.meta).toBe(`${I18N_ITEM_PREFIX}Rev42.gastronomy.trendMeta`);
      expect(item.scope).toBe('global');
      expect(item.url).toBeUndefined();
    }
    expect(card.updatedAt).toBe(NOW);
    expect(card.cursor).toBeNull();
    expect(card.subject?.term).toBe(TRENDING_POOL.find((d) => hero.labelKey.includes(`.${d.key}.`))?.label);
    // The pick and the slot fact agree with the pure helpers for the same day and hour.
    const pick = trendingPick(DAY, mealSlotOf(localHourAt(NOW, SEOUL.lon)));
    expect(hero.labelKey).toBe(`Rev42.gastronomy.trending.${pick.key}.name`);
    expect(card.facts[3].value).toBe(regionName('ko', pick.originCc));
  });

  it('deep cursor: ten trends, the country\'s two traditional dishes, then ONE honest marker when the beam is unreadable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const card = await buildGastronomyCard({ locale: 'ko', country: 'KR' }, { deep: 1 }, NOW);
    expect(card.facts).toHaveLength(4);
    const global = card.items.filter((i) => i.scope === 'global');
    const country = card.items.filter((i) => i.scope === 'country');
    expect(global).toHaveLength(10);
    expect(country.map((i) => i.id)).toEqual(['dish:KR:kimchi', 'dish:KR:samgyetang', 'local:unreadable']);
    expect(country[0].title).toBe('i18n:Rev42.gastronomy.dishes.KR.kimchi.name');
    expect(country[0].description).toBe('i18n:Rev42.gastronomy.dishes.KR.kimchi.origin');
    expect(country[0].meta).toBe(regionName('ko', 'KR'));
    expect(country[2].title).toBe('i18n:Rev42.gastronomy.sections.localEatsFallback');
    expect(country[2].url).toBeUndefined();
    // Global rows come first in array order (the popup renders scopes in order).
    expect(card.items.findIndex((i) => i.scope === 'country')).toBe(10);
  });

  it('deep cursor with a live beam appends the local eats; an empty beam appends the `empty` marker; an unknown country falls to the locale country', async () => {
    vi.stubGlobal('fetch', okFetch(geoJson(RING)));
    const live = await buildGastronomyCard({ locale: 'ko', country: 'KR' }, { deep: '1' }, NOW);
    const local = live.items.filter((i) => i.id.startsWith('local:'));
    expect(local).toHaveLength(6);
    expect(local.every((i) => i.scope === 'country' && typeof i.url === 'string')).toBe(true);
    expect(live.items.filter((i) => i.id.startsWith('dish:'))).toHaveLength(2);

    vi.stubGlobal('fetch', okFetch(geoJson([RING[1]])));
    const empty = await buildGastronomyCard({ locale: 'en', country: 'US' }, { deep: 1 }, NOW);
    expect(empty.items.filter((i) => i.id.startsWith('local:')).map((i) => i.id)).toEqual(['local:empty']);
    expect(empty.items.filter((i) => i.id.startsWith('dish:')).map((i) => i.id)).toEqual(['dish:US:hamburger', 'dish:US:gumbo']);

    const abroad = await buildGastronomyCard({ locale: 'ja', country: 'ZZ' }, { deep: 1 }, NOW);
    expect(abroad.items.filter((i) => i.id.startsWith('dish:')).map((i) => i.id)).toEqual(['dish:JP:okonomiyaki', 'dish:JP:tempura']);
  });
});

describe('gastronomy · source scan (SPEC 1-A #14)', () => {
  it('lib/live/gastronomy.ts contains neither Math.random( nor Date.now(', () => {
    const src = readFileSync(fileURLToPath(new URL('../../lib/live/gastronomy.ts', import.meta.url)), 'utf8');
    expect(src.includes('Math.random(')).toBe(false);
    expect(src.includes('Date.now(')).toBe(false);
    expect(src.includes('new Date()')).toBe(false);
    expect(src).toContain("export const I18N_ITEM_PREFIX = 'i18n:'");
    expect(src).toContain("'unitas.gastronomy.local.v1'");
    // The registry is imported for its TYPES only (the runtime import would be a cycle).
    expect(src).toMatch(/import type \{[^}]*\} from '@\/lib\/live\/discoverySlots'/);
    expect(src).not.toMatch(/import \{[^}]*\} from '@\/lib\/live\/discoverySlots'/);
  });
});
