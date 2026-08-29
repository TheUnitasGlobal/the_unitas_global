import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ComingSoonScene } from '@/components/modules/ComingSoonScene';

export default async function ScorePage({
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
      title={tModules('score.title')}
      description={tModules('score.description')}
      label={tPlaceholder('comingSoon')}
    />
  );
}
