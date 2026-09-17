import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// REV-40 (MISSION 4) -- the FAIL-OPEN regression guard.
//
// REV-36 filled the three U-Square hub panels with a deterministic
// simulation: invented chat rows, invented view / watcher / momentum
// counters, invented market trades. It looked alive, but every figure was
// fiction, and the failure mode was FAIL-OPEN -- a missing RPC, an anon
// refusal or an offline device silently fell back to the simulation instead
// of admitting it had nothing. Codex ch.4 (Fail-Closed) and ch.13 forbid
// that: an unreadable source must land in an honest `loading` / `empty`
// state, never in a fabrication.
//
// MISSION 4 decommissioned lib/square/{talkPulse,shortsPulse,exchangePulse}.ts
// and rewrote the three panels against the real ledger. Deleting code is
// easy to undo by accident -- a revert, a cherry-pick, a well-meaning
// "restore the empty-looking panel" commit -- so this file asserts the
// removal STRUCTURALLY, against the sources themselves. The repo already
// uses source-string assertions for exactly this kind of invariant (see
// __tests__/square/pulse.test.ts, which scans lib/square for Date.now).
//
// These are not UI tests. They prove the shape of the tree: the engines are
// unreachable, the `-sim` attribute family is emitted nowhere, and the
// honest replacement attributes are present.

const WEB = join(__dirname, '../..');

const HUB_FILES = [
  'components/home/hub/KnowledgeExchange.tsx',
  'components/home/hub/ThemeChatRooms.tsx',
  'components/home/hub/UnitasShorts.tsx',
] as const;

/**
 * Every marker REV-36 used to flag a fabricated row, plus the derived elements
 * that had no honest source and were deleted outright. Module scope because
 * two invariants share it: the panels must not emit them, and the stylesheets
 * must not still be painting them.
 */
const REMOVED_ATTRS = [
  'data-hub-trade-sim',
  'data-hub-msg-sim',
  'data-hub-presence-sim',
  'data-hub-pulse-note',
  'data-shorts-pulse-sim',
  'data-shorts-pulse-row',
  'data-short-watching',
  'data-short-modal-watching',
  'data-short-modal-momentum',
  'data-pack-demand',
  'data-pack-momentum',
] as const;

/** The three REV-36 engines, by module name and by their exported call sites. */
const DECOMMISSIONED_MODULES = ['talkPulse', 'shortsPulse', 'exchangePulse'] as const;
const DECOMMISSIONED_EXPORTS = [
  'talkPulse',
  'talkPresence',
  'isSimulatedMessage',
  'TALK_PHRASES',
  'TALK_PULSE_COUNT',
  'shortsPulseStats',
  'shortsPulseFeed',
  'shortsTrending',
  'exchangePulseTrades',
  'exchangeMarketStats',
  'packDemandSeries',
  'packMomentum',
] as const;

/**
 * Comments are historical documentation -- the panels legitimately explain
 * what REV-36 used to do there -- so the literal scans run against code with
 * comments stripped. (Validated against all three sources: the only `'sim'`
 * literal left in the tree is the contract note in KnowledgeExchange.tsx.)
 */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

function read(rel: string): string {
  const path = join(WEB, rel);
  expect(existsSync(path), `${rel} is missing`).toBe(true);
  return readFileSync(path, 'utf8');
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Every .ts / .tsx file under the production surface. */
function productionSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
  };
  for (const root of ['app', 'components', 'lib']) walk(join(WEB, root));
  return out;
}

/** Every stylesheet shipped from the app directory, newest name order. */
function stylesheets(): string[] {
  const dir = join(WEB, 'app');
  expect(existsSync(dir), 'web/app is missing').toBe(true);
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.css'))
    .map((entry) => `app/${entry}`);
}

