import { setRequestLocale } from 'next-intl/server';
import { LifeOsShell } from '@/components/modules/lifeOs/LifeOsShell';
import { BrandKitEngine } from '@/components/modules/lifeOs/BrandKitEngine';

export default async function BrandKitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LifeOsShell locale={locale} activeKey="brand-kit">
      <BrandKitEngine />
    </LifeOsShell>
  );
}
