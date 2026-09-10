'use client';

import type { MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FOOTER_SECTIONS, openSitePage } from '@/lib/sitePages';

/**
 * Large static big-tech-style footer. Every link routes to a real, unique
 * institutional page under /company, /legal or /support (see
 * lib/sitePages.ts + app/[locale]/<group>/[slug]/page.tsx) -- no `#`
 * placeholders. Column order: Company -> Legal -> Policies -> Customer
 * Service.
 *
 * REV-19 §5 / §12: on the Quantum White home the whole band is re-keyed to a
 * translucent 3D glass slab (app/quantum-white.css §12 -- every class below
 * is the dark-route default that the QW scope remaps), and a plain click on
 * any link opens the page as an INLINE modal over the current screen
 * (`openSitePage`, SiteLinkModalHost) instead of routing away; the `href`
 * stays for crawlers, middle-click and the modal's "open the full page".
 */
export function Footer() {
  const t = useTranslations('Footer');

  function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, group: (typeof FOOTER_SECTIONS)[number]['links'][number]) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openSitePage({ group: group.group, slug: group.slug });
  }

  return (
    <footer id="site-footer" className="qw-footer scroll-mt-20 border-t border-white/10 bg-void/60">
      <div className="qw-footer-inner mx-auto max-w-6xl px-6 py-16">
        <div className="qw-footer-grid grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
          {FOOTER_SECTIONS.map((col) => (
            <div key={col.headerKey} className="qw-footer-col">
              <h3 className="qw-footer-head mb-5 text-[15px] font-bold uppercase tracking-[0.15em] text-accent">
                {t(col.headerKey)}
              </h3>
              <ul className="space-y-3.5">
                {col.links.map((entry) => (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      onClick={(event) => handleLinkClick(event, entry)}
                      data-site-link={`${entry.group}/${entry.slug}`}
                      className="qw-footer-link text-[18px] font-medium tracking-wide text-gray-300 transition-colors hover:text-white"
                    >
                      {t(entry.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="qw-footer-brand mt-14 border-t border-white/10 pt-10 text-center">
          <p className="qw-footer-wordmark font-serif text-[18px] font-semibold tracking-widest text-accent">UNITAS</p>
          <p className="qw-footer-copy mt-3 text-[15px] font-medium tracking-wide text-gray-400">
            © 2026 | THE UNITAS GLOBAL OÜ
          </p>
        </div>
      </div>
    </footer>
  );
}
