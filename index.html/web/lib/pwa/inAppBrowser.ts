// In-app browser (embedded WebView) detection + automatic hand-off to the
// system browser (owner instruction 2026-09-07, comparative hardening item 2).
//
// WHY: a link opened inside Facebook / Instagram / Messenger / KakaoTalk /
// LINE / Naver / TikTok / ... lands in that app's embedded WebView, which has
// NO PWA install path: Chromium-based in-app views never fire
// `beforeinstallprompt`, and iOS WKWebViews have no "Add to Home Screen".
// The one-click install button would be a dead click there. So the moment
// such a container is recognised, the visitor is handed to the real system
// browser (Chrome / Safari / the default handler) where the native install
// dialog can open on the very next tap -- with NO manual "⋯ > open in
// browser" hunt.
//
// Two layers share ONE rule table (`IN_APP_VENDOR_RULES`):
//   1. `IN_APP_ESCAPE_BOOTSTRAP` -- an ES5 string injected into <head> by
//      app/layout.tsx, so the hand-off fires before first paint on a cold
//      load (throttled, see `AUTO_ESCAPE_THROTTLE_MS`).
//   2. The TypeScript API below (`detectInAppBrowser`, `buildEscapePlan`,
//      `attemptInAppEscape`) used by <PwaInstallHost/> on every install tap
//      and by <InAppBrowserEscape/> for the post-attempt fallback card.
//
// Everything here is pure except `attemptInAppEscape` / `readEscapeThrottle`.

export type InAppVendor =
  | 'facebook'
  | 'messenger'
  | 'instagram'
  | 'threads'
  | 'kakaotalk'
  | 'line'
  | 'naver'
  | 'daum'
  | 'band'
  | 'twitter'
  | 'tiktok'
  | 'snapchat'
  | 'wechat'
  | 'whatsapp'
  | 'telegram'
  | 'linkedin'
  | 'pinterest'
  | 'zalo'
  | 'viber'
  | 'discord'
  | 'google-app'
  | 'android-webview'
  | 'ios-webview';

export interface InAppVendorRule {
  vendor: InAppVendor;
  /** Case-sensitive on purpose where the marker is a proper token. */
  pattern: RegExp;
}

/**
 * Ordered, most-specific first. A UA is matched against the FIRST rule that
 * hits, so vendor-specific tokens must precede the generic WebView catch-alls.
 * Kept as real RegExps so the ES5 bootstrap below can be generated from the
 * same sources -- one table, two consumers.
 */
export const IN_APP_VENDOR_RULES: readonly InAppVendorRule[] = [
  { vendor: 'messenger', pattern: /MessengerForiOS|FB_IAB\/MESSENGER|Messenger\// },
  { vendor: 'facebook', pattern: /FBAN|FBAV|FB_IAB|FBIOS|FBSS|FBDV|FBBV|FBSV/ },
  { vendor: 'instagram', pattern: /Instagram/ },
  { vendor: 'threads', pattern: /Barcelona/ },
  { vendor: 'kakaotalk', pattern: /KAKAOTALK|KakaoTalk/ },
  { vendor: 'line', pattern: /\bLine\/|\bLIFF\b/ },
  { vendor: 'naver', pattern: /NAVER\(inapp|NAVER\/|naverapp|NaverSearch/i },
  { vendor: 'daum', pattern: /DaumApps|DaumDevice|daumapp/i },
  { vendor: 'band', pattern: /BAND\/|BANDApp|band_app/i },
  { vendor: 'twitter', pattern: /Twitter for|TwitterAndroid|XApp/ },
  { vendor: 'tiktok', pattern: /BytedanceWebview|Bytedance|musical_ly|TikTok|trill/ },
  { vendor: 'snapchat', pattern: /Snapchat/ },
  { vendor: 'wechat', pattern: /MicroMessenger/ },
  { vendor: 'whatsapp', pattern: /WhatsApp/ },
  { vendor: 'telegram', pattern: /TelegramBot|Telegram-Android|TelegramAndroid/ },
  { vendor: 'linkedin', pattern: /LinkedInApp/ },
  { vendor: 'pinterest', pattern: /Pinterest/ },
  { vendor: 'zalo', pattern: /Zalo/ },
  { vendor: 'viber', pattern: /Viber/ },
  { vendor: 'discord', pattern: /Discord/ },
  { vendor: 'google-app', pattern: /\bGSA\/|GoogleApp/ },
  // Generic Android System WebView: the `; wv)` token (Android 5+), or the
  // legacy "Version/4.0 ... Chrome" stock-WebView shape.
  { vendor: 'android-webview', pattern: /Android[^)]*;\s*wv\)|;\s*wv\)|Version\/\d+\.\d+.*Chrome\/\d+.*Mobile/ },
  // Generic iOS WKWebView: WebKit on an iOS device WITHOUT the `Safari/`
  // token every real browser (Safari, CriOS, FxiOS, EdgiOS...) carries.
  { vendor: 'ios-webview', pattern: /^(?=.*\b(iPhone|iPad|iPod)\b)(?=.*AppleWebKit)(?!.*Safari\/).*$/ },
];

