'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Droplets, Gauge, Loader2, Sun, Sunrise, Sunset, Thermometer, Umbrella, Wind } from 'lucide-react';
import { SectionShield } from '@/components/system/PageShield';
import { WeatherRadar } from '@/components/home/WeatherRadar';
import { useDragScroll } from '@/components/ui/useDragScroll';
import { CONDITION_ICON, conditionOf, type Place } from '@/lib/live/useLiveWeather';
import {
  aqiBandOf,
  clockOf,
  dominantPollutant,
  loadDeepForecast,
  localDateOf,
  pollutantBand,
  sliceHourlyFromNow,
  uvBand,
  windDirLabel,
  type AqiBand,
  type DeepAir,
  type DeepForecast,
  type PollutantKind,
} from '@/lib/live/weatherDeep';

/**
 * REV-42 D-4 (founder directive 2026-09-18) -- the air-fusion block that
 * replaced the REV-34 AQI row. One tile per pollutant the reading carries
 * (a null field is NO tile, never a zero), each banded on its own EU AQI
 * breakpoints where the index defines them; the five bandable kinds are
 * `PollutantKind`, the other three (CO, dust, AOD) show their value alone.
 */
type AirTileKind = PollutantKind | 'co' | 'dust' | 'aod' | 'uv';
type AirUnit = 'ugm3' | 'index' | null;

interface AirTile {
  kind: AirTileKind;
  value: number;
  unit: AirUnit;
  band: AqiBand | null;
  /** Decimals the reading is shown with (CO runs in the hundreds). */
  digits: number;
}

const BANDABLE: ReadonlySet<string> = new Set<PollutantKind>(['pm25', 'pm10', 'o3', 'no2', 'so2']);

/** The tiles in display order, only for fields the reading carries. */
export function airTiles(air: DeepAir): AirTile[] {
  const spec: ReadonlyArray<{ kind: AirTileKind; value: number | null; unit: AirUnit; digits: number }> = [
    { kind: 'pm25', value: air.pm25, unit: 'ugm3', digits: 1 },
    { kind: 'pm10', value: air.pm10, unit: 'ugm3', digits: 1 },
    { kind: 'o3', value: air.o3, unit: 'ugm3', digits: 1 },
    { kind: 'no2', value: air.no2, unit: 'ugm3', digits: 1 },
    { kind: 'so2', value: air.so2, unit: 'ugm3', digits: 1 },
    { kind: 'co', value: air.co, unit: 'ugm3', digits: 0 },
    { kind: 'dust', value: air.dust, unit: 'ugm3', digits: 1 },
    { kind: 'aod', value: air.aod, unit: null, digits: 2 },
    { kind: 'uv', value: air.uv, unit: 'index', digits: 1 },
  ];
  const tiles: AirTile[] = [];
  for (const row of spec) {
    if (row.value === null) continue;
    const band = BANDABLE.has(row.kind) ? pollutantBand(row.kind as PollutantKind, row.value) : null;
    tiles.push({ kind: row.kind, value: row.value, unit: row.unit, band, digits: row.digits });
  }
  return tiles;
}

/**
 * REV-34 M1-A (founder directive 2026-09-16) -- the deep half of the weather
 * popup. `LiveWeatherPanel` (compact) above it keeps the city search, the
 * locate-me button and the headline reading; this panel adds what the
 * founder asked for on a click of the weather widget: the extended current
 * row (feels-like, humidity, wind + compass, gusts, UV band, rain), the next
 * 24 hours as a drag rail, the 7-day outlook with sunrise / sunset / UV max /
 * rain chance, the rain radar and the air-quality row.
 *
 * The place arrives from the host AFTER the compact panel commits
 * (`onPlaceChange`), so the first render has none -- a skeleton, then one
 * cache-first `loadDeepForecast` per (lat, lon), each with its own
 * AbortController so a quick second search never paints the first city's
 * curve. Everything time-shaped is sliced from Open-Meteo's local ISO
 * strings; nothing here calls `new Date()` on one (see lib/live/weatherDeep).
 *
 * Contracts: root `[data-weather-panel]`, blocks `[data-weather-hourly]`
 * (24 `li`), `[data-weather-daily]` (7 `li`), `[data-weather-radar]`,
 * `[data-weather-aqi]`; the host's `[data-weather-modal]` wraps all of it.
 */
