-- REV-13 U-Pay universal allowlist -- apply with `supabase db push` after
-- founder approval.
--
-- The Quantum White home's "Singularity Core" grid (web/lib/quantumWhite/
-- clusters.ts) lets a visitor 1-click-invest in EVERY module the site
-- catalogues -- not just the 5 B2C modules and 11 ecosystems the coin
-- economy already covered, but the 8 lock-in retention engines, the 3 B2B
-- enterprise rails, and the 5 Life-OS hubs (spec section 10 item 5). Those
-- 16 modules were never part of MODULE_REGISTRY, so `spend_coins()` and
-- both CHECK constraints on `.module` columns would reject them outright
-- with "Unknown module: %".
--
-- This migration widens the whitelist from the 17 names live since
-- 20260908000000_u_ai_genesis_memory.sql (Arche/Arena/Score/Fate/Codex22,
-- echo/void/mirror/oracle/pulse/apex/genesis/syndicate/aura/paradox/chronos,
-- u-ai) by the 16 new access names in web/lib/upay/universal.ts
-- (`UPAY_UNIVERSAL_ACCESS`) -- 33 names total. Three places must stay in
-- sync (CLAUDE.md "U-Coin ledger audit compliance"): that map, this file's
-- two CHECK constraints + the spend_coins() body, and
-- `web/__tests__/gate/moduleAccess.test.ts` DB_MODULE_WHITELIST.
--
-- The `oracle` key exists in BOTH the ecosystem catalog and the lock-in
-- catalog -- the lock-in's DB name is disambiguated as `oracle-lockin`
-- (never a bare `oracle`, which stays the ecosystem's name).
--
-- Body is 20260908000000's spend_coins() verbatim (Not authenticated /
-- Amount must be positive / Unknown module / phone guard / Wallet not found
-- / Insufficient balance / grant-prune / grant-mint, in that order) with
-- ONLY the `p_module not in (...)` list widened -- nothing else changes.

-- 1. Both CHECK constraints, dropped and re-added by their exact names
--    (public convention for an inline column check created via
--    `add constraint coin_ledger_module_check` / `... module_access_grants_
--    module_check` in 20260902000000 / 20260908000000 -- these are named
--    constraints, not auto-generated ones, so a plain `drop constraint if
--    exists <name>` is exact and idempotent).
alter table public.coin_ledger drop constraint if exists coin_ledger_module_check;
alter table public.coin_ledger add constraint coin_ledger_module_check
  check (module in (
    -- 17 existing (live since 20260908000000)
    'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
    'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos',
    'u-ai',
    -- 16 new (REV-13 U-Pay universal access -- lib/upay/universal.ts)
    'nexus', 'aegis', 'u-twin', 'infinity', 'panopticon', 'oracle-lockin',
    'syndicate-x', 'fate-matrix',
    'u-signature', 'u-key', 'u-pay',
    'life-dashboard', 'second-brain', 'review-agent', 'brand-kit', 'life-library'
  ));

alter table public.module_access_grants drop constraint if exists module_access_grants_module_check;
alter table public.module_access_grants add constraint module_access_grants_module_check
  check (module in (
    'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
    'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos',
    'u-ai',
    'nexus', 'aegis', 'u-twin', 'infinity', 'panopticon', 'oracle-lockin',
    'syndicate-x', 'fate-matrix',
    'u-signature', 'u-key', 'u-pay',
    'life-dashboard', 'second-brain', 'review-agent', 'brand-kit', 'life-library'
  ));

-- 2. spend_coins(): 20260908000000's body verbatim, `p_module not in (...)`
--    widened to the same 33 names.
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
    'u-ai',
    'nexus', 'aegis', 'u-twin', 'infinity', 'panopticon', 'oracle-lockin',
    'syndicate-x', 'fate-matrix',
    'u-signature', 'u-key', 'u-pay',
    'life-dashboard', 'second-brain', 'review-agent', 'brand-kit', 'life-library'
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

-- create-or-replace preserves ACL; re-assert the least-privilege grant.
revoke execute on function public.spend_coins(text, bigint) from public, anon;
grant  execute on function public.spend_coins(text, bigint) to authenticated;
