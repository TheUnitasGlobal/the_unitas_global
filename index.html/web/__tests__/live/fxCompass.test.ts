import { describe, expect, it } from 'vitest';
import {
  DXY_BASKET,
  FX_BASE,
  FX_MAJORS,
  PARITY_ASSETS,
  coinGeckoPriceUrl,
  dollarIndexFrom,
  formatFxRate,
  formatMoney,
  formatSignedPct,
  frankfurterWindowUrl,
  pairQuoteFrom,
  parityRowsFrom,
  parseFrankfurterWindow,
  pctChange,
  pickHomeCurrency,
} from '@/lib/live/fxCompass';
import { FRANKFURTER_SYMBOLS } from '@/lib/live/slotSections';
import type { FxSeriesPoint } from '@/lib/live/discoverySlots';

// REV-41 SPEC.md D-3 -- the fx compass maths, pinned without a network: the
// home-currency rule, the one-request window, the pair / index / parity
// derivations and the number formats the rows print.

const pt = (date: string, rate: number): FxSeriesPoint => ({ date, rate });

describe('fx compass · constants', () => {
  it('keeps the base at USD, four majors and a DXY basket that sums to one and is ECB-published', () => {
    expect(FX_BASE).toBe('USD');
    expect(FX_MAJORS).toEqual(['EUR', 'JPY', 'GBP', 'CNY']);
    expect(DXY_BASKET.map((b) => b.code)).toEqual(['EUR', 'JPY', 'GBP', 'CAD', 'SEK', 'CHF']);
    expect(DXY_BASKET.reduce((s, b) => s + b.weight, 0)).toBeCloseTo(1, 9);
    for (const b of DXY_BASKET) expect(FRANKFURTER_SYMBOLS).toContain(b.code);
    for (const m of FX_MAJORS) expect(FRANKFURTER_SYMBOLS).toContain(m);
    expect(PARITY_ASSETS.map((a) => a.id)).toEqual(['bitcoin', 'ethereum', 'pax-gold']);
  });
});

describe('pickHomeCurrency', () => {
  it('takes the selected country currency when the ECB publishes it and it is not the base', () => {
    expect(pickHomeCurrency('KR', 'en')).toBe('KRW');
    expect(pickHomeCurrency('kr', 'en')).toBe('KRW');
    expect(pickHomeCurrency('JP', 'ko')).toBe('JPY');
    expect(pickHomeCurrency('DE', 'ko')).toBe('EUR');
    expect(pickHomeCurrency('PH', 'en')).toBe('PHP');
  });

  it('falls to the locale country currency when the country is USD or unpublished', () => {
    expect(pickHomeCurrency('US', 'ko')).toBe('KRW');
    expect(pickHomeCurrency('KH', 'ko')).toBe('KRW'); // KHR is not an ECB rate
    expect(pickHomeCurrency('VN', 'ja')).toBe('JPY'); // VND is not an ECB rate
    expect(pickHomeCurrency(undefined, 'ja')).toBe('JPY');
    expect(pickHomeCurrency(null, 'tr')).toBe('TRY');
  });

  it('falls to EUR when both the country and the locale are USD or unpublished', () => {
    expect(pickHomeCurrency('US', 'en')).toBe('EUR');
    expect(pickHomeCurrency('KH', 'en')).toBe('EUR');
    expect(pickHomeCurrency('VN', 'vi')).toBe('EUR');
    expect(pickHomeCurrency('ZZ', 'zz')).toBe('EUR');
  });
});

