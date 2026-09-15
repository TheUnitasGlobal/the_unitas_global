-- REV-30 MISSION 1 (founder directive 2026-09-15) -- the UNITAS hub's SERVER
-- LEDGER: the knowledge exchange and the 22 theme chat rooms move from the
-- device-local, broadcast-only implementation REV-29 shipped to a real
-- Postgres ledger with RLS and RPCs.
--
-- WHAT REV-29 LEFT OPEN, VERBATIM FROM ITS OWN REPORT (§10.1): "지식 거래소·
-- 대화방 서버 원장(테이블·RPC·RLS·정산 잡)은 스키마 변경이라 이번 구간 밖 --
-- 현재는 기기 원장 + 실시간 브로드캐스트." This migration closes exactly that,
-- and nothing else.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FIVE DECISIONS THIS FILE MAKES, AND WHY
--
-- 1. EXCHANGE CREDITS ARE NOT U-COIN. `hub_credits` is its own ledger with its
--    own starter grant. It deliberately does NOT touch public.wallets or
--    public.coin_ledger: the coin economy's whole margin doctrine (제1장,
--    U-COIN Micro-Burn) hangs off those two tables, and quietly minting
--    U-COIN for a marketplace purchase would rewrite the economy without an
--    instruction to do so. The purchase row records the 70/30 split durably
--    (creator_share / platform_share) so a settlement job can pay creators in
--    U-COIN later -- that job is a separate, deliberate step.
--
-- 2. PRICES LIVE IN THE DATABASE, NOT IN THE REQUEST. `hub_catalog` mirrors
--    lib/hub/knowledgeExchange.ts's 24 packs, and `hub_buy_pack` reads the
--    price from it. A client that declares its own price is a client that
--    buys a 320-credit pack for 1. `__tests__/hub/catalogParity.test.ts`
--    fails the build if TS and SQL ever disagree.
--
-- 3. SIGNED-IN VISITORS GET THE SERVER LEDGER; GUESTS KEEP THE DEVICE LEDGER.
--    RLS secures rows by `auth.uid()`, which an anonymous visitor does not
--    have. Rather than inventing a pseudo-identity that RLS cannot actually
--    defend, the client keeps REV-29's device ledger for guests and switches
--    to the server ledger on sign-in. The two are never merged: importing a
--    device's claimed purchases would be a free grant of whatever the device
--    claims, which is the same hole under a friendlier name. The UI says
--    which ledger is in force.
--
-- 4. CHAT PERSISTS FOR SIGNED-IN AUTHORS, BROADCASTS FOR EVERYONE. REV-29's
--    Realtime broadcast stays exactly as it is -- it is what makes a room feel
--    live. What this adds is durability: a signed-in author's message is also
--    written here, so a room opened on a new device is not blank. A guest's
--    message still broadcasts and still lands in that device's own history.
--
-- 5. SERVER-SIDE VALIDATION MIRRORS THE PURE RULES, IT DOES NOT TRUST THEM.
--    Title length, price range, summary length, the 22-room whitelist, the
--    280-character body and the 900 ms flood interval are all re-checked
--    here. lib/hub/themeChat.ts and lib/hub/knowledgeExchange.ts keep their
--    own copies for instant client feedback; this is the copy that decides.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- IDEMPOTENT + self-contained, and applied on its own through the Supabase
-- Management API `database/query` endpoint (scripts/supabase-sql.mjs), NOT via
-- `supabase db push` -- the live project has no complete migration history and
-- a push would try to replay every local file against a schema that does not
-- match them. Same catch-up pattern as 20260902000000 onward; CLI history is
-- then synced with `supabase migration repair --status applied 20260916000000`.
--
-- Nothing in this file drops, truncates or deletes anything.

