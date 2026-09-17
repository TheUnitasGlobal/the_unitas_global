'use client';

import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { FxCompassWidget, FxParityRow, FxSeriesPoint } from '@/lib/live/discoverySlots';
import { formatFxRate, formatMoney, formatSignedPct } from '@/lib/live/fxCompass';
import type { SlotWidgetVariant } from './SlotWidgetView';

/**
 * REV-41 D-3 / D-8 (founder directive 2026-09-17, mission 1-D) -- the FX
 * compass hero. The fx card used to be four facts and no rows, its first
 * fact the euro for everyone; the founder ordered the visitor's OWN pair
 * (Korea -> USD/KRW) as the largest type on the strip, its previous-day and
 * 30-day moves, a 30-day sparkline, a global macro board, a dollar-strength
 * index and crypto parity in the home currency.
 *
 * Everything drawn here comes from ONE `FxCompassWidget` the adapter built
 * from a single Frankfurter window + one fail-open CoinGecko call
 * (lib/live/discoverySlots.ts fxSlot, lib/live/fxCompass.ts). No fetch, no
 * clock, no Date.now() / Math.random(): the sparkline is a polyline scaled
 * to the series' own min / max, and the only numbers formatted here go
 * through Intl.NumberFormat(locale) -- never a hand-rolled separator.
 *
 * The 4-state contract (SPEC D-8): a widget of the right kind paints the
 * hero; no widget while the host loads paints nothing (the host's own
 * loading line speaks); no widget once the host has settled is the honest
 * `[data-fx-unreadable]` line -- a Frankfurter outage is an EMPTY_CARD with
 * no widget, and a blank card is the one outcome the founder forbade.
 *
 * E2E contract (rev41-uai-popup 1-D): `[data-fx-hero]` visible and
 * containing the quote code, `[data-fx-hero-value]` computed >= 40px
 * (`.qw-fx-hero-value` clamp(40px, 9vw, 72px), §29), `[data-fx-spark]`
 * attached, and `[data-fx-unreadable]` never together with the hero.
 */
export interface FxCompassHeroProps {
  widget: FxCompassWidget | undefined;
  variant: SlotWidgetVariant;
  loading: boolean;
  accent: string;
}

type Sign = 'up' | 'down' | 'flat';

/** The sign that colours a delta (§29 `.qw-fx-delta[data-sign]`). */
function signOf(value: number | null): Sign {
  if (value === null || !Number.isFinite(value) || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
}

/** The hero digit and the board rates: formatFxRate's decimal rule (2 dp
 *  at >= 100, 3 dp at >= 10, 4 dp below -- a day's move stays visible on
 *  every pair, so the digits here never disagree with the fx item rows the
 *  adapter wrote) with the locale's own grouping on top ("1,380.25" for
 *  ko / en, "1.380,25" for de). formatFxRate's plain digits are the
 *  fallback when Intl rejects the locale tag. */
function formatRate(rate: number, locale: string): string {
  if (!Number.isFinite(rate)) return formatFxRate(rate);
  const digits = rate >= 100 ? 2 : rate >= 10 ? 3 : 4;
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(rate);
  } catch {
    return formatFxRate(rate);
  }
}

/** The dollar index is a 100-based number read to one decimal. */
function formatIndex(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  } catch {
    return value.toFixed(1);
  }
}

/** PAXG is the gold proxy (one token = one vaulted troy ounce); it is
 *  labelled as gold, not by its ticker name. */
function isGold(row: FxParityRow): boolean {
  return row.id === 'pax-gold' || row.symbol === 'PAXG';
}

/* ---- sparkline --------------------------------------------------------- */

const SPARK_W = 120;
const SPARK_H = 36;
/** Keeps the stroke's extremes inside the box (a stroke centred on y=0
 *  would be half clipped). */
const SPARK_PAD = 2;

/** SVG polyline points for a series: x spreads the samples evenly over the
 *  box, y is the rate scaled between the window's min and max (a flat
 *  window draws a mid-line rather than dividing by zero). Fewer than two
 *  samples is no line at all. */
