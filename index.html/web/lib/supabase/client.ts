'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/**
 * Singleton Supabase client for Client Components. Reuses the same Supabase
 * project as the root static site's coin-core wallet system (see
 * ../../../supabase/migrations) -- this app is a new frontend against the
 * same backend, not a separate one.
 *
 * Uses @supabase/ssr's createBrowserClient (not @supabase/supabase-js's
 * createClient) so the auth session is persisted to COOKIES rather than
 * localStorage. That is what lets the server (middleware.ts, the
 * app/[locale]/(gated)/ layout, any future Server Component / Route Handler)
 * see who is signed in -- required for the page-level coin gate. The
 * `auth` / `.rpc` / `.from` surface is unchanged, so WalletProvider and the
 * entry modals need no changes.
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

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
