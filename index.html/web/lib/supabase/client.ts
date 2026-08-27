'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/**
 * Singleton Supabase client for Client Components. Reuses the same Supabase
 * project as the root static site's coin-core wallet system (see
 * ../../../supabase/migrations) -- this app is a new frontend against the
 * same backend, not a separate one.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.example).',
    );
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}
