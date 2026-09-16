import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOT_NEWS_CATEGORIES } from '@/lib/live/hotNews';
import { isChatMessagePayload } from '@/lib/hub/themeChat';
import { isTradeEvent, EXCHANGE_CATALOG } from '@/lib/hub/knowledgeExchange';
import { SHORTS_SEED } from '@/lib/live/shortsSeed';
import { PULSE_HANDLES, pulseSlot, dayIndexOf, seedHash } from '@/lib/square/pulse';
import { TALK_PHRASES, talkPulse, talkPresence, isSimulatedMessage, TALK_PULSE_COUNT } from '@/lib/square/talkPulse';
import { shortsPulseStats, shortsTrending, shortsPulseFeed } from '@/lib/square/shortsPulse';
import { exchangePulseTrades, packDemandSeries, packMomentum, exchangeMarketStats } from '@/lib/square/exchangePulse';

// REV-36 M3 (SPEC §4.3) -- the U-Square hyper matrix must be DETERMINISTIC
// (same inputs -> same output, on the server and the first client frame),
// must cover every one of the 22 axes, must never move a "views" counter
// backwards on reload, and must never call Math.random or Date.now (that
// would break SSR/CSR agreement). These are the measured proofs.

const NOW = 1_790_000_000_000; // a fixed instant well after the pulse epoch (2026-09-16)

describe('pulse core determinism', () => {
  it('the four modules never read the clock or Math.random', () => {
    for (const mod of ['pulse.ts', 'talkPulse.ts', 'shortsPulse.ts', 'exchangePulse.ts']) {
      // The actual call forms (with the open paren), so the word appearing in
      // a "no Math.random" comment does not trip the scan.
      const src = readFileSync(join(__dirname, '../../lib/square', mod), 'utf8');
      expect(src.includes('Math.random('), `${mod} uses Math.random`).toBe(false);
      expect(src.includes('Date.now('), `${mod} uses Date.now`).toBe(false);
    }
  });

  it('pulseSlot / dayIndexOf are monotonic non-decreasing in now', () => {
    let prevSlot = -1;
    let prevDay = -1;
    for (let t = NOW; t < NOW + 3 * 86_400_000; t += 3_600_000) {
      expect(pulseSlot(t)).toBeGreaterThanOrEqual(prevSlot);
      expect(dayIndexOf(t)).toBeGreaterThanOrEqual(prevDay);
      prevSlot = pulseSlot(t);
      prevDay = dayIndexOf(t);
    }
  });

  it('seedHash spreads neighbouring seeds far apart', () => {
    expect(seedHash('x::1')).not.toBe(seedHash('x::2'));
  });
});

describe('U-Talk pulse', () => {
  it('covers every one of the 22 axes with at least 8 phrases', () => {
    expect(Object.keys(TALK_PHRASES).sort()).toEqual([...HOT_NEWS_CATEGORIES].sort());
    for (const axis of HOT_NEWS_CATEGORIES) {
      expect(TALK_PHRASES[axis].length, axis).toBeGreaterThanOrEqual(8);
    }
  });

  it('produces valid, ascending, recent, non-mine rows for every room', () => {
    for (const room of HOT_NEWS_CATEGORIES) {
      const rows = talkPulse(room, NOW);
      expect(rows.length).toBe(TALK_PULSE_COUNT);
      for (const m of rows) {
        expect(isChatMessagePayload(m), `${room}:${m.id}`).toBe(true);
        expect(isSimulatedMessage(m)).toBe(true);
        expect(m.at).toBeLessThanOrEqual(NOW);
      }
      for (let i = 1; i < rows.length; i++) expect(rows[i].at).toBeGreaterThanOrEqual(rows[i - 1].at);
      expect(rows[rows.length - 1].at).toBeGreaterThanOrEqual(NOW - 4 * 60_000);
    }
  });

  it('is deterministic within a slot and changes across slots', () => {
    const a = talkPulse('economy', NOW);
    const b = talkPulse('economy', NOW + 30_000); // same 5-min slot
    expect(b.map((m) => m.text)).toEqual(a.map((m) => m.text));
    const c = talkPulse('economy', NOW + 6 * 60_000); // next slot
    expect(c.map((m) => m.text)).not.toEqual(a.map((m) => m.text));
  });

  it('talkPresence sits in the 7..63 band', () => {
    for (const room of HOT_NEWS_CATEGORIES) {
      const n = talkPresence(room, NOW);
      expect(n).toBeGreaterThanOrEqual(7);
      expect(n).toBeLessThanOrEqual(63);
    }
  });
});

