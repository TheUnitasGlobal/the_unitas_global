'use client';

import { useTranslations } from 'next-intl';

/** "THE UNITAS" breathing title. No sub-slogan -- removed per request. */
export function Hero() {
  const t = useTranslations('Home');

  return (
    <div className="mx-auto max-w-3xl px-6 text-center">
      <h1 className="title-breathe font-serif text-6xl font-bold tracking-[0.05em] text-white md:text-8xl">
        {t('title')}
      </h1>
    </div>
  );
}
