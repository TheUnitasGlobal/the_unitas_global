import type { Metadata } from 'next';
import { LEGAL_SLUGS } from '@/lib/sitePages';
import { renderSitePage, sitePageMetadata } from '@/components/layout/renderSitePage';

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  return sitePageMetadata(locale, slug);
}

export default async function LegalSlugPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  return renderSitePage({ group: 'legal', locale, slug });
}
