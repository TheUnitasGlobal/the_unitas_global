import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANCHOR_BRIDGE_MAX_ENTRIES,
  ANCHOR_BRIDGE_MISS_TTL_MS,
  ANCHOR_BRIDGE_STORAGE_KEY,
  ANCHOR_BRIDGE_TTL_MS,
  AnchorBridgeCache,
  __resetAnchorBridgeInflight,
  applyAnchorBridge,
  bridgeAnchor,
  bridgeHitOf,
  bridgeKey,
  bridgeTerm,
  bridgeableTerm,
  canonicalBridgeTerm,
  needsAnchorBridge,
  type BridgeStorageLike,
} from '@/lib/uai/anchorBridge';
import { entityAnchor, placeAnchor, qidAnchor, textAnchor } from '@/lib/uai/deeperAnchor';
import { themesFor } from '@/lib/uai/deeperThemes';
import type { ResolvedEntity } from '@/lib/uai/entityResolve';

/**
 * REV-25 MISSION 1 -- the ANCHOR BRIDGE.
 *
 * The defect this closes is not subtle and it is not theoretical: on the
 * deployed REV-24 build the U-AI tower rendered `data-anchor-kind="text"` for
 * an organisation query, `themesFor()` then returned an EMPTY list, and the
 * omni-tech swarm shipped in the same revision could not be reached from the
 * one surface it was built for. The last describe block in this file is that
 * exact before/after, asserted.
 */

