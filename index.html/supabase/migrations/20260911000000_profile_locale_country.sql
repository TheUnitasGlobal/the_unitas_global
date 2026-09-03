-- Country + auto-switch locale on public.profiles (owner instruction 2026-09-03:
-- "국가 기반 자동 언어 전환" -- identify a user's country and auto-switch their
-- UI language on login, while a manual language change still takes effect
-- immediately and persists).
--
-- Applied the same way as 20260908000000 / 20260909000000 / 20260910000000:
-- `supabase db query --linked --file <this file>` then
-- `supabase migration repair --status applied 20260911000000` (NOT `db push`).
-- Additive only: new columns + CREATE OR REPLACE on handle_new_user(), no
-- edits to any already-shipped migration file.

alter table public.profiles
  add column if not exists country text,
  add column if not exists locale  text;

-- country: ISO 3166-1 alpha-2, always uppercase, or NULL (undetected browser /
-- undisclosed). Kept as a shape check rather than an enumerated country list
-- -- validating against the real ISO-3166 list belongs at the application
-- layer, not a 200+ row CHECK.
alter table public.profiles
  drop constraint if exists profiles_country_format,
  add  constraint profiles_country_format check (country is null or country ~ '^[A-Z]{2}$');

-- locale: the app's locale codes (web/i18n/routing.ts). A shape check only --
-- routing.locales is the single source of truth and already grows via
-- TypeScript, not SQL (see locale-set-12 project memory: adding a locale
-- touches 6 app files, deliberately not this migration).
alter table public.profiles
  drop constraint if exists profiles_locale_format,
  add  constraint profiles_locale_format check (locale is null or locale ~ '^[a-z]{2,3}$');

-- Re-declare the signup -> profiles bridge to carry country/locale through
-- alongside every existing field. Final authority per the "additive
-- migrations, CREATE OR REPLACE re-declares last" convention already
-- established by 20260901000000 / 20260903000000.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, phone, nationality, gender, age, blood, mbti, iq, eq,
    country, locale
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
    nullif(new.raw_user_meta_data ->> 'eq', '')::integer,
    nullif(new.raw_user_meta_data ->> 'country', ''),
    nullif(new.raw_user_meta_data ->> 'locale', '')
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
