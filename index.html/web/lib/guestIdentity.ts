/**
 * Client-only guest identity.
 *
 * Deliberately NOT a Supabase anonymous session: an anonymous auth user would
 * need the provider enabled project-side and would create a real `auth.users`
 * row (and, via the `handle_new_user` trigger, a `profiles` row) for every
 * curious visitor. A guest here is a purely local, throwaway handle that lets
 * someone look around -- it carries a numeric Virtual ID for display and a
 * nickname, nothing else, and it is superseded the moment a real session
 * exists. Spending coins / entering paid modules still requires a verified
 * account (enforced server-side by `spend_coins()`), which is the honest
 * upgrade prompt the coin panels surface to guests.
 */

const STORAGE_KEY = 'unitas.guest.v1';

export interface GuestIdentity {
  /** Opaque local id (not an auth uid). */
  id: string;
  /** Human-facing short number, e.g. 480217. */
  virtualId: number;
  /** Localised at render time from `virtualId`; stored for stability. */
  createdAt: string;
}

function randomVirtualId(): number {
  // 6-digit, never leading zero -- reads like a membership number.
  return 100000 + Math.floor(Math.random() * 900000);
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isGuestIdentity(value: unknown): value is GuestIdentity {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.virtualId === 'number' &&
    Number.isFinite(v.virtualId) &&
    typeof v.createdAt === 'string'
  );
}

export function loadGuestIdentity(): GuestIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isGuestIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Returns the existing guest identity or mints and persists a new one. */
export function ensureGuestIdentity(): GuestIdentity {
  const existing = loadGuestIdentity();
  if (existing) return existing;
  const fresh: GuestIdentity = {
    id: randomId(),
    virtualId: randomVirtualId(),
    createdAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    /* storage blocked -- caller still gets an in-memory identity for this tab */
  }
  return fresh;
}

export function clearGuestIdentity(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Zero-padded display form, e.g. "GUEST-480217". */
export function formatVirtualId(virtualId: number): string {
  return `GUEST-${String(virtualId).padStart(6, '0')}`;
}
