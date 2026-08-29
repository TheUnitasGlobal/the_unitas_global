import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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
 * Returns null (rather than throwing) when Supabase env vars are absent, so
 * callers degrade to "treat as signed out / fail-closed" the same way the
 * client components already treat `configured: false`.
 */
export function getSupabaseServerComponentClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
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
  });
}
