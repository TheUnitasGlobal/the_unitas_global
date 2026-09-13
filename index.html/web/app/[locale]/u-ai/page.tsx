import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UaiWorkspace } from '@/components/uai/UaiWorkspace';
import { seoAlternates } from '@/lib/seo/routes';

// REV-22 M_SEO: `/u-ai` is the highest-value indexable route after the home
// page, so it declares its own canonical + 21-entry hreflang cluster rather
// than inheriting app/[locale]/layout.tsx's locale-root one. The canonical is
// deliberately the CLEAN path -- `?q=<anything>` is an unbounded query space
// that must all fold back onto `/u-ai`.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'UAI' });
  const title = `U-AI · ${t('headline')}`;
  const description = t('subhead');
  const alternates = seoAlternates(locale, '/u-ai');
  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'UNITAS',
      url: alternates.canonical,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function UaiPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);

  return <UaiWorkspace initialQuery={typeof q === 'string' ? q : ''} />;
}
