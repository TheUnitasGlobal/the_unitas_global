import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeQuery } from '@/lib/uai/deepInsight';
import {
  DAILY_REDESIGN_CAP,
  REDESIGN_MAX_TOKENS,
  TREND_THRESHOLD,
  buildRedesignPrompt,
  parseRedesignResponse,
  redesignHash,
} from '@/lib/uai/constitutionRedesign';
import { generateInsight, insightProviderAvailable } from '@/lib/uai/provider';
import type { ConstitutionRedesignReport, TrendApiResponse } from '@/lib/uai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCALES = new Set<string>(routing.locales);
const MAX_QUERY_LEN = 400;

/**
 * U-AI FREE threshold-assetization channel.
 *
 *  - No auth, no coin. Every free surface search calls this.
 *  - Genesis Memory hit  -> serve the forged 6-axis "Sovereign Redesign", 0원.
 *  - Below threshold      -> just report the running count.
 *  - Crosses threshold    -> forge the report ONCE (LLM), cache it forever.
 *
 * Fail-open at every layer: a missing table / missing provider / LLM error
 * never surfaces an error to the caller — the free surface search is
 * unaffected, the report just isn't ready yet.
 */
export async function POST(req: Request): Promise<NextResponse<TrendApiResponse>> {
  let body: { query?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, hits: 0, report: null }, { status: 400 });
  }

  const query = (typeof body.query === 'string' ? body.query.trim() : '').slice(0, MAX_QUERY_LEN);
  const locale =
    typeof body.locale === 'string' && LOCALES.has(body.locale) ? body.locale : routing.defaultLocale;
  if (query.length < 2) {
    return NextResponse.json({ ok: false, hits: 0, report: null }, { status: 400 });
  }

  let admin;
  try {
    admin = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: true, hits: 0, report: null });
  }

  const hash = redesignHash(locale, query);

  // 1. Genesis Memory hit -> serve free, engine cost 0원.
  try {
    const { data: cached } = await admin
      .from('genesis_memory')
      .select('payload, model, hit_count')
      .eq('query_hash', hash)
      .maybeSingle();
    if (cached?.payload) {
      const payload = cached.payload as ConstitutionRedesignReport;
      void admin
        .from('genesis_memory')
        .update({
          hit_count: ((cached as { hit_count?: number }).hit_count ?? 0) + 1,
          last_hit_at: new Date().toISOString(),
        })
        .eq('query_hash', hash)
        .then(
          () => undefined,
          () => undefined,
        );
      return NextResponse.json({
        ok: true,
        hits: Math.max(payload.hits ?? TREND_THRESHOLD, TREND_THRESHOLD),
        cached: true,
        report: { ...payload, model: (cached.model as string) || payload.model || 'genesis-memory', cached: true },
      });
    }
  } catch {
    // genesis_memory not applied yet -> treat as a miss.
  }

  // 2. Atomic counter bump + threshold claim.
  let hits = 0;
  let shouldRedesign = false;
  try {
    const { data, error } = await admin.rpc('bump_search_trend', {
      p_query_hash: hash,
      p_query: query,
      p_locale: locale,
      p_threshold: TREND_THRESHOLD,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) {
      hits = typeof row.hits === 'number' ? row.hits : 0;
      shouldRedesign = Boolean(row.should_redesign);
    }
  } catch {
    return NextResponse.json({ ok: true, hits: 0, report: null });
  }

  if (!shouldRedesign || !insightProviderAvailable()) {
    return NextResponse.json({ ok: true, hits, report: null, pending: hits >= TREND_THRESHOLD });
  }

  // 3. Daily global cost backstop.
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await admin
      .from('genesis_memory')
      .select('query_hash', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString());
    if ((count ?? 0) >= DAILY_REDESIGN_CAP) {
      await releaseSlot(admin, hash);
      return NextResponse.json({ ok: true, hits, report: null, pending: true });
    }
  } catch {
    // cap check failed -> proceed (a single forge is cheap; the daily count
    // just couldn't be read this once).
  }

  // 4. Forge the 6-axis Sovereign Redesign — exactly once for this query.
  try {
    const { system, user } = buildRedesignPrompt(query, locale);
    const { text, model } = await generateInsight(system, user, REDESIGN_MAX_TOKENS);
    const report = parseRedesignResponse(text, model, query, hits);
    await admin
      .from('genesis_memory')
      .upsert({ query_hash: hash, locale, payload: report, model })
      .then(
        () => undefined,
        () => undefined,
      );
    return NextResponse.json({ ok: true, hits, fresh: true, report });
  } catch {
    await releaseSlot(admin, hash);
    return NextResponse.json({ ok: true, hits, report: null, pending: true });
  }
}

async function releaseSlot(admin: ReturnType<typeof getSupabaseServerClient>, hash: string) {
  try {
    await admin.rpc('release_search_trend', { p_query_hash: hash });
  } catch {
    // best-effort — the slot just stays claimed and forges on a later day.
  }
}
