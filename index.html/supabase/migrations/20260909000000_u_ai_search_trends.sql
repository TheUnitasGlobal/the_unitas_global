-- U-AI "Evolved Big-Data Empire": the search_trends threshold counter that
-- turns free searches into a self-propagating, zero-server-cost knowledge
-- asset (owner instruction 2026-08-31).
--
-- Design contract (see web/lib/uai/constitutionRedesign.ts +
-- web/app/api/u-ai/trend/route.ts):
--   * Every FREE Phase-1 surface search POSTs its query to /api/u-ai/trend.
--     The route (service-role client) calls bump_search_trend() — one atomic
--     upsert that increments the per-(locale,query) counter.
--   * The instant a query crosses TREND_THRESHOLD (3) cumulative searches AND
--     has not been redesigned yet, bump_search_trend() claims the redesign
--     slot (sets redesigned_at) in the SAME statement and returns
--     should_redesign = true. The route then fires the 100-doctrine engine
--     ONCE and writes the forged 6-axis "Sovereign Redesign" report to
--     public.genesis_memory (query_hash namespace 'cr-v1::…', disjoint from the
--     paid deep-insight 'v1::…' namespace — the paywall stays intact).
--   * Every later searcher of that query is served the report straight from
--     genesis_memory at engine cost 0원 — margin ∞, the "초영속에코시스템".
--   * release_search_trend() un-claims the slot if generation fails or the
--     daily global cap is hit, so the report forges on a later day instead.
--
-- IDEMPOTENT + self-contained. Applied on its own the same way as
-- 20260908000000 (direct SQL + `supabase migration repair --status applied
-- 20260909000000`), NOT via `supabase db push`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. search_trends — the lightweight frequency counter. Service-role only:
--    RLS force-enabled with NO policy (default-deny for anon/authenticated).
--    The API route is the sole reader/writer, via the service client.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.search_trends (
  query_hash        text primary key,
  query             text not null,
  locale            text not null,
  hits              integer not null default 0,
  redesigned_at     timestamptz,
  created_at        timestamptz not null default now(),
  last_searched_at  timestamptz not null default now()
);

create index if not exists search_trends_recent_idx
  on public.search_trends (last_searched_at desc);

alter table public.search_trends enable row level security;
alter table public.search_trends force row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. bump_search_trend — atomic increment + threshold claim in one statement.
--    Returns the new hit count and whether THIS call is the one that must
--    forge the redesign (crossed the threshold and claimed the slot).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bump_search_trend(
  p_query_hash text,
  p_query      text,
  p_locale     text,
  p_threshold  integer default 3
)
returns table (hits integer, should_redesign boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits       integer;
  v_redesigned timestamptz;
begin
  insert into public.search_trends (query_hash, query, locale, hits, last_searched_at)
  values (p_query_hash, left(coalesce(p_query, ''), 400), coalesce(p_locale, 'en'), 1, now())
  on conflict (query_hash) do update
    set hits = public.search_trends.hits + 1,
        last_searched_at = now()
  returning public.search_trends.hits, public.search_trends.redesigned_at
    into v_hits, v_redesigned;

  if v_hits >= greatest(p_threshold, 1) and v_redesigned is null then
    update public.search_trends
      set redesigned_at = now()
      where query_hash = p_query_hash and redesigned_at is null;
    hits := v_hits;
    should_redesign := found;
  else
    hits := v_hits;
    should_redesign := false;
  end if;
  return next;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. release_search_trend — un-claim the redesign slot (generation failed /
--    daily cap hit) so a later search re-triggers the forge.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.release_search_trend(p_query_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.search_trends set redesigned_at = null where query_hash = p_query_hash;
$$;

revoke execute on function public.bump_search_trend(text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.release_search_trend(text) from public, anon, authenticated;
grant  execute on function public.bump_search_trend(text, text, text, integer) to service_role;
grant  execute on function public.release_search_trend(text) to service_role;
