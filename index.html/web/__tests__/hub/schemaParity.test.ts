import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHAT_HISTORY,
  CHAT_MAX_TEXT,
  CHAT_MIN_INTERVAL_MS,
  CHAT_ROOM_KEYS,
} from '@/lib/hub/themeChat';
import {
  CREATOR_SHARE,
  EXCHANGE_CATALOG,
  LISTING_PRICE_MAX,
  LISTING_PRICE_MIN,
  LISTING_REVIEW_MS,
  LISTING_SUMMARY_MAX,
  LISTING_TITLE_MAX,
  LISTING_TITLE_MIN,
  STARTER_CREDITS,
} from '@/lib/hub/knowledgeExchange';
import { HOT_NEWS_CATEGORIES } from '@/lib/live/hotNews';

/**
 * REV-30 MISSION 1 -- the two copies of the hub's rules must not drift.
 *
 * The pure TypeScript modules give the client instant feedback; the SQL is
 * the copy that decides. A price, a length bound or a room name that agrees
 * in one and not the other is the exact shape of bug that only shows up in
 * production, on someone else's account -- so it is a build failure here.
 *
 * This reads the migration as text rather than connecting to a database:
 * it is the file that was applied, it is in the repo, and a test that needs
 * credentials is a test that gets skipped.
 */

const MIGRATION = readFileSync(
  join(__dirname, '../../../supabase/migrations/20260916000000_hub_exchange_and_rooms.sql'),
  'utf8',
);

