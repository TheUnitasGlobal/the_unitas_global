import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ModuleLockPanel, type ModuleLockReason } from '@/components/modules/ModuleLockPanel';
import { moduleForRoute } from '@/lib/module-registry';

/**
 * Landing page for a fail-closed coin gate rejection. app/[locale]/(gated)/
 * layout.tsx redirect()s here (rather than rendering inline) so a locked
 * request never carries the target module's RSC payload. `?reason=` picks
 * the copy, `?m=` names the module for the panel heading.
 */
export default async function LockedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reason?: string; m?: string }>;
}) {
  const { locale } = await params;
  const { reason: rawReason, m: route } = await searchParams;
  setRequestLocale(locale);

  const reason: ModuleLockReason = rawReason === 'signin' ? 'signin' : 'locked';

  let moduleTitle = '';
  const entry = route ? moduleForRoute(route) : null;
  if (entry) {
    const namespace = entry.tier === 'ecosystem' ? 'Ecosystems' : 'Modules';
    const t = await getTranslations({ locale, namespace });
    moduleTitle = t(`${entry.messageKey}.title`);
  }

  return <ModuleLockPanel reason={reason} moduleTitle={moduleTitle} locale={locale} />;
}
