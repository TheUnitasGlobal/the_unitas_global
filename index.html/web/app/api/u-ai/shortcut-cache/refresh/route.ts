import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  DAILY_REDESIGN_CAP,
  REDESIGN_MAX_TOKENS,
  TREND_THRESHOLD,
  buildRedesignPrompt,
  parseRedesignResponse,
  redesignHash,
} from '@/lib/uai/constitutionRedesign';
import { generateInsight, insightProviderAvailable } from '@/lib/uai/provider';
import {
  SHORTCUT_CACHE_TABLE,
  buildSnapshot,
  loadMessages,
  mapLimit,
  seedQueries,
  shortcutCacheKey,
  upsertSnapshot,
} from '@/lib/uai/shortcutCache';
import { SHORTCUT_CACHE_TTL_MS, SHORTCUT_CACHE_VERSION, type ShortcutTier } from '@/lib/uai/shortcutCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Safe on every Vercel plan; the budget below keeps us under it. */
export const maxDuration = 60;

/** Wall-clock budget for one batch run (ms). */
const BUDGET_MS = Number(process.env.SHORTCUT_CRON_BUDGET_MS) || 50_000;
/** Of which this much is held back for the LLM forge phase. */
const FORGE_RESERVE_MS = 24_000;
/** Max deep reports forged per run (well under DAILY_REDESIGN_CAP). */
const FORGE_BUDGET = Number(process.env.SHORTCUT_CRON_FORGE_BUDGET) || 16;
const SYNTH_CONCURRENCY = 6;
const FORGE_CONCURRENCY = 6;
/**
 * generateInsight has no abort hook, so an LLM call started late in the run
 * could push us past maxDuration (seen live: FUNCTION_INVOCATION_TIMEOUT at
 * the 60 s wall). Two guards keep the response inside the wall: no forge
 * starts unless a whole call still fits, and an in-flight call is abandoned
 * at the hard stop (the orphaned fetch dies with the frozen function).
 */
const FORGE_CALL_MAX_MS = 25_000;
const FORGE_HARD_STOP_MS = 55_000;
/** Stale ladder tiers re-synthesized per run, most-opened first. */
const LADDER_SCAN_LIMIT = 200;
/** A tier due within this window of the run is refreshed now rather than
 *  waiting a full extra day. */
const STALE_SLACK_MS = 60 * 60 * 1000;
/** Locales whose seed tiers are synthesized first when the budget is tight. */
const PRIORITY_LOCALES = ['en', 'ko'];

interface WorkItem {
  cacheKey: string;
  locale: string;
  query: string;
  tier: ShortcutTier;
  hits: number;
  reason: 'missing' | 'stale' | 'version';
}

interface ForgeCandidate {
  locale: string;
  query: string;
  hits: number;
  digest: string;
}

interface RefreshReport {
  ok: boolean;
  synthesized: number;
  forged: number;
  remaining: number;
  forgeRemaining: number;
  elapsedMs: number;
  /** What the work-list scan saw -- the cron log's proof that parked tiers
   *  are recognised (a run that re-synthesizes everything shows up here as
   *  `seedRows: 0` / all `missing`). */
  scan: {
    seedRows: number;
    missing: number;
    version: number;
    stale: number;
    ladder: number;
    sample: { version: string | null; synthesizedAt: string | null } | null;
  };
  errors: string[];
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) return false;
  // Header only -- a `?key=` fallback would leak the secret into edge /
  // function logs on every manual warm-up.
  const header = req.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!bearer || bearer.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(bearer), Buffer.from(secret));
}

/** Rejects with `forge deadline` if `promise` is still pending after `ms`. */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('forge deadline')), Math.max(0, ms));
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * The nightly batch of the 24h sovereign caching engine (Vercel cron ->
 * web/vercel.json). Auth: `Authorization: Bearer $CRON_SECRET` (what Vercel
 * sends; a manual warm-up uses the same header). Fail-closed when the
 * secret is unset: this route can spend an LLM budget, so it refuses to run
 * unauthenticated rather than run open.
 *
 * Phase 1 (synthesis, 0원): every seed tier of the matrix in all 20 locales
 *   that is missing / stale / on an old snapshot version, then the stale
 *   visitor-nested ladder tiers most-opened first -- keyless live-web pass +
 *   deterministic 100-doctrine analysis, parked in shortcut_cache.
 * Phase 2 (deep forge, Micro-Burn once, served forever): the LLM 6-axis
 *   Sovereign Redesign for seeds and hot ladder tiers (hit_count >= 3)
 *   that have no Genesis-Memory report yet -- bounded per run and by the
 *   global DAILY_REDESIGN_CAP.
 *
 * Everything is budgeted by wall clock so one run always finishes inside
 * maxDuration; whatever did not fit is simply picked up by the next run.
 */