export interface WeatherDeepPanelProps {
  place: Place | null;
  /** Told once per successful load so the host's meta line can quote the
   *  forecast-day count and the fetch stamp. */
  onLoaded?: (info: { days: number; at: number }) => void;
}

type DeepState = { status: 'idle' | 'loading' } | { status: 'ready'; deep: DeepForecast } | { status: 'error' };

export function WeatherDeepPanel(props: WeatherDeepPanelProps) {
  return (
    <SectionShield zone="weather-deep">
      <WeatherDeepBody {...props} />
    </SectionShield>
  );
}

function WeatherDeepBody({ place, onLoaded }: WeatherDeepPanelProps) {
  const t = useTranslations('Rev34.weather');
  const tWeather = useTranslations('Weather');
  const tAir = useTranslations('Rev42.air');
  const locale = useLocale();
  const [state, setState] = useState<DeepState>({ status: 'idle' });
  const railRef = useRef<HTMLUListElement>(null);
  const rail = useDragScroll(railRef);
  // The host's callback identity must not restart a fetch.
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const lat = place?.lat;
  const lon = place?.lon;
  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const controller = new AbortController();
    let cancelled = false;
    setState({ status: 'loading' });
    loadDeepForecast({ lat, lon }, controller.signal)
      .then(({ data, at }) => {
        if (cancelled) return;
        setState({ status: 'ready', deep: data });
        onLoadedRef.current?.({ days: data.daily.length, at });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lat, lon]);

  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'numeric', day: 'numeric' }), [locale]);

  if (place && state.status === 'error') {
    return (
      <div className="qw-weather-deep" data-weather-panel="" data-weather-state="error">
        <p className="qw-weather-error" role="status">
          {tWeather('error')}
        </p>
      </div>
    );
  }

  // No place yet (the compact panel has not committed) or the load is in
  // flight: the skeleton, never a half-painted curve.
  if (!place || state.status !== 'ready') {
    return (
      <div className="qw-weather-deep" data-weather-panel="" data-weather-state="loading" aria-busy="true">
        <p className="qw-weather-skeleton" data-weather-skeleton="">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" />
          {t('loading')}
        </p>
      </div>
    );
  }

  const { deep } = state;
  const hours = sliceHourlyFromNow(deep.hourly, deep.current.time);
  const band = uvBand(deep.current.uv);
  const aqi = deep.aqi;

  return (
    <div className="qw-weather-deep" data-weather-panel="" data-weather-state="ready" data-weather-tz={deep.timezone}>
      {/* Extended current conditions -- six tiles, the same reading the
          compact panel headlines, widened with what the shallow fetch lacked. */}
      <ul className="qw-weather-stats" data-weather-current="">
        <li className="qw-weather-stat" data-stat="feelsLike">
          <Thermometer size={13} aria-hidden="true" />
          <span className="qw-weather-stat-label">{tWeather('feelsLike')}</span>
          <span className="qw-weather-stat-value">{Math.round(deep.current.feelsLike)}°</span>
        </li>
        <li className="qw-weather-stat" data-stat="humidity">
          <Droplets size={13} aria-hidden="true" />
          <span className="qw-weather-stat-label">{tWeather('humidity')}</span>
          <span className="qw-weather-stat-value">{Math.round(deep.current.humidity)}%</span>
        </li>
        <li className="qw-weather-stat" data-stat="wind">
          <Wind size={13} aria-hidden="true" />
          <span className="qw-weather-stat-label">{tWeather('wind')}</span>
          <span className="qw-weather-stat-value">
            {Math.round(deep.current.wind)} km/h
            <span className="qw-weather-stat-sub" title={t('windDir')}>
              {windDirLabel(deep.current.windDir)}
            </span>
          </span>
        </li>
        <li className="qw-weather-stat" data-stat="gust">
          <Gauge size={13} aria-hidden="true" />
          <span className="qw-weather-stat-label">{t('gust')}</span>
          <span className="qw-weather-stat-value">{Math.round(deep.current.gust)} km/h</span>
        </li>
        <li className="qw-weather-stat" data-stat="uv" data-uv-band={band}>
          <Sun size={13} aria-hidden="true" />
          <span className="qw-weather-stat-label">{t('uv')}</span>
          <span className="qw-weather-stat-value">
            {Math.round(deep.current.uv)}
            <span className="qw-weather-stat-sub">{t(`uvBand.${band}`)}</span>
          </span>
        </li>
        <li className="qw-weather-stat" data-stat="precip">
          <Umbrella size={13} aria-hidden="true" />
          <span className="qw-weather-stat-label">{t('precip')}</span>
          <span className="qw-weather-stat-value">{deep.current.precip.toFixed(1)} mm</span>
        </li>
      </ul>

      {/* Next 24 hours -- a native horizontal scroller with mouse grab-drag,
          the same rail grammar as the carousel's chip rail. */}
      <section className="qw-weather-block">
        <p className="qw-weather-section-label">{t('hourlyLabel')}</p>
        <ul
          ref={railRef}
          className="qw-weather-hourly u-hscroll select-none"
          data-weather-hourly=""
          onPointerDown={rail.handlers.onPointerDown}
          onPointerMove={rail.handlers.onPointerMove}
          onPointerUp={rail.handlers.onPointerUp}
          onPointerCancel={rail.handlers.onPointerCancel}
          onClickCapture={rail.handlers.onClickCapture}
        >
          {hours.map((h, i) => {
            const cond = conditionOf(h.code);
            const Icon = CONDITION_ICON[cond];
            return (
              <li key={h.time} className="qw-weather-hour" data-hour={h.time} title={tWeather(`condition.${cond}`)}>
                <span className="qw-weather-hour-time">{i === 0 ? t('now') : clockOf(h.time)}</span>
                <Icon size={18} className="text-accent" aria-hidden="true" />
                <span className="qw-weather-hour-temp">{Math.round(h.temp)}°</span>
                <span className="qw-weather-hour-prob" data-zero={h.precipProb <= 0 ? '1' : '0'}>
                  <Droplets size={10} aria-hidden="true" />
                  {Math.round(h.precipProb)}%
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 7-day outlook -- one row per day: weekday, condition, high / low,
          rain chance, UV max, sunrise / sunset. */}
      <section className="qw-weather-block">
        <p className="qw-weather-section-label">{t('dailyLabel')}</p>
        <ul className="qw-weather-daily" data-weather-daily="">
          {deep.daily.map((d) => {
            const cond = conditionOf(d.code);
            const Icon = CONDITION_ICON[cond];
            return (
              <li key={d.date} className="qw-weather-day" data-date={d.date}>
                <span className="qw-weather-day-name">{dayFormatter.format(localDateOf(d.date))}</span>
                <span className="qw-weather-day-cond" title={tWeather(`condition.${cond}`)}>
                  <Icon size={18} className="text-accent" aria-hidden="true" />
                </span>
                <span className="qw-weather-day-temps">
                  <span className="qw-weather-day-max">{Math.round(d.max)}°</span>
                  <span className="qw-weather-day-min">{Math.round(d.min)}°</span>
                </span>
                <span className="qw-weather-day-cell" title={t('precipProb')}>
                  <Droplets size={11} aria-hidden="true" />
                  {Math.round(d.precipProbMax)}%
                </span>
                <span className="qw-weather-day-cell" title={t('uv')} data-uv-band={uvBand(d.uvMax)}>
                  <Sun size={11} aria-hidden="true" />
                  {Math.round(d.uvMax)}
                </span>
                <span className="qw-weather-day-sun">
                  <span title={t('sunrise')}>
                    <Sunrise size={11} aria-hidden="true" />
                    {clockOf(d.sunrise)}
                  </span>
                  <span title={t('sunset')}>
                    <Sunset size={11} aria-hidden="true" />
                    {clockOf(d.sunset)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <SectionShield zone="weather-radar">
        <WeatherRadar lat={place.lat} lon={place.lon} />
      </SectionShield>

      {/* REV-42 D-4: the air-fusion block. The band word leads (the same EU
          AQI bands and Rev20 copy the carousel once used, so one reading
          never reads two ways), the EU / US indices beside it, one tile per
          pollutant the reading carries, the dominant pollutant, one line of
          breathing advice and the UV now / peak pair. A failed air request
          is the honest unreadable line -- `[data-weather-aqi]` is stamped
          only when a reading exists (the REV-34 contract). */}
      {aqi ? (
        <AirFusion air={aqi} uvNow={deep.current.uv} uvMax={deep.daily[0]?.uvMax ?? null} />
      ) : (
        <section className="qw-air" data-weather-air="" data-air-state="unreadable">
          <p className="qw-weather-section-label">{tAir('title')}</p>
          <p className="qw-air-unreadable" data-air-unreadable="">
            {tAir('unreadable')}
          </p>
        </section>
      )}
    </div>
  );
}

interface AirFusionProps {
  air: DeepAir;
  /** The forecast model's UV now and today's peak (null when no daily row). */
  uvNow: number;
  uvMax: number | null;
}

function AirFusion({ air, uvNow, uvMax }: AirFusionProps) {
  const t = useTranslations('Rev34.weather');
  const tAir = useTranslations('Rev42.air');
  const tSlots = useTranslations('Rev20.slots');
  const locale = useLocale();
  // The tiles' digits in the visitor's own grouping; plain toFixed when
  // Intl rejects the tag.
  const format = useMemo(() => {
    const cache = new Map<number, Intl.NumberFormat | null>();
    return (value: number, digits: number): string => {
      if (!cache.has(digits)) {
        try {
          cache.set(digits, new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
        } catch {
          cache.set(digits, null);
        }
      }
      const nf = cache.get(digits);
      return nf ? nf.format(value) : value.toFixed(digits);
    };
  }, [locale]);
  const airBand = aqiBandOf(air.eu);
  const tiles = airTiles(air);
  const dominant = dominantPollutant(air);
  const uvNowBand = uvBand(uvNow);

  return (
    <section className="qw-air" data-weather-air="" data-weather-aqi="" data-aqi-band={airBand} data-air-state="data">
      <p className="qw-weather-section-label">{tAir('title')}</p>

      {/* Hero: the band word at 28px, the EU index it is read from, the US
          index when the model carried it. */}
      <div className="qw-air-hero" data-air-hero="">
        <span className="qw-air-band" data-band={airBand}>
          {tSlots(`facts.aqi.${airBand}`)}
        </span>
        <span className="qw-air-hero-cell" data-air-index="eu">
          <span className="qw-air-label">{tAir('euAqi')}</span>
          <span className="qw-air-hero-value">{Math.round(air.eu)}</span>
        </span>
        {air.us !== null && (
          <span className="qw-air-hero-cell" data-air-index="us">
            <span className="qw-air-label">{tAir('usAqi')}</span>
            <span className="qw-air-hero-value">{Math.round(air.us)}</span>
          </span>
        )}
      </div>

      {tiles.length > 0 && (
        <ul className="qw-air-grid" data-air-grid="">
          {tiles.map((tile) => (
            <li key={tile.kind} className="qw-air-cell" data-air-cell={tile.kind} {...(tile.band ? { 'data-band': tile.band } : null)}>
              {/* The UV tile is the air model's index; its label is the
                  forecast panel's own "UV index" word (Rev34), not a second
                  copy of it. */}
              <span className="qw-air-label">{tile.kind === 'uv' ? t('uv') : tAir(tile.kind)}</span>
              <span className="qw-air-value">
                {format(tile.value, tile.digits)}
                {tile.unit && <span className="qw-air-unit">{tAir(`unit.${tile.unit}`)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {dominant && (
        <p className="qw-air-dominant" data-air-dominant={dominant.kind} data-band={dominant.band}>
          <span className="qw-air-label">{tAir('dominant')}</span>
          <span className="qw-air-dominant-name">{tAir(dominant.kind)}</span>
        </p>
      )}

      <p className="qw-air-advice" data-air-advice={airBand}>
        {tAir(`advice.${airBand}`)}
      </p>

      <ul className="qw-air-uv" data-air-uv="">
        <li className="qw-air-uv-cell" data-air-uv-now="" data-uv-band={uvNowBand}>
          <span className="qw-air-label">{tAir('uvNow')}</span>
          <span className="qw-air-value">
            {Math.round(uvNow)}
            <span className="qw-air-unit">{t(`uvBand.${uvNowBand}`)}</span>
          </span>
        </li>
        {uvMax !== null && (
          <li className="qw-air-uv-cell" data-air-uv-max="" data-uv-band={uvBand(uvMax)}>
            <span className="qw-air-label">{tAir('uvMax')}</span>
            <span className="qw-air-value">
              {Math.round(uvMax)}
              <span className="qw-air-unit">{t(`uvBand.${uvBand(uvMax)}`)}</span>
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
