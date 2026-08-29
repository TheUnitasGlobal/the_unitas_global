-- Page-level access enforcement: short-lived per-module access grants issued
-- atomically by spend_coins(), so a server-rendered module page can re-verify
-- that the visitor actually paid before rendering paid content on direct
-- navigation / refresh / deep-link / shared tab.
--
-- Prior state (documented in web/CLAUDE.md "Known gaps"): the coin spend
-- happened only inside the client entry modals (ModuleQuestModal /
-- EcosystemEntryModal); nothing enforced payment at the page. This migration
-- closes that gap without changing the repeat-charge economy: every spend
-- still debits, and now also mints a 30-minute access grant that the
-- app/[locale]/(gated)/layout.tsx server component checks.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LIVE CATCH-UP MIGRATION (owner decision 2026-08-29). The live project
-- `fjznkonbjoierxvopiko` was hand-built via the Dashboard: it has NO
-- supabase_migrations history, yet already carries public.profiles (5 real
-- users), public.wallets (5 rows), public.coin_ledger, and a spend_coins()
-- matching 20260828000000 (5 B2C modules, no phone guard). Migrations
-- 20260823000000 / 20260830000000 / 20260901000000 were NEVER applied there.
--
-- Therefore this file is written to be FULLY IDEMPOTENT and self-contained for
-- exactly what the page-level coin gate needs, and is applied on its own
-- (direct SQL + `supabase migration repair --status applied 20260902000000`),
-- NOT via `supabase db push` (which would try to replay all 7 local
-- migrations against a schema that doesn't match them).
--
-- Deliberately OUT OF SCOPE here (separate, deliberate future reconciliation):
--   * the Zero-Trust phone-verification guard in spend_coins() and its
--     auth.users trigger path (20260823000000) -- live spend_coins() has no
--     such guard today; adding it without the write path would lock out every
--     spend. Rolled out on its own later.
--   * profiles.iq / profiles.eq (20260901000000).
--   * full migration-history baseline (`supabase db pull` + repair).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. coin_ledger.module whitelist: extend from the original 5 B2C modules to
--    both tiers (5 B2C + 11 ecosystems), matching web/lib/module-registry.ts
--    `moduleAccessName()`. Idempotent: drop-if-exists then re-add.
alter table public.coin_ledger drop constraint if exists coin_ledger_module_check;
alter table public.coin_ledger add constraint coin_ledger_module_check
  check (module in (
    'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
    'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos'
  ));

-- 2. The access-grants table.
create table if not exists public.module_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null check (module in (
    'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
    'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos'
  )),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source_ledger_id uuid references public.coin_ledger (id) on delete set null
);

-- Hot path: "does this user have a live grant for this module?"
create index if not exists module_access_grants_lookup_idx
  on public.module_access_grants (user_id, module, expires_at desc);

-- Zero-Trust: RLS forced, default-deny, one narrow select-own rule. Grants are
-- only ever written by spend_coins() (SECURITY DEFINER) -- no insert/update/
-- delete policy by design.
alter table public.module_access_grants enable row level security;
alter table public.module_access_grants force row level security;

drop policy if exists "module_access_grants_select_own" on public.module_access_grants;
create policy "module_access_grants_select_own"
  on public.module_access_grants
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 3. spend_coins(): same shape as the live function, with two changes --
--    (a) both-tier module whitelist, (b) mint a 30-minute module_access_grant
--    in the SAME transaction as the debit + ledger row. `create or replace`
--    keeps the existing EXECUTE grants untouched.
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
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos'
  ) then
    raise exception 'Unknown module: %', p_module;
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

  insert into public.module_access_grants (user_id, module, expires_at, source_ledger_id)
  values (v_user_id, p_module, now() + interval '30 minutes', v_ledger_id);

  return v_balance;
end;
$$;
