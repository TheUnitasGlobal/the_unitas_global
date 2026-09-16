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
  loadDeepForecast,
  localDateOf,
  sliceHourlyFromNow,
  uvBand,
  windDirLabel,
  type DeepForecast,
} from '@/lib/live/weatherDeep';

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
  const tSlots = useTranslations('Rev20.slots');
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

      {/* Air quality -- the same EU AQI bands (and their Rev20 copy) the air
          card uses, so the two never disagree about one reading. */}
      {aqi && (
        <section className="qw-weather-aqi" data-weather-aqi="" data-aqi-band={aqiBandOf(aqi.eu)}>
          <p className="qw-weather-section-label">{t('aqiLabel')}</p>
          <p className="qw-weather-aqi-row">
            <span className="qw-weather-aqi-band">{tSlots(`facts.aqi.${aqiBandOf(aqi.eu)}`)}</span>
            <span className="qw-weather-aqi-cell">
              <span className="qw-weather-stat-label">{tSlots('facts.aqiValue')}</span>
              {Math.round(aqi.eu)}
            </span>
            {aqi.pm25 !== null && (
              <span className="qw-weather-aqi-cell">
                <span className="qw-weather-stat-label">{tSlots('facts.pm25')}</span>
                {aqi.pm25.toFixed(1)}
              </span>
            )}
            {aqi.pm10 !== null && (
              <span className="qw-weather-aqi-cell">
                <span className="qw-weather-stat-label">{tSlots('facts.pm10')}</span>
                {aqi.pm10.toFixed(1)}
              </span>
            )}
          </p>
        </section>
      )}
    </div>
  );
}
