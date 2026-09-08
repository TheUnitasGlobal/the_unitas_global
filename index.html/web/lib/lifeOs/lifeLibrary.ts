import type { SupabaseClient } from '@supabase/supabase-js';

// Life Library module (founder directive 2026-09-08): multi-source
// knowledge archive with intelligent (TTL) caching, same shape of idea as
// the existing U-AI shortcut cache (lib/uai/shortcutCache.ts) and free web
// synthesis (lib/uai/webSynthesis.ts) -- keyless Wikipedia REST, cached in
// Postgres so the second visitor (or the founder revisiting a topic) pays
// zero external calls. Deliberately reuses that precedent instead of a new
// architecture: one source (Wikipedia summary REST, CORS-open, no key) kept
// intentionally single for this first cut; more sources are additive later.

export const LIFE_LIBRARY_TABLE = 'life_library_entries';
export const LIFE_LIBRARY_TTL_MS = 24 * 60 * 60 * 1000;

export interface LibraryEntry {
  queryKey: string;
  locale: string;
  title: string;
  extract: string;
  thumbnailUrl: string | null;
  sourceUrl: string;
  cachedAt: string;
}

export interface LibraryLookupResult {
  entry: LibraryEntry;
  source: 'cache' | 'fresh';
}

export function normalizeQueryKey(query: string): string {
  return query.trim().toLowerCase().slice(0, 200);
}

interface WikipediaSummary {
  title: string;
  extract: string;
  thumbnailUrl: string | null;
  sourceUrl: string;
}

async function fetchWikipediaSummary(query: string, locale: string): Promise<WikipediaSummary | null> {
  const tryLocale = async (loc: string): Promise<WikipediaSummary | null> => {
    const url = `https://${loc}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      title?: string;
      extract?: string;
      thumbnail?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    if (!json.extract) return null;
    return {
      title: json.title ?? query,
      extract: json.extract,
      thumbnailUrl: json.thumbnail?.source ?? null,
      sourceUrl: json.content_urls?.desktop?.page ?? url,
    };
  };

  try {
    const inLocale = await tryLocale(locale);
    if (inLocale) return inLocale;
    if (locale !== 'en') return await tryLocale('en');
    return null;
  } catch {
    return null;
  }
}

function rowToEntry(row: {
  query_key: string;
  locale: string;
  title: string;
  extract: string;
  thumbnail_url: string | null;
  source_url: string;
  cached_at: string;
}): LibraryEntry {
  return {
    queryKey: row.query_key,
    locale: row.locale,
    title: row.title,
    extract: row.extract,
    thumbnailUrl: row.thumbnail_url,
    sourceUrl: row.source_url,
    cachedAt: row.cached_at,
  };
}

/**
 * Cache-first lookup: a live (< 24h) row is served straight from Postgres.
 * A stale/missing row triggers exactly one Wikipedia fetch, which parks the
 * result for every future visitor of that (query, locale) pair. Fails open
 * to a stale cached row (better than nothing) if the live fetch errors, and
 * to `null` only when there is truly nothing to show.
 */
export async function getOrFetchLibraryEntry(
  supabase: SupabaseClient,
  query: string,
  locale: string,
): Promise<LibraryLookupResult | null> {
  const queryKey = normalizeQueryKey(query);
  if (!queryKey) return null;

  const { data: cached } = await supabase
    .from(LIFE_LIBRARY_TABLE)
    .select('*')
    .eq('query_key', queryKey)
    .eq('locale', locale)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.cached_at).getTime() < LIFE_LIBRARY_TTL_MS) {
    return { entry: rowToEntry(cached), source: 'cache' };
  }

  const fresh = await fetchWikipediaSummary(query, locale);
  if (!fresh) {
    return cached ? { entry: rowToEntry(cached), source: 'cache' } : null;
  }

  const cachedAt = new Date().toISOString();
  const row = {
    query_key: queryKey,
    locale,
    title: fresh.title,
    extract: fresh.extract,
    thumbnail_url: fresh.thumbnailUrl,
    source_url: fresh.sourceUrl,
    cached_at: cachedAt,
  };

  await supabase.from(LIFE_LIBRARY_TABLE).upsert(row, { onConflict: 'query_key,locale' });

  return { entry: rowToEntry(row), source: 'fresh' };
}

/** Recently archived entries, most-recent first -- for the "저장된 아카이브" list. */
export async function listRecentLibraryEntries(
  supabase: SupabaseClient,
  locale: string,
  limit = 20,
): Promise<LibraryEntry[]> {
  const { data } = await supabase
    .from(LIFE_LIBRARY_TABLE)
    .select('*')
    .eq('locale', locale)
    .order('cached_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map(rowToEntry);
}
