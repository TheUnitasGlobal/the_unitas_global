import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ComingSoonScene } from '@/components/modules/ComingSoonScene';

export default async function FatePage({
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
      title={tModules('fate.title')}
      description={tModules('fate.description')}
      label={tPlaceholder('comingSoon')}
    />
  );
}
