import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

/**
 * Middleware-side Supabase session refresh. Bridges the incoming request
 * cookies and the outgoing response cookies so an expired access token is
 * rotated on navigation (the browser client can't do this while the tab is
 * closed / on a hard load).
 *
 * `requestHeaders` is forwarded onto the downstream request (that is the only
 * way to make a header visible to Server Components) -- middleware.ts uses it
 * to pass `x-unitas-pathname` to the app/[locale]/(gated)/ gate layout.
 *
 * Returns the (possibly rewritten) response plus the resolved user, or
 * `user: null` on any failure -- middleware.ts must never throw
 * (MIDDLEWARE_INVOCATION_FAILED), and a failure to resolve the session is
 * treated fail-closed as "signed out" by the gate layer.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { response, user: null };

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { response, user: user ?? null };
  } catch {
    return { response, user: null };
  }
}
