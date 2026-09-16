import { describe, expect, it } from 'vitest';
import {
  PRODUCT_CARD_ITEMS,
  PRODUCT_DEEP_ITEMS,
  PRODUCT_FAMILIES,
  PRODUCT_FAMILY_KEYS,
  PRODUCT_MIN_FILL,
  categoryMembersUrl,
  displayTitle,
  familyOfDay,
  foldProductPages,
  isProductFamilyKey,
  pageDetailsUrl,
  previousYearCategories,
  productFamily,
} from '@/lib/live/newProducts';

// REV-29 MISSION 3 / REV-34 MISSION 1-D -- the 글로벌 신상품 adapter's pure
// half. No network: the family table (16 families of two kinds), URL
// builders, the day rotation and the fold over a details response.

const YEAR_FAMILIES = PRODUCT_FAMILIES.filter((f) => !f.static);
const STATIC_FAMILIES = PRODUCT_FAMILIES.filter((f) => f.static);

describe('product families', () => {
  it('ships the sixteen REV-34 families, cars first, with unique keys, colours and Wikidata anchors', () => {
    expect(PRODUCT_FAMILIES.length).toBeGreaterThanOrEqual(15);
    expect(PRODUCT_FAMILY_KEYS).toEqual([
      'cars', 'phones', 'mobility', 'gadgets', 'games',
      'aiAgents', 'quantum', 'sovereignSaas', 'bioHealth', 'neurotech', 'space', 'xr', 'defiHardware', 'ecoEnergy', 'nomadGear', 'robots',
    ]);
    expect(new Set(PRODUCT_FAMILY_KEYS).size).toBe(PRODUCT_FAMILIES.length);
    expect(new Set(PRODUCT_FAMILIES.map((f) => f.color)).size).toBe(PRODUCT_FAMILIES.length);
    expect(new Set(PRODUCT_FAMILIES.map((f) => f.qid)).size).toBe(PRODUCT_FAMILIES.length);
    for (const f of PRODUCT_FAMILIES) {
      expect(f.key, f.key).toMatch(/^[a-z][a-zA-Z]*$/);
      expect(f.color, f.key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(f.icon, f.key).toBeTruthy();
      expect(f.qid, f.key).toMatch(/^Q\d+$/);
      expect(f.static === undefined || f.static === true, f.key).toBe(true);
    }
  });

  it('keeps the five REV-29 consumer families year-parameterised and adds year trees for space and SaaS', () => {
    expect(YEAR_FAMILIES.map((f) => f.key)).toEqual(['cars', 'phones', 'mobility', 'gadgets', 'games', 'sovereignSaas', 'space']);
    for (const f of YEAR_FAMILIES) {
      const cats = f.categories(2026);
      expect(cats.length, f.key).toBeGreaterThan(0);
      expect(cats.length, f.key).toBeLessThanOrEqual(4);
      expect(new Set(cats).size, f.key).toBe(cats.length);
      // At least one tree carries the year, and swapping the year moves it.
      expect(cats.some((c) => c.includes('2026')), f.key).toBe(true);
      expect(f.categories(2025).some((c) => c.includes('2025')), f.key).toBe(true);
      expect(f.categories(2025)).not.toEqual(cats);
    }
    for (const key of ['cars', 'phones', 'gadgets', 'games'] as const) {
      for (const c of productFamily(key).categories(2026)) expect(c, key).toContain('2026');
    }
  });

  it('static frontier families ignore the year and never exceed four category legs', () => {
    expect(STATIC_FAMILIES.map((f) => f.key)).toEqual(['aiAgents', 'quantum', 'bioHealth', 'neurotech', 'xr', 'defiHardware', 'ecoEnergy', 'nomadGear', 'robots']);
    for (const f of STATIC_FAMILIES) {
      const cats = f.categories(2026);
      expect(cats.length, f.key).toBeGreaterThan(0);
      expect(cats.length, f.key).toBeLessThanOrEqual(4);
      expect(new Set(cats).size, f.key).toBe(cats.length);
      expect(f.categories(2025), f.key).toEqual(cats);
      expect(f.categories(1999), f.key).toEqual(cats);
      for (const c of cats) expect(c, f.key).not.toMatch(/\d{4}/);
    }
  });

  it('category names never carry the Category: prefix or stray whitespace', () => {
    for (const f of PRODUCT_FAMILIES) {
      for (const c of f.categories(2026)) {
        expect(c, f.key).not.toMatch(/^category:/i);
        expect(c, f.key).toBe(c.trim());
      }
    }
  });

  it('rotates one family per day, modulo the family count, and wraps in both directions', () => {
    const n = PRODUCT_FAMILIES.length;
    expect(familyOfDay(0).key).toBe(PRODUCT_FAMILIES[0].key);
    expect(familyOfDay(n).key).toBe(PRODUCT_FAMILIES[0].key);
    expect(familyOfDay(n + 2).key).toBe(PRODUCT_FAMILIES[2].key);
    expect(familyOfDay(-1).key).toBe(PRODUCT_FAMILIES[n - 1].key);
    expect(familyOfDay(-n).key).toBe(PRODUCT_FAMILIES[0].key);
    // Every family gets its day: n consecutive days cover the whole table once.
    const seen = new Set(Array.from({ length: n }, (_, i) => familyOfDay(i).key));
    expect(seen.size).toBe(n);
  });

  it('resolves a family by key and falls back to the first (cars) for junk', () => {
    expect(productFamily('games').key).toBe('games');
    expect(productFamily('robots').key).toBe('robots');
    expect(productFamily('nope').key).toBe('cars');
    expect(productFamily(undefined).key).toBe('cars');
    expect(isProductFamilyKey('phones')).toBe(true);
    expect(isProductFamilyKey('quantum')).toBe(true);
    expect(isProductFamilyKey('awards')).toBe(false);
    expect(isProductFamilyKey(42)).toBe(false);
  });

  it('the card shows fewer rows than the deep modal, and the fill floor sits below the card', () => {
    expect(PRODUCT_CARD_ITEMS).toBeLessThan(PRODUCT_DEEP_ITEMS);
    expect(PRODUCT_MIN_FILL).toBeLessThanOrEqual(PRODUCT_CARD_ITEMS);
  });
});

describe('previousYearCategories', () => {
  it('is empty for static families -- the year-1 refetch is gated off', () => {
    for (const f of STATIC_FAMILIES) expect(previousYearCategories(f, 2026), f.key).toEqual([]);
  });

  it('returns only the year-1 trees the current year did not already cover', () => {
    expect(previousYearCategories(productFamily('cars'), 2026)).toEqual(['Cars introduced in 2025']);
    // mobility pairs two thin year trees with the year-free "Electric aircraft" -- fetched once.
    expect(previousYearCategories(productFamily('mobility'), 2026)).toEqual(['Motorcycles introduced in 2025', 'Aircraft first flown in 2025']);
    expect(previousYearCategories(productFamily('sovereignSaas'), 2026)).toEqual(['2025 software']);
  });
});

describe('MediaWiki URLs', () => {
  it('asks for category members newest first, pages only, CORS-safe', () => {
    const u = new URL(categoryMembersUrl('Cars introduced in 2026', 7));
    expect(u.origin).toBe('https://en.wikipedia.org');
    expect(u.searchParams.get('list')).toBe('categorymembers');
    expect(u.searchParams.get('cmtitle')).toBe('Category:Cars introduced in 2026');
    expect(u.searchParams.get('cmsort')).toBe('timestamp');
    expect(u.searchParams.get('cmdir')).toBe('desc');
    expect(u.searchParams.get('cmtype')).toBe('page');
    expect(u.searchParams.get('cmlimit')).toBe('7');
    expect(u.searchParams.get('origin')).toBe('*');
  });

  it('keeps non-ASCII category names (en dash in Brain–computer interface) intact', () => {
    const u = new URL(categoryMembersUrl('Brain–computer interface'));
    expect(u.searchParams.get('cmtitle')).toBe('Category:Brain–computer interface');
    expect(u.searchParams.get('cmlimit')).toBe(String(PRODUCT_DEEP_ITEMS));
  });

  it('asks for intro, thumbnail and (non-English only) the own-language title', () => {
    const en = new URL(pageDetailsUrl(['A', 'B'], 'en'));
    expect(en.searchParams.get('titles')).toBe('A|B');
    expect(en.searchParams.get('prop')).toBe('extracts|pageimages');
    expect(en.searchParams.get('lllang')).toBeNull();
    const ko = new URL(pageDetailsUrl(['A'], 'ko'));
    expect(ko.searchParams.get('prop')).toBe('extracts|pageimages|langlinks');
    expect(ko.searchParams.get('lllang')).toBe('ko');
    expect(ko.searchParams.get('exintro')).toBe('1');
    expect(ko.searchParams.get('pithumbsize')).toBe('240');
  });
});

describe('foldProductPages', () => {
  const members = [
    { title: 'Aurora GT (2026)', timestamp: '2026-09-14T00:00:00Z' },
    { title: 'List of cars introduced in 2026', timestamp: '2026-09-13T00:00:00Z' },
    { title: 'Aurora GT (2026)', timestamp: '2026-09-12T00:00:00Z' },
    { title: 'Nimbus One', timestamp: '2026-09-11T00:00:00Z' },
  ];
  const details = {
    query: {
      pages: {
        '1': {
          pageid: 1,
          title: 'Aurora GT (2026)',
          extract: 'The Aurora GT is a grand tourer unveiled in 2026. It replaced the Aurora S.',
          thumbnail: { source: 'https://upload.wikimedia.org/a.jpg', width: 240, height: 160 },
          langlinks: [{ lang: 'ko', '*': '오로라 GT' }],
        },
        '-1': { title: 'Nimbus One', missing: '' },
      },
    },
  };

  it('dedups, drops housekeeping pages, keeps member order and folds details', () => {
    const out = foldProductPages(members, details, 'cars', 2026, 'ko');
    expect(out.map((e) => e.title)).toEqual(['Aurora GT', 'Nimbus One']);
    expect(out[0].localTitle).toBe('오로라 GT');
    expect(out[0].url).toBe('https://ko.wikipedia.org/wiki/%EC%98%A4%EB%A1%9C%EB%9D%BC_GT');
    expect(out[0].image).toBe('https://upload.wikimedia.org/a.jpg');
    expect(out[0].description).toContain('grand tourer');
    expect(out[0].listedAt).toBe('2026-09-14T00:00:00Z');
    expect(out[0].id).toBe('product:cars:2026:Aurora GT (2026)');
    expect(out[1].url).toBe('https://en.wikipedia.org/wiki/Nimbus_One');
    expect(out[1].description).toBe('');
    expect(out[1].image).toBeUndefined();
    expect(out[1].localTitle).toBeUndefined();
  });

  it('links the English article when the visitor reads English, even with langlinks present', () => {
    const out = foldProductPages(members.slice(0, 1), details, 'cars', 2026, 'en');
    expect(out[0].url).toBe('https://en.wikipedia.org/wiki/Aurora_GT_(2026)');
  });

  it('tags entries with the requesting family and year -- static families included', () => {
    const out = foldProductPages([{ title: 'Optimus (robot)' }], null, 'robots', 2026, 'ja');
    expect(out).toHaveLength(1);
    expect(out[0].family).toBe('robots');
    expect(out[0].year).toBe(2026);
    expect(out[0].title).toBe('Optimus');
    expect(out[0].url).toBe('https://en.wikipedia.org/wiki/Optimus_(robot)');
  });

  it('survives a null details response and members without timestamps', () => {
    const out = foldProductPages([{ title: 'Solo' }], null, 'phones', 2026, 'fr');
    expect(out).toHaveLength(1);
    expect(out[0].listedAt).toBeUndefined();
    expect(out[0].description).toBe('');
  });

  it('clips long extracts to a single line with an ellipsis', () => {
    const long = 'x'.repeat(400);
    const out = foldProductPages([{ title: 'Long' }], { query: { pages: { '9': { title: 'Long', extract: long } } } }, 'gadgets', 2026, 'en');
    expect(out[0].description.length).toBeLessThanOrEqual(140);
    expect(out[0].description.endsWith('…')).toBe(true);
  });
});

describe('displayTitle', () => {
  it('strips one trailing parenthetical and keeps everything else', () => {
    expect(displayTitle('Galaxy S26 (smartphone)')).toBe('Galaxy S26');
    expect(displayTitle('Model (X) Two')).toBe('Model (X) Two');
    expect(displayTitle('(2026)')).toBe('(2026)');
  });
});
