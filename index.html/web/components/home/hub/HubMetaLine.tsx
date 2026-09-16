'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { metaLineArgs } from '@/lib/live/metaLine';

/**
 * REV-34 M1-B (founder directive 2026-09-16) -- the ONE footer line.
 *
 * "갱신 / 시간 / 카드 갱신 / 딥다이브" wordings are gone from every card and
 * modal on the shortcut strip; each footer now renders this component with
 * the news rail's `{count}건 · {source} ~ {updated} 갱신` shape
 * (`Rev34.meta.line`, 20 locales). The time formatting lives in
 * lib/live/metaLine.ts so this file holds no `Intl` of its own -- the card,
 * the feed modal and the weather panel used to keep three copies.
 *
 * `children` is for host-specific screen-reader suffixes (the card's swipe
 * hint); nothing visible may be appended, or the format is no longer one.
 */
export interface HubMetaLineProps {
  count: number;
  source: string;
  updatedAt?: number | null;
  /** Utility classes for the host's own spacing / size; `qw-hub-meta` is
   *  always applied so the white surface re-keys the ink. */
  className?: string;
  children?: ReactNode;
}

export function HubMetaLine({ count, source, updatedAt, className = 'mt-3 text-[12px] text-gray-500', children }: HubMetaLineProps) {
  const t = useTranslations('Rev34.meta');
  const locale = useLocale();
  // next-intl types ICU values as an indexed record; the formatter's named
  // interface has no index signature, so it is spread into one here.
  const values: Record<string, string | number | Date> = { ...metaLineArgs({ count, source, updatedAt }, locale) };
  return (
    <p className={`qw-hub-meta ${className}`.trim()} data-meta-line="">
      {t('line', values)}
      {children}
    </p>
  );
}