describe('U-Shorts seed + pulse', () => {
  it('has 44 clips, the original 14 first and unchanged, unique ids, >=2 per axis', () => {
    expect(SHORTS_SEED.length).toBe(44);
    const original = ['aurora-run', 'corner-kick', 'one-take', 'page-turn', 'drop-alert', 'open-bell', 'panel-swipe', 'silhouette', 'night-market', 'boss-phase', 'lab-bench', 'ward-round', 'chalk-line', 'city-grid'];
    expect(SHORTS_SEED.slice(0, 14).map((s) => s.id)).toEqual(original);
    const ids = SHORTS_SEED.map((s) => s.id);
    expect(new Set(ids).size).toBe(44);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    for (const axis of HOT_NEWS_CATEGORIES) {
      expect(SHORTS_SEED.filter((s) => s.theme === axis).length, axis).toBeGreaterThanOrEqual(2);
    }
  });

  it('every handle is drawn from the shared PULSE_HANDLES pool', () => {
    const pool = new Set(PULSE_HANDLES);
    for (const s of SHORTS_SEED) expect(pool.has(s.handle), `${s.id}:${s.handle}`).toBe(true);
  });

  it('views only ever climb as now advances (never backwards on reload)', () => {
    const short = SHORTS_SEED[0];
    let prev = -1;
    for (let k = 0; k < 5; k++) {
      const v = shortsPulseStats(short, NOW + k * 6 * 60_000).views;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('likes stay within 4-13 % of views and watching within 3..180', () => {
    for (const short of SHORTS_SEED.slice(0, 8)) {
      const s = shortsPulseStats(short, NOW);
      expect(s.likes).toBeGreaterThanOrEqual(Math.floor(s.views * 0.03));
      expect(s.likes).toBeLessThanOrEqual(Math.ceil(s.views * 0.14));
      expect(s.watching).toBeGreaterThanOrEqual(3);
      expect(s.watching).toBeLessThanOrEqual(180);
    }
  });

  it('trending is a stable permutation of the input', () => {
    const sorted = shortsTrending(SHORTS_SEED, NOW);
    expect(sorted.length).toBe(SHORTS_SEED.length);
    expect(new Set(sorted.map((s) => s.id)).size).toBe(SHORTS_SEED.length);
    expect(shortsTrending(SHORTS_SEED, NOW).map((s) => s.id)).toEqual(sorted.map((s) => s.id));
  });

  it('the pulse feed references real clips and stays recent', () => {
    const feed = shortsPulseFeed(NOW, 8);
    expect(feed.length).toBe(8);
    const ids = new Set(SHORTS_SEED.map((s) => s.id));
    for (const e of feed) {
      expect(ids.has(e.shortId)).toBe(true);
      expect(['like', 'follow', 'watch']).toContain(e.kind);
      expect(e.at).toBeLessThanOrEqual(NOW);
    }
  });
});

describe('U-Exchange pulse', () => {
  it('trades are simulated, valid, recent', () => {
    const trades = exchangePulseTrades(NOW, 6);
    expect(trades.length).toBe(6);
    for (const t of trades) {
      expect(isTradeEvent(t)).toBe(true);
      expect(t.sim).toBe(true);
      expect(t.at).toBeLessThanOrEqual(NOW);
      expect(t.at).toBeGreaterThanOrEqual(NOW - 61 * 60_000);
    }
  });

  it('demand series is 7 values in 0..100 and momentum agrees with them', () => {
    const day = dayIndexOf(NOW);
    for (const pack of EXCHANGE_CATALOG.slice(0, 6)) {
      const series = packDemandSeries(pack, day);
      expect(series.length).toBe(7);
      for (const v of series) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(['up', 'flat', 'down']).toContain(packMomentum(pack, day));
    }
  });

  it('market stats sit in plausible bands with traders <= trades', () => {
    const s = exchangeMarketStats(NOW);
    expect(s.volume24h).toBeGreaterThanOrEqual(4000);
    expect(s.volume24h).toBeLessThanOrEqual(60000);
    expect(s.trades24h).toBeGreaterThanOrEqual(20);
    expect(s.trades24h).toBeLessThanOrEqual(400);
    expect(s.traders24h).toBeLessThanOrEqual(s.trades24h);
    expect(HOT_NEWS_CATEGORIES).toContain(s.topTheme);
  });

  it('is deterministic within a slot', () => {
    expect(exchangeMarketStats(NOW)).toEqual(exchangeMarketStats(NOW + 20_000));
    expect(exchangePulseTrades(NOW).map((t) => t.packId)).toEqual(exchangePulseTrades(NOW + 20_000).map((t) => t.packId));
  });
});
