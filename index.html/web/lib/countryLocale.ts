/**
 * Country -> app-locale mapping for the login-time auto language switch
 * (owner instruction 2026-09-03). Zero external calls -- no IP-geolocation
 * service, matching the zero-capital doctrine -- country is read from the
 * browser's own `navigator.language` region subtag, and `profiles.locale`
 * (supabase/migrations/20260911000000_profile_locale_country.sql) is the
 * single persisted source of truth applied on every login (see
 * components/i18n/LocaleAutoSwitch.tsx). A manual switch
 * (components/nav/LanguageSwitcher.tsx) writes back here immediately, so it
 * always wins over the country guess on the next login.
 */
import { routing } from '@/i18n/routing';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type AppLocale = (typeof routing.locales)[number];

const SUPPORTED_LOCALES = new Set<string>(routing.locales);

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return !!value && SUPPORTED_LOCALES.has(value);
}

/**
 * ISO 3166-1 alpha-2 country -> the closest of the app's 20 supported
 * locales. Not exhaustive of every territory -- an unlisted country falls
 * back to the app default (`en`). Multi-language countries pick the
 * plurality/official language closest to one of our locales (e.g. `CA` ->
 * `en`, `CH` -> `de`, `BE` -> `nl`) rather than modelling bilingual splits
 * there is no per-user signal to resolve.
 */
export const COUNTRY_LOCALE_MAP: Record<string, AppLocale> = {
  KR: 'ko', KP: 'ko',
  EE: 'et',
  JP: 'ja',
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', GQ: 'es',
  KH: 'km',
  FR: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', ML: 'fr', BF: 'fr',
  NE: 'fr', TG: 'fr', BJ: 'fr', CD: 'fr', CG: 'fr', GA: 'fr', HT: 'fr',
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',
  VN: 'vi',
  ID: 'id',
  RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', TJ: 'ru', UZ: 'ru', TM: 'ru',
  IN: 'hi',
  IT: 'it', SM: 'it', VA: 'it',
  TR: 'tr',
  TH: 'th',
  PL: 'pl',
  NL: 'nl', BE: 'nl', SR: 'nl',
  PH: 'tl',
};

export function countryToLocale(country: string | null | undefined): AppLocale | null {
  if (!country) return null;
  return COUNTRY_LOCALE_MAP[country.trim().toUpperCase()] ?? null;
}

/** Best-effort split of a BCP-47 tag like "ko-KR" or "en" into language + region. */
export function parseLanguageTag(tag: string): { language: string; region: string | null } {
  const parts = tag.split('-');
  const language = (parts[0] ?? '').toLowerCase();
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase() ?? null;
  return { language, region };
}

/**
 * Detects a country + best-fit app locale from a BCP-47 language tag at
 * signup time. Prefers the region subtag ("ko-KR" -> country "KR" -> locale
 * `ko`); when there is no region, falls back to the bare language subtag if
 * it happens to match one of our locale codes.
 *
 * Defaults to the live `navigator.language` (undefined outside a browser);
 * takes an explicit tag as a parameter so it's directly unit-testable
 * without monkey-patching the global `navigator`.
 */
export function detectBrowserCountryLocale(
  languageTag: string | null = typeof navigator !== 'undefined' ? navigator.language : null,
): { country: string | null; locale: AppLocale | null } {
  if (!languageTag) {
    return { country: null, locale: null };
  }
  const { language, region } = parseLanguageTag(languageTag);
  const fromCountry = countryToLocale(region);
  const fromLanguage = isAppLocale(language) ? (language as AppLocale) : null;
  return { country: region, locale: fromCountry ?? fromLanguage };
}

/**
 * Fire-and-forget persistence of a manual language switch onto the signed-in
 * user's profile, so it "wins" on their next login on any device. Silently
 * no-ops when Supabase isn't configured or the write fails -- a locale
 * preference is never worth blocking or erroring the UI switch over.
 */
export function persistUserLocale(userId: string, locale: AppLocale): void {
  try {
    getSupabaseBrowserClient()
      .from('profiles')
      .update({ locale })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.error('Locale persist error:', error);
      });
  } catch {
    // Supabase not configured -- the route-level switch still applies.
  }
}
