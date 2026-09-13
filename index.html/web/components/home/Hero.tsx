'use client';

import { useTranslations } from 'next-intl';

/**
 * The UNITAS wordmark. No sub-slogan -- removed per request.
 *
 * REV-23 M4 (founder directive 2026-09-13): the mark was plain Rich Black
 * text. It is now a dark glassmorphism plate carrying deep-space gradient
 * typography under a neon-silver metallic rim -- see app/unitas-wordmark.css.
 * That is a PAINT-ONLY change: this component's DOM is deliberately
 * unchanged, because REV-20 measured the hero's vertical symmetry to 0.02px
 * off this exact box (h1 fit-content + `.qw-title-word` inline-block +
 * `--qw-title-rule-h`), and any element added here would move it.
 *
 * REV-19 §2 / §7: the word sits in its own inline-block span so the Quantum
 * White scope can shift the glyph run by `--qw-title-optical-shift`
 * (aligning the centre of "IT" with the gold hairline beneath) without
 * moving the hairline itself, and the outer margin is owned by
 * `.qw-hero-wrap`'s nav-aware padding (the old fixed 76px offset is gone).
 * The invisible ownership mark is appended by SovereignWatermark into its
 * own `.qw-title-mark` span (letter-spacing 0) so it can never widen the
 * measured box.
 */
export function Hero() {
  const t = useTranslations('Home');

  return (
    <div className="qw-hero-title-wrap mx-auto max-w-3xl px-6 text-center">
      <h1 className="title-breathe font-serif font-bold text-white">
        <span className="qw-title-word">{t('title')}</span>
      </h1>
    </div>
  );
}
