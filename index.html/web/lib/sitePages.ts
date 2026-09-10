// Footer / institutional site pages. These are NOT product modules (not
// coin-gated, not in MODULE_REGISTRY) -- they are the "Company / Legal /
// Policies / Customer Service" surface every footer link now routes to a
// real, unique screen for (owner instruction 2026-08-29).
//
// Route groups map to app/[locale]/<group>/[slug]/page.tsx. The group
// folders (`company`, `legal`, `support`) are whitelisted in
// scripts/validate-module-registry.mjs's INFRA_ROUTES so the registry
// guard doesn't flag them as unregistered modules.
//
// Copy lives in messages/*.json under the `SitePages` namespace, keyed by
// slug (all 6 locales -- en, es, et, ja, ko, zh). Legal wording is
// deliberately conservative: "patent pending" (never "granted"), no
// published registry code / street address, no certification claims -- see
// THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md.

export const COMPANY_SLUGS = ['about', 'careers', 'press'] as const;
export const LEGAL_SLUGS = [
  'patent-notice',
  'compliance',
  'security',
  'privacy',
  'cookies',
  'terms',
] as const;
export const SUPPORT_SLUGS = ['help-center', 'contact', 'system-status'] as const;

export type CompanySlug = (typeof COMPANY_SLUGS)[number];
export type LegalSlug = (typeof LEGAL_SLUGS)[number];
export type SupportSlug = (typeof SUPPORT_SLUGS)[number];
export type SiteSlug = CompanySlug | LegalSlug | SupportSlug;

export type SiteGroup = 'company' | 'legal' | 'support';

/** Slugs whose page carries the "informational only" legal disclaimer line. */
export const DISCLAIMER_SLUGS = new Set<string>([
  'patent-notice',
  'compliance',
  'security',
  'privacy',
  'cookies',
  'terms',
]);

export function isSiteSlug(group: SiteGroup, slug: string): boolean {
  if (group === 'company') return (COMPANY_SLUGS as readonly string[]).includes(slug);
  if (group === 'legal') return (LEGAL_SLUGS as readonly string[]).includes(slug);
  return (SUPPORT_SLUGS as readonly string[]).includes(slug);
}

interface FooterLink {
  /** messages `Footer` namespace key -- the visible label. */
  labelKey: string;
  /** absolute in-locale path, e.g. `/company/about`. */
  href: string;
  /** messages `SitePages` namespace key for the destination page body. */
  slug: SiteSlug;
  group: SiteGroup;
}

export interface FooterSection {
  /** messages `Footer` namespace key -- the column header. */
  headerKey: string;
  links: FooterLink[];
}

const link = (group: SiteGroup, slug: SiteSlug, labelKey: string): FooterLink => ({
  group,
  slug,
  labelKey,
  href: `/${group}/${slug}`,
});

// Column order per the existing Footer: Company -> Legal -> Policies -> Customer Service.
export const FOOTER_SECTIONS: FooterSection[] = [
  {
    headerKey: 'company',
    links: [
      link('company', 'about', 'about'),
      link('company', 'careers', 'careers'),
      link('company', 'press', 'press'),
    ],
  },
  {
    headerKey: 'legal',
    links: [
      link('legal', 'patent-notice', 'patentNotice'),
      link('legal', 'compliance', 'compliance'),
      link('legal', 'security', 'security'),
    ],
  },
  {
    headerKey: 'policies',
    links: [
      link('legal', 'privacy', 'privacyPolicy'),
      link('legal', 'cookies', 'cookiePolicy'),
      link('legal', 'terms', 'termsOfService'),
    ],
  },
  {
    headerKey: 'customerService',
    links: [
      link('support', 'help-center', 'helpCenter'),
      link('support', 'contact', 'contactUs'),
      link('support', 'system-status', 'systemStatus'),
    ],
  },
];

/**
 * REV-19 §12: institutional pages open as an INLINE modal over the current
 * screen (`components/layout/SiteLinkModalHost.tsx`) instead of routing
 * away -- the routes above stay for SEO / deep links / the "open the full
 * page" affordance. Any surface (footer, Entry Gate legal link, sign-up
 * form) opens one by dispatching this event on `window`.
 */
export const SITE_PAGE_EVENT = 'unitas:site-page';

export interface SitePageRequest {
  group: SiteGroup;
  slug: SiteSlug;
}

/** Resolve `/legal/terms`-style hrefs (with or without a locale prefix)
 *  into a validated page request; null for anything that is not one. */
export function parseSitePageHref(href: string): SitePageRequest | null {
  const parts = href.split(/[?#]/)[0].split('/').filter(Boolean);
  const idx = parts.findIndex((p) => p === 'company' || p === 'legal' || p === 'support');
  if (idx === -1 || idx > 1) return null; // at most one (locale) segment before the group
  const group = parts[idx] as SiteGroup;
  const slug = parts[idx + 1];
  if (!slug || !isSiteSlug(group, slug)) return null;
  return { group, slug: slug as SiteSlug };
}

/** Client helper: open an institutional page inline. No-op on the server. */
export function openSitePage(request: SitePageRequest): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SitePageRequest>(SITE_PAGE_EVENT, { detail: request }));
}
