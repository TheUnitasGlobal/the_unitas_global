import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { generateInsight, insightProviderAvailable } from '@/lib/uai/provider';
import { DAILY_REDESIGN_CAP } from '@/lib/uai/constitutionRedesign';
import {
  MAX_HYPER_SEED,
  buildHyperSkeleton,
  hyperEngine,
  isHyperEngineKey,
  isValidHyperVariant,
  normalizeHyperSeed,
} from '@/lib/hyperSovereign';
import {
  HYPER_REPORT_MAX_TOKENS,
  buildHyperPrompt,
  hyperReportHash,
  parseHyperReportResponse,
  type HyperReport,
  type HyperReportApiResponse,
} from '@/lib/uai/hyperShortcut';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const LOCALES = new Set<string>(routing.locales);

/** A narrated (locale, engine, seed, variant) is permanent -- edge-cache it
 *  a day so repeat opens rarely even reach this route. */
const CDN_CACHE = 'public, s-maxage=86400, stale-while-revalidate=604800';
const NO_STORE = 'no-store';

type Admin = ReturnType<typeof getSupabaseServerClient>;

function respond(body: HyperReportApiResponse, cacheControl: string, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': cacheControl } });
}

/**
 * GET /api/u-ai/hyper-shortcut?engine=ideaReplicator&seed=coffee&variant=root:0&locale=ko
 *
 * FREE U-AI oracle narration for one Hyper-Sovereign engine result (see
 * lib/uai/hyperShortcut.ts). The server re-derives the deterministic
 * skeleton from the same seed/variant the client rendered, narrates it once
 * via the LLM provider, parks the report in genesis_memory (`hs-v1::`
 * namespace) and serves every later visitor of that exact combination from
 * Postgres at 0원. Guarded by the global DAILY_REDESIGN_CAP fresh-forge
 * backstop shared with the 6-axis redesigns, since the seed is free text.
 * Fail-open: no provider / no Supabase / cap reached / generation error all
 * resolve to `{ ok: false, report: null }` -- the client keeps showing its
 * deterministic result untouched.
 */
export async function GET(req: Request): Promise<NextResponse<HyperReportApiResponse>> {
  const url = new URL(req.url);
  const rawLocale = url.searchParams.get('locale') ?? '';
  const locale = LOCALES.has(rawLocale) ? rawLocale : routing.defaultLocale;
  const engineParam = url.searchParams.get('engine') ?? '';
  const seedRaw = url.searchParams.get('seed') ?? '';
  const variant = url.searchParams.get('variant') ?? '';

  if (!isHyperEngineKey(engineParam) || !hyperEngine(engineParam).narrated || !isValidHyperVariant(variant)) {
    return respond({ ok: false, report: null }, NO_STORE, 400);
  }
  const engine = engineParam;
  const seed = normalizeHyperSeed(seedRaw);
  if (!seed || seed.length > MAX_HYPER_SEED) {
    return respond({ ok: false, report: null }, NO_STORE, 400);
  }
  const skeleton = buildHyperSkeleton(engine, seed, variant);
  if (!skeleton) {
    return respond({ ok: false, report: null }, NO_STORE, 400);
  }

  const hash = hyperReportHash(locale, engine, seed, variant);

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
          ...(data.payload as HyperReport),
          model: (data.model as string) || 'genesis-memory',
          cached: true,
        };
        return respond({ ok: true, report }, CDN_CACHE);
      }
    } catch {
      // genesis_memory unavailable / transient error -> fall through to a fresh forge.
    }
  }

  if (!insightProviderAvailable()) {
    return respond({ ok: false, report: null }, NO_STORE, 503);
  }

  // Daily global cost backstop -- the seed is free text, so unlike the
  // bounded ranking-detail popup this route must not be able to forge
  // without limit.
  if (admin) {
    try {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count } = await admin
        .from('genesis_memory')
        .select('query_hash', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString());
      if ((count ?? 0) >= DAILY_REDESIGN_CAP) {
        return respond({ ok: false, report: null }, NO_STORE, 429);
      }
    } catch {
      // cap check failed -> proceed (a single forge is cheap).
    }
  }

  try {
    const { system, user } = buildHyperPrompt(engine, seed, skeleton, locale);
    const { text, model } = await generateInsight(system, user, HYPER_REPORT_MAX_TOKENS);
    const report = parseHyperReportResponse(text, model, engine, seed, variant);
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
