import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

// Only headers that are safe to surface in server logs (no cookies, no
// authorization, no anything that could carry a session/token).
const SAFE_DIAGNOSTIC_HEADERS = ['user-agent', 'accept-language', 'referer'] as const;

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
    const headersSummary: Record<string, string> = {};
    for (const key of SAFE_DIAGNOSTIC_HEADERS) {
      const value = request.headers.get(key);
      if (value) headersSummary[key] = value;
    }

    console.error(
      JSON.stringify({
        scope: 'middleware',
        level: 'error',
        message: error instanceof Error ? error.message : String(error),
        pathname: request.nextUrl.pathname,
        method: request.method,
        headers: headersSummary,
        timestamp: new Date().toISOString(),
      }),
    );

    return NextResponse.next();
  }
}

export const config = {
  // Match all paths except API routes, Next.js build/image internals,
  // Vercel's own internal endpoints (e.g. /_vercel/insights/view -- must
  // stay excluded or Vercel Analytics gets rewritten by i18n routing),
  // favicon, the public/assets and public/images directories, and any path
  // with a file extension (the generic static-file catch-all). This keeps
  // edge execution scoped to actual page routes only.
  matcher: [
    '/((?!api|_next/static|_next/image|_vercel|favicon\\.ico|assets|images|.*\\..*).*)',
  ],
};
