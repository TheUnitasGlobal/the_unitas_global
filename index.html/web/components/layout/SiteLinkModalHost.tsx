'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowUpRight } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { Modal } from '@/components/ui/Modal';
import { SiteArticle } from './SiteArticle';
import {
  DISCLAIMER_SLUGS,
  SITE_LINK_LIVE_FLAG,
  SITE_PAGE_EVENT,
  consumePendingSitePage,
  readSavedSitePage,
  readSitePageDocument,
  saveOpenSitePage,
  validateSitePageRequest,
  type SiteGroup,
  type SitePageRequest,
} from '@/lib/sitePages';
import { readRegistryLabels, registrySectionsFor } from '@/lib/sitePagesRegistry';
import { beginNavigation } from '@/lib/history/navigationLock';

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
 * REV-21 §6.1: renders the same `SiteArticle` as the route (F-1); takes
 * over a click the head bootstrap captured before hydration (F-2); mirrors
 * the open page to sessionStorage so a locale-switch remount brings it back
 * (F-7); closes WITHOUT a history traversal when the visitor follows "open
 * the full page" (the router is pushing the route entry -- a traversal
 * would cancel it, the same trap §4A F1 fixed for language switches).
 *
 * Mounted once in app/[locale]/layout.tsx; opened from anywhere through
 * `openSitePage()` (lib/sitePages.ts).
 */
export function SiteLinkModalHost() {
  const t = useTranslations('SitePages');
  const tFooter = useTranslations('Footer');
  const tRev = useTranslations('Rev19.legal');
  const locale = useLocale();
  const pathname = usePathname();
  const [request, setRequest] = useState<SitePageRequest | null>(null);

  // The route that already shows a page never gets the same page as a
  // dialog on top of itself (a restored mirror after a navigation, a stray
  // open while the full page is up).
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const isOwnRoute = (next: SitePageRequest) => pathnameRef.current === `/${next.group}/${next.slug}`;

  // Open requests: the `unitas:site-page` event (footer / Entry Gate /
  // sign-up form, and the head bootstrap once we are live) plus, on mount,
  // a request the bootstrap parked before hydration (F-2) or the page that
  // was open before a locale-switch remount (F-7). The mirror is written
  // synchronously in the open path (not in an effect) so its state is
  // settled before any `pagehide` that a navigation may raise.
  useEffect(() => {
    window[SITE_LINK_LIVE_FLAG] = true;
    const open = (next: SitePageRequest | null) => {
      if (!next || isOwnRoute(next)) {
        saveOpenSitePage(null);
        return;
      }
      saveOpenSitePage(next);
      setRequest(next);
    };
    const onOpen = (event: Event) => open(validateSitePageRequest((event as CustomEvent<unknown>).detail));
    // A reload or a real navigation away must not resurrect the dialog;
    // only a same-document remount (the locale switch) may.
    const onPageHide = () => saveOpenSitePage(null);
    window.addEventListener(SITE_PAGE_EVENT, onOpen);
    window.addEventListener('pagehide', onPageHide);
    open(consumePendingSitePage() ?? readSavedSitePage());
    return () => {
      window[SITE_LINK_LIVE_FLAG] = false;
      window.removeEventListener(SITE_PAGE_EVENT, onOpen);
      window.removeEventListener('pagehide', onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; the pathname is read through a ref
  }, []);

  // F-7: the mirror is cleared the moment the page closes.
  useEffect(() => {
    if (!request) saveOpenSitePage(null);
  }, [request]);

  // An in-locale route change (the "open the full page" link, or any other
  // navigation while the dialog is up) closes the dialog without walking
  // history back over its entry: the lock makes the layer release with
  // `traverse: false` (see components/ui/useHistoryLayer.ts).
  const pathRef = useRef(pathname);
  useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    setRequest((current) => {
      if (current) beginNavigation();
      return null;
    });
  }, [pathname]);

  const slug = request?.slug ?? null;
  const doc = slug ? readSitePageDocument(t.raw(slug)) : null;
  const sections = doc && slug ? [...doc.sections, ...registrySectionsFor(slug, locale, readRegistryLabels((key) => t(key)))] : [];
  const legal = slug ? DISCLAIMER_SLUGS.has(slug) : false;

  return (
    <Modal open={request !== null} onClose={() => setRequest(null)} labelledBy="site-page-title" size="xl">
      {request && slug && doc && (
        <SiteArticle
          host="modal"
          group={request.group}
          slug={slug}
          eyebrow={`${tFooter(GROUP_HEADER_KEY[request.group])} · ${tRev('eyebrow')}`}
          title={doc.title}
          lede={doc.lede}
          sections={sections}
          highlights={doc.highlights}
          updated={doc.updated}
          labels={{ updated: t('common.updatedLabel'), contents: t('common.contentsLabel') }}
          disclaimer={legal ? t('common.disclaimer') : undefined}
          notice={legal ? undefined : t('common.corporateNotice')}
        >
          <div className="qw-site-article-actions">
            {/* Close on the click itself, not on the pathname effect that
                follows it: the route's own <h1 id="site-page-title"> mounts
                before that effect runs, and for those frames the document
                would carry the id twice (an ambiguous label for assistive
                tech, and an ambiguous selector for the E2E contract). */}
            <Link
              href={`/${request.group}/${slug}`}
              onClick={() => {
                beginNavigation();
                setRequest(null);
              }}
              data-site-open-full=""
            >
              {tRev('openFull')}
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => setRequest(null)}>
              {tRev('close')}
            </button>
          </div>
        </SiteArticle>
      )}
    </Modal>
  );
}
