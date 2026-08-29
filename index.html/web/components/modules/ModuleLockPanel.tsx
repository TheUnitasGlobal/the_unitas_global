import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LockKeyhole } from 'lucide-react';

export type ModuleLockReason = 'signin' | 'locked';

/**
 * Server-rendered fail-closed panel for the page-level coin gate
 * (app/[locale]/(gated)/layout.tsx). Rendered INSTEAD of `children` when the
 * visitor has no live module_access_grant, so no paid module content ever
 * reaches the HTML payload of a locked page.
 *
 * Deliberately carries zero module logic/content -- just the module's
 * public-catalog title, a reason, and a route back to the catalog where the
 * entry modal (which calls spend_coins) lives.
 */
export async function ModuleLockPanel({
  reason,
  moduleTitle,
  locale,
}: {
  reason: ModuleLockReason;
  moduleTitle: string;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: 'ModuleGate' });

  const title = reason === 'signin' ? t('signinTitle') : t('lockedTitle');
  const body = reason === 'signin' ? t('signinBody') : t('lockedBody');

  return (
    <main className="relative mx-auto flex min-h-[72vh] max-w-2xl flex-col items-center justify-center px-6 py-32 text-center">
      <LockKeyhole size={38} className="mb-6 text-accent" aria-hidden="true" />

      <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-gray-500">{t('eyebrow')}</p>

      <h1
        className="glow-text mb-4 font-serif text-3xl font-bold text-white"
        style={{ textShadow: '0 0 24px rgba(212,175,55,0.33)' }}
      >
        {title}
      </h1>

      <p className="mb-2 text-xs uppercase tracking-widest text-gray-600">
        {t('moduleLabel')}: <span className="text-gray-400">{moduleTitle}</span>
      </p>

      <p className="mb-10 max-w-md text-sm text-gray-400">{body}</p>

      <Link
        href="/"
        className="border border-accent bg-accent/10 px-6 py-3 text-xs font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void"
      >
        {t('returnToCatalog')}
      </Link>
    </main>
  );
}
