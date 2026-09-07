import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

/**
 * Middleware-side Supabase session refresh. Bridges the incoming request
 * cookies and the outgoing response cookies so an expired access token is
 * rotated on navigation (the browser client can't do this while the tab is
 * closed / on a hard load).
 *
 * Mutates the caller-supplied `response` in place rather than building its
 * own -- middleware.ts is the one composing next-intl's locale
 * rewrite/redirect response with this session refresh (owner instruction
 * 2026-09-06, root single-URL architecture), so the base response (and any
 * `x-middleware-rewrite` target it already carries) must survive; this
 * function only ever adds cookies onto it.
 *
 * Returns the resolved user, or `user: null` on any failure -- middleware.ts
 * must never throw (MIDDLEWARE_INVOCATION_FAILED), and a failure to resolve
 * the session is treated fail-closed as "signed out" by the gate layer.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ user: User | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { user: null };

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { user: user ?? null };
  } catch {
    return { user: null };
  }
}
