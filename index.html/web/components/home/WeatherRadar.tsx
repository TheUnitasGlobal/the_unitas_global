'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Minus, Pause, Play, Plus } from 'lucide-react';
import { metaTimeFormatter } from '@/lib/live/metaLine';
import {
  RADAR_DEFAULT_ZOOM,
  RADAR_REFRESH_MS,
  RADAR_ZOOMS,
  basemapTileUrl,
  fetchRadarFrames,
  grid3x3,
  radarTileUrl,
  type BasemapVariant,
  type RadarFrames,
  type RadarZoom,
} from '@/lib/live/rainviewer';

/**
 * REV-34 M1-A (founder directive 2026-09-16) -- the rain radar block of the
 * weather deep popup: nine CARTO basemap tiles under nine RainViewer radar
 * tiles, as plain `<img>` elements. No map library, no iframe, no script from
 * a third party -- the one thing an in-app WebView cannot break is an image,
 * and nine 256px PNGs are lighter than any embed's bootstrap. The tiles are
 * sized by the CSS grid (`width: 100%; aspect-ratio: 1`), never at 256px,
 * because 3 x 256 = 768px is wider than the xl dialog.
 *
 * The frame list (last hour of observations + the nowcast) is polled every
 * ten minutes ONLY while this block is mounted -- the popup is the only
 * mount, so a closed popup costs zero calls -- and served from the 5-minute
 * device cache on reopen. A frame scrubber walks past / now / nowcast, a
 * play button loops them, and the zoom toggle steps 6 / 7 / 8 (default 7).
 * Fail-closed: no frame list means the basemap plus the "unavailable" line,
 * never a throw and never a broken-image glyph (the overlay falls back to a
 * transparent pixel so the 18-image grid is stable for the E2E contract).
 */
export interface WeatherRadarProps {
  lat: number;
  lon: number;
  /** Initial zoom; the visitor may step it within RADAR_ZOOMS. */
  zoom?: RadarZoom;
}

/** Loop cadence of the play button. */
const FRAME_STEP_MS = 700;
/** 1x1 transparent GIF -- the overlay's source while no frame is known. */
const TRANSPARENT_PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

type RadarState = { status: 'loading' } | { status: 'ready'; frames: RadarFrames } | { status: 'unavailable' };