export async function GET(req: Request): Promise<NextResponse<RefreshReport>> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  const report: RefreshReport = {
    ok: false,
    synthesized: 0,
    forged: 0,
    remaining: 0,
    forgeRemaining: 0,
    elapsedMs: 0,
    scan: { seedRows: 0, missing: 0, version: 0, stale: 0, ladder: 0, sample: null },
    errors: [],
  };

  if (!authorized(req)) {
    const status = process.env.CRON_SECRET ? 401 : 503;
    report.errors.push(status === 503 ? 'CRON_SECRET is not configured' : 'unauthorized');
    report.elapsedMs = elapsed();
    return NextResponse.json(report, { status });
  }

  let admin: ReturnType<typeof getSupabaseServerClient>;
  try {
    admin = getSupabaseServerClient();
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : 'supabase unavailable');
    report.elapsedMs = elapsed();
    return NextResponse.json(report, { status: 503 });
  }

  const messagesByLocale = new Map<string, Awaited<ReturnType<typeof loadMessages>>>();
  await Promise.all(
    routing.locales.map(async (locale) => {
      messagesByLocale.set(locale, await loadMessages(locale));
    }),
  );

  // ---- Phase 1: work list ----------------------------------------------------
  const now = Date.now();
  const staleBefore = new Date(now - SHORTCUT_CACHE_TTL_MS + STALE_SLACK_MS).toISOString();
  const work: WorkItem[] = [];
  const seedRows = new Map<string, { hits: number; synthesized_at: string; version: string | null }>();

  try {
    // `payload->>version` comes back keyed `version` (PostgREST names a JSON
    // path field after its last element).
    const { data, error } = await admin
      .from(SHORTCUT_CACHE_TABLE)
      .select('cache_key, hit_count, synthesized_at, payload->>version')
      .eq('tier', 'seed')
      .limit(2000);
    if (error) throw error;
    (data ?? []).forEach((r) => {
      const row = r as { cache_key: string; hit_count: number; synthesized_at: string; version?: string | null };
      seedRows.set(row.cache_key, {
        hits: row.hit_count,
        synthesized_at: row.synthesized_at,
        version: row.version ?? null,
      });
    });
    report.scan.seedRows = seedRows.size;
    const first = seedRows.values().next().value;
    report.scan.sample = first ? { version: first.version, synthesizedAt: first.synthesized_at } : null;
  } catch (err) {
    report.errors.push(`seed scan: ${err instanceof Error ? err.message : String(err)}`);
  }

  const orderedLocales = [
    ...PRIORITY_LOCALES.filter((l) => (routing.locales as readonly string[]).includes(l)),
    ...routing.locales.filter((l) => !PRIORITY_LOCALES.includes(l)),
  ];
  const seedItems: WorkItem[] = [];
  orderedLocales.forEach((locale) => {
    const messages = messagesByLocale.get(locale);
    if (!messages) return;
    seedQueries(messages).forEach((seed) => {
      const cacheKey = shortcutCacheKey(locale, seed.query);
      const row = seedRows.get(cacheKey);
      const base = { cacheKey, locale, query: seed.query, tier: 'seed' as const, hits: row?.hits ?? 0 };
      if (!row) seedItems.push({ ...base, reason: 'missing' });
      else if (row.version !== SHORTCUT_CACHE_VERSION) seedItems.push({ ...base, reason: 'version' });
      else if (row.synthesized_at < staleBefore) seedItems.push({ ...base, reason: 'stale' });
    });
  });
  // Missing seeds strictly first (a tile nobody has ever cached is the
  // worst visitor experience), then version bumps, then stale re-synthesis.
  const reasonRank: Record<WorkItem['reason'], number> = { missing: 0, version: 1, stale: 2 };
  seedItems.sort((a, b) => reasonRank[a.reason] - reasonRank[b.reason]);
  seedItems.forEach((item) => {
    report.scan[item.reason] += 1;
  });
  work.push(...seedItems);

  try {
    const { data, error } = await admin
      .from(SHORTCUT_CACHE_TABLE)
      .select('cache_key, locale, query, hit_count, synthesized_at, payload->>version')
      .eq('tier', 'ladder')
      .or(`synthesized_at.lt.${staleBefore},payload->>version.neq.${SHORTCUT_CACHE_VERSION}`)
      .order('hit_count', { ascending: false })
      .limit(LADDER_SCAN_LIMIT);
    if (error) throw error;
    report.scan.ladder = data?.length ?? 0;
    (data ?? []).forEach((r) => {
      const row = r as { cache_key: string; locale: string; query: string; hit_count: number; version?: string | null };
      work.push({
        cacheKey: row.cache_key,
        locale: row.locale,
        query: row.query,
        tier: 'ladder',
        hits: row.hit_count,
        reason: row.version !== SHORTCUT_CACHE_VERSION ? 'version' : 'stale',
      });
    });
  } catch (err) {
    report.errors.push(`ladder scan: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ---- Phase 1: synthesize within budget --------------------------------------
  const forgeable = insightProviderAvailable();
  const synthDeadline = forgeable ? BUDGET_MS - FORGE_RESERVE_MS : BUDGET_MS;
  const freshDigests = new Map<string, string>();
  let done = 0;
  await mapLimit(
    work,
    SYNTH_CONCURRENCY,
    async (item) => {
      const messages = messagesByLocale.get(item.locale);
      if (!messages) return;
      try {
        const snapshot = await buildSnapshot(item.query, item.locale, item.tier, messages);
        if (await upsertSnapshot(admin, snapshot, item.cacheKey)) {
          report.synthesized += 1;
          freshDigests.set(item.cacheKey, snapshot.web.digest);
        } else {
          report.errors.push(`park failed: ${item.locale}/${item.query}`);
        }
      } catch (err) {
        report.errors.push(`synth ${item.locale}/${item.query}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        done += 1;
      }
    },
    () => elapsed() > synthDeadline,
  );
  report.remaining = Math.max(0, work.length - done);

  // ---- Phase 2: forge deep reports for hot tiers --------------------------------
  if (forgeable && elapsed() < BUDGET_MS - 8_000) {
    try {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count } = await admin
        .from('genesis_memory')
        .select('query_hash', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString());
      const capLeft = Math.max(0, DAILY_REDESIGN_CAP - (count ?? 0));
      const budget = Math.min(FORGE_BUDGET, capLeft);

      if (budget > 0) {
        const { data, error } = await admin
          .from(SHORTCUT_CACHE_TABLE)
          .select('cache_key, locale, query, tier, hit_count, payload->web->>digest')
          .or(`tier.eq.seed,hit_count.gte.${TREND_THRESHOLD}`)
          .order('hit_count', { ascending: false })
          .limit(400);
        if (error) throw error;
        const rows = (data ?? []) as Array<{
          cache_key: string;
          locale: string;
          query: string;
          tier: ShortcutTier;
          hit_count: number;
          digest?: string | null;
        }>;

        // Drop the ones Genesis Memory already holds (chunked `in` lookups).
        const hashes = rows.map((r) => redesignHash(r.locale, r.query));
        const existing = new Set<string>();
        for (let i = 0; i < hashes.length; i += 100) {
          const chunk = hashes.slice(i, i + 100);
          const { data: found } = await admin.from('genesis_memory').select('query_hash').in('query_hash', chunk);
          (found ?? []).forEach((f) => existing.add((f as { query_hash: string }).query_hash));
        }
        const candidates: ForgeCandidate[] = rows
          .filter((r, i) => !existing.has(hashes[i]))
          .map((r) => ({
            locale: r.locale,
            query: r.query,
            hits: r.hit_count,
            digest: freshDigests.get(r.cache_key) ?? r.digest ?? '',
          }));
        report.forgeRemaining = Math.max(0, candidates.length - budget);

        await mapLimit(
          candidates.slice(0, budget),
          FORGE_CONCURRENCY,
          async (c) => {
            try {
              const { system, user } = buildRedesignPrompt(c.query, c.locale, c.digest);
              const { text, model } = await withDeadline(
                generateInsight(system, user, REDESIGN_MAX_TOKENS),
                FORGE_HARD_STOP_MS - elapsed(),
              );
              const deep = parseRedesignResponse(text, model, c.query, Math.max(c.hits, TREND_THRESHOLD));
              const { error: upsertError } = await admin
                .from('genesis_memory')
                .upsert({ query_hash: redesignHash(c.locale, c.query), locale: c.locale, payload: deep, model });
              if (upsertError) throw upsertError;
              report.forged += 1;
            } catch (err) {
              report.errors.push(`forge ${c.locale}/${c.query}: ${err instanceof Error ? err.message : String(err)}`);
            }
          },
          () => elapsed() > FORGE_HARD_STOP_MS - FORGE_CALL_MAX_MS,
        );
        report.forgeRemaining = Math.max(0, candidates.length - report.forged);
      }
    } catch (err) {
      report.errors.push(`forge phase: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  report.ok = true;
  report.elapsedMs = elapsed();
  // Keep the error list readable in the cron log.
  report.errors = report.errors.slice(0, 40);
  return NextResponse.json(report, { headers: { 'cache-control': 'no-store' } });
}
