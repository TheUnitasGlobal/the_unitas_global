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
// slug, in all 20 locales (REV-21 §6.2: written to docs/rev21/i18n/sitepages
// and merged by scripts/i18n/apply-rev21.mjs --namespace SitePages). Legal
// wording is deliberately conservative: "patent pending" (never "granted"),
// no published registry code / street address, no certification claims,
// no application numbers (D-31) -- see THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md.

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

/** Group -> slugs, in footer order. Also embedded verbatim in the
 *  pre-hydration bootstrap below so it validates the same set. */
export const SLUGS_BY_GROUP: Record<SiteGroup, readonly SiteSlug[]> = {
  company: COMPANY_SLUGS,
  legal: LEGAL_SLUGS,
  support: SUPPORT_SLUGS,
};

/** Every slug, footer order. */
export const ALL_SITE_SLUGS: readonly SiteSlug[] = [...COMPANY_SLUGS, ...LEGAL_SLUGS, ...SUPPORT_SLUGS];

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

/** The group a slug belongs to (slugs are unique across groups). */
export function groupOfSlug(slug: string): SiteGroup | null {
  if ((COMPANY_SLUGS as readonly string[]).includes(slug)) return 'company';
  if ((LEGAL_SLUGS as readonly string[]).includes(slug)) return 'legal';
  if ((SUPPORT_SLUGS as readonly string[]).includes(slug)) return 'support';
  return null;
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

/* ------------------------------------------------------------------ */
/* REV-21 §6.2 -- page document shape (`SitePages.<slug>`)             */
/* ------------------------------------------------------------------ */

/** One row of a registry-generated list (third-party sources, browser
 *  storage keys) -- see lib/sitePagesRegistry.ts. */
export interface SiteSectionItem {
  name: string;
  /** Short badge: "called from our servers", "localStorage", ... */
  meta?: string;
  /** One-line legal / purpose note under the name. */
  note?: string;
  /** External homepage of a named operator (opens in a new tab). */
  href?: string;
}

export interface SiteSection {
  heading: string;
  paragraphs: string[];
  /** Registry rows rendered after the paragraphs. */
  items?: SiteSectionItem[];
  /** `data-site-registry` marker for generated sections (E2E contract). */
  kind?: 'third-party' | 'storage' | 'cookies';
}

export interface SitePageDocument {
  title: string;
  lede: string;
  sections: SiteSection[];
  highlights?: string[];
  /** ISO date the copy was last revised (rendered verbatim). */
  updated?: string;
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

/**
 * Validate the raw `SitePages.<slug>` message object into a document both
 * hosts can render. Tolerates the pre-REV-21 `{ body: string[] }` shape
 * (promoted to one heading-less section) so a locale that somehow still
 * carries it renders instead of crashing on `sections.map`. Anything else
 * malformed -> `null` (the route 404s, the modal renders nothing).
 */
export function readSitePageDocument(raw: unknown): SitePageDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.title !== 'string' || typeof r.lede !== 'string') return null;
  let sections: SiteSection[] = [];
  if (Array.isArray(r.sections)) {
    for (const s of r.sections) {
      if (!s || typeof s !== 'object') return null;
      const sec = s as Record<string, unknown>;
      if (typeof sec.heading !== 'string' || !isStringArray(sec.paragraphs)) return null;
      sections.push({ heading: sec.heading, paragraphs: sec.paragraphs });
    }
  } else if (isStringArray(r.body)) {
    sections = [{ heading: '', paragraphs: r.body }];
  } else {
    return null;
  }
  const doc: SitePageDocument = { title: r.title, lede: r.lede, sections };
  if (isStringArray(r.highlights) && r.highlights.length) doc.highlights = r.highlights;
  if (typeof r.updated === 'string' && r.updated.trim()) doc.updated = r.updated;
  return doc;
}

/* ------------------------------------------------------------------ */
/* Inline modal plumbing (REV-19 §12, REV-21 §6.1 F-2 / F-7)           */
/* ------------------------------------------------------------------ */

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

/** sessionStorage mirror of the open page (F-7): a locale switch remounts
 *  the `[locale]` tree, and the dialog comes back from this key. Cleared on
 *  `pagehide` so a reload / real navigation never resurrects it. Listed in
 *  the browser storage ledger (lib/uai/sourceRegistry.ts). */
export const SITE_PAGE_OPEN_STORAGE_KEY = 'unitas.sitePage.open.v1';
/** `window` flag SiteLinkModalHost raises while mounted -- the pre-hydration
 *  bootstrap stands down on the next click once it is set. */
export const SITE_LINK_LIVE_FLAG = '__unitasSiteLinkLive';
/** `window` slot the bootstrap parks a pre-hydration click's request in. */
export const SITE_LINK_PENDING_KEY = '__unitasPendingSitePage';

declare global {
  interface Window {
    __unitasSiteLinkLive?: boolean;
    __unitasPendingSitePage?: unknown;
  }
}

/** Validate an untrusted value (window slot, sessionStorage, event detail)
 *  into a page request; `null` for anything that is not one. */