export function WeatherRadar({ lat, lon, zoom: initialZoom = RADAR_DEFAULT_ZOOM }: WeatherRadarProps) {
  const t = useTranslations('Rev34.weather');
  const locale = useLocale();
  const [zoom, setZoom] = useState<RadarZoom>(initialZoom);
  const [state, setState] = useState<RadarState>({ status: 'loading' });
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The basemap follows the surface: light tiles on the white home route,
  // dark tiles on the void. Read after mount (SSR has no <html> dataset).
  const [variant, setVariant] = useState<BasemapVariant>('light_all');

  useEffect(() => {
    setVariant(document.documentElement.dataset.unitasSurface === 'quantum-white' ? 'light_all' : 'dark_all');
  }, []);

  // Frame list: once on mount, then every RADAR_REFRESH_MS while mounted.
  // A refresh lands the scrubber back on the latest observation.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const load = () => {
      void fetchRadarFrames(controller.signal).then((frames) => {
        if (cancelled) return;
        if (!frames) {
          setState({ status: 'unavailable' });
          return;
        }
        setState({ status: 'ready', frames });
        setFrameIdx(frames.nowIndex);
      });
    };
    load();
    const id = window.setInterval(load, RADAR_REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, []);

  // Play: advance one frame per step, wrapping; cleared on pause / unmount.
  useEffect(() => {
    if (!playing || state.status !== 'ready') return;
    const total = state.frames.frames.length;
    const id = window.setInterval(() => setFrameIdx((i) => (i + 1) % total), FRAME_STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, state]);

  const cells = useMemo(() => grid3x3(lat, lon, zoom), [lat, lon, zoom]);
  const frames = state.status === 'ready' ? state.frames : null;
  const frame = frames ? frames.frames[Math.min(frameIdx, frames.frames.length - 1)] : null;
  const zoomAt = RADAR_ZOOMS.indexOf(zoom);
  const clock = metaTimeFormatter(locale);

  const kindLabel = (kind: 'past' | 'now' | 'nowcast') => (kind === 'past' ? t('radarPast') : kind === 'now' ? t('radarNow') : t('radarNowcast'));

  return (
    <div className="qw-weather-radar" data-weather-radar="" data-radar-zoom={zoom} data-radar-state={state.status}>
      <div className="qw-weather-radar-head">
        <p className="qw-weather-section-label">{t('radarLabel')}</p>
        <div className="qw-radar-zoom" role="group" aria-label={t('radarLabel')}>
          <button
            type="button"
            className="qw-radar-btn"
            onClick={() => setZoom(RADAR_ZOOMS[Math.max(0, zoomAt - 1)])}
            disabled={zoomAt <= 0}
            title={t('zoomOut')}
            aria-label={t('zoomOut')}
            data-radar-zoom-out=""
          >
            <Minus size={13} aria-hidden="true" />
          </button>
          <span className="qw-radar-zoom-level" aria-hidden="true">
            z{zoom}
          </span>
          <button
            type="button"
            className="qw-radar-btn"
            onClick={() => setZoom(RADAR_ZOOMS[Math.min(RADAR_ZOOMS.length - 1, zoomAt + 1)])}
            disabled={zoomAt >= RADAR_ZOOMS.length - 1}
            title={t('zoomIn')}
            aria-label={t('zoomIn')}
            data-radar-zoom-in=""
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* The map is decorative for assistive tech (the numbers are in the
          forecast lists); the status line below it is what gets announced. */}
      <div className="qw-radar-grid" aria-hidden="true">
        {cells.map((cell) => (
          <span key={`${cell.dx},${cell.dy}`} className="qw-radar-cell">
            {/* eslint-disable-next-line @next/next/no-img-element -- keyless CARTO basemap tile, sized by the CSS cell */}
            <img src={basemapTileUrl(zoom, cell.x, cell.y, variant)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="qw-radar-base" />
            {/* eslint-disable-next-line @next/next/no-img-element -- RainViewer radar tile over the basemap */}
            <img
              src={frame && frames ? radarTileUrl(frames.host, frame.path, zoom, cell.x, cell.y) : TRANSPARENT_PX}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="qw-radar-overlay"
              data-radar-tile=""
            />
          </span>
        ))}
        <span className="qw-radar-cross" />
      </div>
      {state.status === 'unavailable' && (
        <p className="qw-radar-unavailable" role="status" data-radar-unavailable="">
          {t('radarUnavailable')}
        </p>
      )}

      {frames && frame && (
        <div className="qw-radar-scrub" data-radar-scrub="">
          <button
            type="button"
            className="qw-radar-btn"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            title={playing ? t('radarPause') : t('radarPlay')}
            aria-label={playing ? t('radarPause') : t('radarPlay')}
            data-radar-play=""
          >
            {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
          </button>
          <ol className="qw-radar-frames u-hscroll" aria-label={t('radarLabel')}>
            {frames.frames.map((f, i) => {
              const label = clock.format(new Date(f.time * 1000));
              return (
                <li key={f.time}>
                  <button
                    type="button"
                    className="qw-radar-frame"
                    data-radar-frame={i}
                    data-radar-kind={f.kind}
                    aria-current={i === frameIdx ? 'step' : undefined}
                    title={`${kindLabel(f.kind)} · ${label}`}
                    onClick={() => {
                      setPlaying(false);
                      setFrameIdx(i);
                    }}
                  >
                    <span className="sr-only">{kindLabel(f.kind)} </span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="qw-radar-frame-kind" aria-live="polite">
            {kindLabel(frame.kind)}
          </p>
        </div>
      )}

      <p className="qw-radar-source">{t('radarSource')}</p>
    </div>
  );
}
