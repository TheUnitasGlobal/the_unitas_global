/**
 * UNITAS Shorts creator pass (pure + storage). Retired in REV-20 §7.1,
 * REVIVED in REV-29 MISSION 4 (founder directive 2026-09-15: "UNITAS 숏츠
 * 부활 및 이관") inside the UNITAS master hub.
 *
 * The upload pipeline opens with the U-Messenger beta, so the Shorts rail
 * offers a CREATOR PASS instead of a dead "Upload" button: a reservation
 * that lives on this device (localStorage) and, for a signed-in account,
 * in Supabase Auth `user_metadata.unitas_shorts_pass` (no schema change).
 * The pass serial is derived deterministically from a per-device seed so
 * it never changes between visits and is never a fabricated queue number.
 *
 * Storage keys are `v2`: the REV-20 orphan sweep deleted the `v1` keys on
 * every device it ran on, and a revived surface must never share a name
 * with a key that a still-cached bundle might sweep again.
 */

export const SHORTS_PASS_KEY = 'unitas.shorts.pass.v2';
export const SHORTS_PASS_METADATA_KEY = 'unitas_shorts_pass';
export const DEVICE_SEED_KEY = 'unitas.device.v2';

export interface ShortsPass {
  /** Creator handle (validated with the mail-handle rules; may be ''). */
  handle: string;
  at: number;
  serial: string;
}

const B32 = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Pure: `U-XXXX-YY` serial from a seed (stable for the seed's lifetime). */
export function passSerial(seed: string): string {
  const h = fnv1a(`unitas-shorts-pass::${seed}`);
  let n = h;
  let body = '';
  for (let i = 0; i < 4; i++) {
    body += B32[n % B32.length];
    n = Math.floor(n / B32.length);
  }
  const tail = fnv1a(`${seed}::tail`) % 97;
  return `U-${body}-${String(tail).padStart(2, '0')}`;
}

function randomSeed(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Per-device seed (created once, kept in localStorage). */
export function deviceSeed(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.localStorage.getItem(DEVICE_SEED_KEY);
    if (existing) return existing;
    const seed = randomSeed();
    window.localStorage.setItem(DEVICE_SEED_KEY, seed);
    return seed;
  } catch {
    return 'ephemeral';
  }
}

export function readShortsPass(): ShortsPass | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SHORTS_PASS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ShortsPass>;
    if (typeof p.serial !== 'string' || typeof p.at !== 'number') return null;
    return { handle: typeof p.handle === 'string' ? p.handle : '', at: p.at, serial: p.serial };
  } catch {
    return null;
  }
}

export function writeShortsPass(pass: ShortsPass): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHORTS_PASS_KEY, JSON.stringify(pass));
  } catch {
    // quota / private mode -- the account copy (when signed in) is the record.
  }
}

/** Pure: the pass an account's metadata carries, if any. */
export function passFromMetadata(meta: unknown): ShortsPass | null {
  if (!meta || typeof meta !== 'object') return null;
  const raw = (meta as Record<string, unknown>)[SHORTS_PASS_METADATA_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<ShortsPass>;
  if (typeof p.serial !== 'string' || typeof p.at !== 'number') return null;
  return { handle: typeof p.handle === 'string' ? p.handle : '', at: p.at, serial: p.serial };
}
