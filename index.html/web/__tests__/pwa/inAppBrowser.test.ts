import { describe, expect, it } from 'vitest';
import {
  ANDROID_CHROME_PACKAGE,
  AUTO_ESCAPE_THROTTLE_MS,
  IN_APP_ESCAPE_BOOTSTRAP,
  IN_APP_ESCAPE_THROTTLE_KEY,
  IN_APP_HTML_ATTR,
  buildEscapePlan,
  detectInAppBrowser,
  shouldAutoEscape,
} from '../../lib/pwa/inAppBrowser';

// In-app browser detection + system-browser hand-off (lib/pwa/inAppBrowser.ts),
// owner instruction 2026-09-07 comparative hardening item 2. Fixtures are
// local to this file (CLAUDE.md "Module-level test isolation").

const UA = {
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  samsung:
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  ucBrowser:
    'Mozilla/5.0 (Linux; U; Android 9; en-US; SM-A105F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.108 UCBrowser/12.11.5.1185 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  iosStandalone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  fbAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908B Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.36.83;]',
  fbIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0.36.83;FBBV/...;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.4;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
  messengerIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/450.0.0;FBBV/...;FBDV/iPhone15,3]',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908B Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.40.92 Android',
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908B Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36;KAKAOTALK 10.6.5',
  kakaoIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.6.5',
  lineIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.5.0',
  naverAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908B Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.5.3)',
  tiktokAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908B Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 trill_2023 musical_ly_2023 BytedanceWebview/d8a21c6',
  genericAndroidWebView:
    'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.0.0 Mobile Safari/537.36',
  genericIosWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  duckduckgoAndroid:
    'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.0.0 Mobile DuckDuckGo/5 Safari/537.36',
};

describe('detectInAppBrowser', () => {
  it('returns null for every real browser and for desktop', () => {
    for (const ua of [UA.chromeAndroid, UA.safariIos, UA.chromeIos, UA.samsung, UA.desktopChrome]) {
      expect(detectInAppBrowser(ua)).toBeNull();
    }
  });

  it('never flags the installed (standalone) app -- even an iOS home-screen UA without the Safari token', () => {
    expect(detectInAppBrowser(UA.iosStandalone, true)).toBeNull();
    expect(detectInAppBrowser(UA.fbIos, true)).toBeNull();
  });

  it('identifies the major social / chat containers with the right platform', () => {
    expect(detectInAppBrowser(UA.fbAndroid)).toEqual({ vendor: 'facebook', platform: 'android' });
    expect(detectInAppBrowser(UA.fbIos)).toEqual({ vendor: 'facebook', platform: 'ios' });
    expect(detectInAppBrowser(UA.messengerIos)).toEqual({ vendor: 'messenger', platform: 'ios' });
    expect(detectInAppBrowser(UA.instagramAndroid)).toEqual({ vendor: 'instagram', platform: 'android' });
    expect(detectInAppBrowser(UA.kakaoAndroid)).toEqual({ vendor: 'kakaotalk', platform: 'android' });
    expect(detectInAppBrowser(UA.kakaoIos)).toEqual({ vendor: 'kakaotalk', platform: 'ios' });
    expect(detectInAppBrowser(UA.lineIos)).toEqual({ vendor: 'line', platform: 'ios' });
    expect(detectInAppBrowser(UA.naverAndroid)).toEqual({ vendor: 'naver', platform: 'android' });
    expect(detectInAppBrowser(UA.tiktokAndroid)).toEqual({ vendor: 'tiktok', platform: 'android' });
  });

  it('falls back to the generic WebView catch-alls', () => {
    expect(detectInAppBrowser(UA.genericAndroidWebView)).toEqual({ vendor: 'android-webview', platform: 'android' });
    expect(detectInAppBrowser(UA.genericIosWebView)).toEqual({ vendor: 'ios-webview', platform: 'ios' });
  });

  it('stands the generic catch-alls down for real browsers with WebView-shaped UAs', () => {
    expect(detectInAppBrowser(UA.ucBrowser)).toBeNull();
    expect(detectInAppBrowser(UA.duckduckgoAndroid)).toBeNull();
  });

  it('is null-safe', () => {
    expect(detectInAppBrowser(null)).toBeNull();
    expect(detectInAppBrowser(undefined)).toBeNull();
    expect(detectInAppBrowser('')).toBeNull();
  });
});

