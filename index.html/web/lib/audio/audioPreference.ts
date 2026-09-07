// Shared persisted sound on/off preference -- single source of truth for
// both SpatialAudioProvider (site-wide SFX/ambient bed) and the logo-page
// entry chime (components/splash/CinematicIntroSplash.tsx), which cannot
// read SpatialAudioProvider's own state because it mounts above it in the
// tree (see app/layout.tsx).

export const AUDIO_PREF_KEY = 'unitas_audio_pref';

/** Absent OR 'on' => sound is ON by default; only an explicit 'off' mutes. */
export function readAudioPrefMuted(): boolean {
  if (typeof window === 'undefined') return true; // SSR / first paint parity
  try {
    return window.localStorage.getItem(AUDIO_PREF_KEY) === 'off';
  } catch {
    return false; // storage blocked -> default ON
  }
}
