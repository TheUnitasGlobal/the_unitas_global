-- Baseline schema + Zero-Trust Row Level Security for the `profiles` table.
--
-- NOT YET APPLIED. This repo had no migration history before this file, and
-- the `profiles` table already exists in the live Supabase project
-- (fjznkonbjoierxvopiko), created outside of version control. Column
-- names/types below are inferred from how the frontend reads/writes them
-- (index.html: handleAuthAction signUp options.data.*, fetchUserData).
--
-- Before running `supabase db push`:
--   1. Run `supabase db pull` (with a valid SUPABASE_ACCESS_TOKEN) to diff
--      this against the real live schema and reconcile any drift.
--   2. Confirm no other code/table currently grants broader access to
--      `profiles` that this migration would silently tighten.
--
-- Only `profiles` is covered here — no other table (e.g. "global_assets")
-- is referenced anywhere in this codebase, so none is defined below.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  nationality text,
  gender text,
  age integer,
  blood text,
  mbti text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Populates profiles from auth.users signup metadata. SECURITY DEFINER is
-- required because clients only ever hold anon/authenticated privileges and
-- are deliberately given no INSERT policy on profiles (see below).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, nationality, gender, age, blood, mbti)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'nationality',
    new.raw_user_meta_data ->> 'gender',
    nullif(new.raw_user_meta_data ->> 'age', '')::integer,
    new.raw_user_meta_data ->> 'blood',
    new.raw_user_meta_data ->> 'mbti'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Zero-Trust: RLS on, forced even for the table owner, default-deny, then
-- only two narrow allow rules.
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Deliberately no INSERT policy for `authenticated`/`anon`: rows are only
-- ever created by the SECURITY DEFINER trigger above.
-- Deliberately no DELETE policy: rows are only removed via the
-- ON DELETE CASCADE from auth.users, or by service_role (which bypasses
-- RLS entirely and should only ever be used server-side).