describe('buildEscapePlan', () => {
  const href = 'https://www.theunitas.global/ko?ref=x#top';

  it('does nothing without a detection or for a non-http URL', () => {
    expect(buildEscapePlan(null, href).strategy).toBe('none');
    expect(buildEscapePlan({ vendor: 'facebook', platform: 'android' }, 'about:blank').strategy).toBe('none');
    expect(buildEscapePlan({ vendor: 'facebook', platform: 'android' }, 'not a url').strategy).toBe('none');
  });

  it('uses the KakaoTalk external-open scheme on both platforms', () => {
    for (const platform of ['android', 'ios'] as const) {
      const plan = buildEscapePlan({ vendor: 'kakaotalk', platform }, href);
      expect(plan.strategy).toBe('kakao-external');
      expect(plan.url).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`);
      expect(plan.reliable).toBe(true);
    }
  });

  it('appends openExternalBrowser=1 for LINE, keeping the hash last', () => {
    const plan = buildEscapePlan({ vendor: 'line', platform: 'android' }, href);
    expect(plan.strategy).toBe('line-external');
    expect(plan.url).toBe('https://www.theunitas.global/ko?ref=x&openExternalBrowser=1#top');
    const noQuery = buildEscapePlan({ vendor: 'line', platform: 'ios' }, 'https://www.theunitas.global/ko');
    expect(noQuery.url).toBe('https://www.theunitas.global/ko?openExternalBrowser=1');
  });

  it('builds a Chrome-pinned intent:// URL with a fallback for any other Android container', () => {
    const plan = buildEscapePlan({ vendor: 'facebook', platform: 'android' }, href);
    expect(plan.strategy).toBe('android-intent');
    expect(plan.url).toBe(
      `intent://www.theunitas.global/ko?ref=x#top#Intent;scheme=https;action=android.intent.action.VIEW;package=${ANDROID_CHROME_PACKAGE};S.browser_fallback_url=${encodeURIComponent(href)};end`,
    );
    expect(plan.reliable).toBe(true);
  });

  it("uses Safari's x-safari-https scheme on iOS, flagged best-effort for Meta containers", () => {
    const naver = buildEscapePlan({ vendor: 'naver', platform: 'ios' }, href);
    expect(naver.strategy).toBe('ios-safari-scheme');
    expect(naver.url).toBe('x-safari-https://www.theunitas.global/ko?ref=x#top');
    expect(naver.reliable).toBe(true);
    const fb = buildEscapePlan({ vendor: 'facebook', platform: 'ios' }, href);
    expect(fb.strategy).toBe('ios-safari-scheme');
    expect(fb.reliable).toBe(false);
  });
});

describe('shouldAutoEscape', () => {
  it('fires on the first visit and again only after the throttle window', () => {
    expect(shouldAutoEscape(null, 1_000_000)).toBe(true);
    expect(shouldAutoEscape(1_000_000, 1_000_000 + AUTO_ESCAPE_THROTTLE_MS - 1)).toBe(false);
    expect(shouldAutoEscape(1_000_000, 1_000_000 + AUTO_ESCAPE_THROTTLE_MS)).toBe(true);
    expect(shouldAutoEscape(Number.NaN, 5)).toBe(true);
  });
});

// --- pre-hydration bootstrap ------------------------------------------------

interface HostOptions {
  ua: string;
  href?: string;
  standalone?: boolean;
  search?: string;
  storage?: Record<string, string>;
  readyState?: 'loading' | 'interactive' | 'complete';
}

function runBootstrap(opts: HostOptions) {
  const storage: Record<string, string> = { ...(opts.storage ?? {}) };
  const attrs: Record<string, string> = {};
  const url = new URL(opts.href ?? 'https://www.theunitas.global/ko');
  const location = {
    href: url.toString(),
    host: url.host,
    pathname: url.pathname,
    search: opts.search ?? url.search,
    hash: url.hash,
    protocol: url.protocol,
  };
  const navigated: string[] = [];
  const locProxy = new Proxy(location, {
    set(target, key, value) {
      if (key === 'href') navigated.push(String(value));
      (target as Record<string | symbol, unknown>)[key] = value;
      return true;
    },
  });
  const events: string[] = [];
  const win = {
    matchMedia: () => ({ matches: opts.standalone === true }),
    dispatchEvent: (e: { type: string }) => {
      events.push(e.type);
      return true;
    },
  };
  const navigator = { userAgent: opts.ua, standalone: false };
  const deferred: Array<() => void> = [];
  const document = {
    readyState: opts.readyState ?? 'complete',
    addEventListener: (type: string, fn: () => void) => {
      if (type === 'DOMContentLoaded') deferred.push(fn);
    },
    documentElement: {
      setAttribute: (k: string, v: string) => {
        attrs[k] = v;
      },
    },
    cookie: '',
  };
  const localStorage = {
    getItem: (k: string) => (k in storage ? storage[k] : null),
    setItem: (k: string, v: string) => {
      storage[k] = v;
    },
    removeItem: (k: string) => {
      delete storage[k];
    },
  };
  class CustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  new Function('window', 'navigator', 'document', 'location', 'localStorage', 'CustomEvent', IN_APP_ESCAPE_BOOTSTRAP)(
    win,
    navigator,
    document,
    locProxy,
    localStorage,
    CustomEvent,
  );
  return { navigated, attrs, storage, events, deferred, fireDomContentLoaded: () => deferred.splice(0).forEach((fn) => fn()) };
}

