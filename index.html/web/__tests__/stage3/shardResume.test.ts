import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aggregateShards,
  nextShard,
  recordShard,
  shardState,
  shardsComplete,
  SWEEP_PROJECTS,
} from '../../scripts/idle-sensor-core.mjs';

// REV-39 M1 -- the "준비"/Resume semantics of Codex ch.13. Every sweep before
// this shipped ended `cancelled`, because a ~1.5 h 3-engine pass never fit in a
// real idle window and the whole run was discarded. Sharding per project plus a
// checkpoint means an interruption costs one project, not the suite.

const KEY = 'BUILDID@headsha';

function summaryFor(project: string, counts: Partial<Record<string, number>> = {}) {
  return {
    perProject: { [project]: { expected: counts.expected ?? 10, unexpected: counts.unexpected ?? 0, flaky: 0, skipped: counts.skipped ?? 1 } },
    totals: { expected: counts.expected ?? 10, unexpected: counts.unexpected ?? 0, flaky: 0, skipped: counts.skipped ?? 1 },
    failures: counts.unexpected ? [{ project, file: 'a.spec.js', title: 't', error: 'boom', kind: 'product-defect' }] : [],
  };
}

describe('shardState', () => {
  it('starts empty and keeps well-formed shards for the same key', () => {
    expect(shardState(null, KEY)).toEqual({ key: KEY, shards: {} });
    const raw = { key: KEY, shards: { chromium: { expected: 5, unexpected: 0, flaky: 0, skipped: 1, failures: [], finishedAt: 'x' } } };
    expect(Object.keys(shardState(raw, KEY).shards)).toEqual(['chromium']);
  });

  it('DISCARDS every shard when the build or HEAD changed', () => {
    const raw = { key: 'OTHER@sha', shards: { chromium: { expected: 5, unexpected: 0, flaky: 0, skipped: 0, failures: [], finishedAt: 'x' } } };
    expect(shardState(raw, KEY)).toEqual({ key: KEY, shards: {} });
  });

  it('drops malformed shard rows rather than trusting them', () => {
    const raw = { key: KEY, shards: { chromium: { expected: 'many' }, webkit: null, tablet: { expected: 1, unexpected: 0 } } };
    expect(Object.keys(shardState(raw, KEY).shards)).toEqual(['tablet']);
  });
});

describe('nextShard / recordShard / shardsComplete', () => {
  it('walks the projects in order and stops when the suite is done', () => {
    let p = shardState(null, KEY);
    const walked: string[] = [];
    for (let i = 0; i < SWEEP_PROJECTS.length; i++) {
      const next = nextShard(p);
      expect(next).toBe(SWEEP_PROJECTS[i]);
      walked.push(next!);
      expect(shardsComplete(p)).toBe(false);
      p = recordShard(p, next!, summaryFor(next!), `2026-09-16T0${i}:00:00.000Z`);
    }
    expect(walked).toEqual([...SWEEP_PROJECTS]);
    expect(nextShard(p)).toBeNull();
    expect(shardsComplete(p)).toBe(true);
  });

  it('a cancelled shard is simply not recorded, so it is retried next window', () => {
    let p = shardState(null, KEY);
    p = recordShard(p, 'chromium', summaryFor('chromium'), 't1');
    // webkit was cancelled -> nothing recorded for it
    expect(nextShard(p)).toBe('webkit');
    expect(Object.keys(p.shards)).toEqual(['chromium']);
  });
});

describe('aggregateShards', () => {
  it('folds every shard into one summary the reader already understands', () => {
    let p = shardState(null, KEY);
    for (const project of SWEEP_PROJECTS) p = recordShard(p, project, summaryFor(project, { expected: 100, skipped: 5 }), '2026-09-16T05:00:00.000Z');
    const agg = aggregateShards(p, { buildId: 'BUILDID', head: 'headsha', startedAt: '2026-09-16T00:00:00.000Z', finishedAt: '2026-09-16T05:00:00.000Z' });
    expect(agg.status).toBe('passed');
    expect(agg.totals.expected).toBe(100 * SWEEP_PROJECTS.length);
    expect(agg.totals.skipped).toBe(5 * SWEEP_PROJECTS.length);
    expect(agg.shardedProjects).toEqual([...SWEEP_PROJECTS]);
    expect(Object.keys(agg.perProject)).toEqual([...SWEEP_PROJECTS]);
    expect(agg.durationMs).toBe(5 * 3600 * 1000);
  });

  it('is failed when any shard carried an unexpected result, and carries its failures', () => {
    let p = shardState(null, KEY);
    for (const project of SWEEP_PROJECTS) {
      p = recordShard(p, project, summaryFor(project, project === 'webkit' ? { unexpected: 2 } : {}), 't');
    }
    const agg = aggregateShards(p, { buildId: 'B', head: 'H', startedAt: 't', finishedAt: 't' });
    expect(agg.status).toBe('failed');
    expect(agg.totals.unexpected).toBe(2);
    expect(agg.failures.length).toBeGreaterThan(0);
  });
});

describe('project list drift gate', () => {
  it('the core list matches tests/web-cinema.config.js metadata.sweepProjects', () => {
    const cfg = readFileSync(join(__dirname, '../../../tests/web-cinema.config.js'), 'utf8');
    const m = cfg.match(/sweepProjects:\s*\[([^\]]*)\]/);
    expect(m, 'config must declare metadata.sweepProjects').not.toBeNull();
    const declared = m![1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    expect(declared).toEqual([...SWEEP_PROJECTS]);
    // Every declared project must also be a real Playwright project.
    for (const p of declared) expect(cfg).toContain(`name: '${p}'`);
  });
});
