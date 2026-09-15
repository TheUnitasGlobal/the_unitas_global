import { describe, expect, it } from 'vitest';
import {
  classifyHubError,
  mapBuyResult,
  mapServerBoard,
  mapServerLedger,
  mapServerListing,
  mapServerMessage,
  mapServerPurchase,
} from '@/lib/hub/hubLedger';

/**
 * REV-30 MISSION 1 -- the client's half of the server seam. Every mapper is
 * pure and VALIDATING: an RPC answer is data from the network, so it is
 * checked field by field and dropped when it does not fit, exactly the way
 * the broadcast payload guard treats a chat frame. These tests are what make
 * "the client and the server agree" a measured claim rather than a hope.
 */

const AT = 1_800_000_000_000;

describe('mapServerPurchase', () => {
  it('accepts a well-formed row', () => {
    expect(mapServerPurchase({ packId: 'kp-01', price: 180, at: AT })).toEqual({ packId: 'kp-01', price: 180, at: AT });
  });

  it('accepts a numeric string (jsonb bigints arrive as strings)', () => {
    expect(mapServerPurchase({ packId: 'kp-01', price: '180', at: String(AT) })).toEqual({ packId: 'kp-01', price: 180, at: AT });
  });

  it('drops anything malformed rather than guessing', () => {
    expect(mapServerPurchase({ packId: '', price: 180, at: AT })).toBeNull();
    expect(mapServerPurchase({ packId: 'kp-01', price: 0, at: AT })).toBeNull();
    expect(mapServerPurchase({ packId: 'kp-01', price: -5, at: AT })).toBeNull();
    expect(mapServerPurchase({ packId: 'kp-01', price: 180 })).toBeNull();
    expect(mapServerPurchase(null)).toBeNull();
    expect(mapServerPurchase([1, 2])).toBeNull();
  });
});

describe('mapServerListing', () => {
  const row = { id: 'ul-1', title: 'Tariff rounds', theme: 'economy', price: 120, summary: 'A ladder.', status: 'review', at: AT };

  it('maps a listing and normalises the status to the two the UI renders', () => {
    expect(mapServerListing(row)).toEqual({ id: 'ul-1', title: 'Tariff rounds', theme: 'economy', price: 120, summary: 'A ladder.', at: AT, status: 'review' });
    expect(mapServerListing({ ...row, status: 'live' })?.status).toBe('live');
    // Anything else is treated as still in review -- never as live.
    expect(mapServerListing({ ...row, status: 'retired' })?.status).toBe('review');
    expect(mapServerListing({ ...row, status: 'nonsense' })?.status).toBe('review');
  });

  it('rejects a theme that is not one of the 22 axes', () => {
    expect(mapServerListing({ ...row, theme: 'world' })).toBeNull();
    expect(mapServerListing({ ...row, theme: '' })).toBeNull();
  });

  it('rejects an empty title or a missing id', () => {
    expect(mapServerListing({ ...row, title: '   ' })).toBeNull();
    expect(mapServerListing({ ...row, id: '' })).toBeNull();
  });

  it('defaults a missing summary to empty rather than dropping the row', () => {
    const { summary, ...noSummary } = row;
    void summary;
    expect(mapServerListing(noSummary)?.summary).toBe('');
  });
});

describe('mapServerLedger', () => {
  it('maps the whole envelope', () => {
    const ledger = mapServerLedger({
      credits: 1020,
      starterGranted: true,
      purchases: [{ packId: 'kp-04', price: 90, at: AT }],
      listings: [{ id: 'ul-1', title: 'A', theme: 'law', price: 50, summary: '', status: 'live', at: AT }],
    });
    expect(ledger?.credits).toBe(1020);
    expect(ledger?.purchases).toHaveLength(1);
    expect(ledger?.listings).toHaveLength(1);
  });

  it('drops only the bad rows, keeping the good ones', () => {
    const ledger = mapServerLedger({
      credits: 10,
      purchases: [{ packId: 'kp-04', price: 90, at: AT }, { packId: '', price: 1, at: AT }, null],
      listings: [{ id: 'ul-1', title: 'A', theme: 'nope', price: 50, at: AT }],
    });
    expect(ledger?.purchases.map((p) => p.packId)).toEqual(['kp-04']);
    expect(ledger?.listings).toEqual([]);
  });

  it('returns null for an envelope the UI could not trust', () => {
    expect(mapServerLedger(null)).toBeNull();
    expect(mapServerLedger({ purchases: [] })).toBeNull();
    expect(mapServerLedger({ credits: -1 })).toBeNull();
    expect(mapServerLedger({ credits: 'many' })).toBeNull();
  });

  it('treats absent collections as empty, not as a failure', () => {
    expect(mapServerLedger({ credits: 1200 })).toEqual({ credits: 1200, purchases: [], listings: [] });
  });
});

