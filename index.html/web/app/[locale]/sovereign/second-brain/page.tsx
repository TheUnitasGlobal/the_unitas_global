import { setRequestLocale } from 'next-intl/server';
import { LifeOsShell } from '@/components/modules/lifeOs/LifeOsShell';
import { SecondBrainEngine } from '@/components/modules/lifeOs/SecondBrainEngine';

export default async function SecondBrainPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LifeOsShell locale={locale} activeKey="second-brain">
      <SecondBrainEngine />
    </LifeOsShell>
  );
}
