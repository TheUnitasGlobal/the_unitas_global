import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SitePage } from './SitePage';
import { DISCLAIMER_SLUGS, isSiteSlug, type SiteGroup } from '@/lib/sitePages';

const GROUP_HEADER_KEY: Record<SiteGroup, string> = {
  company: 'company',
  legal: 'legal',
  support: 'customerService',
};

/** Shared body for the company/legal/support `[slug]` routes. */
export async function renderSitePage({
  group,
  locale,
  slug,
}: {
  group: SiteGroup;
  locale: string;
  slug: string;
}) {
  if (!isSiteSlug(group, slug)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('SitePages');
  const tFooter = await getTranslations('Footer');

  return (
    <SitePage
      eyebrow={tFooter(GROUP_HEADER_KEY[group])}
      title={t(`${slug}.title`)}
      lede={t(`${slug}.lede`)}
      body={t.raw(`${slug}.body`) as string[]}
      disclaimer={DISCLAIMER_SLUGS.has(slug) ? t('common.disclaimer') : undefined}
      backLabel={t('common.back')}
    />
  );
}

export async function sitePageMetadata(locale: string, slug: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'SitePages' });
  try {
    return { title: t(`${slug}.title`) };
  } catch {
    return {};
  }
}
