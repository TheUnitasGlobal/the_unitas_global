/**
 * REV-41 D-3 -- the fx compass: the pure maths behind the "환율 나침반" card.
 *
 * Before REV-41 the fx slot spent one Frankfurter call on four latest-day
 * quotes, rendered them as facts only (`items: []`, so the meta line read
 * "0건") and pinned EUR as the emphasised figure for every visitor. The
 * founder's directive (SPEC §0 1-D): kill the zero count, render a global
 * macro board, crypto parity and 30-day sparklines, and let the visitor's
 * OWN currency pair -- resolved from the Geo-IP / profile country, not the
 * language -- be the largest figure on the card.
 *
 * Still ONE Frankfurter request: v2 `rates?base=USD&quotes=…&from=<30d ago>`
 * answers a flat `{ date, base, quote, rate }` row per quote per publishing
 * day, so the latest rate, the previous-day change, the 30-day change, every
 * sparkline and the dollar-strength index all fall out of the same body.
 * One optional CoinGecko `simple/price` call (fail-open) adds BTC / ETH /
 * PAXG in USD and in the home currency. Nothing here is a key, a paid
 * endpoint or a U-COIN burn.
 *
 * Pure: no fetch, no React, no clock. The adapter in discoverySlots.ts does
 * the two requests; everything else is testable in node.
 */
import type { FxPairQuote, FxParityRow, FxSeriesPoint } from '@/lib/live/discoverySlots';
import { COUNTRY_CURRENCY, FRANKFURTER_SYMBOLS } from '@/lib/live/slotSections';
import { localeCountry } from '@/lib/live/slotContext';

/** Every quote is "units of QUOTE per one USD" -- the ECB reference rates
 *  re-based on the dollar, which is how the DXY-style index reads too. */
export const FX_BASE = 'USD';

/** The global macro board: the four majors every visitor sees. */
export const FX_MAJORS = ['EUR', 'JPY', 'GBP', 'CNY'] as const;

/** ICE DXY weights (57.6 / 13.6 / 11.9 / 9.1 / 4.2 / 3.6, summing to 1) over
 *  the six ECB-published currencies -- the "dollar strength index
 *  (approx.)" of SPEC D-3. Geometric, like the real index. */
export const DXY_BASKET: ReadonlyArray<{ code: string; weight: number }> = [
  { code: 'EUR', weight: 0.576 },
  { code: 'JPY', weight: 0.136 },
  { code: 'GBP', weight: 0.119 },
  { code: 'CAD', weight: 0.091 },
  { code: 'SEK', weight: 0.042 },
  { code: 'CHF', weight: 0.036 },
];

/** The series window the sparklines and the 30-day change read. */
export const FX_WINDOW_DAYS = 30;

/** CoinGecko ids → the parity rows, in display order. PAXG is the gold
 *  proxy: one token = one troy ounce of vaulted gold, priced keylessly. */
export const PARITY_ASSETS: ReadonlyArray<{ id: string; symbol: string; name: string }> = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'pax-gold', symbol: 'PAXG', name: 'PAX Gold' },
];

function publishedNonBase(code: string | undefined): string | null {
  if (!code || code === FX_BASE) return null;
  return FRANKFURTER_SYMBOLS.includes(code) ? code : null;
}

/**
 * The hero pair's quote currency, by descending intent (SPEC D-3): the
 * selected country's currency when the ECB publishes it and it is not the
 * base; else the currency of the country the LOCALE implies, under the
 * same two conditions; else EUR (the ECB's own unit, always published).
 * A US visitor therefore gets USD/EUR, a Korean reader in the US gets
 * USD/KRW, a Cambodian reader (KHR, unpublished) gets EUR.
 */
export function pickHomeCurrency(country: string | null | undefined, locale: string): string {
  const own = publishedNonBase(COUNTRY_CURRENCY[(country ?? '').trim().toUpperCase()]);
  if (own) return own;
  const byLocale = publishedNonBase(COUNTRY_CURRENCY[localeCountry(locale)]);
  if (byLocale) return byLocale;
  return 'EUR';
}

/** Frankfurter v2 window URL: one request, every quote, every publishing
 *  day from `from` (ISO date) to today (or `to`). */
export function frankfurterWindowUrl(quotes: readonly string[], from: string, base = FX_BASE, to?: string): string {
  const params = new URLSearchParams({ base, quotes: quotes.join(','), from });
  if (to) params.set('to', to);
  return `https://api.frankfurter.dev/v2/rates?${params.toString()}`;
}

/** CoinGecko simple/price for the parity assets, in USD and the home
 *  currency (lower-cased, as the API wants), with the 24 h change. */
export function coinGeckoPriceUrl(home: string, ids: readonly string[] = PARITY_ASSETS.map((a) => a.id)): string {
  const vs = Array.from(new Set(['usd', home.toLowerCase()])).join(',');
  const params = new URLSearchParams({ ids: ids.join(','), vs_currencies: vs, include_24hr_change: 'true' });
  return `https://api.coingecko.com/api/v3/simple/price?${params.toString()}`;
}

export interface FxWindow {
  base: string;
  /** Newest publishing date across every quote. */
  date: string;
  /** Date-ascending series per requested quote; a quote the API did not
   *  answer for is simply absent. */
  byQuote: Map<string, FxSeriesPoint[]>;
}

interface WindowRow {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
}

/** Pure: the flat v2 row array → one date-ordered series per requested
 *  quote (duplicate dates collapse to the first row seen), or null when the
 *  body is not the v2 array or carries no usable row for any quote. */