describe('REV-40 fail-open regression: the simulation engines stay gone', () => {
  it('no production source imports lib/square/{talkPulse,shortsPulse,exchangePulse}', () => {
    const sources = productionSources();
    // Sanity: the walker actually found the tree it is supposed to police.
    expect(sources.length).toBeGreaterThan(100);

    const offenders: string[] = [];
    for (const path of sources) {
      const rel = relative(WEB, path).split(sep).join('/');
      // The engines' own files, if a stale copy is still on disk, are not
      // "wiring them back in" -- what matters is that nothing reaches them.
      if (DECOMMISSIONED_MODULES.some((m) => rel === `lib/square/${m}.ts`)) continue;
      const src = readFileSync(path, 'utf8');
      for (const mod of DECOMMISSIONED_MODULES) {
        if (src.includes(`square/${mod}`)) offenders.push(`${rel} -> ${mod}`);
      }
    }
    expect(offenders, 'a production source imports a decommissioned simulation engine').toEqual([]);
  });

  it('the three hub panels reference no simulation engine or export, anywhere', () => {
    for (const rel of HUB_FILES) {
      const src = read(rel);
      for (const name of [...DECOMMISSIONED_MODULES, ...DECOMMISSIONED_EXPORTS]) {
        expect(count(src, name), `${rel} still references ${name}`).toBe(0);
      }
      // No panel may invent a figure locally either, now that the engines
      // that used to do it are gone.
      expect(src.includes('Math.random('), `${rel} fabricates a number`).toBe(false);
    }
  });

  it('the `-sim` attribute family is emitted zero times', () => {
    for (const rel of HUB_FILES) {
      const src = read(rel);
      for (const attr of REMOVED_ATTRS) {
        expect(count(src, attr), `${rel} still emits ${attr}`).toBe(0);
      }
    }
  });

  it('no stylesheet still styles a removed marker', () => {
    // Deleting the elements left ~70 lines of unreachable CSS in
    // app/unitas-hub.css -- rules for .qw-room-msg--pulse, the pulse note, the
    // shorts sim badge and list, the per-row reaction tints and the pack demand
    // sparkline -- shipped to every visitor for nothing. The rules are gone;
    // this is the gate that keeps them gone, including via a revert. Comments
    // are NOT stripped: a stylesheet has no reason to name a dead marker at
    // all, so the scan is deliberately literal.
    const sheets = stylesheets();
    // Sanity: the walker actually found the stylesheets it is supposed to police.
    expect(sheets, 'the stylesheet walker found nothing').toContain('app/unitas-hub.css');

    const offenders: string[] = [];
    for (const rel of sheets) {
      const src = read(rel);
      for (const attr of REMOVED_ATTRS) {
        const hits = count(src, attr);
        if (hits > 0) offenders.push(`${rel} styles ${attr} x${hits}`);
      }
    }
    expect(offenders, 'a stylesheet still paints a decommissioned element').toEqual([]);
  });

  it("data-hub-market-source can never carry the literal 'sim'", () => {
    const raw = read('components/home/hub/KnowledgeExchange.tsx');
    const code = codeOnly(raw);
    // The attribute exists and is derived from the honest market state.
    expect(raw).toContain('data-hub-market-source={marketSource}');
    expect(code).toContain("marketState === 'data' ? 'ledger' : marketState");
    // ...and 'sim' survives only in the comment that documents its removal.
    expect(count(code, "'sim'") + count(code, '"sim"'), "'sim' is a live literal again").toBe(0);
    // The three legal values must all be reachable in code.
    for (const v of ["'ledger'", "'loading'", "'empty'"]) {
      expect(code.includes(v), `market source cannot be ${v}`).toBe(true);
    }
  });

  it('a stale broadcast carrying REV-36 `sim` payloads is rejected at the wire', () => {
    // An older tab must not be able to put an invented trade on the ticker.
    const code = codeOnly(read('components/home/hub/KnowledgeExchange.tsx'));
    expect(code).toContain('payload.sim !== true');
  });

  it('the shorts rail sorts by a real counter, not a fabricated "trending" rank', () => {
    const code = codeOnly(read('components/home/hub/UnitasShorts.tsx'));
    expect(code).toContain("['liked', 'catalogue']");
    expect(count(code, "'trending'"), 'the fabricated trending rank is back').toBe(0);
    // The only counter left on a card is the real like total.
    expect(code).toContain('data-short-likes');
  });

  it('every removed marker has an honest loading/empty replacement in its place', () => {
    // Proof that the panels were rewritten, not merely stripped: each one
    // still declares the three-state vocabulary the DOM contract promises.
    const expectations: Record<(typeof HUB_FILES)[number], string[]> = {
      'components/home/hub/KnowledgeExchange.tsx': [
        'data-hub-market-source',
        'data-hub-loading',
        'data-hub-empty',
        'data-hub-ledger',
        'data-hub-trade',
      ],
      'components/home/hub/ThemeChatRooms.tsx': ['data-hub-room-list', 'data-hub-loading', 'data-hub-empty', 'data-hub-msg', 'data-hub-durable'],
      'components/home/hub/UnitasShorts.tsx': [
        'data-shorts-pulse',
        'data-shorts-feed-empty',
        'data-shorts-counts',
        'data-hub-loading',
        'data-hub-empty',
        'data-shorts-ledger',
        'data-short-modal-followers',
      ],
    };
    for (const [rel, attrs] of Object.entries(expectations)) {
      const src = read(rel);
      for (const attr of attrs) {
        expect(count(src, attr), `${rel} lost its honest ${attr} state`).toBeGreaterThan(0);
      }
    }
  });
});
