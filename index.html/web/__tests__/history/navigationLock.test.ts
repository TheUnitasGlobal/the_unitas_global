import { afterEach, describe, expect, it } from 'vitest';
import { NAVIGATION_LOCK_MS, __setNavigationClock, beginNavigation, endNavigation, navigationInFlight } from '@/lib/history/navigationLock';
import { LOCALE_SWITCH_MARKER_KEY, MARKER_TTL_MS, readLocaleSwitchMarker, writeLocaleSwitchMarker } from '@/lib/i18n/localeSwitchMarker';

// REV-21 SPEC.md §4.1 F1 / F3 -- the navigation lock a locale switch raises
// so unmounting modal layers release without traversing history, and the
// continuity marker the new locale tree restores scroll / focus from.

afterEach(() => __setNavigationClock());

describe('navigationLock', () => {
  it('is in flight from beginNavigation until the traversal budget elapses or endNavigation', () => {
    let now = 1000;
    __setNavigationClock(() => now);
    expect(navigationInFlight()).toBe(false);
    beginNavigation();
    expect(navigationInFlight()).toBe(true);
    now += NAVIGATION_LOCK_MS - 1;
    expect(navigationInFlight()).toBe(true);
    now += 2;
    expect(navigationInFlight()).toBe(false);
    beginNavigation(50);
    expect(navigationInFlight()).toBe(true);
    endNavigation();
    expect(navigationInFlight()).toBe(false);
  });

  it('never shortens an existing lock', () => {
    let now = 0;
    __setNavigationClock(() => now);
    beginNavigation(1000);
    beginNavigation(10);
    now = 500;
    expect(navigationInFlight()).toBe(true);
  });
});

describe('localeSwitchMarker', () => {
  function fakeStore() {
    const data: Record<string, string> = {};
    return {
      data,
      getItem: (k: string) => (k in data ? data[k] : null),
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
      removeItem: (k: string) => {
        delete data[k];
      },
    };
  }

  it('round-trips a fresh marker once and rejects a stale or malformed one', () => {
    const s = fakeStore();
    writeLocaleSwitchMarker({ scrollY: 900, focused: true, uaiQuery: '공기' }, s, 10_000);
    expect(JSON.parse(s.data[LOCALE_SWITCH_MARKER_KEY]).typing).toBe(false);
    const read = readLocaleSwitchMarker(s, 12_000);
    expect(read).toMatchObject({ scrollY: 900, focused: true, typing: false, uaiQuery: '공기', towerOpen: false, at: 10_000 });
    expect(readLocaleSwitchMarker(s, 12_000)).toBeNull(); // consumed
    writeLocaleSwitchMarker({ scrollY: 1 }, s, 10_000);
    expect(readLocaleSwitchMarker(s, 10_000 + MARKER_TTL_MS + 1)).toBeNull();
    s.setItem(LOCALE_SWITCH_MARKER_KEY, '{not json');
    expect(readLocaleSwitchMarker(s, 1)).toBeNull();
    expect(readLocaleSwitchMarker(null)).toBeNull();
  });
});
