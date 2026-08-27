import { NextResponse } from 'next/server';

// Deliberately does not invoke next-intl/middleware. Locale resolution
// happens entirely at the page/layout level instead:
//   - app/page.tsx handles the bare "/" -> "/{locale}" redirect
//   - app/[locale]/layout.tsx validates the locale segment (hasLocale + notFound)
//   - i18n/request.ts resolves the request locale for Server Components
// This function can never throw, which eliminates MIDDLEWARE_INVOCATION_FAILED
// at the source rather than catching it after the fact.
//
// Ownership/fingerprint headers (Item 1): a lightweight, non-visual
// complement to scripts/ownership-fingerprint.mjs's public/ manifest. The
// manifest covers static assets under public/; this covers page navigations
// (everything the matcher below allows through). Both are metadata-level,
// not a visible watermark, per the owner's explicit instruction.
export function middleware() {
  const response = NextResponse.next();
  response.headers.set('X-Unitas-Owner', 'THE UNITAS GLOBAL OU');
  response.headers.set('X-Unitas-License', 'Proprietary -- All Rights Reserved. See /legal#license.');
  return response;
}

export const config = {
  // Keep edge invocation scoped away from static assets/API routes even
  // though the handler above is a no-op -- no reason to pay for an edge
  // invocation on requests this middleware can't affect, and this is what
  // keeps CSS/JS chunk requests under /_next/static from ever reaching it.
  matcher: [
    '/((?!api|_next/static|_next/image|_vercel|favicon\\.ico|assets|images|.*\\..*).*)',
  ],
};
