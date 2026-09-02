import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: [
    'en', 'ko', 'et', 'ja', 'zh', 'es', 'km', 'fr', 'de', 'pt', 'vi', 'id',
    'ru', 'hi', 'it', 'tr', 'th', 'pl', 'nl', 'tl',
  ],
  defaultLocale: 'en',
});
