import { describe, expect, it } from 'vitest';
import { STANDALONE_LAUNCH_BOOTSTRAP, standaloneLaunchTarget } from '../../lib/pwa/standaloneLaunch';
import { LOCALE_PREF_COOKIE } from '../../lib/i18n/localePreference';

// Installed-app launch fast-path (lib/pwa/standaloneLaunch.ts), owner
// instruction 2026-09-07 comparative hardening item 4. Fixtures local to
// this file (CLAUDE.md "Module-level test isolation").

describe('standaloneLaunchTarget', () => {
  it('rewrites a standalone root launch to the persisted non-default locale', () => {
    expect(standaloneLaunchTarget({ standalone: true, pathname: '/', preferredLocale: 'ko' })).toBe('/ko');
    expect(standaloneLaunchTarget({ standalone: true, pathname: '/', preferredLocale: ' KM ' })).toBe('/km');
    expect(standaloneLaunchTarget({ standalone: true, pathname: '/', preferredLocale: 'ja', search: '?a=1', hash: '#x' })).toBe(
      '/ja?a=1#x',
    );
  });

  it('leaves online (browser tab) launches alone -- root stays English for SEO', () => {
    expect(standaloneLaunchTarget({ standalone: false, pathname: '/', preferredLocale: 'ko' })).toBeNull();
  });

  it('only ever touches the bare root', () => {
    expect(standaloneLaunchTarget({ standalone: true, pathname: '/ko', preferredLocale: 'ja' })).toBeNull();
    expect(standaloneLaunchTarget({ standalone: true, pathname: '/company/about', preferredLocale: 'ko' })).toBeNull();
  });

  it('ignores the default locale, unknown locales and empty preferences', () => {
    expect(standaloneLaunchTarget({ standalone: true, pathname: '/', preferredLocale: 'en' })).toBeNull();
    expect(standaloneLaunchTarget({ standalone: true, pathname: '/', preferredLocale: 'xx' })).toBeNull();
    expect(standaloneLaunchTarget({ standalone: true, pathname: '/', preferredLocale: null })).toBeNull();
    expect(standaloneLaunchTarget({ standalone: true, pathname: '/', preferredLocale: '   ' })).toBeNull();
  });
});

interface HostOptions {
  standalone: boolean;
  pathname?: string;
  search?: string;
  hash?: string;
  storage?: Record<string, string>;
  cookie?: string;
}

function runBootstrap(opts: HostOptions) {
  const replaced: string[] = [];
  const attrs: Record<string, string> = {};
  const storage = { ...(opts.storage ?? {}) };
  const win = { matchMedia: () => ({ matches: opts.standalone }) };
  const navigator = { standalone: false };
  const document = {
    cookie: opts.cookie ?? '',
    documentElement: {
      setAttribute: (k: string, v: string) => {
        attrs[k] = v;
      },
    },
  };
  const location = {
    pathname: opts.pathname ?? '/',
    search: opts.search ?? '',
    hash: opts.hash ?? '',
    replace: (href: string) => replaced.push(href),
  };
  const localStorage = { getItem: (k: string) => (k in storage ? storage[k] : null) };
  new Function('window', 'navigator', 'document', 'location', 'localStorage', STANDALONE_LAUNCH_BOOTSTRAP)(
    win,
    navigator,
    document,
    location,
    localStorage,
  );
  return { replaced, attrs };
}

describe('STANDALONE_LAUNCH_BOOTSTRAP', () => {
  it('parses as a standalone ES5 script', () => {
    expect(() => new Function(STANDALONE_LAUNCH_BOOTSTRAP)).not.toThrow();
  });

  it('redirects a standalone root launch pre-paint to the persisted locale', () => {
    const r = runBootstrap({ standalone: true, storage: { [LOCALE_PREF_COOKIE]: 'ko' }, search: '?q=1', hash: '#h' });
    expect(r.replaced).toEqual(['/ko?q=1#h']);
    expect(r.attrs['data-standalone-launch']).toBe('ko');
  });

  it('falls back to the cookie when localStorage is empty', () => {
    const r = runBootstrap({ standalone: true, cookie: `x=1; ${LOCALE_PREF_COOKIE}=ja; y=2` });
    expect(r.replaced).toEqual(['/ja']);
  });

  it('is a no-op online, on sub-paths, for English and for unknown locales', () => {
    expect(runBootstrap({ standalone: false, storage: { [LOCALE_PREF_COOKIE]: 'ko' } }).replaced).toEqual([]);
    expect(runBootstrap({ standalone: true, pathname: '/ko', storage: { [LOCALE_PREF_COOKIE]: 'ja' } }).replaced).toEqual([]);
    expect(runBootstrap({ standalone: true, storage: { [LOCALE_PREF_COOKIE]: 'en' } }).replaced).toEqual([]);
    expect(runBootstrap({ standalone: true, storage: { [LOCALE_PREF_COOKIE]: 'zz' } }).replaced).toEqual([]);
    expect(runBootstrap({ standalone: true }).replaced).toEqual([]);
  });
});