/**
 * Real browsers whose UA happens to carry a generic-WebView shape (UC Browser
 * ships `Version/4.0 ... Chrome`, DuckDuckGo's Android browser is a WebView
 * with the `wv` token, ...). They are NOT in-app containers, so the two
 * generic catch-all rules must stand down for them; vendor-specific tokens
 * (FBAN, Instagram, KAKAOTALK...) always win regardless.
 */
export const REAL_BROWSER_EXCLUSION =
  /UCBrowser|SamsungBrowser|OPR\/|OPT\/|MiuiBrowser|EdgA\/|EdgiOS|YaBrowser|Whale\/|Puffin|DuckDuckGo|Brave|Vivaldi|Firefox|FxiOS|CriOS|HuaweiBrowser|HeyTapBrowser|VivoBrowser|OppoBrowser|Silk\/|Kiwi/;

const GENERIC_VENDORS: ReadonlySet<InAppVendor> = new Set(['android-webview', 'ios-webview']);

export type InAppPlatform = 'android' | 'ios' | 'other';

export function detectPlatform(ua: string): InAppPlatform {
  if (/Android/i.test(ua)) return 'android';
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return 'ios';
  // iPadOS 13+ Safari masquerades as macOS; a touch-capable Mac UA is an iPad.
  return 'other';
}

export interface InAppDetection {
  vendor: InAppVendor;
  platform: InAppPlatform;
}

/**
 * Pure: which in-app container (if any) is this UA? `standalone` callers must
 * pass `true` when the page runs as an installed app -- an iOS home-screen
 * web app also lacks the `Safari/` token, so it would otherwise read as a
 * WKWebView. Desktop UAs never match (in-app WebViews are a mobile problem).
 */
export function detectInAppBrowser(ua: string | null | undefined, standalone = false): InAppDetection | null {
  if (!ua || standalone) return null;
  const platform = detectPlatform(ua);
  if (platform === 'other') return null;
  const realBrowser = REAL_BROWSER_EXCLUSION.test(ua);
  for (const rule of IN_APP_VENDOR_RULES) {
    if (!rule.pattern.test(ua)) continue;
    if (realBrowser && GENERIC_VENDORS.has(rule.vendor)) return null;
    return { vendor: rule.vendor, platform };
  }
  return null;
}

export type EscapeStrategy =
  | 'kakao-external'
  | 'line-external'
  | 'android-intent'
  | 'ios-safari-scheme'
  | 'none';

export interface EscapePlan {
  strategy: EscapeStrategy;
  /** Navigating to this URL hands the page to the system browser. */
  url: string | null;
  /** Whether the strategy is known to reliably work for this container. */
  reliable: boolean;
}

/** Chrome's Android package -- the `intent://` pin used by every major KR/JP/global site. */
export const ANDROID_CHROME_PACKAGE = 'com.android.chrome';

function withQueryParam(href: string, key: string, value: string): string {
  const hash = href.indexOf('#');
  const base = hash === -1 ? href : href.slice(0, hash);
  const tail = hash === -1 ? '' : href.slice(hash);
  const sep = base.indexOf('?') === -1 ? '?' : '&';
  return `${base}${sep}${key}=${value}${tail}`;
}

/**
 * Pure: the hand-off URL for a detected container.
 *
 *   KakaoTalk (both OS)  -> kakaotalk://web/openExternal?url=<href>
 *   LINE (both OS)       -> <href>?openExternalBrowser=1
 *   any Android WebView  -> intent://host/path#Intent;scheme=https;
 *                           package=com.android.chrome;
 *                           S.browser_fallback_url=<href>;end
 *   any iOS WebView      -> x-safari-https://host/path  (Safari's own URL
 *                           scheme; honoured by most containers, silently
 *                           ignored by the few that block it -- the fallback
 *                           card then offers the one-tap copy path)
 */
