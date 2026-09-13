import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ComingSoonScene } from '@/components/modules/ComingSoonScene';
import { indexablePageMetadata } from '@/lib/seo/pageMetadata';

// REV-22 M_SEO: the three B2B protocol routes are the only module pages that
// are NOT coin-gated (MODULE_REGISTRY `coinGated: false`), so they are the only
// ones a crawler may index -- and therefore the only ones that need their own
// canonical + hreflang cluster. Without this block the page inherits
// app/[locale]/layout.tsx's locale-root canonical and Google folds it into the
// home page.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return indexablePageMetadata({
    locale,
    path: '/u-pay',
    namespace: 'Modules',
    titleKey: 'uPay.title',
    descriptionKey: 'uPay.description',
  });
}

export default async function UPayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tModules = await getTranslations('Modules');
  const tPlaceholder = await getTranslations('Placeholder');

  return (
    <ComingSoonScene
      title={tModules('uPay.title')}
      description={tModules('uPay.description')}
      label={tPlaceholder('comingSoon')}
    />
  );
}
