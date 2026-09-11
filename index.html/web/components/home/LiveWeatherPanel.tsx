'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Cloud, Droplets, Loader2, LocateFixed, MapPin, RefreshCw, Search, Thermometer, Wind, X, Zap } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { CONDITION_ICON, conditionOf, useLiveWeather, type Place } from '@/lib/live/useLiveWeather';

/**
 * "실시간 날씨" tab (owner instruction 2026-09-03): live current conditions
 * + a 5-day outlook for a city, from Open-Meteo (keyless, CORS `*`, 0원).
 *
 * REV-20 §3.3: this component is now a pure view over `useLiveWeather` --
 * every geocoding / caching / positioning rule that used to live here moved
 * to lib/live/useLiveWeather.ts verbatim (mechanical extraction, JSX below
 * is unchanged) so the discovery carousel's weather slot (slot 0,
 * lib/live/discoverySlots.ts) can read the SAME 10-minute device cache
 * without a duplicate fetch. This component itself now renders inside the
 * weather slot's deep modal (`slot:weather`) for city search / locate-me /
 * the full 5-day grid -- the carousel's own active card only shows the
 * compact SlotCard facts.
 */
export function LiveWeatherPanel() {
  const t = useTranslations('Weather');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();

  const {
    place,
    forecast,
    fetchedAt,
    loading,
    error,
    cityQuery,
    setCityQuery,
    candidates,
    setCandidates,
    searching,
    instant,
    locating,
    load,
    runCitySearch,
    pickCandidate,
    locateMe,
  } = useLiveWeather(locale, {
    myLocationLabel: t('myLocation'),
    errorLabel: t('error'),
    noCityLabel: t('noCity'),
    locationDeniedLabel: t('locationDenied'),
  });

  function onCityKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void runCitySearch();
    }
  }

  const cond = forecast ? conditionOf(forecast.current.code) : null;
  const CondIcon = cond ? CONDITION_ICON[cond] : Cloud;
  const dayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'numeric', day: 'numeric' });
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-full">
      {/* Place + controls row -- "국가 / 도시(주)" title format (owner
          instruction 2026-09-03), so a US state result ("Georgia") never
          reads identically to the country of the same name: the admin1
          qualifier and the country are both always visible. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[16px] font-bold text-white sm:text-[17px]">
          <MapPin size={14} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate">
            {place.country && <span className="text-gray-400">{place.country} / </span>}
            {place.name}
            {place.admin1 && <span className="text-gray-500">({place.admin1})</span>}
            {place.isState && <span className="ml-1.5 text-gray-600">· {t('stateBadge')}</span>}
            {place.isCountry && <span className="ml-1.5 text-gray-600">· {t('countryBadge')}</span>}
            {place.approx && <span className="ml-1.5 text-gray-600">· ≈ {t('approx')}</span>}
          </span>
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => void locateMe()}
            disabled={locating}
            title={t('myLocation')}
            aria-label={t('myLocation')}
            className="flex h-8 items-center gap-1.5 border border-accent/40 px-2.5 text-[11px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {locating ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={12} aria-hidden="true" />}
            <span className="hidden sm:inline">{locating ? t('detecting') : t('myLocation')}</span>
          </button>
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => void load(place, true)}
            disabled={loading}
            title={t('refresh')}
            aria-label={t('refresh')}
            className="flex h-8 w-8 items-center justify-center border border-accent/40 text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* City search -- mousedown must reach the input (the dropdown and
          strip wrappers swallow mousedown to protect the search bar's
          focus), so it stops propagation and takes focus itself; the bar's
          root-level blur logic keeps the popup open while focus is here. */}
      <div className="relative mb-3">
        <div className="flex items-center gap-2 border border-white/15 bg-void/50 px-3 py-2">
          <Search size={14} className="shrink-0 text-gray-500" aria-hidden="true" />
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            onKeyDown={onCityKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full bg-transparent text-[14px] text-white placeholder:text-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => void runCitySearch()}
            disabled={searching || !cityQuery.trim()}
            className="shrink-0 border border-white/20 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-white/40 hover:text-white disabled:opacity-40"
          >
            {searching ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : t('search')}
          </button>
        </div>
        {candidates.length > 1 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 border border-white/15 bg-quantum shadow-xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <p className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-widest text-accent/80">
                {t('pickRegion')}
              </p>
              <button
                type="button"
                onMouseEnter={() => playHoverSfx()}
                onClick={() => setCandidates([])}
                aria-label={t('dismiss')}
                title={t('dismiss')}
                className="flex h-6 w-6 shrink-0 items-center justify-center border border-white/15 text-gray-400 transition-colors hover:border-accent/50 hover:text-accent"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {candidates.map((p: Place) => (
                <li key={p.id ?? `${p.lat},${p.lon}`}>
                  <button
                    type="button"
                    onMouseEnter={() => playHoverSfx()}
                    onClick={() => pickCandidate(p)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-200 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <MapPin size={12} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      {p.admin1 && <span className="text-gray-500"> ({p.admin1})</span>}
                    </span>
                    {p.country && <span className="shrink-0 text-gray-500">· {p.country}</span>}
                    {p.isState && (
                      <span className="shrink-0 border border-amber-400/40 px-1 text-[10px] font-bold uppercase text-amber-300">
                        {t('stateBadge')}
                      </span>
                    )}
                    {p.isCountry && (
                      <span className="shrink-0 border border-accent/40 px-1 text-[10px] font-bold uppercase text-accent">
                        {t('countryBadge')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {instant && (
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent/80" aria-live="polite">
          <Zap size={11} aria-hidden="true" />
          {t('instant')}
        </p>
      )}

      {error && <p className="mb-3 text-[12px] font-bold text-amber-300">{error}</p>}

      {loading && !forecast && (
        <p className="flex items-center gap-2 py-4 text-[13px] text-gray-400">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" />
          {t('loading')}
        </p>
      )}

      {forecast && cond && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
          {/* Current */}
          <div className="flex items-center gap-4 border border-white/10 bg-void/50 px-4 py-4">
            <CondIcon size={60} className="shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0">
              <p className="qw-weather-big text-4xl font-bold leading-none text-white sm:text-5xl">
                {Math.round(forecast.current.temp)}°
              </p>
              <p className="mt-1 text-[15px] font-bold text-gray-200">{t(`condition.${cond}`)}</p>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Thermometer size={11} aria-hidden="true" />
                  {t('feelsLike')} {Math.round(forecast.current.feelsLike)}°
                </span>
                <span className="flex items-center gap-1">
                  <Droplets size={11} aria-hidden="true" />
                  {t('humidity')} {Math.round(forecast.current.humidity)}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind size={11} aria-hidden="true" />
                  {t('wind')} {Math.round(forecast.current.wind)} km/h
                </span>
              </p>
            </div>
          </div>

          {/* 5-day outlook */}
          <div className="border border-white/10 bg-void/50 px-3 py-3">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-widest text-gray-500">{t('forecastLabel')}</p>
            <ul className="grid grid-cols-5 gap-1.5">
              {forecast.daily.map((d) => {
                const c = conditionOf(d.code);
                const Icon = CONDITION_ICON[c];
                return (
                  <li key={d.date} className="flex flex-col items-center gap-1 text-center" title={t(`condition.${c}`)}>
                    <span className="text-[12px] text-gray-400">{dayFormatter.format(new Date(`${d.date}T12:00:00`))}</span>
                    <Icon size={20} className="text-accent" aria-hidden="true" />
                    <span className="text-[14px] font-bold text-white">{Math.round(d.max)}°</span>
                    <span className="text-[13px] text-gray-500">{Math.round(d.min)}°</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {fetchedAt && (
        <p className="qw-hub-meta mt-2 text-[13px] font-semibold text-gray-500">
          {t('updated')} {timeFormatter.format(new Date(fetchedAt))} · {t('source')}
        </p>
      )}
    </div>
  );
}
