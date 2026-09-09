import { describe, expect, it } from 'vitest';
import { createPrecache, type PrecacheRouter } from '../../lib/quantumWhite/precache';
import { ALL_CLUSTER_MODULES, findCluster, type ClusterModule } from '../../lib/quantumWhite/clusters';

// Module-level test isolation (CLAUDE.md). `createPrecache` schedules its
// network-touching prefetch via requestIdleCallback with a setTimeout(…,1)
// fallback -- vitest's `environment: 'node'` has neither `window` nor
// `requestIdleCallback`, so every call here exercises the setTimeout path.
// A short real-timer flush is enough to observe the deferred work land.

function makeFakeRouter(throwOnHref?: string): { router: PrecacheRouter; calls: string[] } {
  const calls: string[] = [];
  const router: PrecacheRouter = {
    prefetch(href: string) {
      calls.push(href);
      if (href === throwOnHref) throw new Error('router.prefetch boom');
    },
  };
  return { router, calls };
}

function flushIdle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

function firstRoutedModule(): ClusterModule {
  const m = ALL_CLUSTER_MODULES.find((mod) => mod.hasRoute);
  if (!m) throw new Error('fixture assumption broken: no routed module in ALL_CLUSTER_MODULES');
  return m;
}

function firstLockInModule(): ClusterModule {
  const m = ALL_CLUSTER_MODULES.find((mod) => mod.kind === 'lockin');
  if (!m) throw new Error('fixture assumption broken: no lock-in module in ALL_CLUSTER_MODULES');
  return m;
}

describe('createPrecache: warmModule', () => {
  it('prefetches a hasRoute module exactly once per precache instance no matter how many times it is warmed', async () => {
    const { router, calls } = makeFakeRouter();
    const precache = createPrecache(router);
    const m = firstRoutedModule();

    precache.warmModule(m);
    precache.warmModule(m);
    precache.warmModule(m);
    await flushIdle();

    expect(calls.filter((h) => h === m.href)).toHaveLength(1);
  });

  it('marks the module warm synchronously and pins it for instant resolve()', () => {
    const { router } = makeFakeRouter();
    const precache = createPrecache(router);
    const m = firstRoutedModule();

    precache.warmModule(m);

    expect(precache.isWarm(m.id)).toBe(true);
    expect(precache.resolve(m.id)).toBe(m);
  });

  it('never calls router.prefetch for a module with hasRoute:false (lock-ins have no route)', async () => {
    const { router, calls } = makeFakeRouter();
    const precache = createPrecache(router);
    const lockin = firstLockInModule();
    expect(lockin.hasRoute).toBe(false);

    precache.warmModule(lockin);
    await flushIdle();

    expect(calls).toHaveLength(0);
    expect(precache.isWarm(lockin.id)).toBe(true);
    expect(precache.resolve(lockin.id)).toBe(lockin);
  });

  it('never throws when router.prefetch throws synchronously', async () => {
    const m = firstRoutedModule();
    const { router } = makeFakeRouter(m.href);
    const precache = createPrecache(router);

    expect(() => precache.warmModule(m)).not.toThrow();
    await flushIdle();

    // The warm-up is purely decorative: a failed prefetch still leaves the
    // module marked warm so the UI doesn't retry it forever.
    expect(precache.isWarm(m.id)).toBe(true);
  });

  it('never throws and never produces an unhandled rejection when router.prefetch returns a rejected promise', async () => {
    const m = firstRoutedModule();
    const router: PrecacheRouter = {
      // A `void`-returning function type accepts any return value in TS, so
      // this models a real Next.js router.prefetch() that returns a promise.
      prefetch: () => Promise.reject(new Error('async boom')),
    };
    const precache = createPrecache(router);

    expect(() => precache.warmModule(m)).not.toThrow();
    await flushIdle();

    expect(precache.isWarm(m.id)).toBe(true);
  });
});

describe('createPrecache: warmCluster', () => {
  it('warms every module in the cluster exactly once each and prefetches only the routed ones', async () => {
    const { router, calls } = makeFakeRouter();
    const precache = createPrecache(router);
    const cluster = findCluster('cognitive');

    precache.warmCluster(cluster);
    await flushIdle();

    for (const m of cluster.modules) {
      expect(precache.isWarm(m.id)).toBe(true);
    }
    const expectedHrefs = cluster.modules.filter((m) => m.hasRoute).map((m) => m.href).sort();
    expect(calls.slice().sort()).toEqual(expectedHrefs);
  });

  it('does not re-prefetch modules already warmed individually', async () => {
    const { router, calls } = makeFakeRouter();
    const precache = createPrecache(router);
    const cluster = findCluster('live');
    const first = cluster.modules[0];

    precache.warmModule(first);
    precache.warmCluster(cluster);
    await flushIdle();

    expect(calls.filter((h) => h === first.href)).toHaveLength(1);
  });
});

describe('createPrecache: dispose', () => {
  it('is idempotent and never throws', () => {
    const { router } = makeFakeRouter();
    const precache = createPrecache(router);
    precache.warmModule(firstRoutedModule());

    expect(() => precache.dispose()).not.toThrow();
    expect(() => precache.dispose()).not.toThrow();
  });

  it('stops warmModule from doing any further work once disposed', () => {
    const { router, calls } = makeFakeRouter();
    const precache = createPrecache(router);
    precache.dispose();

    const m = firstRoutedModule();
    precache.warmModule(m);

    expect(precache.isWarm(m.id)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
