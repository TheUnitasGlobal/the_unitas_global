'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  COMING_SOON_CINEMA,
  cinemaLayer,
  cinemaTrack,
  type CinemaTone,
} from '@/lib/comingSoonCinema';

/**
 * Shared post-scaffold shell for the modules that are routed but have no
 * engine yet (fate, score, arena, arche, codex22, u-pay, u-key, u-signature).
 *
 * The ambient loop behind the copy is driven entirely by the generated
 * manifest in public/coming-soon/cinema.json -- see lib/comingSoonCinema.ts
 * and scripts/generate-coming-soon-cinema.mjs. Honours prefers-reduced-motion
 * (renders a single static frame) so it stays cheap on low-spec devices.
 */
export function ComingSoonScene({
  title,
  description,
  label,
}: {
  title: string;
  description: string;
  label: string;
}) {
  const reduceMotion = useReducedMotion();
  const { palette, durationMs } = COMING_SOON_CINEMA;
  const duration = durationMs / 1000;
  const tone = (name?: CinemaTone) => palette[name ?? 'neon'];

  const particles = cinemaLayer('drift-field')?.particles ?? [];
  const sweepRotate = cinemaTrack('horizon-sweep', 'rotate');
  const sweepOpacity = cinemaTrack('horizon-sweep', 'opacity');
  const scanY = cinemaTrack('scanline', 'y');
  const scanOpacity = cinemaTrack('scanline', 'opacity');
  const glow = cinemaTrack('title-pulse', 'glowPx');
  const glowOpacity = cinemaTrack('title-pulse', 'opacity');

  const repeat = reduceMotion ? 0 : Infinity;
  const sweepLayer = cinemaLayer('horizon-sweep');

  return (
    <main className="relative isolate mx-auto flex min-h-[72vh] max-w-3xl flex-col items-center justify-center overflow-hidden px-6 py-32 text-center">
      {/* ambient cinema loop */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0" style={{ backgroundColor: palette.void }} />

        <motion.div
          className="absolute -inset-1/3"
          style={{
            mixBlendMode: 'screen',
            background: `linear-gradient(90deg, transparent, ${tone(sweepLayer?.from)}22, ${tone(
              sweepLayer?.to,
            )}18, transparent)`,
          }}
          initial={{ rotate: sweepRotate.values[0], opacity: sweepOpacity.values[0] }}
          animate={
            reduceMotion
              ? { rotate: sweepRotate.values[0], opacity: sweepOpacity.values[0] }
              : { rotate: sweepRotate.values, opacity: sweepOpacity.values }
          }
          transition={{ duration, repeat, ease: 'easeInOut', times: sweepRotate.times }}
        />

        {particles.map((particle, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.radius * 2,
              height: particle.radius * 2,
              backgroundColor: tone(particle.tone),
              mixBlendMode: 'screen',
            }}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={
              reduceMotion
                ? { opacity: particle.opacity * 0.6 }
                : {
                    opacity: [0, particle.opacity, particle.opacity, 0],
                    x: [0, particle.drift[0], 0],
                    y: [0, particle.drift[1], 0],
                  }
            }
            transition={{
              duration: particle.durationMs / 1000,
              delay: reduceMotion ? 0 : particle.delayMs / 1000,
              repeat,
              ease: 'easeInOut',
            }}
          />
        ))}

        {!reduceMotion && (
          <motion.div
            className="absolute inset-x-0 h-px"
            style={{ backgroundColor: tone('neon'), boxShadow: `0 0 12px ${tone('neon')}` }}
            initial={{ top: `${scanY.values[0]}%`, opacity: 0 }}
            animate={{
              top: scanY.values.map((v) => `${v}%`),
              opacity: scanOpacity.values,
            }}
            transition={{ duration, repeat, ease: 'linear', times: scanY.times }}
          />
        )}
      </div>

      <h1
        className="glow-text mb-4 font-serif text-3xl font-bold text-white"
        style={{ textShadow: `0 0 24px ${palette.accent}55` }}
      >
        {title}
      </h1>
      <p className="mb-8 max-w-xl text-sm text-gray-400">{description}</p>

      <motion.p
        className="text-xs uppercase text-accent"
        style={{ letterSpacing: '0.2em' }}
        initial={{ opacity: glowOpacity.values[0], textShadow: `0 0 ${glow.values[0]}px ${palette.accent}` }}
        animate={
          reduceMotion
            ? { opacity: 1, textShadow: `0 0 16px ${palette.accent}` }
            : {
                opacity: glowOpacity.values,
                textShadow: glow.values.map((px) => `0 0 ${px}px ${palette.accent}`),
              }
        }
        transition={{ duration, repeat, ease: 'easeInOut', times: glow.times }}
      >
        {label}
      </motion.p>
    </main>
  );
}
