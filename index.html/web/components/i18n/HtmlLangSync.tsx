'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

/**
 * `<html>` lives in the stable root layout (app/layout.tsx), which Next.js's
 * App Router does NOT re-render on a client-side navigation that only
 * changes a descendant dynamic segment (that's the whole point of hoisting
 * it out of app/[locale]/ -- see that layout's comment) -- so `lang`
 * couldn't be set reactively from the root itself. This tiny client
 * component lives inside the locale-reactive tree instead, where
 * `useLocale()` correctly picks up each switch, and imperatively keeps the
 * actual `<html lang>` attribute in sync.
 */
export function HtmlLangSync() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
