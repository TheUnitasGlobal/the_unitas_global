'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Modal } from '@/components/ui/Modal';
import { DISCLAIMER_SLUGS, SITE_PAGE_EVENT, type SiteGroup, type SitePageRequest } from '@/lib/sitePages';

const GROUP_HEADER_KEY: Record<SiteGroup, string> = {
  company: 'company',
  legal: 'legal',
  support: 'customerService',
};

/**
 * REV-19 §12 -- the inline institutional-page modal. Terms of Service,
 * Privacy Policy and every other footer page open OVER the current screen
 * (a layer on the deep modal history stack, so back / Escape / backdrop
 * close it) instead of routing the visitor away from the popup or form
 * they were in. The dedicated `/legal/<slug>` routes remain for SEO, deep
 * links and the "open the full page" affordance below.
 *
 * Mounted once in app/[locale]/layout.tsx; opened from anywhere through
 * `openSitePage()` (lib/sitePages.ts).
 */
export function SiteLinkModalHost() {
  const t = useTranslations('SitePages');
  const tFooter = useTranslations('Footer');
  const tRev = useTranslations('Rev19.legal');
  const [request, setRequest] = useState<SitePageRequest | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<SitePageRequest>).detail;
      if (!detail || typeof detail !== 'object') return;
      setRequest({ group: detail.group, slug: detail.slug });
    };
    window.addEventListener(SITE_PAGE_EVENT, onOpen);
    return () => window.removeEventListener(SITE_PAGE_EVENT, onOpen);
  }, []);

  const slug = request?.slug ?? null;
  const body = slug ? (t.raw(`${slug}.body`) as string[]) : [];

  return (
    <Modal open={request !== null} onClose={() => setRequest(null)} labelledBy="site-page-title" size="xl">
      {request && slug && (
        <article className="qw-site-modal space-y-5" data-site-page={slug}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-accent/70">
            {tFooter(GROUP_HEADER_KEY[request.group])} · {tRev('eyebrow')}
          </p>
          <h2 id="site-page-title" className="font-serif text-2xl font-bold leading-tight text-white md:text-3xl">
            {t(`${slug}.title`)}
          </h2>
          <p className="text-[16px] leading-relaxed text-gray-200 [text-wrap:balance]">{t(`${slug}.lede`)}</p>
          <div className="max-h-[46vh] space-y-4 overflow-y-auto overscroll-contain pr-1">
            {body.map((paragraph, i) => (
              <p key={i} className="text-[14px] leading-relaxed text-gray-300">
                {paragraph}
              </p>
            ))}
            {DISCLAIMER_SLUGS.has(slug) && (
              <p className="border-t border-white/10 pt-4 text-[12px] leading-relaxed text-gray-500">{t('common.disclaimer')}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <Link
              href={`/${request.group}/${slug}`}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.2em] text-accent transition-colors hover:text-white"
            >
              {tRev('openFull')}
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setRequest(null)}
              className="border border-white/20 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.2em] text-gray-200 transition-colors hover:border-white/40 hover:text-white"
            >
              {tRev('close')}
            </button>
          </div>
        </article>
      )}
    </Modal>
  );
}
