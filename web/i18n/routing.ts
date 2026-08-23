import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ko', 'et', 'ja', 'zh', 'es'],
  defaultLocale: 'en',
});
