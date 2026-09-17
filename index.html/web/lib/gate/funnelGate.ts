/**
 * REV-23 M1 -- the SERVER-SIDE funnel gate (founder directive 2026-09-13,
 * MISSION 1, highest priority).
 *
 * THE DEFECT THIS CLOSES. Until REV-23 the pre-launch funnel (logo splash ->
 * entry gate -> ad segments 1-5 -> the sealed "COMING SOON" screen) was a
 * purely CLIENT overlay: `app/[locale]/layout.tsx` mounted
 * <ComingSoonCinema/> at z-500 on top of a page whose real HTML the server
 * had already sent. Anything that arrived on a deep link -- a Bing result,
 * a shared URL, an in-app browser, a reader mode, a JS-disabled client, or
 * plain devtools -- either saw, or could trivially reveal, the main site
 * without ever walking the funnel. A curtain is not a gate.
 *
 * THE FIX. The verdict is now taken at the EDGE, before any page renders,
 * and a sealed visitor's request is REWRITTEN (never redirected) onto
 * `/<locale>/gateway` -- a route whose page body is empty, so the main
 * interface's markup is never serialized into a response at all. The URL in
 * the address bar is untouched, so a deep link still "works" (it just lands
 * on the funnel), no redirect loop is possible, and `generateStaticParams`
 * keeps every page statically generated: nothing here reads `headers()` in
 * a layout.
 *
 * EXACTLY TWO WAYS PAST IT, all fail-closed:
 *   1. a proven SOVEREIGN founder -- the cookie session, the covert
 *      `x-unitas-signature` master key, or the `?sovereign_auth=<token>`
 *      bootstrap that mints the cookie (lib/sovereignAuth.ts +
 *      lib/sovereign/masterKey.ts). All three collapse into the single
 *      `hasSovereign` input below, resolved once per request by middleware;
 *   2. a search-engine indexer (`isIndexerAgent`) -- Codex ch.7's global
 *      SEO sovereignty depends on Googlebot/bingbot/Yeti/YandexBot/SeznamBot
 *      still reading the real pages; a human following the indexed link is
 *      sealed like everyone else.
 *
 * REV-24 MISSION 2 (founder directive 2026-09-13) DELETED the third way. The
 * `UNITAS_GATE_BYPASS=1` environment flag was a temporary all-or-nothing
 * switch: set in production it opened the funnel for the entire planet, and
 * it was the only thing standing between the founder's own direct access and
 * a lockout. The Sovereign Master Key replaces it with a per-request
 * credential that is scoped to whoever holds it -- so there is no longer any
 * environment variable, anywhere, that disables this gate.
 *
 * Pure + Edge-safe: no DOM, no Node API, no crypto. Unit-tested in
 * __tests__/gate/funnelGate.test.ts.
 */

/** Route segment the sealed rewrite lands on. */
export const GATE_PATH_SEGMENT = 'gateway';

/** Response header stamped with the verdict (observability + E2E contract). */
export const GATE_HEADER = 'x-unitas-gate';

export type GateVerdict = 'pass' | 'seal';

/**
 * Paths the gate must never touch. Two families:
 *  - infrastructure the middleware matcher already mostly excludes, kept
 *    here as belt-and-braces so a matcher edit can never silently start
 *    sealing `/api` or the sitemap;
 *  - the gateway route itself (sealing it would rewrite onto itself).
 */
export function isGateExemptPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/_vercel/')) return true;
  if (pathname.startsWith('/assets/') || pathname.startsWith('/icons/') || pathname.startsWith('/images/')) return true;
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/manifest.webmanifest') return true;
  // IndexNow key file + any other bare file at the root (favicon, *.txt).
  if (/^\/[^/]+\.[A-Za-z0-9]+$/.test(pathname)) return true;
  return isGatePath(pathname);
}

/** Is this already the gateway route (with or without a locale prefix)? */
export function isGatePath(pathname: string): boolean {
  return new RegExp(`^/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?/)?${GATE_PATH_SEGMENT}(?:/|$)`).test(pathname);
}

/**
 * Search-engine + link-preview crawlers that must keep reading the real
 * pages (Codex ch.7). Deliberately a NAME allowlist rather than a
 * reverse-DNS check: a forged UA buys a spoofer nothing an ordinary
 * `view-source:` would not already give them, while a missed real crawler
 * would silently de-index the whole 340-URL sitemap.
 */
const INDEXER_UA = [
  'googlebot',
  'google-inspectiontool',
  'storebot-google',
  'bingbot',
  'adidxbot',
  'bingpreview',
  'msnbot',
  'yandexbot',
  'yeti', // NaverBot
  'naverbot',
  'seznambot',
  'duckduckbot',
  'duckassistbot',
  'applebot',
  'slurp', // Yahoo
  'baiduspider',
  'petalbot',
  'facebookexternalhit',
  'facebookcatalog',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'whatsapp',
  'discordbot',
  'indexnow',
  'chrome-lighthouse',
] as const;

export function isIndexerAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return INDEXER_UA.some((needle) => ua.includes(needle));
}

export interface GateInput {
  pathname: string;
  userAgent: string | null | undefined;
  /**
   * A sovereign founder was PROVEN for this request -- by the signed cookie,
   * by the `x-unitas-signature` master key, or by the auth param that mints
   * the cookie. Resolved once per request in middleware.ts so the HMAC cost
   * is paid at most once, and never at all for the public.
   */
  hasSovereign: boolean;
}

/**
 * The one decision. Order matters: exempt paths short-circuit before any
 * identity question, then the two carve-outs, then SEAL. Anything the
 * function cannot positively justify passing is sealed -- and with the env
 * bypass gone, `hasSovereign` is the only input a human can influence, and it
 * is cryptographic.
 */
export function resolveGateVerdict({ pathname, userAgent, hasSovereign }: GateInput): GateVerdict {
  if (isGateExemptPath(pathname)) return 'pass';
  if (hasSovereign) return 'pass';
  if (isIndexerAgent(userAgent)) return 'pass';
  return 'seal';
}

/**
 * The rewrite target for a sealed request. `locale` is the locale the
 * i18n layer already resolved, so the gateway page renders in the visitor's
 * own language -- the funnel captions are localized.
 */
export function gatewayPathFor(locale: string): string {
  return `/${locale}/${GATE_PATH_SEGMENT}`;
}
