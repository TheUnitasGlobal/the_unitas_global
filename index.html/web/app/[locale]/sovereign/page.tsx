import { setRequestLocale } from 'next-intl/server';
import { LifeOsShell } from '@/components/modules/lifeOs/LifeOsShell';
import { LifeDashboardEngine } from '@/components/modules/lifeOs/LifeDashboardEngine';

export default async function LifeDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LifeOsShell locale={locale} activeKey="life-dashboard">
      <LifeDashboardEngine />
    </LifeOsShell>
  );
}