-- ── 0. the 22 rooms / themes ──────────────────────────────────────────────
-- One source, used by every check below. Matches HOT_NEWS_CATEGORIES
-- (web/lib/live/hotNews.ts) after REV-29 M2.2 split 복지·보건 and 안보·분쟁.
-- A domain rather than a repeated inline list: adding the 23rd axis later is
-- one ALTER, not five.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'hub_theme') then
    create domain public.hub_theme as text
      check (value in (
        'politics', 'economy', 'science', 'technology', 'engineering', 'sports',
        'culture', 'art', 'expression', 'language', 'society', 'structure',
        'pragma', 'law', 'institution', 'education', 'welfare', 'health',
        'security', 'conflict', 'strategy', 'disaster'
      ));
  end if;
end
$$;

-- ── 1. hub_catalog ────────────────────────────────────────────────────────
create table if not exists public.hub_catalog (
  pack_id    text primary key,
  title      text not null,
  theme      public.hub_theme not null,
  seller     text not null,
  price      integer not null check (price >= 10 and price <= 5000),
  kind       text not null check (kind in ('ladder', 'playbook', 'dataset', 'prompt')),
  tier       text not null check (tier in ('seed', 'pro', 'sovereign')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.hub_catalog is
  'REV-30: the knowledge exchange catalogue. The PRICE OF RECORD -- hub_buy_pack reads it here, never from the request. Mirrors lib/hub/knowledgeExchange.ts (parity-tested).';

-- Readable by any signed-in visitor (it is a shop window); written by
-- service_role only.
alter table public.hub_catalog enable row level security;
alter table public.hub_catalog force row level security;

drop policy if exists "hub_catalog_select_all" on public.hub_catalog;
create policy "hub_catalog_select_all"
  on public.hub_catalog
  for select
  to authenticated
  using (true);

-- The 24 packs. `on conflict do update` keeps a re-run in step with the TS
-- catalogue without ever deleting a pack someone has already bought.
insert into public.hub_catalog (pack_id, title, theme, seller, price, kind, tier) values
  ('kp-01', 'Central bank week — a 12-rung reading ladder', 'economy', 'quiet.ledger', 180, 'ladder', 'pro'),
  ('kp-02', 'Zero-capital launch playbook for one-person shops', 'pragma', 'cart.mind', 240, 'playbook', 'sovereign'),
  ('kp-03', 'Semiconductor supply map, verified sources only', 'technology', 'nomad.kai', 320, 'dataset', 'sovereign'),
  ('kp-04', 'Courtroom vocabulary in five languages', 'law', 'ink.and.echo', 90, 'prompt', 'seed'),
  ('kp-05', 'Election night — how to read exit polls', 'politics', 'frame.zero', 120, 'playbook', 'pro'),
  ('kp-06', 'Earthquake early-warning primer for coastal cities', 'disaster', 'span.wire', 60, 'ladder', 'seed'),
  ('kp-07', 'Vaccine trial phases, explained in one page', 'health', 'ward.seven', 70, 'ladder', 'seed'),
  ('kp-08', 'Pension reform tracker — 20 countries', 'welfare', 'quiet.ledger', 210, 'dataset', 'pro'),
  ('kp-09', 'Ceasefire timelines, 1990–now', 'conflict', 'proof.sketch', 150, 'dataset', 'pro'),
  ('kp-10', 'Cyber-defence checklist for small teams', 'security', 'bench.notes', 260, 'playbook', 'sovereign'),
  ('kp-11', 'Summit season — a diplomat’s reading order', 'strategy', 'hem.line', 130, 'ladder', 'pro'),
  ('kp-12', 'Transfer window arithmetic', 'sports', 'pitch.side', 40, 'prompt', 'seed'),
  ('kp-13', 'Film festival circuit — who decides what', 'culture', 'frame.zero', 110, 'ladder', 'pro'),
  ('kp-14', 'Auction house price ladders, 2015–now', 'art', 'lineweight', 190, 'dataset', 'pro'),
  ('kp-15', 'Press-freedom index, source by source', 'expression', 'ink.and.echo', 80, 'dataset', 'seed'),
  ('kp-16', 'Endangered languages — a field starter', 'language', 'steam.rising', 55, 'ladder', 'seed'),
  ('kp-17', 'Birth-rate policy playbook', 'society', 'hem.line', 170, 'playbook', 'pro'),
  ('kp-18', 'Power grid outage post-mortems', 'structure', 'span.wire', 220, 'dataset', 'sovereign'),
  ('kp-19', 'Regulator watch — EU · US · KR · JP', 'institution', 'quiet.ledger', 200, 'dataset', 'pro'),
  ('kp-20', 'University admissions decoded', 'education', 'proof.sketch', 95, 'playbook', 'seed'),
  ('kp-21', 'Fusion milestones and what they actually mean', 'science', 'bench.notes', 140, 'ladder', 'pro'),
  ('kp-22', 'Bridge & tunnel megaprojects — cost curves', 'engineering', 'span.wire', 230, 'dataset', 'sovereign'),
  ('kp-23', 'Prompt kit: brief any news story in 6 axes', 'expression', 'nomad.kai', 45, 'prompt', 'seed'),
  ('kp-24', 'Tariff rounds — a trader’s timeline', 'economy', 'cart.mind', 160, 'ladder', 'pro')
on conflict (pack_id) do update set
  title  = excluded.title,
  theme  = excluded.theme,
  seller = excluded.seller,
  price  = excluded.price,
  kind   = excluded.kind,
  tier   = excluded.tier,
  active = true;

-- ── 2. hub_credits ────────────────────────────────────────────────────────
create table if not exists public.hub_credits (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  credits         bigint not null default 0 check (credits >= 0),
  starter_granted boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.hub_credits is
  'REV-30: exchange credits, one row per user. DELIBERATELY SEPARATE from public.wallets -- these are not U-COIN.';

alter table public.hub_credits enable row level security;
alter table public.hub_credits force row level security;

-- Read your own balance. No insert/update/delete policy at all: every write
-- goes through a SECURITY DEFINER RPC, so a session can never set its own
-- balance (the shape that turns a marketplace into a faucet).
drop policy if exists "hub_credits_select_own" on public.hub_credits;
create policy "hub_credits_select_own"
  on public.hub_credits
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ── 3. hub_listings ───────────────────────────────────────────────────────
create table if not exists public.hub_listings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 3 and 60),
  theme      public.hub_theme not null,
  price      integer not null check (price >= 10 and price <= 5000),
  summary    text not null default '' check (char_length(summary) <= 200),
  status     text not null default 'review' check (status in ('review', 'live', 'retired')),
  created_at timestamptz not null default now(),
  -- REV-29's client rule: a listing goes live 10 minutes after it is filed.
  -- Stored rather than computed so the moment survives a clock change.
  live_at    timestamptz not null default now() + interval '10 minutes'
);

comment on table public.hub_listings is
  'REV-30: creator-filed knowledge packs. `live_at` is the end of the 10-minute review window (REV-29 LISTING_REVIEW_MS).';

create index if not exists hub_listings_user_idx on public.hub_listings (user_id, created_at desc);
create index if not exists hub_listings_live_idx on public.hub_listings (status, live_at desc);

alter table public.hub_listings enable row level security;
alter table public.hub_listings force row level security;

-- Your own listings always; everyone else's only once they are live. A
-- listing still in review is not a public object.
drop policy if exists "hub_listings_select_own" on public.hub_listings;
create policy "hub_listings_select_own"
  on public.hub_listings
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "hub_listings_select_live" on public.hub_listings;
create policy "hub_listings_select_live"
  on public.hub_listings
  for select
  to authenticated
  using (status = 'live' and live_at <= now());

-- ── 4. hub_purchases ──────────────────────────────────────────────────────
create table if not exists public.hub_purchases (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  pack_id        text not null references public.hub_catalog (pack_id),
  price          integer not null check (price > 0),
  creator_share  integer not null check (creator_share >= 0),
  platform_share integer not null check (platform_share >= 0),
  seller         text not null,
  credits_after  bigint not null check (credits_after >= 0),
  created_at     timestamptz not null default now(),
  -- The split must always add back up to the price -- a row that does not
  -- balance is a settlement bug, and the table refuses to hold one.
  constraint hub_purchases_split_balances check (creator_share + platform_share = price)
);

comment on table public.hub_purchases is
  'REV-30: append-only purchase ledger. creator_share / platform_share are the 70/30 split recorded at purchase time for a later U-COIN settlement job.';

-- One purchase per pack per person: the product is access, not a consumable.
create unique index if not exists hub_purchases_once_idx on public.hub_purchases (user_id, pack_id);
create index if not exists hub_purchases_seller_idx on public.hub_purchases (seller, created_at desc);

alter table public.hub_purchases enable row level security;
alter table public.hub_purchases force row level security;

drop policy if exists "hub_purchases_select_own" on public.hub_purchases;
create policy "hub_purchases_select_own"
  on public.hub_purchases
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ── 5. hub_messages ───────────────────────────────────────────────────────
create table if not exists public.hub_messages (
  id         uuid primary key default gen_random_uuid(),
  room       public.hub_theme not null,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  author     text not null check (char_length(btrim(author)) between 1 and 40),
  body       text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

comment on table public.hub_messages is
  'REV-30: durable history for the 22 theme rooms. The Realtime broadcast REV-29 shipped is unchanged and still carries the live feel; this is what makes a room non-blank on a new device.';

create index if not exists hub_messages_room_idx on public.hub_messages (room, created_at desc);
create index if not exists hub_messages_author_idx on public.hub_messages (user_id, created_at desc);

alter table public.hub_messages enable row level security;
alter table public.hub_messages force row level security;

-- A room is public to signed-in visitors -- that is what a room is. Writing
-- goes through the RPC (sanitising + flood guard), so there is no insert
-- policy; deleting your own message is allowed.
drop policy if exists "hub_messages_select_all" on public.hub_messages;
create policy "hub_messages_select_all"
  on public.hub_messages
  for select
  to authenticated
  using (true);

drop policy if exists "hub_messages_delete_own" on public.hub_messages;
create policy "hub_messages_delete_own"
  on public.hub_messages
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── 6. RPC: hub_sync ──────────────────────────────────────────────────────
-- One round trip that opens the hub: mints the starter credits the first time
-- a signed-in visitor ever calls it, then returns the whole ledger. Idempotent
-- by `starter_granted`, so a reload never re-grants.
create or replace function public.hub_sync()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits bigint;
  v_starter boolean;
  v_purchases jsonb;
  v_listings jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.hub_credits (user_id, credits, starter_granted)
  values (v_user_id, 1200, true)
  on conflict (user_id) do nothing;

  -- A row that predates the starter grant (impossible today, but a future
  -- writer could create one) still receives it exactly once.
  update public.hub_credits
  set credits = credits + 1200, starter_granted = true, updated_at = now()
  where user_id = v_user_id and starter_granted = false;

  select credits, starter_granted into v_credits, v_starter
  from public.hub_credits
  where user_id = v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'packId', pack_id,
           'price', price,
           'at', (extract(epoch from created_at) * 1000)::bigint
         ) order by created_at), '[]'::jsonb)
  into v_purchases
  from public.hub_purchases
  where user_id = v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id::text,
           'title', title,
           'theme', theme,
           'price', price,
           'summary', summary,
           'status', case when live_at <= now() then 'live' else 'review' end,
           'at', (extract(epoch from created_at) * 1000)::bigint
         ) order by created_at desc), '[]'::jsonb)
  into v_listings
  from public.hub_listings
  where user_id = v_user_id and status <> 'retired';

  return jsonb_build_object(
    'credits', v_credits,
    'starterGranted', v_starter,
    'purchases', v_purchases,
    'listings', v_listings
  );
