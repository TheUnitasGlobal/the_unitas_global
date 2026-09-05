import { NextResponse, type NextRequest } from 'next/server';
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

// Locale resolution deliberately does NOT run next-intl/middleware. It
// happens entirely at the page/layout level instead:
//   - app/page.tsx handles the bare "/" -> "/{locale}" redirect
//   - app/[locale]/layout.tsx validates the locale segment (hasLocale + notFound)
//   - i18n/request.ts resolves the request locale for Server Components
//
// This middleware does four things, all fail-safe:
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
//
// Ownership/fingerprint headers: a lightweight, non-visual complement to
// scripts/ownership-fingerprint.mjs's public/ manifest -- the manifest covers
// static assets under public/, this covers page navigations.
export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const secure = url.protocol === 'https:';

  // --- 1. sovereign token hand-off -----------------------------------------
  if (url.searchParams.has(SOVEREIGN_AUTH_PARAM)) {
    const verdict = evaluateSovereignParam(url.search, resolveSovereignToken());
    const response = NextResponse.redirect(stripSovereignParam(url), 303);
    response.headers.set('Cache-Control', 'no-store');

    if (verdict === 'grant') {
      const expiresAt = Math.floor(Date.now() / 1000) + SOVEREIGN_SESSION_TTL_SEC;
      const session = await signSovereignSession(expiresAt, resolveSovereignSigningSecret());
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

  // --- 3 + 4. session refresh + pathname forwarding -----------------------
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-unitas-pathname', url.pathname);

  const { response } = await updateSession(request, requestHeaders);

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