describe('mapBuyResult', () => {
  it('accepts a balanced split', () => {
    expect(mapBuyResult({ ok: true, packId: 'kp-01', price: 180, credits: 1020, creatorShare: 126, platformShare: 54 })).toEqual({
      packId: 'kp-01',
      price: 180,
      credits: 1020,
      creatorShare: 126,
      platformShare: 54,
    });
  });

  it('REFUSES a split that does not add back up to the price', () => {
    // The table has this as a constraint; the client re-checks it so a
    // broken settlement can never be rendered as if it were fine.
    expect(mapBuyResult({ ok: true, packId: 'kp-01', price: 180, credits: 1020, creatorShare: 126, platformShare: 50 })).toBeNull();
  });

  it('refuses a payload that is not an ok result', () => {
    expect(mapBuyResult({ ok: false, packId: 'kp-01', price: 180, credits: 0, creatorShare: 126, platformShare: 54 })).toBeNull();
    expect(mapBuyResult(null)).toBeNull();
  });
});

describe('mapServerMessage', () => {
  const row = { id: 'm1', room: 'economy', author: 'nomad-1234', authorId: 'u:abc', text: 'hello', at: AT };

  it('maps a stored row into the same shape the broadcast carries', () => {
    expect(mapServerMessage(row)).toEqual({ id: 'm1', room: 'economy', author: 'nomad-1234', authorId: 'u:abc', text: 'hello', at: AT });
  });

  it('re-sanitises text that came back over the wire', () => {
    expect(mapServerMessage({ ...row, text: '  spaced   out  ' })?.text).toBe('spaced out');
  });

  it('clips an over-long author rather than dropping the message', () => {
    expect(mapServerMessage({ ...row, author: 'a'.repeat(60) })?.author).toHaveLength(40);
  });

  it('drops a row for an unknown room, an empty text or a missing id', () => {
    expect(mapServerMessage({ ...row, room: 'world' })).toBeNull();
    expect(mapServerMessage({ ...row, text: '   ' })).toBeNull();
    expect(mapServerMessage({ ...row, id: '' })).toBeNull();
    expect(mapServerMessage({ ...row, authorId: '' })).toBeNull();
    expect(mapServerMessage('message')).toBeNull();
  });
});

describe('mapServerBoard', () => {
  it('maps rows and skips the malformed ones', () => {
    expect(mapServerBoard([
      { handle: 'nomad.kai', sales: 12, revenue: 2688 },
      { handle: '', sales: 1, revenue: 1 },
      { handle: 'cart.mind', sales: 'x', revenue: 1 },
      null,
    ])).toEqual([{ handle: 'nomad.kai', packs: 0, sales: 12, revenue: 2688 }]);
  });

  it('answers an empty list for anything that is not an array', () => {
    expect(mapServerBoard(null)).toEqual([]);
    expect(mapServerBoard({ handle: 'x' })).toEqual([]);
  });
});

describe('classifyHubError', () => {
  it('maps each RPC exception to the reason the UI shows', () => {
    expect(classifyHubError('Not authenticated')).toBe('unauthenticated');
    expect(classifyHubError('Already owned')).toBe('owned');
    expect(classifyHubError('Insufficient credits')).toBe('insufficient');
    expect(classifyHubError('Too fast')).toBe('too-fast');
  });

  it('falls back to a plain refusal for anything unrecognised', () => {
    expect(classifyHubError('some postgres detail')).toBe('rejected');
    expect(classifyHubError(null)).toBe('rejected');
    expect(classifyHubError(undefined)).toBe('rejected');
  });
});
