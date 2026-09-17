import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CREATOR_SHARE,
  DEFAULT_CATALOG_SORT,
  EMPTY_LEDGER,
  EXCHANGE_CATALOG,
  LISTING_REVIEW_MS,
  STARTER_CREDITS,
  UNITAS_SHARE,
  buyPack,
  canBuy,
  catalogView,
  isTradeEvent,
  listPack,
  listingStatus,
  packById,
  projectedEarnings,
  projectedSales,
  splitRevenue,
  validateListing,
  type ExchangeLedger,
} from '@/lib/hub/knowledgeExchange';
import { isHotNewsCategory } from '@/lib/live/hotNews';

// REV-29 MISSION 4 -- the knowledge exchange's pure rules. No window, no
// network; the ledger is a plain value in and a plain value out.

const NOW = 1_800_000_000_000;

describe('catalogue', () => {
  it('is 24 packs with unique ids, real news-axis themes and sane prices', () => {
    expect(EXCHANGE_CATALOG).toHaveLength(24);
    expect(new Set(EXCHANGE_CATALOG.map((p) => p.id)).size).toBe(24);
    for (const p of EXCHANGE_CATALOG) {
      expect(isHotNewsCategory(p.theme), p.id).toBe(true);
      expect(p.price).toBeGreaterThanOrEqual(10);
      expect(p.price).toBeLessThanOrEqual(5000);
      expect(p.title.length).toBeGreaterThan(3);
    }
    expect(packById('kp-01')?.theme).toBe('economy');
    expect(packById('nope')).toBeUndefined();
  });

  // REV-40 follow-up -- the seeded counters are asserted GONE, structurally.
  //
  // An earlier pass stopped PRINTING the PRNG sales/rating/buyer draws but kept
  // the generator alive as the ordering key behind the catalogue's default
  // "popularity" tab, so the first screen every visitor read was still a
  // fabricated ranking with its numbers hidden. Removing code is easy to undo
  // by accident (a revert, a cherry-pick, a "restore the sort tab" commit), so
  // the removal is pinned against the source itself -- the same technique
  // __tests__/square/failOpenRegression.test.ts uses on the hub panels.
  it('carries no pseudo-random source: the seeded counters and their sort are gone', () => {
    const src = readFileSync(join(__dirname, '../../lib/hub/knowledgeExchange.ts'), 'utf8');
    for (const banned of ['packStats', 'mulberry32', 'sellerBoard(', 'Math.random(', "'trending'"]) {
      expect(src.includes(banned), `knowledgeExchange.ts still carries ${banned}`).toBe(false);
    }
    // The surviving hash mints listing ids; it must not grow a generator again.
    expect(src.includes('hashString')).toBe(true);
  });

  it('catalogView filters by theme and sorts two honest ways', () => {
    const economy = catalogView('economy', DEFAULT_CATALOG_SORT);
    expect(economy.length).toBeGreaterThan(0);
    expect(economy.every((p) => p.theme === 'economy')).toBe(true);
    const byPrice = catalogView('all', 'price');
    for (let i = 1; i < byPrice.length; i++) expect(byPrice[i].price).toBeGreaterThanOrEqual(byPrice[i - 1].price);
    // 'newest' is catalogue order reversed -- a fact about the seed file.
    expect(catalogView('all', 'newest')[0].id).toBe(EXCHANGE_CATALOG[EXCHANGE_CATALOG.length - 1].id);
    // ...and it is what a visitor gets before touching a thing.
    expect(DEFAULT_CATALOG_SORT).toBe('newest');
  });

  it('every sort is a stable permutation of the filtered catalogue', () => {
    for (const sort of ['newest', 'price'] as const) {
      const view = catalogView('all', sort);
      expect(view).toHaveLength(EXCHANGE_CATALOG.length);
      expect(new Set(view.map((p) => p.id)).size).toBe(EXCHANGE_CATALOG.length);
      // Deterministic: a second call cannot reshuffle the shelf.
      expect(catalogView('all', sort).map((p) => p.id)).toEqual(view.map((p) => p.id));
      // Pure: the source catalogue is never reordered in place.
      expect(EXCHANGE_CATALOG[0].id).toBe('kp-01');
    }
  });
});

describe('revenue split', () => {
  it('is 70 / 30 and always sums back to the gross', () => {
    expect(CREATOR_SHARE + UNITAS_SHARE).toBeCloseTo(1);
    for (const amount of [0, 1, 99, 100, 333, 5000]) {
      const s = splitRevenue(amount);
      expect(s.creator + s.platform).toBe(amount);
      expect(s.creator).toBe(Math.round(amount * 0.7));
    }
  });
});

