-- Sovereign Life-OS cognitive hub modules (founder directive 2026-09-08):
-- Second Brain (vectorized document graph), Review Agent (nightly audit
-- log), Life Library (multi-source knowledge cache). Life Dashboard and
-- Brand Kit are read-mostly/pure-logic modules and need no new tables.
--
-- APPLIED 2026-09-08 against the live project (fjznkonbjoierxvopiko) via the
-- Supabase Management API `database/query` endpoint (SUPABASE_ACCESS_TOKEN,
-- whole file wrapped in one begin/commit transaction so a failure -- e.g.
-- pgvector unavailable -- would have rolled back cleanly with zero partial
-- state; pgvector 0.8.2 was confirmed available and installed cleanly).
-- CLI history synced with `supabase migration repair --status applied
-- 20260912000000`, same catch-up pattern as 20260902000000+.
--
-- These 3 tables are deliberately OUTSIDE the coin economy: the Life-OS
-- surface is founder-only tooling gated by the edge-level sovereign session
-- fence (middleware.ts `isSovereignProtectedPath`, any `/sovereign` path
-- segment), not by spend_coins()/module_access_grants. Nothing here touches
-- public.coin_ledger, public.wallets, or their check constraints.

-- 1. Second Brain: vectorized document graph. embedding is nullable and the
--    app code (lib/lifeOs/secondBrain.ts) already degrades to tag-overlap
--    graph edges when it's absent -- if this project's Supabase instance
--    doesn't have pgvector allow-listed, drop the `create extension` line
--    and the `embedding` column below before applying; nothing else in this
--    file depends on it.
create extension if not exists vector;

create table if not exists public.second_brain_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.second_brain_notes is
  'Sovereign Life-OS Second Brain: one row per note. embedding is optional (OPENAI_API_KEY-gated, see lib/lifeOs/embeddings.ts).';

create index if not exists second_brain_notes_user_id_idx
  on public.second_brain_notes (user_id, updated_at desc);

-- Zero-Trust: own-rows-only, same pattern as wallets/coin_ledger.
alter table public.second_brain_notes enable row level security;
alter table public.second_brain_notes force row level security;

drop policy if exists "second_brain_notes_select_own" on public.second_brain_notes;
create policy "second_brain_notes_select_own"
  on public.second_brain_notes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "second_brain_notes_insert_own" on public.second_brain_notes;
create policy "second_brain_notes_insert_own"
  on public.second_brain_notes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "second_brain_notes_update_own" on public.second_brain_notes;
create policy "second_brain_notes_update_own"
  on public.second_brain_notes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "second_brain_notes_delete_own" on public.second_brain_notes;
create policy "second_brain_notes_delete_own"
  on public.second_brain_notes
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 2. Review Agent: nightly audit log, archived by POST /api/life/review/run
--    (Vercel cron, web/vercel.json) and mirrored to ~/life/review/ on the
--    founder's machine by scripts/review-agent-archive.mjs. No per-user
--    ownership -- this is a system-wide operational log, not personal data.
create table if not exists public.review_agent_logs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  status text not null check (status in ('ok', 'warn', 'error')),
  summary text not null,
  findings jsonb not null default '[]'::jsonb,
  triggered_by text not null default 'cron' check (triggered_by in ('cron', 'manual')),
  created_at timestamptz not null default now()
);

comment on table public.review_agent_logs is
  'Sovereign Life-OS Review Agent: one row per nightly (or manually triggered) audit run. Service-role only.';

create index if not exists review_agent_logs_run_at_idx
  on public.review_agent_logs (run_at desc);

-- Service-role only: RLS force-enabled with NO policy (default-deny for
-- anon/authenticated), same convention as public.shortcut_cache. The API
-- route is the sole reader/writer, and it is itself gated by CRON_SECRET or
-- a verified sovereign session -- see app/api/life/review/run/route.ts.
alter table public.review_agent_logs enable row level security;
alter table public.review_agent_logs force row level security;

revoke all on public.review_agent_logs from anon, authenticated;

-- 3. Life Library: 24h TTL knowledge cache, same shape as
--    public.shortcut_cache. Service-role only for the same reason: this is
--    a shared cache keyed by (query, locale), not per-user data.
create table if not exists public.life_library_entries (
  query_key    text not null,
  locale       text not null,
  title        text not null,
  extract      text not null,
  thumbnail_url text,
  source_url   text not null,
  cached_at    timestamptz not null default now(),
  primary key (query_key, locale)
);

comment on table public.life_library_entries is
  'Sovereign Life-OS Life Library: 24h TTL cache of multi-source knowledge lookups, keyed by (query_key, locale). Service-role only.';

create index if not exists life_library_entries_cached_at_idx
  on public.life_library_entries (locale, cached_at desc);

alter table public.life_library_entries enable row level security;
alter table public.life_library_entries force row level security;

revoke all on public.life_library_entries from anon, authenticated;
