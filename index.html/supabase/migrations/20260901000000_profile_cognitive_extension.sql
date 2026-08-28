-- Cognitive-profile extension: adds IQ / EQ to public.profiles and teaches
-- handle_new_user() to carry every profile field through from signup metadata.
--
-- NOT YET APPLIED (same convention as every other file in this directory --
-- see 20260821000000_profiles_rls.sql). This is an ADDITIVE migration: it does
-- not edit any existing file, it re-declares handle_new_user() with CREATE OR
-- REPLACE so a replay of the whole sequence lands on this definition last.

alter table public.profiles
  add column if not exists iq  integer,
  add column if not exists eq  integer;

-- Sanity bounds so a fat-fingered client write can't poison the ranking inputs.
-- (Range chosen to match web/lib/profileFields.ts.)
alter table public.profiles
  drop constraint if exists profiles_iq_range,
  add  constraint profiles_iq_range check (iq is null or (iq between 40 and 200));

alter table public.profiles
  drop constraint if exists profiles_eq_range,
  add  constraint profiles_eq_range check (eq is null or (eq between 0 and 200));

alter table public.profiles
  drop constraint if exists profiles_age_range,
  add  constraint profiles_age_range check (age is null or (age between 14 and 120));

-- Re-declare the signup -> profiles bridge to include nationality/gender/age/
-- blood/mbti/iq/eq (the 20260821 version already handled the first few; this
-- keeps every field in one place and adds the two new columns).
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
  return new;
end;
$$;

-- Guard: the real name is write-once. profiles_update_own RLS lets a client
-- PATCH any own column; this reverts a client-initiated change to a non-empty
-- full_name (first completion from NULL/'' is still allowed). Nested trigger
-- writes (pg_trigger_depth() > 1) and service_role (account-deletion scrub)
-- pass through. Mirrors protect_profile_identity() in 20260823000000.
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
