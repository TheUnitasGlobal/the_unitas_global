// Standalone (installed app) launch fast-path (owner instruction 2026-09-07,
// comparative hardening item 4: "세션 동기화 -- 단 1초 만에 자율 입장").
//
// The manifest's `start_url` is the bare root (`/`), which -- per the
// root single-URL SEO architecture (2026-09-06) -- always renders ENGLISH on
// the server; the visitor's persisted language (lib/i18n/localePreference.ts)
// is re-applied only after hydration, by ComingSoonCinema's locale-restore
// effect (`router.replace(pathname, { locale })`). On a phone that is a
// visible beat: an English first paint, then a client navigation, then the
// real language. Inside the INSTALLED app there is no SEO concern at all --
// no crawler ever launches a home-screen icon -- so this pre-hydration
// bootstrap reads the same preference and `location.replace`s straight to
// `/<locale>` BEFORE first paint. One document, one splash, the right
// language from byte zero. Online (browser tab) launches are untouched:
// `/` stays English there exactly as the SEO doctrine demands.
//
// Pure predicate `standaloneLaunchTarget()` is unit-tested; the ES5 string is
// generated from the same locale table.

import { routing } from '@/i18n/routing';
import { LOCALE_PREF_COOKIE } from '@/lib/i18n/localePreference';

export interface StandaloneLaunchInput {
  /** `display-mode: standalone` / `minimal-ui`, or iOS `navigator.standalone`. */
  standalone: boolean;
  pathname: string;
  /** The persisted manual language pick (localStorage / cookie), if any. */
  preferredLocale: string | null;
  search?: string;
  hash?: string;
}

/**
 * Pure: the path an installed-app launch should be redirected to, or null
 * when the current document is already right. Only the bare root (the
 * manifest `start_url`) is ever rewritten, and only to a supported
 * NON-default locale -- the default locale lives at `/` by design.
 */
export function standaloneLaunchTarget(input: StandaloneLaunchInput): string | null {
  if (!input.standalone) return null;
  const path = input.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/') return null;
  const pref = (input.preferredLocale ?? '').trim().toLowerCase();
  if (!pref || pref === routing.defaultLocale) return null;
  if (!(routing.locales as readonly string[]).includes(pref)) return null;
  return `/${pref}${input.search ?? ''}${input.hash ?? ''}`;
}

/**
 * Injected into <head> by app/layout.tsx. Must run AFTER the PWA capture
 * bootstrap (which wipes sessionStorage on a fresh entry) and BEFORE the
 * entry-chime bootstrap (so the chime arms on the final document only).
 * Reads localStorage first, the `unitas_locale_pref` cookie second, exactly
 * like `readLocalePreference()`.
 */
export const STANDALONE_LAUNCH_BOOTSTRAP = `(function(){try{
var sa=false;try{sa=(window.matchMedia&&(window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: minimal-ui)').matches))||navigator.standalone===true;}catch(_){}
if(!sa)return;
var path=String(location.pathname||'/').replace(/\\/+$/,'')||'/';
if(path!=='/')return;
var pref=null;try{pref=localStorage.getItem('${LOCALE_PREF_COOKIE}');}catch(_){}
if(!pref){try{var m=document.cookie.match(/(?:^|; )${LOCALE_PREF_COOKIE}=([^;]*)/);if(m)pref=decodeURIComponent(m[1]);}catch(_){}}
if(!pref)return;
pref=String(pref).trim().toLowerCase();
if(!pref||pref==='${routing.defaultLocale}')return;
if(${JSON.stringify([...routing.locales])}.indexOf(pref)===-1)return;
try{document.documentElement.setAttribute('data-standalone-launch',pref);}catch(_){}
location.replace('/'+pref+String(location.search||'')+String(location.hash||''));
}catch(_){}})();`;