describe('request URLs', () => {
  it('builds the one Frankfurter v2 window request on the .dev host', () => {
    expect(frankfurterWindowUrl(['EUR', 'JPY'], '2026-08-14')).toBe('https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR%2CJPY&from=2026-08-14');
    expect(frankfurterWindowUrl(['EUR'], '2026-08-14', 'USD', '2026-09-13')).toContain('&to=2026-09-13');
    expect(frankfurterWindowUrl(['EUR'], '2026-08-14')).not.toContain('frankfurter.app');
  });

  it('builds the CoinGecko simple/price request in USD plus the home currency, lower-cased', () => {
    expect(coinGeckoPriceUrl('KRW')).toBe(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cethereum%2Cpax-gold&vs_currencies=usd%2Ckrw&include_24hr_change=true',
    );
    expect(coinGeckoPriceUrl('USD')).toContain('vs_currencies=usd&');
    expect(coinGeckoPriceUrl('eur', ['bitcoin'])).toContain('ids=bitcoin&vs_currencies=usd%2Ceur');
  });
});

describe('parseFrankfurterWindow', () => {
  const rows = [
    { date: '2026-09-12', base: 'USD', quote: 'EUR', rate: 0.9 },
    { date: '2026-09-10', base: 'USD', quote: 'EUR', rate: 0.92 },
    { date: '2026-09-11', base: 'USD', quote: 'EUR', rate: 0.91 },
    { date: '2026-09-11', base: 'USD', quote: 'KRW', rate: 1385 },
    { date: '2026-09-11', base: 'USD', quote: 'KRW', rate: 9999 }, // duplicate date: first row wins
    { date: '2026-09-11', base: 'USD', quote: 'XYZ', rate: 1 }, // not requested
    { date: '2026-09-12', base: 'USD', quote: 'JPY', rate: Number.NaN },
    { date: '2026-09-12', base: 'USD', quote: 'JPY', rate: -1 },
  ];

  it('yields a date-ascending series per requested quote and the newest date across them', () => {
    const w = parseFrankfurterWindow(rows, ['EUR', 'KRW', 'JPY']);
    expect(w?.base).toBe('USD');
    expect(w?.date).toBe('2026-09-12');
    expect(w?.byQuote.get('EUR')).toEqual([pt('2026-09-10', 0.92), pt('2026-09-11', 0.91), pt('2026-09-12', 0.9)]);
    expect(w?.byQuote.get('KRW')).toEqual([pt('2026-09-11', 1385)]);
    expect(w?.byQuote.has('JPY')).toBe(false);
    expect(w?.byQuote.has('XYZ')).toBe(false);
  });

  it('rejects the v1 object shape, an empty array and an array with no usable row', () => {
    expect(parseFrankfurterWindow({ amount: 1, rates: { EUR: 0.9 } }, ['EUR'])).toBeNull();
    expect(parseFrankfurterWindow([], ['EUR'])).toBeNull();
    expect(parseFrankfurterWindow([{ date: '2026-09-12', quote: 'JPY', rate: 'x' }], ['JPY'])).toBeNull();
    expect(parseFrankfurterWindow(null, ['EUR'])).toBeNull();
  });
});

describe('pairQuoteFrom / pctChange', () => {
  it('reads the latest rate, the move against the previous row and against the first row', () => {
    const q = pairQuoteFrom('KRW', [pt('2026-08-14', 1400), pt('2026-09-11', 1385), pt('2026-09-12', 1390.5)]);
    expect(q?.code).toBe('KRW');
    expect(q?.rate).toBe(1390.5);
    expect(q?.change24h).toBeCloseTo(((1390.5 - 1385) / 1385) * 100, 9);
    expect(q?.change30d).toBeCloseTo(((1390.5 - 1400) / 1400) * 100, 9);
    expect(q?.series).toHaveLength(3);
  });

  it('is honest about a window too short to measure', () => {
    const one = pairQuoteFrom('EUR', [pt('2026-09-12', 0.9)]);
    expect(one?.rate).toBe(0.9);
    expect(one?.change24h).toBeNull();
    expect(one?.change30d).toBeNull();
    expect(pairQuoteFrom('EUR', [])).toBeNull();
    expect(pctChange(100, 110)).toBe(10);
    expect(pctChange(0, 5)).toBeNull();
    expect(pctChange(Number.NaN, 5)).toBeNull();
  });
});