export function buildEscapePlan(detection: InAppDetection | null, href: string): EscapePlan {
  if (!detection) return { strategy: 'none', url: null, reliable: false };
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { strategy: 'none', url: null, reliable: false };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { strategy: 'none', url: null, reliable: false };
  }
  const clean = url.toString();

  if (detection.vendor === 'kakaotalk') {
    return { strategy: 'kakao-external', url: `kakaotalk://web/openExternal?url=${encodeURIComponent(clean)}`, reliable: true };
  }
  if (detection.vendor === 'line') {
    return { strategy: 'line-external', url: withQueryParam(clean, 'openExternalBrowser', '1'), reliable: true };
  }
  if (detection.platform === 'android') {
    const scheme = url.protocol.replace(':', '');
    const intent =
      `intent://${url.host}${url.pathname}${url.search}${url.hash}` +
      `#Intent;scheme=${scheme};action=android.intent.action.VIEW;package=${ANDROID_CHROME_PACKAGE};` +
      `S.browser_fallback_url=${encodeURIComponent(clean)};end`;
    return { strategy: 'android-intent', url: intent, reliable: true };
  }
  if (detection.platform === 'ios') {
    const scheme = url.protocol === 'https:' ? 'x-safari-https' : 'x-safari-http';
    return {
      strategy: 'ios-safari-scheme',
      url: `${scheme}://${url.host}${url.pathname}${url.search}${url.hash}`,
      // Facebook / Instagram on iOS swallow foreign schemes; everything else
      // tends to honour it. Reported as best-effort so the UI keeps its card.
      reliable: !(detection.vendor === 'facebook' || detection.vendor === 'messenger' || detection.vendor === 'instagram' || detection.vendor === 'threads'),
    };
  }
  return { strategy: 'none', url: null, reliable: false };
}

/** localStorage key holding the epoch-ms of the last AUTOMATIC hand-off attempt. */
export const IN_APP_ESCAPE_THROTTLE_KEY = 'unitas.inapp.escape.at';
/** An automatic (page-load) hand-off is attempted at most once per window. */
export const AUTO_ESCAPE_THROTTLE_MS = 90_000;
/** `<html data-inapp="<vendor>">` stamp so CSS / React can read the verdict without re-sniffing. */
export const IN_APP_HTML_ATTR = 'data-inapp';
/** Window event fired after any hand-off attempt (detail: { auto, strategy }). */
export const IN_APP_ESCAPE_ATTEMPT_EVENT = 'unitas:inapp-escape-attempt';

/** Pure: should an automatic hand-off fire now, given the last attempt stamp? */
export function shouldAutoEscape(lastAttemptAt: number | null, now: number, throttleMs = AUTO_ESCAPE_THROTTLE_MS): boolean {
  if (lastAttemptAt === null || !Number.isFinite(lastAttemptAt)) return true;
  return now - lastAttemptAt >= throttleMs;
}

