import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { updateSession } from '@/lib/supabase/middlewareClient';
import {
  SOVEREIGN_AUTH_PARAM,
  SOVEREIGN_HINT_COOKIE,
  SOVEREIGN_HINT_VALUE,
  SOVEREIGN_SESSION_COOKIE,
  SOVEREIGN_SESSION_TTL_SEC,
  evaluateSovereignParam,
  isSovereignProtectedPath,
  resolveSovereignSigningSecret,
  resolveSovereignToken,
  signSovereignSession,
  stripSovereignParam,
  verifySovereignSession,
} from '@/lib/sovereignAuth';

// Root single-URL English-first architecture (owner instruction 2026-09-06):
// `i18n/routing.ts` sets `localePrefix: 'as-needed'` + `localeDetection:
// false`, so next-intl's own middleware is now load-bearing -- it is the
// thing that internally rewrites a bare "/" (or "/about") request to
// "/en" (or "/en/about") for Next's router while leaving the address bar
// alone, and it 308-redirects a superfluous "/en" to "/" for canonical
// consolidation. There is deliberately no app/page.tsx any more; the
// rewrite below is what makes "/" resolve to app/[locale]/page.tsx at all.
//
// This still has to compose with the three other things this middleware
// does, all fail-safe:
//   1. Sovereign founder auth (owner instruction 2026-09-04, item 4): a
//      `?sovereign_auth=<token>` visit is verified in constant time against
//      SOVEREIGN_AUTH_TOKEN; a match mints the HMAC-signed HttpOnly session
//      cookie (+ a client hint cookie) and 303-redirects to the same URL with
//      the token stripped. `?sovereign_auth=off` revokes. A wrong token gets
//      the same silent redirect -- no cookie, no distinguishing response.
//   2. Fail-closed 404 for every sovereign-only route (lib/sovereignAuth.ts
//      `isSovereignProtectedPath`) unless the signed cookie verifies.
//   3. Refreshes the Supabase auth session cookie (updateSession) so the
//      page-level coin gate in app/[locale]/(gated)/layout.tsx can read who
//      is signed in. updateSession swallows all errors and never throws.
//   4. Forwards `x-unitas-pathname` onto the downstream request so that gate
//      layout (which, being a route-group layout, does not otherwise receive
//      the module route segment) can tell which module is being requested.
//      `moduleForPathname` already tolerates a pathname with or without a
//      locale prefix, so the ORIGINAL (pre-rewrite) pathname is forwarded
//      unchanged here.
//
// Composition order: sovereign token hand-off and 404 fencing run first
// (locale-independent, early-return). Then next-intl's middleware resolves
// the locale rewrite/redirect. A redirect (superfluous "/en", or a locale
// literally not in `routing.locales`) is returned as-is. Otherwise its
// rewrite target (if any) is preserved while rebuilding the response so the
// Supabase cookie refresh and the `x-unitas-pathname` request header can
// both still be attached to the SAME response next-intl produced -- per
// next-intl's documented middleware-composition pattern, only altering its
// response rather than discarding it.
//
// Ownership/fingerprint headers: a lightweight, non-visual complement to
// scripts/ownership-fingerprint.mjs's public/ manifest -- the manifest covers
// static assets under public/, this covers page navigations.
const handleI18nRouting = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const secure = url.protocol === 'https:';

  // --- 1. sovereign token hand-off -----------------------------------------
  if (url.searchParams.has(SOVEREIGN_AUTH_PARAM)) {
    const verdict = evaluateSovereignParam(url.search, resolveSovereignToken());
    const response = NextResponse.redirect(stripSovereignParam(url), 303);
    response.headers.set('Cache-Control', 'no-store');

    if (verdict === 'grant') {
      // `grant` is only reachable when resolveSovereignToken() returned a
      // non-null token (evaluateSovereignParam fails closed on null), and
      // resolveSovereignSigningSecret() derives from that same token when no
      // explicit signing secret is set -- so this is non-null in practice.
      // The check stays explicit (rather than a non-null assertion) so a
      // future refactor that decouples the two resolutions fails closed
      // instead of signing a cookie with an empty secret.
      const secret = resolveSovereignSigningSecret();
      if (secret) {
        const expiresAt = Math.floor(Date.now() / 1000) + SOVEREIGN_SESSION_TTL_SEC;
        const session = await signSovereignSession(expiresAt, secret);
        response.cookies.set(SOVEREIGN_SESSION_COOKIE, session, {
          httpOnly: true,
          secure,
          sameSite: 'lax',
          path: '/',
          maxAge: SOVEREIGN_SESSION_TTL_SEC,
        });
        response.cookies.set(SOVEREIGN_HINT_COOKIE, SOVEREIGN_HINT_VALUE, {
          httpOnly: false,
          secure,
          sameSite: 'lax',
          path: '/',
          maxAge: SOVEREIGN_SESSION_TTL_SEC,
        });
      }
    } else if (verdict === 'revoke') {
      response.cookies.set(SOVEREIGN_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
      response.cookies.set(SOVEREIGN_HINT_COOKIE, '', { path: '/', maxAge: 0 });
    }
    return response;
  }

  // --- 2. sovereign-only routes: bodiless 404 unless the signed cookie holds --
  if (isSovereignProtectedPath(url.pathname)) {
    const { ok } = await verifySovereignSession(
      request.cookies.get(SOVEREIGN_SESSION_COOKIE)?.value,
      resolveSovereignSigningSecret(),
    );
    if (!ok) return new NextResponse(null, { status: 404 });
    if (url.pathname.startsWith('/api/')) {
      const passthrough = NextResponse.next();
      passthrough.headers.set('Cache-Control', 'no-store');
      return passthrough;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-unitas-pathname', url.pathname);

  // API routes (only /api/sovereign/verify can reach this point -- every
  // other /api/* path is outside this middleware's matcher entirely) never
  // go through locale rewriting.
  if (url.pathname.startsWith('/api/')) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    await updateSession(request, response);
    response.headers.set('X-Unitas-Owner', 'THE UNITAS GLOBAL OU');
    response.headers.set(
      'X-Unitas-License',
      'Proprietary -- All Rights Reserved. See /legal#license.',
    );
    return response;
  }

  // --- 3. locale resolution (next-intl) ------------------------------------
  // `intlResponse` is one of: a redirect (superfluous "/en" -> "/"), or a 200
  // that's either a pass-through (already-correct URL) or carries an
  // `x-middleware-rewrite` target (bare "/" internally resolved to "/en").
  const intlResponse = handleI18nRouting(request);
  if (!intlResponse.ok) {
    // Redirect: nothing downstream renders, so there's no Server Component
    // waiting on x-unitas-pathname and no session to usefully refresh here --
    // the browser's follow-up request re-enters this middleware and does both.
    intlResponse.headers.set('X-Unitas-Owner', 'THE UNITAS GLOBAL OU');
    intlResponse.headers.set(
      'X-Unitas-License',
      'Proprietary -- All Rights Reserved. See /legal#license.',
    );
    return intlResponse;
  }

  // --- 4. rebuild the response to carry BOTH next-intl's rewrite target AND
  // the forwarded x-unitas-pathname request header, then layer the Supabase
  // session-refresh cookies on top. NextResponse.next()/.rewrite() only
  // accept a `request.headers` override at construction time, so a fresh
  // response has to be built from whichever target next-intl chose -- its
  // own headers/cookies (locale-preference cookie, hreflang `Link` header)
  // are copied across rather than lost.
  const rewriteTarget = intlResponse.headers.get('x-middleware-rewrite');
  const response = rewriteTarget
    ? NextResponse.rewrite(new URL(rewriteTarget), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });

  intlResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  const alternateLinks = intlResponse.headers.get('link');
  if (alternateLinks) response.headers.set('link', alternateLinks);

  await updateSession(request, response);

  response.headers.set('X-Unitas-Owner', 'THE UNITAS GLOBAL OU');
  response.headers.set(
    'X-Unitas-License',
    'Proprietary -- All Rights Reserved. See /legal#license.',
  );
  return response;
}

export const config = {
  // Keep edge invocation scoped away from static assets/API routes -- this is
  // what keeps CSS/JS chunk requests under /_next/static from ever reaching
  // the middleware (and paying for a Supabase session refresh they can't use).
  // The one API exception is the sovereign prefix, which the middleware fences.
  matcher: [
    '/((?!api|_next/static|_next/image|_vercel|favicon\\.ico|assets|images|.*\\..*).*)',
    '/api/sovereign/:path*',
  ],
};
