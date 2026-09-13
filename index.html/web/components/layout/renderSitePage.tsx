import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { SurfaceScope } from './SurfaceScope';
import { SiteArticle } from './SiteArticle';
import { DISCLAIMER_SLUGS, isSiteSlug, readSitePageDocument, type SiteGroup, type SiteSlug } from '@/lib/sitePages';
import { readRegistryLabels, registrySectionsFor } from '@/lib/sitePagesRegistry';

const GROUP_HEADER_KEY: Record<SiteGroup, string> = {
  company: 'company',
  legal: 'legal',
  support: 'customerService',
};

/**
 * Shared body for the company/legal/support `[slug]` routes. REV-21 §6.1
 * (F-1): renders the same `SiteArticle` as the inline modal, inside a
 * `SurfaceScope` so the route is painted Quantum White like the home it
 * was opened from. The registry-generated sections (privacy / cookies)
 * are appended here exactly as the modal appends them.
 */
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
  const doc = readSitePageDocument(t.raw(slug));
  if (!doc) notFound();

  const siteSlug = slug as SiteSlug;
  const sections = [...doc.sections, ...registrySectionsFor(siteSlug, locale, readRegistryLabels((key) => t(key)))];
  const legal = DISCLAIMER_SLUGS.has(slug);

  return (
    <SurfaceScope>
      <main className="qw-site-route" data-site-route={slug}>
        <Link href="/" className="qw-site-back group" data-site-back="">
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          {t('common.back')}
        </Link>
        <SiteArticle
          host="route"
          group={group}
          slug={siteSlug}
          eyebrow={tFooter(GROUP_HEADER_KEY[group])}
          title={doc.title}
          lede={doc.lede}
          sections={sections}
          highlights={doc.highlights}
          updated={doc.updated}
          labels={{ updated: t('common.updatedLabel'), contents: t('common.contentsLabel') }}
          disclaimer={legal ? t('common.disclaimer') : undefined}
          notice={legal ? undefined : t('common.corporateNotice')}
        />
      </main>
    </SurfaceScope>
  );
}

export async function sitePageMetadata(locale: string, slug: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'SitePages' });
  try {
    const title = t(`${slug}.title`);
    const description = t(`${slug}.lede`);
    return {
      title,
      description,
      openGraph: { title, description, type: 'article', siteName: 'UNITAS' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return {};
  }
}
