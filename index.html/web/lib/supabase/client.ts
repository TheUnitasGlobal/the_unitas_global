'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validatePublicSupabaseEnv } from '@/lib/security/credentialShape';

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
 *
 * THROWING IS THE CONTRACT, and it is load-bearing. Every consumer that can
 * survive without Supabase already wraps this call in try/catch and degrades
 * (WalletProvider sets `configured: false`; lib/hub/hubChannel.ts returns
 * null; lib/hub/hubLedger.ts reports `offline`). So the only question this
 * function answers is "is the public env USABLE", and the old
 * `if (!url || !anonKey)` answered it wrong: a placeholder is a non-empty
 * string. `vercel env pull` writes the literal `[SENSITIVE]` for Secret-typed
 * variables, and `.env.example` ships `<paste-the-...>` -- both sailed through
 * the truthiness check, built a live client, and turned every call into a
 * 401 that the UI reported as "configured but failing" instead of
 * "not configured". `validatePublicSupabaseEnv` (lib/security/credentialShape)
 * rejects placeholders, non-JWT keys, and a key whose `role` claim is not
 * `anon` -- a service_role key pasted into a NEXT_PUBLIC_ var is a secret
 * leak, not a working config.
 *
 * That validator is the ISOMORPHIC module, never `web/scripts/credential-core.mjs`:
 * this file is `'use client'`, and the .mjs decodes JWT claims through
 * `Buffer.from(seg, 'base64url')`, which the `buffer@6.0.3` polyfill Next
 * bundles for the browser does not implement -- it would throw on CORRECT
 * keys. See the docblock in credentialShape.ts.
 *
 * A failed validation must not poison the singleton: `browserClient` is
 * assigned only after a client is actually built, so a rejected env leaves it
 * null and the next call re-evaluates rather than handing back a half-built
 * client.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const env = validatePublicSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!env.ok) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not usable (see .env.example): ${env.errors.join(' | ')}`,
    );
  }

  browserClient = createBrowserClient(env.url, env.anonKey);
  return browserClient;
}