describe('buying', () => {
  const pack = packById('kp-04')!; // 90 credits

  it('starts every device with the starter credits and no purchases', () => {
    expect(EMPTY_LEDGER.credits).toBe(STARTER_CREDITS);
    expect(EMPTY_LEDGER.purchases).toEqual([]);
    expect(canBuy(EMPTY_LEDGER, pack)).toBe('ok');
  });

  it('debits the price once, then reports the pack as owned', () => {
    const after = buyPack(EMPTY_LEDGER, pack, NOW);
    expect(after.credits).toBe(STARTER_CREDITS - pack.price);
    expect(after.purchases).toEqual([{ packId: pack.id, at: NOW, price: pack.price }]);
    expect(canBuy(after, pack)).toBe('owned');
    // A second buy is a no-op on the same value.
    expect(buyPack(after, pack, NOW + 1)).toBe(after);
  });

  it('refuses when credits are short, and never mutates the input', () => {
    const poor: ExchangeLedger = { ...EMPTY_LEDGER, credits: 10 };
    expect(canBuy(poor, pack)).toBe('insufficient');
    const same = buyPack(poor, pack, NOW);
    expect(same).toBe(poor);
    expect(EMPTY_LEDGER.credits).toBe(STARTER_CREDITS);
  });
});

describe('listing', () => {
  const good = { title: 'Tariff rounds, decoded', theme: 'economy' as const, price: 120, summary: 'A one-page ladder.' };

  it('validates title length, integer price range and summary length', () => {
    expect(validateListing(good)).toBe('ok');
    expect(validateListing({ ...good, title: 'ab' })).toBe('title');
    expect(validateListing({ ...good, title: 'x'.repeat(61) })).toBe('title');
    expect(validateListing({ ...good, price: 9 })).toBe('price');
    expect(validateListing({ ...good, price: 5001 })).toBe('price');
    expect(validateListing({ ...good, price: 12.5 })).toBe('price');
    expect(validateListing({ ...good, price: Number.NaN })).toBe('price');
    expect(validateListing({ ...good, summary: 'y'.repeat(201) })).toBe('summary');
  });

  it('adds a review-status listing at the head, or nothing when invalid', () => {
    const l1 = listPack(EMPTY_LEDGER, good, NOW);
    expect(l1.listings).toHaveLength(1);
    expect(l1.listings[0].status).toBe('review');
    expect(l1.listings[0].title).toBe(good.title);
    const l2 = listPack(l1, { ...good, title: 'Second' }, NOW + 1);
    expect(l2.listings[0].title).toBe('Second');
    expect(listPack(l1, { ...good, title: '' }, NOW)).toBe(l1);
  });

  it('goes live after the review window and projects demand slowly, capped', () => {
    const l = listPack(EMPTY_LEDGER, good, NOW).listings[0];
    expect(listingStatus(l, NOW)).toBe('review');
    expect(listingStatus(l, NOW + LISTING_REVIEW_MS)).toBe('live');
    expect(projectedSales(l, NOW)).toBe(0);
    expect(projectedSales(l, NOW + LISTING_REVIEW_MS + 6 * 60 * 60 * 1000)).toBe(1);
    expect(projectedSales(l, NOW + LISTING_REVIEW_MS + 1000 * 60 * 60 * 1000)).toBe(40);
  });

  it('projected earnings apply the split over every listing', () => {
    const ledger = listPack(listPack(EMPTY_LEDGER, good, NOW), { ...good, title: 'Second', price: 200 }, NOW);
    const at = NOW + LISTING_REVIEW_MS + 12 * 60 * 60 * 1000; // 2 sales each
    const e = projectedEarnings(ledger, at);
    expect(e.sales).toBe(4);
    expect(e.gross).toBe(2 * 120 + 2 * 200);
    expect(e.creator + e.platform).toBe(e.gross);
  });
});

describe('trade events over the wire', () => {
  it('accepts only a well-formed event about a catalogue pack', () => {
    expect(isTradeEvent({ packId: 'kp-01', buyer: 'nomad-1234', at: NOW })).toBe(true);
    expect(isTradeEvent({ packId: 'kp-99', buyer: 'x', at: NOW })).toBe(false);
    expect(isTradeEvent({ packId: 'kp-01', buyer: '', at: NOW })).toBe(false);
    expect(isTradeEvent({ packId: 'kp-01', buyer: 'a'.repeat(41), at: NOW })).toBe(false);
    expect(isTradeEvent(null)).toBe(false);
    expect(isTradeEvent('kp-01')).toBe(false);
  });
});
