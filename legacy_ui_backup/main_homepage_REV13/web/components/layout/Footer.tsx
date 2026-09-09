'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FOOTER_SECTIONS } from '@/lib/sitePages';

/**
 * Large static big-tech-style footer. Every link now routes to a real,
 * unique institutional page under /company, /legal or /support (see
 * lib/sitePages.ts + app/[locale]/<group>/[slug]/page.tsx) -- no `#`
 * placeholders. Column order: Company -> Legal -> Policies -> Customer
 * Service.
 */
export function Footer() {
  const t = useTranslations('Footer');

  return (
    <footer id="site-footer" className="scroll-mt-20 border-t border-white/10 bg-void/60">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
          {FOOTER_SECTIONS.map((col) => (
            <div key={col.headerKey}>
              <h3 className="mb-5 text-[15px] font-bold uppercase tracking-[0.15em] text-accent">
                {t(col.headerKey)}
              </h3>
              <ul className="space-y-3.5">
                {col.links.map((entry) => (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      className="text-[18px] font-medium tracking-wide text-gray-300 transition-colors hover:text-white"
                    >
                      {t(entry.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-white/10 pt-10 text-center">
          <p className="font-serif text-[18px] font-semibold tracking-widest text-accent">UNITAS</p>
          <p className="mt-3 text-[15px] font-medium tracking-wide text-gray-400">
            © 2026 | THE UNITAS GLOBAL OÜ
          </p>
        </div>
      </div>
    </footer>
  );
}
