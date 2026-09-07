// Shared, omni-channel locale preference persistence (owner instruction
// 2026-09-06, item 5): every manual language switch, from ANY surface
// (GlobalLanguagePicker on the entry gate/cinematic, LanguageSwitcher in the
// nav bar), writes here so a returning visit -- on any page, any device --
// re-applies it without a manual reselect. Dual-written to localStorage AND
// a cookie: localStorage is the primary read path, the cookie is a fallback
// for a browser/mode that blocks storage but still allows cookies.

export const LOCALE_PREF_COOKIE = 'unitas_locale_pref';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function persistLocalePreference(locale: string): void {
  try {
    window.localStorage.setItem(LOCALE_PREF_COOKIE, locale);
  } catch {
    /* storage blocked -- the cookie write below still covers this browser */
  }
  try {
    document.cookie = `${LOCALE_PREF_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
  } catch {
    /* cookies blocked -- localStorage above still covers same-browser return visits */
  }
}

export function readLocalePreference(): string | null {
  try {
    const fromStorage = window.localStorage.getItem(LOCALE_PREF_COOKIE);
    if (fromStorage) return fromStorage;
  } catch {
    /* no-op -- fall through to the cookie */
  }
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_PREF_COOKIE}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
