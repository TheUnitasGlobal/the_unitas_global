import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only by convention: import this from Route Handlers / Server
// Actions alone. (The `server-only` package would enforce this at build
// time, but it isn't part of this scaffold's dependency list.)

/**
 * Server-side Supabase client for Route Handlers / Server Actions. Uses the
 * service role key when present (privileged, bypasses RLS -- required for
 * things like the spend_coins/credit_coins RPCs called from trusted server
 * code) and falls back to the anon key otherwise.
 *
 * This is intentionally the plain @supabase/supabase-js client rather than
 * @supabase/ssr's cookie-synced server client: that package isn't part of
 * this scaffold's dependency list. Add it if/when this app needs
 * cookie-based session reads in Server Components (e.g. to know who's
 * signed in during SSR) rather than only privileged server-side calls.
 */
export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set (see .env.example).',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js patches the global fetch with its Data Cache, which memoizes
    // GET responses by URL -- and every PostgREST select is a GET whose URL
    // repeats verbatim across requests. Left alone, a route handler can be
    // served a minutes-old (or hours-old) row set as if it were live; the
    // shortcut-cache batch was re-synthesizing every tier on every run
    // because its scan kept seeing the first deploy's near-empty table.
    // Privileged DB reads must always hit Postgres.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
