-- U-AI omni search engine: the "Monopoly Gate" margin path + the
-- "Genesis Memory" persistent cognitive cache + the "Brain-Grid" per-user
-- query trajectory store (owner instruction 2026-08-30).
--
-- Design contract (see web/lib/uai/* and web/app/api/u-ai/insight/route.ts):
--   * Phase-1 surface analysis (3-second triple lens, commercial-bias shield
--     gauge, 3-step action checklist) is 100% client-side heuristic -- zero
--     server cost, no row here.
--   * Phase 2-4 deep insight (Chronos trajectory, binary verdict, red-pen
--     hidden-intent decode, The VOID negative-space insight, efficiency path)
--     costs U-COIN on every request via spend_coins('u-ai', N) -- the
--     "Micro-Burn" absolute-margin logic. That spend mints the usual 30-min
--     module_access_grant, and the API route requires a FRESH one (< 120s) as
--     proof-of-burn before it will call the Claude API. BYOK is never offered.
--   * genesis_memory caches the (hashed) Claude response so a repeat of the
--     same query in the same locale is served from Postgres -- the U-COIN is
--     still burned (margin), but the Anthropic API cost converges to 0.
--
-- Written FULLY IDEMPOTENT and self-contained, applied on its own
-- (direct SQL + `supabase migration repair --status applied 20260908000000`),
-- matching the 20260902000000 / 20260903000000 live catch-up convention --
-- NOT via `supabase db push`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend the module whitelist by one entry: 'u-ai'. Three places must stay
--    in sync (CLAUDE.md "U-Coin ledger audit compliance"): the coin_ledger
--    CHECK, the module_access_grants CHECK, and the spend_coins() body.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.coin_ledger drop constraint if exists coin_ledger_module_check;
alter table public.coin_ledger add constraint coin_ledger_module_check
  check (module in (
    'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
    'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos',
    'u-ai'
  ));

alter table public.module_access_grants drop constraint if exists module_access_grants_module_check;
alter table public.module_access_grants add constraint module_access_grants_module_check
  check (module in (
    'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
    'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos',
    'u-ai'
  ));

-- Body is 20260907000000's spend_coins verbatim with 'u-ai' appended to the
-- whitelist -- nothing else changes.
create or replace function public.spend_coins(p_module text, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance bigint;
  v_ledger_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_module not in (
    'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
    'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos',
    'u-ai'
  ) then
    raise exception 'Unknown module: %', p_module;
  end if;

  -- Zero-Trust guard: DB-side enforcement, independent of the frontend.
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and phone_verified = true and deleted_at is null
  ) then
    raise exception 'Phone verification required before spending coins';
  end if;

  select balance into v_balance
  from public.wallets
  where user_id = v_user_id
  for update;

  if v_balance is null then
    raise exception 'Wallet not found';
  end if;
  if v_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  v_balance := v_balance - p_amount;

  update public.wallets
  set balance = v_balance, updated_at = now()
  where user_id = v_user_id;

  insert into public.coin_ledger (user_id, amount, kind, module, balance_after)
  values (v_user_id, -p_amount, 'module_access', p_module, v_balance)
  returning id into v_ledger_id;

  -- Keep module_access_grants bounded: clear this caller's stale grants.
  delete from public.module_access_grants
  where user_id = v_user_id and expires_at < now();

  insert into public.module_access_grants (user_id, module, expires_at, source_ledger_id)
  values (v_user_id, p_module, now() + interval '30 minutes', v_ledger_id);

  return v_balance;
end;
$$;

revoke execute on function public.spend_coins(text, bigint) from public, anon;
grant  execute on function public.spend_coins(text, bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Genesis Memory -- the shared, deduplicated Claude-response cache.
--    query_hash = sha256(`${locale}::${normalized query}`) computed in the
--    route. Rows are written ONLY by the service-role API route (no RLS
--    insert/update policy -- SECURITY: authenticated users may read the cache
--    but never seed it). payload is the parsed DeepReport JSON.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.genesis_memory (
  query_hash   text primary key,
  locale       text not null,
  payload      jsonb not null,
  model        text,
  hit_count    integer not null default 0,
  created_at   timestamptz not null default now(),
  last_hit_at  timestamptz
);

alter table public.genesis_memory enable row level security;
alter table public.genesis_memory force row level security;

drop policy if exists genesis_memory_read on public.genesis_memory;
create policy genesis_memory_read on public.genesis_memory
  for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Brain-Grid -- per-user cognitive trajectory (search history + resolution
--    path). localStorage is the primary client store; this table is the
--    logged-in dual write. RLS: strict select/insert/delete-own, no update
--    (an entry is a historical fact, like coin_ledger).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.brain_grid (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  query        text not null,
  depth        text not null default 'surface' check (depth in ('surface', 'deep')),
  shield_score integer,
  lens         jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists brain_grid_user_recent_idx
  on public.brain_grid (user_id, created_at desc);

alter table public.brain_grid enable row level security;
alter table public.brain_grid force row level security;

drop policy if exists brain_grid_select_own on public.brain_grid;
create policy brain_grid_select_own on public.brain_grid
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists brain_grid_insert_own on public.brain_grid;
create policy brain_grid_insert_own on public.brain_grid
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists brain_grid_delete_own on public.brain_grid;
create policy brain_grid_delete_own on public.brain_grid
  for delete to authenticated using (auth.uid() = user_id);
