-- profiles.age type reconciliation. The column was created as `text` in the
-- hand-built era; every migration (20260821000000 onward) assumes `integer`,
-- and 20260901000000's `profiles_age_range` CHECK could not be added in
-- 20260903000000 because the column was still text.
--
-- Audited on live (project fjznkonbjoierxvopiko) 2026-08-29: all 5 rows hold
-- clean numeric strings ("46","30","30","30","30"); none non-numeric, none
-- outside 14..120. Safe cast below; a stray non-numeric value would abort the
-- ALTER and roll back with zero data change (fail-closed).

alter table public.profiles
  alter column age type integer using nullif(btrim(age), '')::integer;

-- The range guard 20260901000000 intended (matches web/lib/profileFields.ts
-- AGE_MIN=14 / AGE_MAX=120). idempotent.
alter table public.profiles
  drop constraint if exists profiles_age_range,
  add  constraint profiles_age_range check (age is null or (age between 14 and 120));
