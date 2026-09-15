import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OmniSwarmWorkspace } from '@/components/swarm/OmniSwarmWorkspace';
import { seoAlternates } from '@/lib/seo/routes';

// REV-32 M1: the omni-tech swarm's own address. It declares its own canonical
// + hreflang cluster rather than inheriting the locale-root one (same reason
// as /u-ai: the clean path is canonical, and `?qid=` / `?q=` are an unbounded
// query space that must all fold back onto `/omni-swarm`).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Rev32.swarm' });
  const title = `${t('page.title')} · UNITAS`;
  const description = t('page.lede');
  const alternates = seoAlternates(locale, '/omni-swarm');
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

export default async function OmniSwarmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ qid?: string; q?: string }>;
}) {
  const { locale } = await params;
  const { qid, q } = await searchParams;
  setRequestLocale(locale);

  // Only a well-formed Wikidata item is trusted straight from the URL; any
  // other string goes through the resolver like a typed query would.
  const pinned = typeof qid === 'string' && /^Q\d+$/.test(qid) ? qid : '';
  return <OmniSwarmWorkspace initialQid={pinned} initialQuery={typeof q === 'string' ? q : ''} />;
}
