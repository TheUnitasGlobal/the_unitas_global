import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getOrFetchLibraryEntry, listRecentLibraryEntries } from '@/lib/lifeOs/lifeLibrary';
import {
  SOVEREIGN_SESSION_COOKIE,
  resolveSovereignSigningSecret,
  verifySovereignSession,
} from '@/lib/sovereignAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCALES = new Set<string>(routing.locales);
const MAX_QUERY_LEN = 200;

/**
 * Life Library lookup + recent-archive list. This route path does NOT start
 * with `/sovereign`, so it needs its own founder check (same as
 * app/api/life/review/run/route.ts) rather than relying on the page-level
 * edge fence -- otherwise it would be an unauthenticated, cost-free-to-abuse
 * external-fetch proxy.
 */
async function isFounder(): Promise<boolean> {
  const result = await verifySovereignSession(
    cookies().get(SOVEREIGN_SESSION_COOKIE)?.value,
    resolveSovereignSigningSecret(),
  );
  return result.ok;
}

export async function GET(req: Request) {
  if (!(await isFounder())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawLocale = url.searchParams.get('locale') ?? routing.defaultLocale;
  const locale = LOCALES.has(rawLocale) ? rawLocale : routing.defaultLocale;
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LEN);

  const supabase = getSupabaseServerClient();

  if (!query) {
    const recent = await listRecentLibraryEntries(supabase, locale);
    return NextResponse.json({ ok: true, mode: 'recent', entries: recent });
  }

  const result = await getOrFetchLibraryEntry(supabase, query, locale);
  if (!result) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, mode: 'lookup', ...result });
}
