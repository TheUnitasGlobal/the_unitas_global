import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { describeCredential, validatePublicSupabaseEnv } from '@/lib/security/credentialShape';

/**
 * Silence was half the 2026-09-17 bug: a developer holding a placeholder got a
 * silently signed-out app with no clue why. One line, once per process --
 * this path is reached on every gated render, so it must never become a
 * per-request log. Never carries a credential value (see describeCredential).
 */
let degradeWarned = false;

function warnDegradedOnce(url: unknown, anonKey: unknown, errors: string[]): void {
  if (degradeWarned) return;
  degradeWarned = true;
  try {
    console.warn(
      `[Sovereign Shield] Server Component Supabase client degraded to signed-out :: ${errors.join(' | ')} · url=${describeCredential(url)} anon=${describeCredential(anonKey)}`,
    );
  } catch {
    // A diagnostic may never be the reason a render fails.
  }
}

/**
 * Cookie-synced Supabase client for Server Components (and the
 * app/[locale]/(gated)/ layout in particular). Reads the auth session from
 * the request cookies that the browser client (lib/supabase/client.ts, now
 * on @supabase/ssr) writes.
 *
 * `setAll` is a best-effort no-op here: a Server Component cannot mutate
 * response cookies, so token refresh is handled by middleware.ts instead
 * (see lib/supabase/middlewareClient.ts). Wrapped in try/catch because
 * cookies().set() throws when called from a render pass.
 *
 * Returns null (rather than throwing) when the public Supabase credentials do
 * not pass shape validation, so callers degrade to "treat as signed out /
 * fail-closed" the same way the client components already treat
 * `configured: false`. THIS CONTRACT MUST NOT BECOME A THROW: the (gated)
 * layout calls this during render, so a throw would turn a global sign-out
 * into a global 500.
 *
 * The check is `validatePublicSupabaseEnv`, not `!url || !anonKey`, because a
 * placeholder (`[SENSITIVE]`, `<paste-...>`) is a NON-EMPTY string: the old
 * truthiness test built a live client that 401s on every call, so the gate
 * read "locked" instead of "signed out" and nothing said why (2026-09-17).
 * A placeholder now degrades down exactly the same path as an absent value.
 */
export function getSupabaseServerComponentClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const env = validatePublicSupabaseEnv(url, anonKey);
  if (!env.ok) {
    warnDegradedOnce(url, anonKey, env.errors);
    return null;
  }

  const cookieStore = cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render -- middleware.ts refreshes
          // the session cookie instead. Safe to ignore.
        }
      },
    },
    // Same guard as lib/supabase/server.ts: keep Next's Data Cache off
    // PostgREST reads, so a grant check never sees a stale row set.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