describe('dollarIndexFrom', () => {
  const legs = (scale: (i: number) => number) =>
    new Map<string, FxSeriesPoint[]>(
      DXY_BASKET.map((b, k) => [b.code, [0, 1, 2].map((i) => pt(`2026-09-1${i}`, (k + 1) * scale(i)))]),
    );

  it('reads 100 on the first day and moves with the geometric weighted basket', () => {
    const flat = dollarIndexFrom(legs(() => 1));
    expect(flat?.series.map((p) => p.rate)).toEqual([100, 100, 100]);
    expect(flat?.value).toBe(100);
    // Every quote up 10 % = a dollar 10 % stronger against the basket.
    const up = dollarIndexFrom(legs((i) => (i === 2 ? 1.1 : 1)));
    expect(up?.series[0].rate).toBeCloseTo(100, 9);
    expect(up?.value).toBeCloseTo(110, 6);
    // A rising quote is a STRONGER dollar; a falling one weakens it.
    const down = dollarIndexFrom(legs((i) => (i === 2 ? 0.9 : 1)));
    expect(down?.value).toBeCloseTo(90, 6);
  });

  it('uses only the dates every basket leg published and refuses a basket with a missing leg', () => {
    const map = legs(() => 1);
    map.set('SEK', [pt('2026-09-10', 5), pt('2026-09-12', 5)]);
    expect(dollarIndexFrom(map)?.series.map((p) => p.date)).toEqual(['2026-09-10', '2026-09-12']);
    map.delete('CHF');
    expect(dollarIndexFrom(map)).toBeNull();
    expect(dollarIndexFrom(new Map())).toBeNull();
  });
});

describe('parityRowsFrom', () => {
  const body = {
    bitcoin: { usd: 65000, krw: 90000000, usd_24h_change: 1.5, krw_24h_change: 1.4 },
    ethereum: { usd: 3000, usd_24h_change: -0.5 },
    'pax-gold': { usd: 'n/a' },
  };

  it('maps the assets in order, leaving home null when CoinGecko has no quote and dropping a priceless asset', () => {
    const rows = parityRowsFrom(body, 'KRW');
    expect(rows.map((r) => r.symbol)).toEqual(['BTC', 'ETH']);
    expect(rows[0]).toEqual({ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', usd: 65000, home: 90000000, change24h: 1.5 });
    expect(rows[1]).toEqual({ id: 'ethereum', symbol: 'ETH', name: 'Ethereum', usd: 3000, home: null, change24h: -0.5 });
    expect(parityRowsFrom(body, 'usd')[0].home).toBe(65000);
  });

  it('fails open on anything that is not the price object', () => {
    expect(parityRowsFrom(null, 'KRW')).toEqual([]);
    expect(parityRowsFrom([], 'KRW')).toEqual([]);
    expect(parityRowsFrom({ error: 'rate limited' }, 'KRW')).toEqual([]);
  });
});

describe('formats', () => {
  it('prints a rate with enough digits to show a day of movement', () => {
    expect(formatFxRate(1390.5)).toBe('1390.50');
    expect(formatFxRate(154.08)).toBe('154.08');
    expect(formatFxRate(10.4)).toBe('10.400');
    expect(formatFxRate(7.1234)).toBe('7.1234');
    expect(formatFxRate(0.86094)).toBe('0.8609');
    expect(formatFxRate(Number.NaN)).toBe('—');
  });

  it('signs a percentage move', () => {
    expect(formatSignedPct(0.397)).toBe('+0.40%');
    expect(formatSignedPct(-1.0989)).toBe('-1.10%');
    expect(formatSignedPct(0)).toBe('0.00%');
  });

  it('prints money in the locale and falls back on a code Intl rejects', () => {
    expect(formatMoney(65000, 'USD', 'en')).toBe('$65,000');
    expect(formatMoney(2600.5, 'USD', 'en')).toBe('$2,601');
    expect(formatMoney(12.345, 'EUR', 'en')).toBe('€12.35');
    expect(formatMoney(12.345, 'XXXX', 'en')).toBe('12.35 XXXX');
  });
});
