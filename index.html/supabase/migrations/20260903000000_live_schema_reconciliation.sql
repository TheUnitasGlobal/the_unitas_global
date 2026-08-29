-- Live-schema reconciliation (owner request 2026-08-29).
--
-- The live project `fjznkonbjoierxvopiko` was hand-built via the Dashboard:
-- `profiles` (5 real rows), `wallets` (5), `coin_ledger`, `subscriptions`,
-- `handle_new_user`/`spend_coins`/`credit_coins`, and the profiles/wallets/
-- coin_ledger/subscriptions RLS existed with NO migration history. Audited
-- 2026-08-29, the genuine gaps versus migrations 20260821000000 ..
-- 20260901000000 were:
--   * profiles.updated_at            (20260821000000)  -- missing column
--   * profiles.phone_verified / .deleted_at, profiles_phone_verified_unique_idx,
--     handle_phone_verified() + trigger, protect_profile_identity() + trigger
--                                    (20260823000000)  -- entirely missing
--   * profiles.iq / .eq + range checks, protect_profile_realname() + trigger,
--     handle_new_user() carrying iq/eq
--                                    (20260901000000)  -- entirely missing
--
-- This file carries exactly that delta to live, IDEMPOTENTLY and ADDITIVELY
-- (add column if not exists / create or replace / drop ... if exists), so it
-- is fail-closed: any error rolls the whole apply back and touches no data.
-- After it applies, 20260821000000/…/20260901000000 are marked applied via
-- `supabase migration repair` (their effects are now all present); a fresh
-- replay of the full sequence also lands here last with the same result.
--
-- DELIBERATE DEVIATIONS (owner decisions, documented not silently dropped):
--   1. spend_coins() keeps the 20260902000000 form -- 16-module whitelist +
--      module_access_grant mint, and NO phone-verified guard. The guard from
--      20260823000000/20260830000000 stays out pending a deliberate Zero-Trust
--      rollout; the *infra* it needs (phone_verified column, the
--      handle_phone_verified trigger, protect_profile_identity) IS added here,
--      so enabling the guard later is a one-function migration.
--   2. profiles.age is `text` on live (migrations assume `integer`). No type
--      change is forced on 5 rows of real data -- so 20260901000000's
--      `profiles_age_range` CHECK is intentionally NOT added here. Reconcile
--      the age type separately if/when desired.
--   3. Live has duplicate hand-made policies ("Users can view own profile" /
--      "Users can update own profile") beside the migration's
--      profiles_select_own / profiles_update_own. Left untouched (harmless,
--      OR-combined). `supabase db pull` captures them in the baseline.

-- ── 20260821000000 delta ───────────────────────────────────────────────────
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

-- ── 20260823000000: Zero-Trust identity infra (NOT the spend_coins guard) ──
alter table public.profiles
  add column if not exists phone_verified boolean not null default false,
  add column if not exists deleted_at timestamptz;

create unique index if not exists profiles_phone_verified_unique_idx
  on public.profiles (phone)
  where phone_verified = true and deleted_at is null;

create or replace function public.handle_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phone_confirmed_at is not null and (old.phone_confirmed_at is null or old.phone is distinct from new.phone) then
    update public.profiles
    set phone = new.phone, phone_verified = true
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_phone_verified on auth.users;
create trigger on_auth_user_phone_verified
  after update of phone, phone_confirmed_at on auth.users
  for each row execute function public.handle_phone_verified();

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() = 1
     and coalesce(auth.role(), '') is distinct from 'service_role'
     and new.phone_verified is distinct from old.phone_verified
  then
    new.phone_verified := old.phone_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_identity_trigger on public.profiles;
create trigger protect_profile_identity_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

-- ── 20260901000000: cognitive-profile extension ───────────────────────────
alter table public.profiles
  add column if not exists iq integer,
  add column if not exists eq integer;

alter table public.profiles
  drop constraint if exists profiles_iq_range,
  add  constraint profiles_iq_range check (iq is null or (iq between 40 and 200));

alter table public.profiles
  drop constraint if exists profiles_eq_range,
  add  constraint profiles_eq_range check (eq is null or (eq between 0 and 200));

create or replace function public.protect_profile_realname()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() = 1
     and coalesce(auth.role(), '') is distinct from 'service_role'
     and old.full_name is not null
     and btrim(old.full_name) <> ''
     and new.full_name is distinct from old.full_name
  then
    new.full_name := old.full_name;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_realname_trigger on public.profiles;
create trigger protect_profile_realname_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_realname();

-- handle_new_user(): final form = 20260828000000's wallet bootstrap +
-- 20260901000000's full field list (incl. iq/eq). 20260901000000's own body
-- dropped the wallet insert -- a sequence bug fixed here so a new signup still
-- gets a wallet row (spend_coins needs it).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, phone, nationality, gender, age, blood, mbti, iq, eq
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone),
    new.raw_user_meta_data ->> 'nationality',
    new.raw_user_meta_data ->> 'gender',
    nullif(new.raw_user_meta_data ->> 'age', '')::integer,
    new.raw_user_meta_data ->> 'blood',
    new.raw_user_meta_data ->> 'mbti',
    nullif(new.raw_user_meta_data ->> 'iq', '')::integer,
    nullif(new.raw_user_meta_data ->> 'eq', '')::integer
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ── re-assert 20260902000000's spend_coins as the final authority ──────────
-- (16-module whitelist + 30-min module_access_grant mint, NO phone guard --
-- see DELIBERATE DEVIATIONS above). Idempotent; guarantees the final state
-- regardless of 20260823000000/20260830000000 replaying their own versions
-- earlier in a fresh sequence.
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