export function parseFrankfurterWindow(json: unknown, quotes: readonly string[]): FxWindow | null {
  if (!Array.isArray(json)) return null;
  const wanted = new Set(quotes);
  const seen = new Map<string, Map<string, number>>();
  let base = '';
  let date = '';
  for (const row of json as WindowRow[]) {
    if (!row || typeof row !== 'object') continue;
    if (typeof row.quote !== 'string' || !wanted.has(row.quote)) continue;
    if (typeof row.date !== 'string' || typeof row.rate !== 'number' || !Number.isFinite(row.rate) || row.rate <= 0) continue;
    if (!base && typeof row.base === 'string') base = row.base;
    let byDate = seen.get(row.quote);
    if (!byDate) {
      byDate = new Map();
      seen.set(row.quote, byDate);
    }
    if (!byDate.has(row.date)) byDate.set(row.date, row.rate);
    if (row.date > date) date = row.date;
  }
  if (seen.size === 0) return null;
  const byQuote = new Map<string, FxSeriesPoint[]>();
  for (const code of quotes) {
    const byDate = seen.get(code);
    if (!byDate) continue;
    const series = Array.from(byDate, ([d, rate]) => ({ date: d, rate })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    byQuote.set(code, series);
  }
  return { base: base || FX_BASE, date, byQuote };
}

/** Signed percentage move from `from` to `to`; null when there is no
 *  positive reference to measure against. */
export function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null;
  return ((to - from) / from) * 100;
}

/**
 * One pair from its window: the latest rate, the move against the previous
 * PUBLISHED row (`change24h` -- a Monday reads against Friday, which is what
 * "vs yesterday" honestly means for ECB data) and against the first row of
 * the window (`change30d`). Both are signed percentages; either is null
 * when the window is too short to measure it.
 */
export function pairQuoteFrom(code: string, series: readonly FxSeriesPoint[]): FxPairQuote | null {
  if (series.length === 0) return null;
  const last = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;
  const first = series.length >= 2 ? series[0] : null;
  return {
    code,
    rate: last.rate,
    change24h: prev ? pctChange(prev.rate, last.rate) : null,
    change30d: first ? pctChange(first.rate, last.rate) : null,
    series: series.map((p) => ({ date: p.date, rate: p.rate })),
  };
}

/**
 * The dollar-strength index (approx.): a geometric, DXY-weighted index of
 * the six basket quotes, normalised so the window's FIRST common day reads
 * 100. Quotes are units-per-USD, so a rising quote is a stronger dollar and
 * the index rises with it: `100 · Π (rate_t / rate_0) ^ w`. Only dates every
 * basket leg published are used (the ECB publishes them together, so that is
 * every working day); a basket leg missing from the window yields null
 * rather than a re-weighted fake.
 */
export function dollarIndexFrom(
  byQuote: ReadonlyMap<string, readonly FxSeriesPoint[]>,
  basket: ReadonlyArray<{ code: string; weight: number }> = DXY_BASKET,
): { value: number; series: FxSeriesPoint[] } | null {
  if (basket.length === 0) return null;
  const legs: Array<{ weight: number; byDate: Map<string, number> }> = [];
  for (const leg of basket) {
    const points = byQuote.get(leg.code);
    if (!points || points.length === 0) return null;
    legs.push({ weight: leg.weight, byDate: new Map(points.map((p) => [p.date, p.rate])) });
  }
  const dates = Array.from(legs[0].byDate.keys())
    .filter((d) => legs.every((l) => l.byDate.has(d)))
    .sort();
  if (dates.length === 0) return null;
  const d0 = dates[0];
  const series: FxSeriesPoint[] = dates.map((date) => ({
    date,
    rate: 100 * legs.reduce((acc, l) => acc * Math.pow(l.byDate.get(date)! / l.byDate.get(d0)!, l.weight), 1),
  }));
  return { value: series[series.length - 1].rate, series };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * CoinGecko `simple/price` body → parity rows in PARITY_ASSETS order. An
 * asset without a finite USD price is dropped; a missing home-currency
 * price (CoinGecko does not quote every ECB currency) leaves `home` null
 * rather than inventing a cross rate. Anything that is not the expected
 * object yields `[]` -- the card renders without the parity block.
 */
export function parityRowsFrom(json: unknown, home: string): FxParityRow[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const body = json as Record<string, unknown>;
  const homeKey = home.toLowerCase();
  const rows: FxParityRow[] = [];
  for (const asset of PARITY_ASSETS) {
    const entry = body[asset.id];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const usd = finiteNumber(e.usd);
    if (usd === null) continue;
    rows.push({
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      usd,
      home: homeKey === 'usd' ? usd : finiteNumber(e[homeKey]),
      change24h: finiteNumber(e.usd_24h_change),
    });
  }
  return rows;
}

/** Enough digits to show a day's move: 2 for ≥ 100 (JPY, KRW), 3 for ≥ 10,
 *  4 below (EUR 0.8609 -- at 2 digits a whole week can read unchanged). */
export function formatFxRate(rate: number): string {
  if (!Number.isFinite(rate)) return '—';
  return rate.toFixed(rate >= 100 ? 2 : rate >= 10 ? 3 : 4);
}

/** "+0.32%" / "-0.15%" / "0.00%" -- the sign IS the information. */
export function formatSignedPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/** Locale-aware money for the parity rows (Intl knows every ISO code the
 *  ECB and CoinGecko publish; a stray code falls back to "1234.50 XXX"). */
export function formatMoney(value: number, currency: string, locale: string): string {
  const digits = Math.abs(value) >= 1000 ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency.toUpperCase()}`;
  }
}
