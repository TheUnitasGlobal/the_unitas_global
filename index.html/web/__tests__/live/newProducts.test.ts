import { describe, expect, it } from 'vitest';
import {
  PRODUCT_CARD_ITEMS,
  PRODUCT_DEEP_ITEMS,
  PRODUCT_FAMILIES,
  PRODUCT_FAMILY_KEYS,
  categoryMembersUrl,
  displayTitle,
  familyOfDay,
  foldProductPages,
  isProductFamilyKey,
  pageDetailsUrl,
  productFamily,
} from '@/lib/live/newProducts';

// REV-29 MISSION 3 -- the 글로벌 신상품 adapter's pure half. No network:
// URL builders, the day rotation and the fold over a details response.

describe('product families', () => {
  it('ships five families with unique keys, hex colours, icons and Wikidata anchors', () => {
    expect(PRODUCT_FAMILIES).toHaveLength(5);
    expect(new Set(PRODUCT_FAMILY_KEYS).size).toBe(5);
    for (const f of PRODUCT_FAMILIES) {
      expect(f.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(f.icon).toBeTruthy();
      expect(f.qid).toMatch(/^Q\d+$/);
      const cats = f.categories(2026);
      expect(cats.length).toBeGreaterThan(0);
      for (const c of cats) expect(c).toContain('2026');
    }
  });

  it('rotates one family per day and wraps in both directions', () => {
    expect(familyOfDay(0).key).toBe(PRODUCT_FAMILIES[0].key);
    expect(familyOfDay(5).key).toBe(PRODUCT_FAMILIES[0].key);
    expect(familyOfDay(7).key).toBe(PRODUCT_FAMILIES[2].key);
    expect(familyOfDay(-1).key).toBe(PRODUCT_FAMILIES[4].key);
  });

  it('resolves a family by key and falls back to the first for junk', () => {
    expect(productFamily('games').key).toBe('games');
    expect(productFamily('nope').key).toBe(PRODUCT_FAMILIES[0].key);
    expect(productFamily(undefined).key).toBe(PRODUCT_FAMILIES[0].key);
    expect(isProductFamilyKey('phones')).toBe(true);
    expect(isProductFamilyKey('awards')).toBe(false);
  });

  it('the card shows fewer rows than the deep modal', () => {
    expect(PRODUCT_CARD_ITEMS).toBeLessThan(PRODUCT_DEEP_ITEMS);
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
        '2': { pageid: 2, title: 'Nimbus One' },
      },
    },
  };

  it('drops list pages and duplicates, keeps member order, maps details', () => {
    const out = foldProductPages(members, details, 'cars', 2026, 'ko');
    expect(out.map((e) => e.title)).toEqual(['Aurora GT', 'Nimbus One']);
    expect(out[0].localTitle).toBe('오로라 GT');
    expect(out[0].url).toBe('https://ko.wikipedia.org/wiki/%EC%98%A4%EB%A1%9C%EB%9D%BC_GT');
    expect(out[0].image).toBe('https://upload.wikimedia.org/a.jpg');
    expect(out[0].description).toContain('grand tourer');
    expect(out[0].family).toBe('cars');
    expect(out[0].year).toBe(2026);
    expect(out[0].listedAt).toBe('2026-09-14T00:00:00Z');
  });

  it('a member without details keeps its title and an English link', () => {
    const out = foldProductPages(members, details, 'cars', 2026, 'ko');
    expect(out[1].description).toBe('');
    expect(out[1].image).toBeUndefined();
    expect(out[1].url).toBe('https://en.wikipedia.org/wiki/Nimbus_One');
  });

  it('English visitors always link to the English article', () => {
    const out = foldProductPages(members, details, 'cars', 2026, 'en');
    expect(out[0].url).toBe('https://en.wikipedia.org/wiki/Aurora_GT_(2026)');
    expect(out[0].localTitle).toBeUndefined();
  });

  it('survives a null details response', () => {
    const out = foldProductPages(members, null, 'phones', 2025, 'ja');
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.description === '')).toBe(true);
  });

  it('displayTitle strips only a trailing parenthetical', () => {
    expect(displayTitle('Galaxy Z (smartphone)')).toBe('Galaxy Z');
    expect(displayTitle('Model (X) Two')).toBe('Model (X) Two');
    expect(displayTitle('(2026)')).toBe('(2026)');
  });
});
