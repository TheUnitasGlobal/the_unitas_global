import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LIFE_OS_MODULES, lifeOsHref } from '@/lib/lifeOs/registry';

/**
 * Shared shell for the 5 Sovereign Life-OS pages (app/[locale]/sovereign/...).
 * Mirrors ModuleWorkspace's visual language (font-serif glow title, dark
 * bordered content panel) but swaps the coin-cost "rules" block for a nav
 * strip across the 5 modules -- there is no entry-modal payment step here,
 * access is the edge-level sovereign fence in middleware.ts, not a coin
 * spend, so ModuleWorkspace's EcosystemTheme-shaped props don't fit.
 */
export async function LifeOsShell({
  locale,
  activeKey,
  children,
}: {
  locale: string;
  activeKey: string;
  children: ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: 'LifeOs' });
  const active = LIFE_OS_MODULES.find((m) => m.key === activeKey) ?? LIFE_OS_MODULES[0];

  return (
    <main className="mx-auto max-w-4xl px-6 py-28">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-accent"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {t('hub.backLink')}
      </Link>

      <div className="mb-8 text-center">
        <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-gray-500">{t('hub.eyebrow')}</p>
        <h1
          className="glow-text mb-3 font-serif text-3xl font-bold text-white"
          style={{ textShadow: '0 0 24px rgba(212,175,55,0.33)' }}
        >
          {t(`${active.messageKey}.title`)}
        </h1>
        <p className="mx-auto max-w-xl text-sm text-gray-400">{t(`${active.messageKey}.description`)}</p>
      </div>

      <nav className="mb-10 flex flex-wrap justify-center gap-2" aria-label={t('hub.navLabel')}>
        {LIFE_OS_MODULES.map((mod) => {
          const Icon = mod.icon;
          const isActive = mod.key === active.key;
          return (
            <Link
              key={mod.key}
              href={lifeOsHref(mod.path)}
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                isActive
                  ? 'border-accent text-accent'
                  : 'border-accent/20 text-gray-500 hover:border-accent/50 hover:text-gray-300'
              }`}
            >
              <Icon size={12} aria-hidden="true" />
              {t(`nav.${mod.messageKey}`)}
            </Link>
          );
        })}
      </nav>

      <div className="border border-accent/20 bg-quantum p-6">{children}</div>
    </main>
  );
}
