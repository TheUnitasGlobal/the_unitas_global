-- Zero-Trust identity: verified-phone uniqueness ("1 person = 1 account"),
-- soft-delete support, and gating spend_coins() on phone verification.
--
-- NOT YET APPLIED (same convention as the other migrations in this repo --
-- see 20260821000000_profiles_rls.sql). Apply with `supabase db push` after
-- reconciling against the live project.

alter table public.profiles
  add column if not exists phone_verified boolean not null default false,
  add column if not exists deleted_at timestamptz;

-- "1 person = 1 account": only one live (non-deleted) profile may hold a
-- given phone number once that phone is actually verified. Unverified/null
-- phones are unconstrained (people can start signup without colliding),
-- and a soft-deleted row's phone is excluded so it can be legitimately
-- re-registered by someone else later.
create unique index if not exists profiles_phone_verified_unique_idx
  on public.profiles (phone)
  where phone_verified = true and deleted_at is null;

-- The only path that may ever mark a profile's phone as verified: fires
-- when Supabase Auth itself confirms a phone OTP (auth.users.phone_confirmed_at
-- transitions to non-null), never on the client's say-so.
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

-- Guard: PostgREST's existing profiles_update_own RLS policy lets an
-- authenticated client PATCH any column on their own row, including
-- phone_verified -- which would let them just claim verification. Revert
-- any top-level (client-initiated) change to phone_verified, but allow it
-- through when the write is nested inside another trigger (pg_trigger_depth()
-- > 1, i.e. handle_phone_verified above doing it) or made by service_role
-- (the account-deletion route clearing it during soft delete).
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

-- Extend spend_coins (defined in 20260828000000_wallets_and_ledger.sql) with
-- a phone-verification guard -- this is where the "protect high-value coin
-- transactions" requirement is actually enforced, DB-side, regardless of
-- what the frontend does or fails to check.
create or replace function public.spend_coins(p_module text, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance bigint;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_module not in ('Arche', 'Arena', 'Score', 'Fate', 'Codex22') then
    raise exception 'Unknown module: %', p_module;
  end if;

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
  values (v_user_id, -p_amount, 'module_access', p_module, v_balance);

  return v_balance;
end;
$$;
