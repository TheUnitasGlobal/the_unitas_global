import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ENTRY_DETAIL_MAX_RANK, GLOBAL_RANKING_THEMES, type GlobalRankingThemeKey } from '@/lib/globalRankings';
import { loadMessages } from '@/lib/uai/shortcutCache';
import { generateInsight, insightProviderAvailable } from '@/lib/uai/provider';
import {
  RANKING_DETAIL_MAX_TOKENS,
  buildRankingDetailPrompt,
  parseRankingDetailResponse,
  rankingDetailHash,
  type RankingDetailApiResponse,
  type RankingDetailReport,
} from '@/lib/uai/rankingDetail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const LOCALES = new Set<string>(routing.locales);
const THEME_KEYS = new Set<string>(GLOBAL_RANKING_THEMES.map((t) => t.key));

/** Content for a given (locale, theme, rank) triple is effectively
 *  permanent -- a day-long edge cache means a repeat open from anywhere
 *  rarely even reaches this route, let alone Postgres. */
const CDN_CACHE = 'public, s-maxage=86400, stale-while-revalidate=604800';
const NO_STORE = 'no-store';

type Admin = ReturnType<typeof getSupabaseServerClient>;

function respond(body: RankingDetailApiResponse, cacheControl: string, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': cacheControl } });
}

/**
 * GET /api/u-ai/ranking-detail?theme=heritage&rank=1&locale=ko
 *
 * FREE, cached, locale-aware encyclopedic write-up for one ranking entry's
 * detail popup -- see lib/uai/rankingDetail.ts for the full design note.
 * Genesis Memory cache hit -> engine cost 0원, CDN-cached a full day. A miss
 * synthesizes once via the U-AI LLM provider and parks it in genesis_memory
 * for every later visitor of that (locale, theme, rank) triple. Fail-open
 * throughout: no provider / no Supabase / generation error all resolve to
 * `{ ok: false, report: null }` rather than an error the popup has to
 * surface -- the client keeps showing its static curated one-liner.
 */
export async function GET(req: Request): Promise<NextResponse<RankingDetailApiResponse>> {
  const url = new URL(req.url);
  const rawLocale = url.searchParams.get('locale') ?? '';
  const locale = LOCALES.has(rawLocale) ? rawLocale : routing.defaultLocale;
  const themeParam = url.searchParams.get('theme') ?? '';
  const rank = Number(url.searchParams.get('rank'));

  if (
    !THEME_KEYS.has(themeParam) ||
    !Number.isInteger(rank) ||
    rank < 1 ||
    rank > ENTRY_DETAIL_MAX_RANK
  ) {
    return respond({ ok: false, report: null }, NO_STORE, 400);
  }
  const theme = themeParam as GlobalRankingThemeKey;
  const themeData = GLOBAL_RANKING_THEMES.find((t) => t.key === theme);
  const entry = themeData?.entries.find((e) => e.rank === rank);
  if (!themeData || !entry) {
    return respond({ ok: false, report: null }, NO_STORE, 404);
  }

  const hash = rankingDetailHash(locale, theme, rank);

  let admin: Admin | null = null;
  try {
    admin = getSupabaseServerClient();
  } catch {
    admin = null;
  }

  if (admin) {
    try {
      const { data } = await admin
        .from('genesis_memory')
        .select('payload, model, hit_count')
        .eq('query_hash', hash)
        .maybeSingle();
      if (data?.payload) {
        void admin
          .from('genesis_memory')
          .update({
            hit_count: ((data as { hit_count?: number }).hit_count ?? 0) + 1,
            last_hit_at: new Date().toISOString(),
          })
          .eq('query_hash', hash)
          .then(
            () => undefined,
            () => undefined,
          );
        const report = {
          ...(data.payload as RankingDetailReport),
          model: (data.model as string) || 'genesis-memory',
          cached: true,
        };
        return respond({ ok: true, report }, CDN_CACHE);
      }
    } catch {
      // genesis_memory not applied yet / transient error -> fall through to a fresh forge.
    }
  }

  if (!insightProviderAvailable()) {
    return respond({ ok: false, report: null }, NO_STORE, 503);
  }

  try {
    const messages = await loadMessages(locale);
    const themeTitle =
      ((messages as { GlobalRankings?: { themes?: Record<string, { title?: string }> } })?.GlobalRankings?.themes?.[
        theme
      ]?.title) ?? theme;
    const { system, user } = buildRankingDetailPrompt(entry, theme, themeTitle, locale);
    const { text, model } = await generateInsight(system, user, RANKING_DETAIL_MAX_TOKENS);
    const report = parseRankingDetailResponse(text, model, entry, theme);
    if (admin) {
      void admin
        .from('genesis_memory')
        .upsert({ query_hash: hash, locale, payload: report, model })
        .then(
          () => undefined,
          () => undefined,
        );
    }
    return respond({ ok: true, report }, NO_STORE);
  } catch {
    return respond({ ok: false, report: null }, NO_STORE, 502);
  }
}