describe('IN_APP_ESCAPE_BOOTSTRAP', () => {
  it('parses as a standalone ES5 script', () => {
    expect(() => new Function(IN_APP_ESCAPE_BOOTSTRAP)).not.toThrow();
  });

  it('is inert in a real browser, on desktop, and in the installed app', () => {
    for (const ua of [UA.chromeAndroid, UA.safariIos, UA.desktopChrome]) {
      const r = runBootstrap({ ua });
      expect(r.navigated).toEqual([]);
      expect(r.attrs[IN_APP_HTML_ATTR]).toBeUndefined();
    }
    const app = runBootstrap({ ua: UA.iosStandalone, standalone: true });
    expect(app.navigated).toEqual([]);
  });

  it('stamps the vendor and hands an Android Facebook visitor to Chrome before paint', () => {
    const r = runBootstrap({ ua: UA.fbAndroid, href: 'https://www.theunitas.global/ko?ref=x' });
    expect(r.attrs[IN_APP_HTML_ATTR]).toBe('facebook');
    expect(r.navigated).toHaveLength(1);
    expect(r.navigated[0]).toMatch(/^intent:\/\/www\.theunitas\.global\/ko\?ref=x#Intent;scheme=https;/);
    expect(r.navigated[0]).toContain(`package=${ANDROID_CHROME_PACKAGE}`);
    expect(r.storage[IN_APP_ESCAPE_THROTTLE_KEY]).toMatch(/^\d+$/);
    expect(r.events).toContain('unitas:inapp-escape-attempt');
  });

  it('uses the vendor schemes for KakaoTalk / LINE and x-safari on iOS', () => {
    expect(runBootstrap({ ua: UA.kakaoIos }).navigated[0]).toMatch(/^kakaotalk:\/\/web\/openExternal\?url=/);
    expect(runBootstrap({ ua: UA.lineIos }).navigated[0]).toBe('https://www.theunitas.global/ko?openExternalBrowser=1');
    expect(runBootstrap({ ua: UA.fbIos }).navigated[0]).toBe('x-safari-https://www.theunitas.global/ko');
  });

  it('throttles the automatic hand-off to once per window', () => {
    const recent = String(Date.now() - 1000);
    const r = runBootstrap({ ua: UA.fbAndroid, storage: { [IN_APP_ESCAPE_THROTTLE_KEY]: recent } });
    expect(r.attrs[IN_APP_HTML_ATTR]).toBe('facebook');
    expect(r.navigated).toEqual([]);
    expect(r.storage[IN_APP_ESCAPE_THROTTLE_KEY]).toBe(recent);
    const stale = String(Date.now() - AUTO_ESCAPE_THROTTLE_MS - 1);
    expect(runBootstrap({ ua: UA.fbAndroid, storage: { [IN_APP_ESCAPE_THROTTLE_KEY]: stale } }).navigated).toHaveLength(1);
  });

  it('takes the verdict + throttle pre-paint but defers the navigation to DOMContentLoaded while parsing', () => {
    const r = runBootstrap({ ua: UA.fbAndroid, readyState: 'loading' });
    expect(r.attrs[IN_APP_HTML_ATTR]).toBe('facebook');
    expect(r.storage[IN_APP_ESCAPE_THROTTLE_KEY]).toMatch(/^\d+$/);
    expect(r.navigated).toEqual([]);
    expect(r.deferred).toHaveLength(1);
    r.fireDomContentLoaded();
    expect(r.navigated).toHaveLength(1);
    expect(r.events).toContain('unitas:inapp-escape-attempt');
  });

  it('respects the QA / support escape hatches', () => {
    expect(runBootstrap({ ua: UA.fbAndroid, search: '?splash=0' }).navigated).toEqual([]);
    expect(runBootstrap({ ua: UA.fbAndroid, search: '?inapp=stay' }).navigated).toEqual([]);
  });

  it('stands down for real browsers with WebView-shaped UAs', () => {
    expect(runBootstrap({ ua: UA.ucBrowser }).navigated).toEqual([]);
    expect(runBootstrap({ ua: UA.duckduckgoAndroid }).navigated).toEqual([]);
  });
});
