/**
 * REV-36 MISSION 3 -- 유지식거래소 (Knowledge Exchange) hyper matrix. The
 * ticker used to say "no trade signal yet" until a real purchase happened;
 * now the exchange opens on a living market -- a trade ticker, a 24h market
 * bar and a 7-day demand sparkline per pack -- all deterministic from the
 * pulse slot and the UTC day, all marked as simulation, and all overridden by
 * the real server ledger the moment it has rows (lib/hub/hubLedger.ts).
 */
import { EXCHANGE_CATALOG, type TradeEvent } from '@/lib/hub/knowledgeExchange';
import type { HotNewsCategory } from '@/lib/live/hotNews';
import type { KnowledgePack } from '@/lib/hub/knowledgeExchange';
import { PULSE_SLOT_MS, intIn, mulberry32, pickHandle, pulseSlot, seedHash } from './pulse';

/**
 * Pure: the simulated trade ticker -- `count` purchases within the last hour,
 * newest first, each carrying `sim: true` so the panel can style it and so no
 * simulated trade is ever counted as revenue. Every row passes isTradeEvent.
 */
export function exchangePulseTrades(now: number, count = 6): TradeEvent[] {
  const slot = pulseSlot(now);
  const rand = mulberry32(seedHash(`exchange-trades::${slot}`));
  const trades: TradeEvent[] = [];
  // Spread the rows across the last ~58 minutes, newest first, so the oldest
  // still sits inside the "last 60 minutes" the ticker claims: a base spacing
  // plus a jitter of at most half a step keeps the whole span bounded.
  const spacing = Math.max(20_000, Math.floor((58 * 60_000) / count));
  let at = now - intIn(rand, 0, 90_000);
  for (let i = 0; i < count; i++) {
    const pack = EXCHANGE_CATALOG[Math.floor(rand() * EXCHANGE_CATALOG.length) % EXCHANGE_CATALOG.length];
    trades.push({ packId: pack.id, buyer: pickHandle(rand), at, sim: true });
    at -= spacing - intIn(rand, 0, Math.floor(spacing / 3));
  }
  return trades;
}

/**
 * Pure: a 7-day demand series for one pack, each value 0..100, day-seeded so
 * the sparkline is the same on every device and only turns over at UTC
 * midnight. The last value is the newest day.
 */
export function packDemandSeries(pack: KnowledgePack, dayIndex: number): number[] {
  const series: number[] = [];
  for (let d = 6; d >= 0; d--) {
    const rand = mulberry32(seedHash(`exchange-demand::${pack.id}::${dayIndex - d}`));
    series.push(intIn(rand, 0, 100));
  }
  return series;
}

export type PackMomentum = 'up' | 'flat' | 'down';

/** Pure: the pack's momentum from the last two demand values. */
export function packMomentum(pack: KnowledgePack, dayIndex: number): PackMomentum {
  const series = packDemandSeries(pack, dayIndex);
  const delta = series[series.length - 1] - series[series.length - 2];
  if (delta > 6) return 'up';
  if (delta < -6) return 'down';
  return 'flat';
}

export interface MarketStats {
  /** Credits traded in the last 24h. */
  volume24h: number;
  /** Number of trades in the last 24h. */
  trades24h: number;
  /** Distinct buyers in the last 24h (<= trades24h). */
  traders24h: number;
  /** The theme with the most volume today. */
  topTheme: HotNewsCategory;
}

/**
 * Pure: the 24h market bar, seeded by day + slot so it drifts through the day
 * yet is identical on every device at the same minute. Bands are plausible
 * for a young marketplace.
 */
export function exchangeMarketStats(now: number): MarketStats {
  const slot = pulseSlot(now);
  const rand = mulberry32(seedHash(`exchange-market::${slot}`));
  const trades24h = intIn(rand, 20, 400);
  const volume24h = intIn(rand, 4000, 60000);
  const traders24h = Math.max(1, Math.min(trades24h, intIn(rand, Math.ceil(trades24h * 0.4), trades24h)));
  const theme = EXCHANGE_CATALOG[Math.floor(rand() * EXCHANGE_CATALOG.length) % EXCHANGE_CATALOG.length].theme;
  return { volume24h, trades24h, traders24h, topTheme: theme };
}

export { PULSE_SLOT_MS };