export function validateSitePageRequest(raw: unknown): SitePageRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const { group, slug } = raw as { group?: unknown; slug?: unknown };
  if (typeof group !== 'string' || typeof slug !== 'string') return null;
  if (group !== 'company' && group !== 'legal' && group !== 'support') return null;
  if (!isSiteSlug(group, slug)) return null;
  return { group, slug: slug as SiteSlug };
}

/** Resolve `/legal/terms`-style hrefs (with or without a locale prefix)
 *  and `legal/terms`-style `data-site-link` values into a validated page
 *  request; null for anything that is not one. */
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

/** Take (and clear) the request a pre-hydration click parked on `window`. */
export function consumePendingSitePage(): SitePageRequest | null {
  if (typeof window === 'undefined') return null;
  const raw = window[SITE_LINK_PENDING_KEY];
  window[SITE_LINK_PENDING_KEY] = null;
  return validateSitePageRequest(raw);
}

interface StoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function sessionStore(): StoreLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** The page the mirror says is open (F-7), or null. */
export function readSavedSitePage(store: StoreLike | null = sessionStore()): SitePageRequest | null {
  if (!store) return null;
  try {
    const raw = store.getItem(SITE_PAGE_OPEN_STORAGE_KEY);
    return raw ? validateSitePageRequest(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Mirror the open page (F-7); `null` clears the mirror. */
export function saveOpenSitePage(request: SitePageRequest | null, store: StoreLike | null = sessionStore()): void {
  if (!store) return;
  try {
    if (request) store.setItem(SITE_PAGE_OPEN_STORAGE_KEY, JSON.stringify({ group: request.group, slug: request.slug }));
    else store.removeItem(SITE_PAGE_OPEN_STORAGE_KEY);
  } catch {
    // storage unavailable -- surviving a locale switch is a nicety, not a requirement.
  }
}

/**
 * REV-21 §6.1 (F-2) -- pre-hydration site-link capture. Injected into
 * app/layout.tsx's <head> (ES5 only: no arrows, no let/const -- asserted by
 * __tests__/layout/siteLinkBootstrap.test.ts) so a footer / legal link
 * clicked BEFORE React has hydrated (a phone on a slow link, a refresh
 * landing on the released home) does not fall through to the anchor's
 * `href` and route the visitor into the dark `/legal/<slug>` document.
 *
 * Contract with the rest of the site:
 *  - listens in the CAPTURE phase on `window` for a plain left click
 *    (no modifier keys, not already default-prevented) whose target sits
 *    inside an `a[data-site-link]`; anything else is left alone, so
 *    middle-click / ctrl-click still open the real route in a new tab.
 *  - validates the request against the SAME group/slug set as
 *    `parseSitePageHref` (embedded below), then prevents the navigation,
 *    parks the request in `window.__unitasPendingSitePage`, mirrors it to
 *    sessionStorage (F-7), and dispatches `unitas:site-page` so an
 *    already-mounted host opens it at once. `SiteLinkModalHost` consumes
 *    the parked request on mount.
 *  - never stops propagation: ExitGuard's own capture listeners still
 *    count the click as the visitor's activation gesture.
 *  - stands down on the first click after `SiteLinkModalHost` has mounted
 *    (`__unitasSiteLinkLive`); from then on the React onClick handles it.
 */
export const SITE_LINK_BOOTSTRAP = `(function(){try{
var L=${JSON.stringify(SITE_LINK_LIVE_FLAG)},P=${JSON.stringify(SITE_LINK_PENDING_KEY)},K=${JSON.stringify(SITE_PAGE_OPEN_STORAGE_KEY)},EV=${JSON.stringify(SITE_PAGE_EVENT)},G=${JSON.stringify(SLUGS_BY_GROUP)};
function parse(h){var raw=String(h||'').split(/[?#]/)[0].split('/'),parts=[],i;for(i=0;i<raw.length;i++){if(raw[i])parts.push(raw[i]);}var idx=-1;for(i=0;i<parts.length;i++){if(Object.prototype.hasOwnProperty.call(G,parts[i])){idx=i;break;}}if(idx===-1||idx>1)return null;var g=parts[idx],s=parts[idx+1],list=G[g];if(!s)return null;for(i=0;i<list.length;i++){if(list[i]===s)return {group:g,slug:s};}return null;}
function off(){window.removeEventListener('click',on,true);}
function on(e){if(window[L]){off();return;}if(!e||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var t=e.target;while(t&&t!==document&&!(t.getAttribute&&t.hasAttribute&&t.hasAttribute('data-site-link'))){t=t.parentNode;}if(!t||t===document)return;var r=parse(t.getAttribute('data-site-link'))||parse(t.getAttribute('href'));if(!r)return;e.preventDefault();window[P]=r;try{sessionStorage.setItem(K,JSON.stringify(r));}catch(_){}try{window.dispatchEvent(new CustomEvent(EV,{detail:r}));}catch(_){}}
window.addEventListener('click',on,true);
}catch(_){}})();`;
