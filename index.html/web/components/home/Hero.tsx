'use client';

import { useTranslations } from 'next-intl';

/**
 * "UNITAS" breathing title. No sub-slogan -- removed per request.
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
