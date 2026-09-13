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
 * EXACTLY THREE WAYS PAST IT, all fail-closed:
 *   1. a verified sovereign founder session (HMAC HttpOnly cookie minted by
 *      `?sovereign_auth=<token>`, see lib/sovereignAuth.ts);
 *   2. a search-engine indexer (`isIndexerAgent`) -- Codex ch.13's global
 *      SEO sovereignty depends on Googlebot/bingbot/Yeti/YandexBot/SeznamBot
 *      still reading the real pages; a human following the indexed link is
 *      sealed like everyone else;
 *   3. `UNITAS_GATE_BYPASS=1`, for local development and the E2E harness
 *      only (the founder's "로컬 개발 환경이나 예외 상황" carve-out).
 *
 * Pure + Edge-safe: no DOM, no Node API, no crypto. Unit-tested in
 * __tests__/gate/funnelGate.test.ts.
 */

/** Route segment the sealed rewrite lands on. */
export const GATE_PATH_SEGMENT = 'gateway';

/** Response header stamped with the verdict (observability + E2E contract). */
export const GATE_HEADER = 'x-unitas-gate';

/** Env flag that disables enforcement outright (local dev / E2E only). */
export const GATE_BYPASS_ENV = 'UNITAS_GATE_BYPASS';

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
 * pages (Codex ch.13). Deliberately a NAME allowlist rather than a
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

/** `true` only when the explicit bypass flag is literally "1". */
export function isGateBypassed(env: Record<string, string | undefined>): boolean {
  return env[GATE_BYPASS_ENV] === '1';
}

export interface GateInput {
  pathname: string;
  userAgent: string | null | undefined;
  /** A verified sovereign founder session was proven for this request. */
  hasSovereign: boolean;
  /** `isGateBypassed(process.env)` -- resolved by the caller. */
  bypass: boolean;
}

/**
 * The one decision. Order matters: exempt paths short-circuit before any
 * identity question, then the three carve-outs, then SEAL. Anything the
 * function cannot positively justify passing is sealed.
 */
export function resolveGateVerdict({ pathname, userAgent, hasSovereign, bypass }: GateInput): GateVerdict {
  if (isGateExemptPath(pathname)) return 'pass';
  if (bypass) return 'pass';
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