function readThrottle(): number | null {
  try {
    const raw = window.localStorage.getItem(IN_APP_ESCAPE_THROTTLE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeThrottle(now: number): void {
  try {
    window.localStorage.setItem(IN_APP_ESCAPE_THROTTLE_KEY, String(now));
  } catch {
    /* storage blocked -- the attempt still fires, just unthrottled */
  }
}

function isStandaloneHost(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      window.matchMedia?.('(display-mode: minimal-ui)').matches === true ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** Live detection against the current document (null on the server / in a real browser / as an installed app). */
export function currentInAppBrowser(): InAppDetection | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  return detectInAppBrowser(navigator.userAgent, isStandaloneHost());
}

/**
 * Navigates to the hand-off URL for the current container. `auto` attempts
 * are throttled; a tap (`auto = false`) always fires. Returns the plan used
 * (strategy `'none'` when there was nothing to do).
 */
export function attemptInAppEscape(options: { auto?: boolean; href?: string } = {}): EscapePlan {
  const detection = currentInAppBrowser();
  if (!detection) return { strategy: 'none', url: null, reliable: false };
  const href = options.href ?? window.location.href;
  const plan = buildEscapePlan(detection, href);
  if (!plan.url) return plan;
  const now = Date.now();
  if (options.auto && !shouldAutoEscape(readThrottle(), now)) {
    return { ...plan, strategy: 'none', url: null };
  }
  if (options.auto) writeThrottle(now);
  try {
    window.dispatchEvent(
      new CustomEvent(IN_APP_ESCAPE_ATTEMPT_EVENT, { detail: { auto: options.auto === true, strategy: plan.strategy } }),
    );
  } catch {
    /* no-op */
  }
  try {
    window.location.href = plan.url;
  } catch {
    /* an unsupported scheme throws on some engines -- the fallback card covers it */
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Pre-hydration bootstrap (ES5, generated from the same rule table)
// ---------------------------------------------------------------------------

function es5Regex(rule: InAppVendorRule): string {
  return `[${JSON.stringify(rule.vendor)},new RegExp(${JSON.stringify(rule.pattern.source)},${JSON.stringify(rule.pattern.flags)})]`;
}

/**
 * Injected verbatim into <head> by app/layout.tsx (after the PWA capture
 * bootstrap). On a cold load inside a recognised in-app container it:
 *   - stamps `<html data-inapp="<vendor>">` (React / CSS read it later);
 *   - fires the hand-off navigation automatically, at most once per
 *     `AUTO_ESCAPE_THROTTLE_MS`, so a visitor coming from a chat / social
 *     link is in the system browser without touching a single menu. The
 *     verdict + throttle stamp are taken pre-paint, but the navigation
 *     itself is deferred to `DOMContentLoaded`: a foreign-scheme navigation
 *     started while the parser is still running can stall the document in
 *     some Chromium builds (observed in headless E2E), whereas after the
 *     parse it is either honoured by the container or dropped harmlessly.
 * Skips: installed / standalone apps, `?splash=0` QA runs, desktop UAs, and
 * any URL carrying `inapp=stay` (a manual escape hatch for support).
 */
export const IN_APP_ESCAPE_BOOTSTRAP = `(function(){try{
var ua=String(navigator.userAgent||'');
if(!/Android|iPhone|iPad|iPod/.test(ua))return;
var sa=false;try{sa=(window.matchMedia&&(window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: minimal-ui)').matches))||navigator.standalone===true;}catch(_){}
if(sa)return;
if(/[?&](splash=(0|off|false)|inapp=stay)(&|$)/.test(location.search))return;
var rules=[${IN_APP_VENDOR_RULES.map(es5Regex).join(',')}];
var real=new RegExp(${JSON.stringify(REAL_BROWSER_EXCLUSION.source)}).test(ua);
var vendor=null;for(var i=0;i<rules.length;i++){if(rules[i][1].test(ua)){if(real&&(rules[i][0]==='android-webview'||rules[i][0]==='ios-webview'))return;vendor=rules[i][0];break;}}
if(!vendor)return;
try{document.documentElement.setAttribute('${IN_APP_HTML_ATTR}',vendor);}catch(_){}
var now=Date.now();var last=null;try{var raw=localStorage.getItem('${IN_APP_ESCAPE_THROTTLE_KEY}');if(raw){last=Number(raw);if(!isFinite(last))last=null;}}catch(_){}
if(last!==null&&now-last<${AUTO_ESCAPE_THROTTLE_MS})return;
try{localStorage.setItem('${IN_APP_ESCAPE_THROTTLE_KEY}',String(now));}catch(_){}
var href=String(location.href);var android=/Android/i.test(ua);var target=null;
if(vendor==='kakaotalk'){target='kakaotalk://web/openExternal?url='+encodeURIComponent(href);}
else if(vendor==='line'){var h=href.indexOf('#');var b=h===-1?href:href.slice(0,h);var t=h===-1?'':href.slice(h);target=b+(b.indexOf('?')===-1?'?':'&')+'openExternalBrowser=1'+t;}
else if(android){target='intent://'+location.host+location.pathname+location.search+location.hash+'#Intent;scheme='+location.protocol.replace(':','')+';action=android.intent.action.VIEW;package=${ANDROID_CHROME_PACKAGE};S.browser_fallback_url='+encodeURIComponent(href)+';end';}
else{target=(location.protocol==='https:'?'x-safari-https':'x-safari-http')+'://'+location.host+location.pathname+location.search+location.hash;}
if(!target)return;
var go=function(){try{window.dispatchEvent(new CustomEvent('${IN_APP_ESCAPE_ATTEMPT_EVENT}',{detail:{auto:true,strategy:'bootstrap'}}));}catch(_){}try{location.href=target;}catch(_){}};
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',go);}else{go();}
}catch(_){}})();`;
