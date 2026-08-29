-- ARCHIVE — data captured 2026-08-29 from live project fjznkonbjoierxvopiko
-- immediately before migration 20260904000000_prune_unmanaged_objects.sql
-- dropped these hand-made, code-unreferenced tables. Kept only so the drop
-- is fully reversible. Not run by any tooling.
--
-- Empty at capture time (no rows): core_profiles, integrity_logs, payments, users.

-- public.test_table  (1 row — connection smoke test)
--   columns: id bigint, created_at timestamptz, name text
insert into public.test_table (id, name) values (1, 'Hello Unitas');

-- public.global_assets  (5 rows — abandoned per-module image stub; superseded
--   by web/lib/module-registry.ts + public/ownership-manifest.json. owner_id
--   all null; image_url all null except a broken "undefined - Imgur.jpg" test URL)
--   columns: id bigint, routing_path text, status text, owner_id uuid, image_url text
insert into public.global_assets (id, routing_path, status, owner_id, image_url) values
  (1, 'Arche',   'Active', null, 'https://fjznkonbjoierxvopiko.supabase.co/storage/v1/object/public/star/undefined%20-%20Imgur.jpg'),
  (3, 'Arena',   'Active', null, null),
  (4, 'Score',   'Active', null, null),
  (5, 'Fate',    'Active', null, null),
  (6, 'Codex22', 'Active', null, null);
