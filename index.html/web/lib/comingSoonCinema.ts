// Typed accessor for the generated "coming soon" cinema manifest.
//
// Source of truth: public/coming-soon/cinema.json, produced by
// scripts/generate-coming-soon-cinema.mjs (`npm --prefix web run gen:coming-soon`).
// Static import so the manifest is bundled and type-checked at build time --
// never fetched at runtime, which keeps the placeholder pages fully static.

import manifest from '@/public/coming-soon/cinema.json';

export type CinemaTone = 'void' | 'haze' | 'accent' | 'neon';

export interface CinemaParticle {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  delayMs: number;
  durationMs: number;
  drift: [number, number];
  tone: CinemaTone;
}

export interface CinemaKeyframe {
  offset: number;
  rotate?: number;
  opacity?: number;
  y?: number;
  glowPx?: number;
  letterSpacingEm?: number;
}

export interface CinemaLayer {
  id: string;
  type: 'particles' | 'gradient-sweep' | 'sweep-bar' | 'text-glow';
  blend?: string;
  tone?: CinemaTone;
  from?: CinemaTone;
  to?: CinemaTone;
  particles?: CinemaParticle[];
  keyframes?: CinemaKeyframe[];
}

export interface CinemaManifest {
  schemaVersion: number;
  kind: string;
  seed: string;
  target: string;
  profile: string;
  loop: boolean;
  durationMs: number;
  viewBox: { width: number; height: number };
  palette: Record<CinemaTone, string>;
  layers: CinemaLayer[];
}

export const COMING_SOON_CINEMA = manifest as unknown as CinemaManifest;

export function cinemaLayer(id: string): CinemaLayer | undefined {
  return COMING_SOON_CINEMA.layers.find((layer) => layer.id === id);
}

/** Split a keyframe track into Framer Motion `values` + `times` arrays. */
export function cinemaTrack(
  id: string,
  prop: keyof Omit<CinemaKeyframe, 'offset'>,
): { values: number[]; times: number[] } {
  const frames = cinemaLayer(id)?.keyframes ?? [];
  return {
    values: frames.map((frame) => frame[prop] ?? 0),
    times: frames.map((frame) => frame.offset),
  };
}
