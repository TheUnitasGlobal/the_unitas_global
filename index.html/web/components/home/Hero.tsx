'use client';

import { useTranslations } from 'next-intl';

/** "UNITAS" breathing title. No sub-slogan -- removed per request. */
export function Hero() {
  const t = useTranslations('Home');

  return (
    <div className="mx-auto mt-[76px] max-w-3xl px-6 text-center">
      <h1 className="title-breathe font-serif font-bold text-white">
        {t('title')}
      </h1>
    </div>
  );
}