end;
$$;

-- ── 7. RPC: hub_buy_pack ──────────────────────────────────────────────────
-- Atomic purchase. Locks the caller's own credit row, reads the price FROM
-- THE CATALOGUE, checks the balance, debits, and appends the purchase with
-- the 70/30 split -- all in the one implicit transaction, so an insufficient
-- balance or a repeat purchase rolls back with no partial state.
create or replace function public.hub_buy_pack(p_pack_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer;
  v_seller text;
  v_credits bigint;
  v_creator integer;
  v_platform integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select price, seller into v_price, v_seller
  from public.hub_catalog
  where pack_id = p_pack_id and active = true;

  if v_price is null then
    raise exception 'Unknown pack: %', p_pack_id;
  end if;

  if exists (select 1 from public.hub_purchases where user_id = v_user_id and pack_id = p_pack_id) then
    raise exception 'Already owned';
  end if;

  insert into public.hub_credits (user_id, credits, starter_granted)
  values (v_user_id, 1200, true)
  on conflict (user_id) do nothing;

  select credits into v_credits
  from public.hub_credits
  where user_id = v_user_id
  for update;

  if v_credits < v_price then
    raise exception 'Insufficient credits';
  end if;

  v_credits := v_credits - v_price;

  update public.hub_credits
  set credits = v_credits, updated_at = now()
  where user_id = v_user_id;

  -- 70 / 30, rounded the same way lib/hub/knowledgeExchange.ts rounds it, and
  -- the platform takes the remainder so the two always sum to the price.
  v_creator := round(v_price * 0.7);
  v_platform := v_price - v_creator;

  insert into public.hub_purchases (user_id, pack_id, price, creator_share, platform_share, seller, credits_after)
  values (v_user_id, p_pack_id, v_price, v_creator, v_platform, v_seller, v_credits);

  return jsonb_build_object(
    'ok', true,
    'packId', p_pack_id,
    'price', v_price,
    'credits', v_credits,
    'creatorShare', v_creator,
    'platformShare', v_platform
  );
end;
$$;

-- ── 8. RPC: hub_list_pack ─────────────────────────────────────────────────
-- Files a listing after re-checking every rule the client checked. The
-- theme domain rejects an unknown axis on its own.
create or replace function public.hub_list_pack(p_title text, p_theme text, p_price integer, p_summary text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_summary text := btrim(coalesce(p_summary, ''));
  v_id uuid;
  v_live timestamptz;
  v_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(v_title) < 3 or char_length(v_title) > 60 then
    raise exception 'Title must be 3-60 characters';
  end if;
  if p_price is null or p_price < 10 or p_price > 5000 then
    raise exception 'Price must be 10-5000 credits';
  end if;
  if char_length(v_summary) > 200 then
    raise exception 'Summary must be at most 200 characters';
  end if;
  -- A cap on open listings per author: the table is public writable surface,
  -- and an unbounded one is an invitation.
  if (select count(*) from public.hub_listings where user_id = v_user_id and status <> 'retired') >= 50 then
    raise exception 'Listing limit reached';
  end if;

  insert into public.hub_listings (user_id, title, theme, price, summary)
  values (v_user_id, v_title, p_theme::public.hub_theme, p_price, v_summary)
  returning id, live_at, created_at into v_id, v_live, v_at;

  return jsonb_build_object(
    'ok', true,
    'id', v_id::text,
    'title', v_title,
    'theme', p_theme,
    'price', p_price,
    'summary', v_summary,
    'status', 'review',
    'at', (extract(epoch from v_at) * 1000)::bigint,
    'liveAt', (extract(epoch from v_live) * 1000)::bigint
  );
end;
$$;

-- ── 9. RPC: hub_post_message ──────────────────────────────────────────────
-- Sanitises, enforces the 900 ms flood interval against the author's own last
-- row, writes, and returns the stored message so the client renders exactly
-- what was persisted rather than its optimistic copy.
create or replace function public.hub_post_message(p_room text, p_body text, p_author text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text;
  v_author text := btrim(coalesce(p_author, ''));
  v_last timestamptz;
  v_id uuid;
  v_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Collapse whitespace, then strip whatever control characters remain --
  -- the same shape lib/hub/themeChat.ts's sanitizeChatText produces. Doing
  -- it in this order, with POSIX classes only, is equivalent: a control
  -- character is never whitespace, so neither pass can eat the other's
  -- input. POSIX classes rather than hex escapes is deliberate -- see the
  -- REV-30 report: two separate tools in this repo have now silently
  -- turned a backslash-u escape into the byte it names.
  v_body := btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'), '[[:cntrl:]]', '', 'g'));

  if char_length(v_body) = 0 then
    raise exception 'Empty message';
  end if;
  if char_length(v_body) > 280 then
    v_body := left(v_body, 280);
  end if;
  if char_length(v_author) = 0 then
    v_author := 'nomad';
  end if;
  if char_length(v_author) > 40 then
    v_author := left(v_author, 40);
  end if;

  select max(created_at) into v_last
  from public.hub_messages
  where user_id = v_user_id;

  if v_last is not null and now() - v_last < interval '900 milliseconds' then
    raise exception 'Too fast';
  end if;

  insert into public.hub_messages (room, user_id, author, body)
  values (p_room::public.hub_theme, v_user_id, v_author, v_body)
  returning id, created_at into v_id, v_at;

  return jsonb_build_object(
    'ok', true,
    'id', v_id::text,
    'room', p_room,
    'author', v_author,
    'authorId', 'u:' || v_user_id::text,
    'text', v_body,
    'at', (extract(epoch from v_at) * 1000)::bigint
  );
end;
$$;

-- ── 10. RPC: hub_room_history ─────────────────────────────────────────────
-- The last N messages of one room, oldest first (render order). A plain
-- select would work under the read policy; this exists so the client has one
-- shape for history and live messages alike, and so the row cap is the
-- server's decision rather than the caller's.
create or replace function public.hub_room_history(p_room text, p_limit integer default 60)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(payload order by sent_at), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'id', id::text,
             'room', room::text,
             'author', author,
             'authorId', 'u:' || user_id::text,
             'text', body,
             'at', (extract(epoch from created_at) * 1000)::bigint
           ) as payload,
           created_at as sent_at
    from public.hub_messages
    where room = p_room::public.hub_theme
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 60), 1), 200)
  ) recent;
