'use client';

import { useTranslations } from 'next-intl';

/** "UNITAS" breathing title. No sub-slogan -- removed per request. */
export function Hero() {
  const t = useTranslations('Home');

  return (
    <div className="mx-auto max-w-3xl px-6 text-center">
      <h1 className="title-breathe font-serif text-7xl font-bold tracking-[0.03em] text-white md:text-9xl">
        {t('title')}
      </h1>
    </div>
  );
}
