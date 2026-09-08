'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Attaches the signed-in visitor's Supabase access token (if any) as a
 * Bearer header, same pattern as lib/uai/useUai.ts. Second Brain's routes
 * require it (per-user data ownership); Review Agent / Life Library ignore
 * it and rely on the founder's sovereign session cookie instead (sent
 * automatically, same-origin) -- sending it unconditionally here is
 * harmless and keeps one fetch helper for all 5 Life-OS engines.
 */
export async function lifeOsFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
