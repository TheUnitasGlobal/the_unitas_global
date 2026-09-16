import { describe, expect, it } from 'vitest';
import {
  DEEP_HOURLY_COUNT,
  WEATHER_DEEP_STORAGE_KEY,
  WEATHER_DEEP_TTL_MS,
  WEATHER_DEEP_VERSION,
  airQualityUrl,
  aqiBandOf,
  clockOf,
  deepForecastUrl,
  deepPlaceKey,
  localDateOf,
  parseDeepForecast,
  readDeepForecastCache,
  sliceHourlyFromNow,
  uvBand,
  windDirLabel,
  writeDeepForecastCache,
  type DeepForecast,
  type OpenMeteoDeepResponse,
  type StorageLike,
} from '@/lib/live/weatherDeep';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const store = {
    data: { ...initial },
    getItem: (k: string) => (k in store.data ? store.data[k] : null),
    setItem: (k: string, v: string) => {
      store.data[k] = v;
    },
    removeItem: (k: string) => {
      delete store.data[k];
    },
  };
  return store;
}

/** 48 hourly stamps across two local days, on the hour. */
function hourlyStamps(): string[] {
  const out: string[] = [];
  for (const day of ['2026-09-16', '2026-09-17']) {
    for (let h = 0; h < 24; h++) out.push(`${day}T${String(h).padStart(2, '0')}:00`);
  }
  return out;
}

const SEOUL = { lat: 37.5665, lon: 126.978 };

const FULL: OpenMeteoDeepResponse = {
  timezone: 'Asia/Seoul',
  current: {
    time: '2026-09-16T14:15',
    temperature_2m: 27.4,
    relative_humidity_2m: 61,
    apparent_temperature: 29.1,
    weather_code: 2,
    wind_speed_10m: 12.3,
    wind_direction_10m: 225,
    wind_gusts_10m: 30.6,
    uv_index: 6.4,
    precipitation: 0.2,
  },
  hourly: {
    time: hourlyStamps(),
    temperature_2m: hourlyStamps().map((_, i) => 20 + (i % 10)),
    weather_code: hourlyStamps().map(() => 1),
    precipitation_probability: hourlyStamps().map((_, i) => i % 100),
    precipitation: hourlyStamps().map(() => 0),
    wind_speed_10m: hourlyStamps().map(() => 8),
    uv_index: hourlyStamps().map(() => 3),
  },
  daily: {
    time: ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22'],
    weather_code: [1, 2, 3, 61, 0, 1, 95],
    temperature_2m_max: [29, 28, 27, 24, 26, 27, 25],
    temperature_2m_min: [19, 18, 18, 17, 16, 17, 18],
    sunrise: ['2026-09-16T06:12', '2026-09-17T06:13', '2026-09-18T06:14', '2026-09-19T06:15', '2026-09-20T06:15', '2026-09-21T06:16', '2026-09-22T06:17'],
    sunset: ['2026-09-16T18:36', '2026-09-17T18:34', '2026-09-18T18:33', '2026-09-19T18:31', '2026-09-20T18:30', '2026-09-21T18:28', '2026-09-22T18:27'],
    uv_index_max: [7.2, 6.8, 5.1, 2.3, 8.0, 7.5, 3.0],
    precipitation_probability_max: [10, 20, 40, 90, 5, 10, 80],
    wind_speed_10m_max: [20, 18, 22, 35, 15, 17, 40],
    wind_direction_10m_dominant: [200, 210, 180, 90, 270, 315, 0],
  },
};

