import { setRequestLocale } from 'next-intl/server';
import { LifeOsShell } from '@/components/modules/lifeOs/LifeOsShell';
import { ReviewAgentEngine } from '@/components/modules/lifeOs/ReviewAgentEngine';

export default async function ReviewAgentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LifeOsShell locale={locale} activeKey="review-agent">
      <ReviewAgentEngine />
    </LifeOsShell>
  );
}
