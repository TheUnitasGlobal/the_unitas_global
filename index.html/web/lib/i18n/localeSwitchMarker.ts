/**
 * REV-21 §4A (F3) -- the locale-switch continuity marker.
 *
 * A language change remounts the whole `[locale]` tree. Without a marker
 * the new tree lands at scroll 0 with the search bar blurred (the
 * founder-reported "scroll jump"). Every locale-switch call site writes
 * this marker just before `router.replace(..., { scroll: false })`; the
 * home's layout effect restores the scroll position, and the search bar
 * restores focus, when the marker is younger than `MARKER_TTL_MS`. The
 * marker is consumed on read, so a later cold load never replays it.
 *
 * sessionStorage only (device-local, tab-scoped); listed in the browser
 * storage ledger (lib/uai/sourceRegistry.ts). Pure helpers, `window`
 * guarded, so node-environment tests can drive them with a fake store.
 */

export const LOCALE_SWITCH_MARKER_KEY = 'unitas.localeSwitch.v1';
export const MARKER_TTL_MS = 5000;

export interface LocaleSwitchMarker {
  scrollY: number;
  /** The search bar had focus. */
  focused: boolean;
  /** A typing session (level 2) was open. */
  typing: boolean;
  /** The submitted U-AI query whose tower was open, if any. */
  uaiQuery: string | null;
  towerOpen: boolean;
  at: number;
}

interface StoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function store(): StoreLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function writeLocaleSwitchMarker(partial: Partial<Omit<LocaleSwitchMarker, 'at'>>, s: StoreLike | null = store(), now = Date.now()): void {
  if (!s) return;
  const marker: LocaleSwitchMarker = {
    scrollY: partial.scrollY ?? (typeof window === 'undefined' ? 0 : window.scrollY),
    focused: partial.focused ?? false,
    typing: partial.typing ?? false,
    uaiQuery: partial.uaiQuery ?? null,
    towerOpen: partial.towerOpen ?? false,
    at: now,
  };
  try {
    s.setItem(LOCALE_SWITCH_MARKER_KEY, JSON.stringify(marker));
  } catch {
    // storage unavailable -- continuity is a nicety, not a requirement.
  }
}

/** Read a still-fresh marker. `consume` (default) removes it. */
export function readLocaleSwitchMarker(s: StoreLike | null = store(), now = Date.now(), consume = true): LocaleSwitchMarker | null {
  if (!s) return null;
  try {
    const raw = s.getItem(LOCALE_SWITCH_MARKER_KEY);
    if (!raw) return null;
    if (consume) s.removeItem(LOCALE_SWITCH_MARKER_KEY);
    const parsed = JSON.parse(raw) as Partial<LocaleSwitchMarker>;
    if (!parsed || typeof parsed.at !== 'number' || now - parsed.at > MARKER_TTL_MS || now < parsed.at) return null;
    return {
      scrollY: typeof parsed.scrollY === 'number' ? parsed.scrollY : 0,
      focused: parsed.focused === true,
      typing: parsed.typing === true,
      uaiQuery: typeof parsed.uaiQuery === 'string' ? parsed.uaiQuery : null,
      towerOpen: parsed.towerOpen === true,
      at: parsed.at,
    };
  } catch {
    return null;
  }
}