describe('weatherDeep · parseDeepForecast', () => {
  it('maps the full response, including the air-quality body', () => {
    const deep = parseDeepForecast(FULL, { current: { european_aqi: 33, pm2_5: 12.4, pm10: 21 } });
    expect(deep.timezone).toBe('Asia/Seoul');
    expect(deep.current).toEqual({
      temp: 27.4,
      feelsLike: 29.1,
      humidity: 61,
      wind: 12.3,
      windDir: 225,
      gust: 30.6,
      uv: 6.4,
      precip: 0.2,
      code: 2,
      time: '2026-09-16T14:15',
    });
    expect(deep.hourly).toHaveLength(48);
    expect(deep.hourly[5]).toEqual({ time: '2026-09-16T05:00', temp: 25, code: 1, precipProb: 5, precip: 0, wind: 8, uv: 3 });
    expect(deep.daily).toHaveLength(7);
    expect(deep.daily[3]).toEqual({
      date: '2026-09-19',
      code: 61,
      max: 24,
      min: 17,
      sunrise: '2026-09-19T06:15',
      sunset: '2026-09-19T18:31',
      uvMax: 2.3,
      precipProbMax: 90,
      windMax: 35,
      windDir: 90,
    });
    expect(deep.aqi).toEqual({ eu: 33, pm25: 12.4, pm10: 21 });
  });

  it('defaults every missing series instead of throwing, and omits aqi when the air body is absent or empty', () => {
    const deep = parseDeepForecast({}, null);
    expect(deep.current).toEqual({ temp: 0, feelsLike: 0, humidity: 0, wind: 0, windDir: 0, gust: 0, uv: 0, precip: 0, code: 3, time: '' });
    expect(deep.hourly).toEqual([]);
    expect(deep.daily).toEqual([]);
    expect(deep.aqi).toBeUndefined();
    expect(deep.timezone).toBe('UTC');

    const partial = parseDeepForecast(
      { current: { temperature_2m: 10 }, hourly: { time: ['2026-01-01T00:00'], temperature_2m: [null] }, daily: { time: ['2026-01-01'] } },
      { current: { european_aqi: null } },
    );
    expect(partial.current.feelsLike).toBe(10); // apparent falls back to the air temperature
    expect(partial.hourly[0]).toMatchObject({ temp: 0, code: 3, precipProb: 0 });
    expect(partial.daily[0]).toMatchObject({ sunrise: '', sunset: '', uvMax: 0, precipProbMax: 0 });
    expect(partial.aqi).toBeUndefined();
  });

  it('keeps pm values null when the air body lacks them', () => {
    const deep = parseDeepForecast(FULL, { current: { european_aqi: 85 } });
    expect(deep.aqi).toEqual({ eu: 85, pm25: null, pm10: null });
  });
});

describe('weatherDeep · sliceHourlyFromNow', () => {
  const hourly = parseDeepForecast(FULL, null).hourly;

  it('starts at the hour containing the current minute and returns 24 cells, by string prefix', () => {
    const window = sliceHourlyFromNow(hourly, '2026-09-16T14:15');
    expect(window).toHaveLength(DEEP_HOURLY_COUNT);
    expect(window[0].time).toBe('2026-09-16T14:00');
    expect(window[23].time).toBe('2026-09-17T13:00');
  });

  it('falls forward to the first later hour when the current hour is missing, and to the tail when all are past', () => {
    const sparse = hourly.filter((h) => h.time !== '2026-09-16T14:00');
    expect(sliceHourlyFromNow(sparse, '2026-09-16T14:15')[0].time).toBe('2026-09-16T15:00');
    const late = sliceHourlyFromNow(hourly, '2026-09-18T03:00', 5);
    expect(late.map((h) => h.time)).toEqual(['2026-09-17T19:00', '2026-09-17T20:00', '2026-09-17T21:00', '2026-09-17T22:00', '2026-09-17T23:00']);
  });

  it('never Date-parses: an earlier-than-series stamp still slices from the first hour', () => {
    expect(sliceHourlyFromNow(hourly, '2026-09-15T23:59', 3).map((h) => h.time)).toEqual(['2026-09-16T00:00', '2026-09-16T01:00', '2026-09-16T02:00']);
    expect(sliceHourlyFromNow([], '2026-09-16T14:15')).toEqual([]);
    expect(sliceHourlyFromNow(hourly, '2026-09-16T14:15', 0)).toEqual([]);
  });
});