/** The `values (...)` rows of the catalogue seed, parsed back out. */
function seededCatalog(): Array<{ packId: string; title: string; theme: string; seller: string; price: number; kind: string; tier: string }> {
  const start = MIGRATION.indexOf('insert into public.hub_catalog');
  const end = MIGRATION.indexOf('on conflict (pack_id)', start);
  expect(start, 'the catalogue seed block').toBeGreaterThan(-1);
  expect(end, 'the catalogue seed terminator').toBeGreaterThan(start);
  const block = MIGRATION.slice(start, end);
  const rowRe = /\(\s*'([^']+)',\s*'((?:[^']|'')*)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*'([^']+)',\s*'([^']+)'\s*\)/g;
  const rows: Array<{ packId: string; title: string; theme: string; seller: string; price: number; kind: string; tier: string }> = [];
  for (const m of block.matchAll(rowRe)) {
    rows.push({
      packId: m[1],
      title: m[2].replace(/''/g, "'"),
      theme: m[3],
      seller: m[4],
      price: Number(m[5]),
      kind: m[6],
      tier: m[7],
    });
  }
  return rows;
}

describe('catalogue parity (TS <-> SQL)', () => {
  const seeded = seededCatalog();

  it('seeds exactly the packs the TypeScript catalogue ships', () => {
    expect(seeded).toHaveLength(EXCHANGE_CATALOG.length);
    expect(seeded.map((r) => r.packId)).toEqual(EXCHANGE_CATALOG.map((p) => p.id));
  });

  it('every field of every pack matches, price above all', () => {
    for (const pack of EXCHANGE_CATALOG) {
      const row = seeded.find((r) => r.packId === pack.id);
      expect(row, `${pack.id} missing from the migration`).toBeTruthy();
      expect(row!.title, `${pack.id} title`).toBe(pack.title);
      expect(row!.theme, `${pack.id} theme`).toBe(pack.theme);
      expect(row!.seller, `${pack.id} seller`).toBe(pack.seller);
      // The price is what `hub_buy_pack` charges. A drift here is a client
      // that shows one number and an account that is debited another.
      expect(row!.price, `${pack.id} price`).toBe(pack.price);
      expect(row!.kind, `${pack.id} kind`).toBe(pack.kind);
      expect(row!.tier, `${pack.id} tier`).toBe(pack.tier);
    }
  });
});

describe('room parity (TS <-> SQL)', () => {
  it('the hub_theme domain lists exactly the 22 news axes', () => {
    const start = MIGRATION.indexOf('create domain public.hub_theme');
    expect(start).toBeGreaterThan(-1);
    const block = MIGRATION.slice(start, MIGRATION.indexOf('));', start));
    const names = Array.from(block.matchAll(/'([a-z]+)'/g)).map((m) => m[1]);
    expect(names.slice().sort()).toEqual([...HOT_NEWS_CATEGORIES].slice().sort());
    expect(names).toHaveLength(22);
    // The chat rooms and the news axes are the same list, by construction.
    expect([...CHAT_ROOM_KEYS].sort()).toEqual(names.slice().sort());
  });
});

describe('rule parity (TS <-> SQL)', () => {
  it('the starter grant is the same number on both sides', () => {
    expect(STARTER_CREDITS).toBe(1200);
    // Two grants in the SQL (hub_sync mints it, hub_buy_pack backfills a
    // missing row) -- both must be the TS number.
    const grants = Array.from(MIGRATION.matchAll(/values \(v_user_id, (\d+), true\)/g)).map((m) => Number(m[1]));
    expect(grants.length).toBeGreaterThanOrEqual(2);
    for (const g of grants) expect(g).toBe(STARTER_CREDITS);
    expect(MIGRATION).toContain(`credits = credits + ${STARTER_CREDITS}`);
  });

  it('the creator split is 70% on both sides', () => {
    expect(CREATOR_SHARE).toBe(0.7);
    expect(MIGRATION).toContain('v_creator := round(v_price * 0.7);');
    // And the platform takes the remainder, so the two always sum to the
    // price -- the constraint the purchase table refuses to violate.
    expect(MIGRATION).toContain('v_platform := v_price - v_creator;');
    expect(MIGRATION).toContain('check (creator_share + platform_share = price)');
  });

  it('listing bounds match', () => {
    expect([LISTING_TITLE_MIN, LISTING_TITLE_MAX]).toEqual([3, 60]);
    expect([LISTING_PRICE_MIN, LISTING_PRICE_MAX]).toEqual([10, 5000]);
    expect(LISTING_SUMMARY_MAX).toBe(200);
    expect(MIGRATION).toContain(`char_length(btrim(title)) between ${LISTING_TITLE_MIN} and ${LISTING_TITLE_MAX}`);
    // The column definitions are space-aligned in the migration, so this
    // one is matched on a whitespace-insensitive pattern rather than text.
    const priceCheck = new RegExp(
      'price' + String.raw`\s+` + 'integer not null check ' + String.raw`\(` +
        'price >= ' + LISTING_PRICE_MIN + ' and price <= ' + LISTING_PRICE_MAX + String.raw`\)`,
    );
    expect(MIGRATION).toMatch(priceCheck);
    expect(MIGRATION).toContain(`char_length(summary) <= ${LISTING_SUMMARY_MAX}`);
    // The RPC re-checks the same bounds rather than leaning on the table.
    expect(MIGRATION).toContain(`char_length(v_title) < ${LISTING_TITLE_MIN} or char_length(v_title) > ${LISTING_TITLE_MAX}`);
    expect(MIGRATION).toContain(`p_price < ${LISTING_PRICE_MIN} or p_price > ${LISTING_PRICE_MAX}`);
  });

  it('the review window is the same ten minutes', () => {
    expect(LISTING_REVIEW_MS).toBe(10 * 60 * 1000);
    expect(MIGRATION).toContain("now() + interval '10 minutes'");
  });

  it('chat bounds match', () => {
    expect(CHAT_MAX_TEXT).toBe(280);
    expect(CHAT_MIN_INTERVAL_MS).toBe(900);
    expect(CHAT_HISTORY).toBe(60);
    expect(MIGRATION).toContain(`char_length(btrim(body)) between 1 and ${CHAT_MAX_TEXT}`);
    expect(MIGRATION).toContain(`char_length(v_body) > ${CHAT_MAX_TEXT}`);
    expect(MIGRATION).toContain(`interval '${CHAT_MIN_INTERVAL_MS} milliseconds'`);
    expect(MIGRATION).toContain(`p_limit integer default ${CHAT_HISTORY}`);
  });
});

describe('the migration is safe to re-run and safe to read', () => {
  it('drops, truncates and deletes nothing', () => {
    // `drop policy if exists` is the house idempotency idiom and is not a
    // data loss shape; everything else is.
    const withoutPolicyDrops = MIGRATION.replace(/drop policy if exists[^;]*;/gi, '');
    expect(withoutPolicyDrops).not.toMatch(/\bdrop\s+table\b/i);
    expect(withoutPolicyDrops).not.toMatch(/\bdrop\s+column\b/i);
    expect(withoutPolicyDrops).not.toMatch(/\btruncate\b/i);
    expect(withoutPolicyDrops).not.toMatch(/\bdelete\s+from\b/i);
  });

  it('every table it creates forces RLS', () => {
    const tables = Array.from(MIGRATION.matchAll(/create table if not exists public\.(hub_\w+)/g)).map((m) => m[1]);
    expect(tables.sort()).toEqual(['hub_catalog', 'hub_credits', 'hub_listings', 'hub_messages', 'hub_purchases']);
    for (const table of tables) {
      expect(MIGRATION, `${table} enable`).toContain(`alter table public.${table} enable row level security`);
      expect(MIGRATION, `${table} force`).toContain(`alter table public.${table} force row level security`);
    }
  });

  it('grants no RPC to anon and every RPC to authenticated', () => {
    const rpcs = ['hub_sync', 'hub_buy_pack', 'hub_list_pack', 'hub_post_message', 'hub_room_history', 'hub_seller_board'];
    for (const fn of rpcs) {
      expect(MIGRATION, `${fn} revoke`).toMatch(new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\)\\s+from public, anon`));
      expect(MIGRATION, `${fn} grant`).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\)\\s+to authenticated`));
    }
    expect(MIGRATION).toContain('from anon;');
  });

  it('carries no control character -- the escape trap that bit REV-29 and REV-30', () => {
    // Two separate tools in this repo have silently turned a backslash-u (or
    // backslash-b) escape into the byte it names. A NUL inside a migration
    // reaches Postgres as a NUL.
    // eslint-disable-next-line no-control-regex
    expect(MIGRATION).not.toMatch(/[ --]/);
    // And the sanitiser uses POSIX classes precisely so it never needs one.
    expect(MIGRATION).toContain('[[:cntrl:]]');
  });

  it('never touches the U-COIN economy', () => {
    // REV-30 decision 1: the exchange ledger is its own. A migration that
    // quietly writes to wallets or coin_ledger would rewrite the margin
    // doctrine without being asked to.
    expect(MIGRATION).not.toMatch(/insert into public\.(wallets|coin_ledger)/i);
    expect(MIGRATION).not.toMatch(/update public\.(wallets|coin_ledger)/i);
  });
});