export function sparkPoints(series: readonly FxSeriesPoint[]): string {
  const n = series.length;
  if (n < 2) return '';
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of series) {
    if (point.rate < min) min = point.rate;
    if (point.rate > max) max = point.rate;
  }
  const span = max - min;
  const innerH = SPARK_H - SPARK_PAD * 2;
  return series
    .map((point, i) => {
      const x = (i / (n - 1)) * SPARK_W;
      const y = span > 0 ? SPARK_PAD + (1 - (point.rate - min) / span) * innerH : SPARK_H / 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function Sparkline({ series, label }: { series: readonly FxSeriesPoint[]; label: string }) {
  const points = sparkPoints(series);
  return (
    <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" role="img" aria-label={label} focusable="false">
      {points && (
        <polyline
          className="qw-fx-spark-line"
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

/** A signed percentage with its label; `compact` keeps the label for
 *  assistive tech only (board cells and parity rows have no room). */
function Delta({ value, label, compact = false }: { value: number | null; label: string; compact?: boolean }) {
  return (
    <span className="qw-fx-delta" data-fx-delta="" data-sign={signOf(value)}>
      <span className="qw-fx-delta-value">{value === null ? '—' : formatSignedPct(value)}</span>
      <span className={compact ? 'sr-only' : 'qw-fx-delta-label'}>{label}</span>
    </span>
  );
}

/* ---- hero ---------------------------------------------------------------- */

export function FxCompassHero({ widget, variant, loading, accent }: FxCompassHeroProps) {
  const t = useTranslations('Rev41.fx');
  const locale = useLocale();

  if (!widget) {
    // The host's loading line speaks while the window is in flight; only a
    // settled card with nothing to show earns the honest line.
    if (loading) return null;
    return (
      <p className="qw-fx-unreadable" data-fx-unreadable="" role="status">
        {t('unreadable')}
      </p>
    );
  }

  const { hero } = widget;
  const heroValue = formatRate(hero.rate, locale);
  // The hero pair never repeats itself on the board (the home currency may
  // itself be one of the majors).
  const board = widget.majors.filter((quote) => quote.code !== hero.code);
  const index = widget.dollarIndex;

  return (
    <div className="qw-fx-hero" data-fx-hero="" data-variant={variant} style={{ '--qw-hub-accent': accent } as CSSProperties}>
      <p className="qw-fx-hero-label">
        <span>{t('homeLabel')}</span>
        <span className="qw-fx-hero-home">{hero.code}</span>
      </p>
      <p className="qw-fx-hero-value" data-fx-hero-value="">
        {heroValue}
      </p>
      <p className="qw-fx-hero-pair">{t('perUnit', { base: widget.base, value: heroValue, quote: hero.code })}</p>
      <p className="qw-fx-deltas">
        <Delta value={hero.change24h} label={t('change24h')} />
        <Delta value={hero.change30d} label={t('change30d')} />
        <span className="qw-fx-date">{widget.date}</span>
      </p>
      <div className="qw-fx-spark" data-fx-spark="" data-size="hero" data-sign={signOf(hero.change30d)}>
        <Sparkline series={hero.series} label={t('sparkAria', { quote: hero.code })} />
      </div>

      {(board.length > 0 || index) && (
        <div className="qw-fx-section" data-fx-board="">
          <p className="qw-fx-section-label">{t('majors')}</p>
          <ul className="qw-fx-board">
            {board.map((quote) => (
              <li key={quote.code} className="qw-fx-board-cell" data-fx-pair={quote.code}>
                <span className="qw-fx-board-code">
                  {widget.base}/{quote.code}
                </span>
                <span className="qw-fx-board-rate">{formatRate(quote.rate, locale)}</span>
                <Delta value={quote.change24h} label={t('change24h')} compact />
                <span className="qw-fx-spark" data-fx-spark="" data-size="mini" data-sign={signOf(quote.change30d)}>
                  <Sparkline series={quote.series} label={t('sparkAria', { quote: quote.code })} />
                </span>
              </li>
            ))}
            {index && (
              <li className="qw-fx-board-cell qw-fx-index" data-fx-index="">
                <span className="qw-fx-board-code">{t('dollarIndex')}</span>
                <span className="qw-fx-board-rate">{formatIndex(index.value, locale)}</span>
                {/* 30 days ago = 100, so the index less 100 IS its 30-day move. */}
                <Delta value={index.value - 100} label={t('change30d')} compact />
                <span className="qw-fx-spark" data-fx-spark="" data-size="mini" data-sign={signOf(index.value - 100)}>
                  <Sparkline series={index.series} label={t('dollarIndex')} />
                </span>
              </li>
            )}
          </ul>
          {index && <p className="qw-fx-note">{t('dollarIndexNote')}</p>}
        </div>
      )}

      {widget.parity.length > 0 && (
        <div className="qw-fx-section" data-fx-parity="">
          <p className="qw-fx-section-label">{t('parity')}</p>
          <ul className="qw-fx-parity">
            {widget.parity.map((row) => (
              <li key={row.id} className="qw-fx-parity-row" data-fx-parity-row={row.symbol}>
                <span className="qw-fx-parity-symbol">{row.symbol}</span>
                <span className="qw-fx-parity-name">{isGold(row) ? t('gold') : row.name}</span>
                {/* Home-currency price when CoinGecko quotes it; the USD
                    price otherwise -- never a converted guess. */}
                <span className="qw-fx-parity-price">
                  {row.home !== null ? formatMoney(row.home, widget.home, locale) : formatMoney(row.usd, 'USD', locale)}
                </span>
                <Delta value={row.change24h} label={t('change24h')} compact />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
