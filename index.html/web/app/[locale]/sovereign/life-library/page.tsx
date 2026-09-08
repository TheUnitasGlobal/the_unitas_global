import { setRequestLocale } from 'next-intl/server';
import { LifeOsShell } from '@/components/modules/lifeOs/LifeOsShell';
import { LifeLibraryEngine } from '@/components/modules/lifeOs/LifeLibraryEngine';

export default async function LifeLibraryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LifeOsShell locale={locale} activeKey="life-library">
      <LifeLibraryEngine />
    </LifeOsShell>
  );
}
