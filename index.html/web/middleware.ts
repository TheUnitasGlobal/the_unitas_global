import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middlewareClient';

// Locale resolution deliberately does NOT run next-intl/middleware. It
// happens entirely at the page/layout level instead:
//   - app/page.tsx handles the bare "/" -> "/{locale}" redirect
//   - app/[locale]/layout.tsx validates the locale segment (hasLocale + notFound)
//   - i18n/request.ts resolves the request locale for Server Components
//
// This middleware does two things, both fail-safe:
//   1. Refreshes the Supabase auth session cookie (updateSession) so the
//      page-level coin gate in app/[locale]/(gated)/layout.tsx can read who
//      is signed in. updateSession swallows all errors and never throws.
//   2. Forwards `x-unitas-pathname` onto the downstream request so that gate
//      layout (which, being a route-group layout, does not otherwise receive
//      the module route segment) can tell which module is being requested.
//
// Ownership/fingerprint headers (Item 1): a lightweight, non-visual
// complement to scripts/ownership-fingerprint.mjs's public/ manifest -- the
// manifest covers static assets under public/, this covers page navigations.
export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-unitas-pathname', request.nextUrl.pathname);

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
  matcher: [
    '/((?!api|_next/static|_next/image|_vercel|favicon\\.ico|assets|images|.*\\..*).*)',
  ],
};
