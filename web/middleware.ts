import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

// Wrapped defensively: the i18n middleware runs on every matched request in
// the Vercel edge runtime, so any unexpected input (malformed headers,
// missing cookies, odd bot requests) throwing here would otherwise surface
// as a hard MIDDLEWARE_INVOCATION_FAILED for the visitor. Falling through to
// NextResponse.next() lets the request reach the page (which still resolves
// a locale via i18n/request.ts) instead of crashing outright.
export default function middleware(request: NextRequest) {
  try {
    return handleI18nRouting(request);
  } catch (error) {
    console.error('[middleware] i18n routing failed, passing request through', error);
    return NextResponse.next();
  }
}

export const config = {
  // Match all paths except static assets, API routes and Next internals.
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
