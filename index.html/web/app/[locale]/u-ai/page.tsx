import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UaiWorkspace } from '@/components/uai/UaiWorkspace';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'UAI' });
  return { title: `U-AI · ${t('headline')}` };
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
