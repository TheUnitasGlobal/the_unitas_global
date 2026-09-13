import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { seoAlternates } from './routes';

/**
 * REV-22 M_SEO -- the server-side companion to lib/seo/routes.ts (kept in a
 * separate file so `routes.ts` stays import-pure and unit-testable under the
 * node vitest environment: `next-intl/server` is request-scoped).
 *
 * Builds the full indexable-page metadata block -- title, description,
 * canonical, the 21-entry hreflang cluster, Open Graph and Twitter -- for a
 * page whose copy lives under one `messages` namespace key.
 *
 * Every indexable page MUST declare its own `alternates`. Next merges
 * metadata shallowly down the segment tree, so a page that omits them
 * inherits app/[locale]/layout.tsx's locale-root canonical, which is exactly
 * the defect measured in the REV-21 production build.
 */
export async function indexablePageMetadata({
  locale,
  path,
  namespace,
  titleKey,
  descriptionKey,
  ogType = 'website',
}: {
  locale: string;
  /** Locale-independent path, e.g. '/u-key'. */
  path: string;
  namespace: string;
  titleKey: string;
  descriptionKey: string;
  ogType?: 'website' | 'article';
}): Promise<Metadata> {
  const alternates = seoAlternates(locale, path);
  const t = await getTranslations({ locale, namespace });
  const title = t(titleKey);
  const description = t(descriptionKey);

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      type: ogType,
      siteName: 'UNITAS',
      url: alternates.canonical,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * The `robots` block every NON-indexable route carries: the 16 coin-gated
 * modules (which 307-redirect an ungranted visitor to /locked), /locked
 * itself, and the sovereign console (which middleware.ts already answers with
 * a bodiless 404 for anyone without the signed founder cookie).
 *
 * Defence in depth alongside the robots.txt `Disallow:` block -- a crawler
 * that ignores robots.txt still sees `noindex, nofollow`, and an engine that
 * reached the page through a shared link never lists it.
 */
export const NOINDEX: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};
