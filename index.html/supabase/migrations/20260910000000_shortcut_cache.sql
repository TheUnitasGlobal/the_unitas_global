-- U-AI 24h SOVEREIGN CACHING ENGINE: the shortcut_cache store that parks one
-- synthesized snapshot per (locale, query) tier of the multi-dimensional
-- shortcut matrix + infinite knowledge ladder (owner directive 2026-09-02,
-- "24-hour intelligent caching / zero-capital cost-zero automation").
--
-- Design contract (see web/lib/uai/shortcutCache.ts +
-- web/app/api/u-ai/shortcut-cache/route.ts + .../refresh/route.ts):
--   * A Vercel cron (web/vercel.json, once per UTC day) calls the refresh
--     route with CRON_SECRET. It synthesizes every seed tier (16 governance +
--     hot issue + finance + real estate + dating + career, x 20 locales) and
--     every visitor-nested ladder tier whose snapshot is older than 24h, and
--     upserts the result here. It also forges the LLM 6-axis deep analysis
--     for hot tiers into public.genesis_memory (cr-v1 namespace, same as the
--     search-bar threshold channel) so the popup serves it at 0 KRW.
--   * GET /api/u-ai/shortcut-cache serves the parked snapshot (plus the deep
--     report) with a 1h CDN s-maxage: a visitor never triggers a synthesis,
--     never an external API call, never an LLM call. Only a miss (a brand-new
--     nested keyword) or a manual refresh older than 10 min synthesizes
--     inline -- once -- and parks the result for everyone after.
--   * tier = 'seed' for matrix tiles (always re-synthesized nightly),
--     'ladder' for visitor-nested keywords (re-synthesized nightly by
--     popularity within the batch budget, served stale-but-valid otherwise).
--
-- IDEMPOTENT + self-contained. Applied on its own the same way as
-- 20260908000000 / 20260909000000 (direct SQL + `supabase migration repair
-- --status applied 20260910000000`), NOT via `supabase db push`.

create table if not exists public.shortcut_cache (
  cache_key       text primary key,
  locale          text not null,
  query           text not null,
  tier            text not null default 'ladder' check (tier in ('seed', 'ladder')),
  payload         jsonb not null,
  hit_count       integer not null default 0,
  synthesized_at  timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  last_hit_at     timestamptz not null default now()
);

comment on table public.shortcut_cache is
  'U-AI 24h sovereign cache: one synthesized snapshot per (locale, query) shortcut tier. Service-role only.';

-- The nightly batch scans "stale first, most-opened first".
create index if not exists shortcut_cache_tier_synth_idx
  on public.shortcut_cache (tier, synthesized_at);
create index if not exists shortcut_cache_hits_idx
  on public.shortcut_cache (hit_count desc);

-- Service-role only: RLS force-enabled with NO policy (default-deny for
-- anon/authenticated). The API routes are the sole reader/writer.
alter table public.shortcut_cache enable row level security;
alter table public.shortcut_cache force row level security;

revoke all on public.shortcut_cache from anon, authenticated;