function memStorage(seed?: string): BridgeStorageLike & { data: Record<string, string>; writes: number } {
  const data: Record<string, string> = seed ? { [ANCHOR_BRIDGE_STORAGE_KEY]: seed } : {};
  return {
    data,
    writes: 0,
    getItem: (k) => data[k] ?? null,
    setItem(k, v) {
      this.writes += 1;
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const SAMSUNG: ResolvedEntity = {
  localeTitle: '삼성전자',
  enTitle: 'Samsung Electronics',
  qid: 'Q20718',
  disambiguation: false,
  lang: 'ko',
};

beforeEach(() => {
  __resetAnchorBridgeInflight();
});

describe('bridgeableTerm -- what is worth one resolution', () => {
  it('admits a single CJK character, because the shortcut ladder already does', () => {
    expect(bridgeableTerm('물')).toBe(true);
    expect(bridgeableTerm('水')).toBe(true);
  });

  it('admits ordinary names in any script', () => {
    expect(bridgeableTerm('Samsung Electronics')).toBe(true);
    expect(bridgeableTerm('  삼성전자  ')).toBe(true);
    expect(bridgeableTerm('Организация')).toBe(true);
  });

  it('rejects empty and punctuation-only input', () => {
    for (const t of ['', '   ', '...', '???', '· ·', '「」', '—']) {
      expect(bridgeableTerm(t), JSON.stringify(t)).toBe(false);
    }
  });

  it('rejects a sentence -- that is a question, not a subject', () => {
    expect(bridgeableTerm('what are the thirteen best ways to run a sovereign saas company today')).toBe(false);
    expect(bridgeableTerm('x'.repeat(101))).toBe(false);
    expect(bridgeableTerm('x'.repeat(100))).toBe(true);
  });
});

describe('needsAnchorBridge -- gated on capability, not on the label', () => {
  it('bridges a text anchor', () => {
    expect(needsAnchorBridge(textAnchor('Samsung Electronics', 'en'))).toBe(true);
  });

  it('bridges an ENTITY anchor that never got a QID -- it is just as unable to feed a lens', () => {
    const anchorless = entityAnchor({ localeTitle: '삼성전자', enTitle: 'Samsung Electronics', disambiguation: false }, 'ko');
    expect(anchorless.kind).toBe('entity');
    expect(anchorless.qid).toBeUndefined();
    expect(needsAnchorBridge(anchorless)).toBe(true);
  });

  it('leaves an identified anchor alone', () => {
    expect(needsAnchorBridge(qidAnchor('Q20718', '삼성전자', 'ko'))).toBe(false);
  });

  it('never guesses at a disambiguation -- that is the meaning chooser, and the 공기 drift', () => {
    expect(needsAnchorBridge({ ...textAnchor('공기', 'ko'), disambiguation: true })).toBe(false);
  });

  it('leaves place and country anchors to their own identifiers', () => {
    const place = placeAnchor({ name: 'Busan', lat: 35.18, lon: 129.08, countryCode: 'KR' } as never, 'ko');
    expect(needsAnchorBridge(place)).toBe(false);
    expect(needsAnchorBridge({ kind: 'country', term: 'Korea', lang: 'en', countryCode: 'KR' })).toBe(false);
  });

  it('is null-safe', () => {
    expect(needsAnchorBridge(null)).toBe(false);
    expect(needsAnchorBridge(undefined)).toBe(false);
  });
});

describe('term identity', () => {
  it('folds whitespace, case and compatibility forms into one row', () => {
    expect(canonicalBridgeTerm('  Samsung   Electronics ')).toBe('samsung electronics');
    expect(bridgeKey('Samsung Electronics', 'en')).toBe(bridgeKey('  samsung   electronics  ', 'en'));
  });

  it('keeps languages apart', () => {
    expect(bridgeKey('air', 'en')).not.toBe(bridgeKey('air', 'ko'));
  });
});

describe('bridgeHitOf -- what counts as an answer', () => {
  it('accepts a resolved entity with a QID', () => {
    expect(bridgeHitOf(SAMSUNG)).toEqual({ qid: 'Q20718', localeTitle: '삼성전자', enTitle: 'Samsung Electronics', lang: 'ko' });
  });

  it('refuses a disambiguation, a missing QID and a malformed QID', () => {
    expect(bridgeHitOf({ ...SAMSUNG, disambiguation: true })).toBeNull();
    expect(bridgeHitOf({ ...SAMSUNG, qid: undefined })).toBeNull();
    expect(bridgeHitOf({ ...SAMSUNG, qid: 'P31' })).toBeNull();
    expect(bridgeHitOf(null)).toBeNull();
  });

  it('carries a coordinate through when the resolution found one', () => {
    expect(bridgeHitOf({ ...SAMSUNG, coord: { lat: 35.18, lon: 129.08 } })?.coord).toEqual({ lat: 35.18, lon: 129.08 });
  });
});

describe('applyAnchorBridge -- the upgrade', () => {
  it('keeps the visitor wording and rides the identity underneath', () => {
    const before = textAnchor('samsung', 'en');
    const after = applyAnchorBridge(before, { qid: 'Q20718', localeTitle: '삼성전자', enTitle: 'Samsung Electronics', lang: 'ko' });
    expect(after.kind).toBe('entity');
    expect(after.qid).toBe('Q20718');
    expect(after.term, 'the outbound row still searches what they typed').toBe('samsung');
    expect(after.localeTitle).toBe('삼성전자');
    expect(after.enTitle).toBe('Samsung Electronics');
    expect(after.lang, 'the anchor stays in the visitor language').toBe('en');
  });

  it('becomes a PLACE anchor when the entity carries a coordinate, so a bridged city gains the weather lenses', () => {
    const after = applyAnchorBridge(textAnchor('부산', 'ko'), { qid: 'Q16520', localeTitle: '부산광역시', lang: 'ko', coord: { lat: 35.18, lon: 129.08 } });
    expect(after.kind).toBe('place');
    expect(after.coord).toEqual({ lat: 35.18, lon: 129.08 });
  });

  it('preserves a country scope the host had already established', () => {
    const scoped = { ...textAnchor('samsung', 'ko'), countryCode: 'KR' };
    expect(applyAnchorBridge(scoped, { qid: 'Q20718', localeTitle: '삼성전자', lang: 'ko' }).countryCode).toBe('KR');
  });
});

describe('AnchorBridgeCache -- the reason this costs 0원', () => {
  it('serves a hit inside its TTL and forgets it after', () => {
    let now = 1_000_000;
    const cache = new AnchorBridgeCache(memStorage(), () => now);
    cache.set('samsung', 'en', { qid: 'Q20718', localeTitle: 'Samsung Electronics', lang: 'en' });
    expect(cache.get('samsung', 'en')?.qid).toBe('Q20718');
    now += ANCHOR_BRIDGE_TTL_MS - 1;
    expect(cache.get('samsung', 'en')?.qid).toBe('Q20718');
    now += 2;
    expect(cache.get('samsung', 'en'), 'expired rows read as unknown, not as a miss').toBeUndefined();
  });

  it('caches a MISS too, on a shorter clock -- a term with no page must not re-ask every render', () => {
    let now = 1_000_000;
    const cache = new AnchorBridgeCache(memStorage(), () => now);
    cache.set('nexus', 'en', null);
    expect(cache.get('nexus', 'en'), 'null is an answer: do not resolve again').toBeNull();
    now += ANCHOR_BRIDGE_MISS_TTL_MS + 1;
    expect(cache.get('nexus', 'en')).toBeUndefined();
    expect(ANCHOR_BRIDGE_MISS_TTL_MS).toBeLessThan(ANCHOR_BRIDGE_TTL_MS);
  });

  it('survives a page reload through localStorage', () => {
    const storage = memStorage();
    const first = new AnchorBridgeCache(storage, () => 5_000);
    first.set('samsung', 'en', { qid: 'Q20718', localeTitle: 'Samsung Electronics', lang: 'en' });
    first.flush();
    const second = new AnchorBridgeCache(storage, () => 6_000);
    expect(second.get('samsung', 'en')?.qid, 'a returning visitor spends nothing').toBe('Q20718');
  });

  it('evicts least-recently-written rows past the cap', () => {
    let now = 0;
    const cache = new AnchorBridgeCache(memStorage(), () => (now += 1));
    for (let i = 0; i < ANCHOR_BRIDGE_MAX_ENTRIES + 10; i++) cache.set(`t${i}`, 'en', null);
    expect(cache.size).toBe(ANCHOR_BRIDGE_MAX_ENTRIES);
    expect(cache.get('t0', 'en')).toBeUndefined();
    expect(cache.get(`t${ANCHOR_BRIDGE_MAX_ENTRIES + 9}`, 'en')).toBeNull();
  });

  it('purges a blob written by an older version', () => {
    const storage = memStorage(JSON.stringify({ v: 'ab-v0', entries: { 'en|samsung': { hit: { qid: 'Q1' }, at: 1 } } }));
    expect(new AnchorBridgeCache(storage, () => 2).get('samsung', 'en')).toBeUndefined();
    expect(storage.data[ANCHOR_BRIDGE_STORAGE_KEY]).toBeUndefined();
  });

  it('fails open on corrupt storage and on a storage that throws', () => {
    expect(new AnchorBridgeCache(memStorage('{not json'), () => 1).get('x', 'en')).toBeUndefined();
    const hostile: BridgeStorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const cache = new AnchorBridgeCache(hostile, () => 1);
    expect(() => cache.set('x', 'en', null)).not.toThrow();
    expect(() => cache.flush()).not.toThrow();
    expect(cache.get('x', 'en'), 'the memory tier still answers').toBeNull();
  });

  it('runs with no storage at all (server render)', () => {
    const cache = new AnchorBridgeCache(null, () => 1);
    cache.set('x', 'en', null);
    expect(cache.get('x', 'en')).toBeNull();
  });
});

describe('bridgeTerm -- one resolution, ever', () => {
  it('resolves once and serves every later ask from cache', async () => {
    const cache = new AnchorBridgeCache(memStorage(), () => 1);
    const resolve = vi.fn(async () => SAMSUNG);
    expect((await bridgeTerm('삼성전자', 'ko', { cache, resolve }))?.qid).toBe('Q20718');
    expect((await bridgeTerm('  삼성전자 ', 'ko', { cache, resolve }))?.qid).toBe('Q20718');
    expect(resolve, 'the second ask must not reach the network').toHaveBeenCalledTimes(1);
  });

  it('de-duplicates concurrent asks -- the tower mounts one block PER PAGE', async () => {
    const cache = new AnchorBridgeCache(memStorage(), () => 1);
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const resolve = vi.fn(async () => {
      await gate;
      return SAMSUNG;
    });
    const all = Promise.all(Array.from({ length: 12 }, () => bridgeTerm('samsung electronics', 'en', { cache, resolve })));
    release!();
    const hits = await all;
    expect(resolve, 'twelve mounted blocks, one request').toHaveBeenCalledTimes(1);
    expect(hits.every((h) => h?.qid === 'Q20718')).toBe(true);
  });

  it('caches a miss so an unresolvable term is asked once', async () => {
    const cache = new AnchorBridgeCache(memStorage(), () => 1);
    const resolve = vi.fn(async () => null);
    expect(await bridgeTerm('NEXUS-PRIME', 'en', { cache, resolve })).toBeNull();
    expect(await bridgeTerm('nexus-prime', 'en', { cache, resolve })).toBeNull();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('spends nothing at all on a term that is not worth resolving', async () => {
    const resolve = vi.fn(async () => SAMSUNG);
    expect(await bridgeTerm('...', 'en', { cache: new AnchorBridgeCache(null), resolve })).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('does not cache a timeout -- that is silence, not an answer', async () => {
    const cache = new AnchorBridgeCache(memStorage(), () => 1);
    const slow = vi.fn(
      (_t: string, _l: string, signal: AbortSignal) =>
        new Promise<ResolvedEntity | null>((resolve) => {
          signal.addEventListener('abort', () => resolve(null));
        }),
    );
    expect(await bridgeTerm('slow subject', 'en', { cache, resolve: slow, timeoutMs: 5 })).toBeNull();
    expect(cache.get('slow subject', 'en'), 'still unknown, so a later visit may try again').toBeUndefined();
  });

  it('swallows a resolver that throws', async () => {
    const resolve = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(bridgeTerm('offline subject', 'en', { cache: new AnchorBridgeCache(null), resolve })).resolves.toBeNull();
  });
});

describe('bridgeAnchor', () => {
  it('upgrades a text anchor to an entity anchor', async () => {
    const next = await bridgeAnchor(textAnchor('삼성전자', 'ko'), { cache: new AnchorBridgeCache(null), resolve: async () => SAMSUNG });
    expect(next?.kind).toBe('entity');
    expect(next?.qid).toBe('Q20718');
  });

  it('returns null when nothing changes, so the caller keeps what it had', async () => {
    const resolve = vi.fn(async () => SAMSUNG);
    expect(await bridgeAnchor(qidAnchor('Q20718', '삼성전자', 'ko'), { resolve })).toBeNull();
    expect(await bridgeAnchor(null, { resolve })).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
    expect(await bridgeAnchor(textAnchor('unknown subject', 'en'), { cache: new AnchorBridgeCache(null), resolve: async () => null })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe('THE GAP REV-25 EXISTS TO CLOSE: tower text anchor -> swarm field', () => {
  it('a text anchor offers ZERO lenses -- this is what the tower shipped', () => {
    expect(themesFor('tower', textAnchor('Samsung Electronics', 'en'))).toEqual([]);
  });

  it('the same term, bridged, reaches bigTechPulse -- and it leads the order', async () => {
    const bridged = await bridgeAnchor(textAnchor('Samsung Electronics', 'en'), {
      cache: new AnchorBridgeCache(null),
      resolve: async () => ({ ...SAMSUNG, lang: 'en', localeTitle: 'Samsung Electronics' }),
    });
    expect(bridged, 'the bridge must produce an anchor').not.toBeNull();
    const themes = themesFor('tower', bridged!);
    expect(themes.length).toBeGreaterThan(0);
    expect(themes[0].key, 'the swarm is the first tile the visitor sees').toBe('bigTechPulse');
    expect(themes.find((t) => t.key === 'bigTechPulse')!.needs).toBe('entity');
  });

  it('holds for every entity host, not just the tower', async () => {
    const bridged = await bridgeAnchor(textAnchor('Samsung Electronics', 'en'), {
      cache: new AnchorBridgeCache(null),
      resolve: async () => ({ ...SAMSUNG, lang: 'en', localeTitle: 'Samsung Electronics' }),
    });
    for (const host of ['tower', 'uaiPage', 'keywordTier', 'unitasProfile', 'feed'] as const) {
      expect(themesFor(host, textAnchor('Samsung Electronics', 'en')), host).toEqual([]);
      expect(
        themesFor(host, bridged!).some((t) => t.key === 'bigTechPulse'),
        host,
      ).toBe(true);
    }
  });
});
