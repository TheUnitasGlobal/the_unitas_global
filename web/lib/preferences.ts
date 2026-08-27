/**
 * Client-only visitor preference keys, persisted in `localStorage`.
 *
 * Two owner mandates (2026-08-27) ride on these:
 *   - Language: a first-ever visit always resolves to English; once the
 *     visitor picks a language from the nav dropdown that choice is stored
 *     here and every later visit to "/" restores it.
 *   - Sound: enabled on every load. The ONLY thing that turns it off is the
 *     visitor pressing the toggle -- that single choice is what gets stored
 *     here, and it is what survives reloads. Absence of the key === sound on.
 */
export const LOCALE_STORAGE_KEY = 'unitas_locale';
export const SOUND_MUTED_STORAGE_KEY = 'unitas_sound_muted';

/**
 * Reads the remembered locale, but only if it is still one we actually ship.
 * Returns `null` when nothing is stored or `localStorage` is unavailable
 * (private mode, storage disabled) -- callers fall back to English.
 */
export function readStoredLocale(supported: readonly string[]): string | null {
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return value && supported.includes(value) ? value : null;
  } catch {
    return null;
  }
}

/** Persists the visitor's explicit language pick. Silent no-op if storage is blocked. */
export function storeLocale(locale: string): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* storage unavailable -- preference just won't persist this session */
  }
}

/** True only when the visitor has previously turned sound OFF by hand. */
export function isSoundMutedByChoice(): boolean {
  try {
    return window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Persists the visitor's explicit sound on/off pick. Silent no-op if storage is blocked. */
export function storeSoundMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    /* storage unavailable -- preference just won't persist this session */
  }
}
