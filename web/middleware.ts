import { NextResponse } from 'next/server';

// Deliberately does not invoke next-intl/middleware. Locale resolution
// happens entirely at the page/layout level instead:
//   - app/page.tsx handles the bare "/" -> "/{locale}" redirect
//   - app/[locale]/layout.tsx validates the locale segment (hasLocale + notFound)
//   - i18n/request.ts resolves the request locale for Server Components
// This function can never throw, which eliminates MIDDLEWARE_INVOCATION_FAILED
// at the source rather than catching it after the fact.
export function middleware() {
  return NextResponse.next();
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
