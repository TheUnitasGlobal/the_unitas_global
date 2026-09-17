import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { describeCredential, validatePublicSupabaseEnv } from '@/lib/security/credentialShape';

/**
 * Silence was half the 2026-09-17 bug: a developer holding a placeholder got a
 * silently signed-out app with no clue why. One line, once per Edge isolate --
 * this runs on EVERY navigation, so it must never become a per-request log.
 * Never carries a credential value (see describeCredential), and the whole
 * emit is guarded because nothing in this file may throw.
 */
let degradeWarned = false;

function warnDegradedOnce(url: unknown, anonKey: unknown, errors: string[]): void {
  if (degradeWarned) return;
  degradeWarned = true;
  try {
    console.warn(
      `[Sovereign Shield] middleware Supabase session refresh degraded to signed-out :: ${errors.join(' | ')} · url=${describeCredential(url)} anon=${describeCredential(anonKey)}`,
    );
  } catch {
    // A diagnostic may never be the reason middleware fails.
  }
}

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
 * must never throw (MIDDLEWARE_INVOCATION_FAILED is a 500 on EVERY route, not
 * a sign-out), and a failure to resolve the session is treated fail-closed as
 * "signed out" by the gate layer.
 *
 * The credential check is `validatePublicSupabaseEnv`, not `!url || !anonKey`,
 * because a placeholder (`[SENSITIVE]`, `<paste-...>`) is a NON-EMPTY string:
 * the old truthiness test let middleware build a live client and post the
 * placeholder to GoTrue as a bearer token on every navigation, which 401s and
 * lands in the catch below anyway -- a request-rate round trip to reach the
 * same `user: null` (2026-09-17). It now degrades before the network.
 *
 * That check sits INSIDE the try on purpose: the contract here is "no throw
 * escapes", and keeping every added line under the existing guard is what
 * makes that structural rather than a promise about the validator.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ user: User | null }> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const env = validatePublicSupabaseEnv(url, anonKey);
    if (!env.ok) {
      warnDegradedOnce(url, anonKey, env.errors);
      return { user: null };
    }

    const supabase = createServerClient(env.url, env.anonKey, {
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