$$;

-- ── 11. RPC: hub_seller_board ─────────────────────────────────────────────
-- Real revenue per creator, from the purchase ledger rather than the seeded
-- projection REV-29's board showed. Returns an empty array until the ledger
-- has rows, and the UI keeps the seeded board as its fallback.
create or replace function public.hub_seller_board(p_limit integer default 6)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'handle', seller,
           'sales', sales,
           'revenue', revenue
         ) order by revenue desc, seller), '[]'::jsonb)
  from (
    select seller, count(*)::int as sales, sum(creator_share)::bigint as revenue
    from public.hub_purchases
    group by seller
    order by revenue desc, seller
    limit least(greatest(coalesce(p_limit, 6), 1), 50)
  ) board;
$$;

-- ── 12. EXECUTE least-privilege ───────────────────────────────────────────
-- Same posture as 20260905000000: nothing callable by `anon` or PUBLIC, the
-- visitor-facing RPCs granted to `authenticated` alone.
revoke execute on function public.hub_sync()                                   from public, anon;
revoke execute on function public.hub_buy_pack(text)                           from public, anon;
revoke execute on function public.hub_list_pack(text, text, integer, text)     from public, anon;
revoke execute on function public.hub_post_message(text, text, text)           from public, anon;
revoke execute on function public.hub_room_history(text, integer)              from public, anon;
revoke execute on function public.hub_seller_board(integer)                    from public, anon;

grant execute on function public.hub_sync()                                    to authenticated;
grant execute on function public.hub_buy_pack(text)                            to authenticated;
grant execute on function public.hub_list_pack(text, text, integer, text)      to authenticated;
grant execute on function public.hub_post_message(text, text, text)            to authenticated;
grant execute on function public.hub_room_history(text, integer)               to authenticated;
grant execute on function public.hub_seller_board(integer)                     to authenticated;

-- Table-level: RLS is the gate, but the grants should not be wider than the
-- policies either. `anon` gets nothing at all.
revoke all on public.hub_catalog, public.hub_credits, public.hub_listings,
              public.hub_purchases, public.hub_messages from anon;

grant select on public.hub_catalog   to authenticated;
grant select on public.hub_credits   to authenticated;
grant select on public.hub_listings  to authenticated;
grant select on public.hub_purchases to authenticated;
grant select, delete on public.hub_messages to authenticated;