describe('weatherDeep · bands and labels', () => {
  it('uvBand follows the WHO scale after rounding', () => {
    expect(uvBand(0)).toBe('low');
    expect(uvBand(2.4)).toBe('low');
    expect(uvBand(2.5)).toBe('moderate');
    expect(uvBand(5)).toBe('moderate');
    expect(uvBand(6)).toBe('high');
    expect(uvBand(7.4)).toBe('high');
    expect(uvBand(8)).toBe('veryHigh');
    expect(uvBand(10)).toBe('veryHigh');
    expect(uvBand(11)).toBe('extreme');
    expect(uvBand(-3)).toBe('low');
  });

  it('windDirLabel maps degrees to the 16-point compass, wrapping and normalising', () => {
    expect(windDirLabel(0)).toBe('N');
    expect(windDirLabel(11)).toBe('N');
    expect(windDirLabel(12)).toBe('NNE');
    expect(windDirLabel(45)).toBe('NE');
    expect(windDirLabel(90)).toBe('E');
    expect(windDirLabel(180)).toBe('S');
    expect(windDirLabel(225)).toBe('SW');
    expect(windDirLabel(270)).toBe('W');
    expect(windDirLabel(359)).toBe('N');
    expect(windDirLabel(360)).toBe('N');
    expect(windDirLabel(-90)).toBe('W');
    expect(windDirLabel(Number.NaN)).toBe('N');
  });

  it('aqiBandOf matches the air slot thresholds', () => {
    expect(aqiBandOf(0)).toBe('good');
    expect(aqiBandOf(20)).toBe('good');
    expect(aqiBandOf(21)).toBe('fair');
    expect(aqiBandOf(40)).toBe('fair');
    expect(aqiBandOf(60)).toBe('moderate');
    expect(aqiBandOf(80)).toBe('poor');
    expect(aqiBandOf(100)).toBe('veryPoor');
    expect(aqiBandOf(101)).toBe('extreme');
  });

  it('clockOf slices HH:mm and localDateOf builds the day from its parts', () => {
    expect(clockOf('2026-09-16T06:12')).toBe('06:12');
    expect(clockOf('')).toBe('—');
    const d = localDateOf('2026-09-16');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 16, 12]);
  });
});

describe('weatherDeep · request URLs', () => {
  it('asks for current + hourly + 7 daily days in the local timezone, and the EU AQI trio', () => {
    const url = new URL(deepForecastUrl(SEOUL));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('forecast_days')).toBe('7');
    expect(url.searchParams.get('current')).toContain('wind_gusts_10m');
    expect(url.searchParams.get('current')).toContain('uv_index');
    expect(url.searchParams.get('hourly')).toContain('precipitation_probability');
    expect(url.searchParams.get('daily')).toContain('sunrise');
    expect(url.searchParams.get('daily')).toContain('wind_direction_10m_dominant');
    const air = new URL(airQualityUrl(SEOUL));
    expect(air.host).toBe('air-quality-api.open-meteo.com');
    expect(air.searchParams.get('current')).toBe('european_aqi,pm2_5,pm10');
  });
});

describe('weatherDeep · device cache', () => {
  const deep: DeepForecast = parseDeepForecast(FULL, { current: { european_aqi: 12 } });

  it('keys on the place at ~11 m precision', () => {
    expect(deepPlaceKey(SEOUL)).toBe('37.5665,126.9780');
    expect(deepPlaceKey({ lat: 37.56651, lon: 126.97804 })).toBe('37.5665,126.9780');
  });

  it('writes a versioned entry under its own key and serves it within the TTL, with the fetch stamp', () => {
    const storage = fakeStorage();
    writeDeepForecastCache(SEOUL, deep, storage, 1_000);
    expect(Object.keys(storage.data)).toEqual([WEATHER_DEEP_STORAGE_KEY]);
    expect(JSON.parse(storage.data[WEATHER_DEEP_STORAGE_KEY]).v).toBe(WEATHER_DEEP_VERSION);
    const hit = readDeepForecastCache(SEOUL, storage, 1_000 + WEATHER_DEEP_TTL_MS);
    expect(hit?.at).toBe(1_000);
    expect(hit?.data.daily).toHaveLength(7);
    expect(hit?.data.aqi?.eu).toBe(12);
  });

  it('misses past the TTL, for another place, for another version, and on corrupt or blocked storage', () => {
    const storage = fakeStorage();
    writeDeepForecastCache(SEOUL, deep, storage, 1_000);
    expect(readDeepForecastCache(SEOUL, storage, 1_000 + WEATHER_DEEP_TTL_MS + 1)).toBeNull();
    expect(readDeepForecastCache({ lat: 35.6762, lon: 139.6503 }, storage, 2_000)).toBeNull();

    const stale = fakeStorage({ [WEATHER_DEEP_STORAGE_KEY]: JSON.stringify({ v: 'wd-v0', key: deepPlaceKey(SEOUL), at: 1_000, data: deep }) });
    expect(readDeepForecastCache(SEOUL, stale, 1_500)).toBeNull();

    expect(readDeepForecastCache(SEOUL, fakeStorage({ [WEATHER_DEEP_STORAGE_KEY]: '{nope' }), 1)).toBeNull();
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(() => writeDeepForecastCache(SEOUL, deep, throwing, 1)).not.toThrow();
    expect(readDeepForecastCache(SEOUL, throwing, 1)).toBeNull();
    expect(readDeepForecastCache(SEOUL, null, 1)).toBeNull();
  });
});
