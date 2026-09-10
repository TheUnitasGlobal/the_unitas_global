/**
 * REV-19 §8 -- `@theunitas.global` mail handle reservation (pure).
 *
 * Serverless-viable by construction: the handle rides Supabase Auth's
 * `user_metadata` at sign-up (`options.data.unitas_mail_handle`) -- no
 * table, no migration -- and, for guests, a per-device localStorage note.
 * Actual mailbox provisioning needs MX + a mail provider the platform does
 * not run yet, so every surface says "reserved · mailbox activates when
 * UNITAS Mail opens" and never claims a working inbox.
 */

export const UNITAS_MAIL_DOMAIN = 'theunitas.global';
export const UNITAS_MAIL_METADATA_KEY = 'unitas_mail_handle';
export const UNITAS_MAIL_RESERVATION_KEY = 'unitas.mail.reservation.v1';
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

/** Handles nobody may reserve (role accounts, brand, abuse). */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'admin', 'administrator', 'root', 'postmaster', 'hostmaster', 'webmaster', 'abuse', 'noreply', 'no-reply', 'support',
  'help', 'security', 'billing', 'ceo', 'founder', 'unitas', 'theunitas', 'u-ai', 'uai', 'ucoin', 'u-coin', 'upay',
  'u-pay', 'legal', 'privacy', 'terms', 'info', 'contact', 'press', 'careers', 'mail', 'email', 'system', 'sovereign',
  'test', 'null', 'undefined',
]);

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

export type HandleVerdict = 'ok' | 'empty' | 'invalid' | 'reserved';

/** Pure: normalize what the visitor typed (lowercase, trimmed, no domain). */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/@.*$/, '');
}

/** Pure: validate a normalized handle. */
export function validateHandle(raw: string): HandleVerdict {
  const h = normalizeHandle(raw);
  if (!h) return 'empty';
  if (h.length < HANDLE_MIN || h.length > HANDLE_MAX || !HANDLE_RE.test(h) || /[._-]{2,}/.test(h)) return 'invalid';
  if (RESERVED_HANDLES.has(h)) return 'reserved';
  return 'ok';
}

/** Pure: the full address for a valid handle. */
export function handleAddress(handle: string): string {
  return `${normalizeHandle(handle)}@${UNITAS_MAIL_DOMAIN}`;
}

export interface MailReservation {
  handle: string;
  at: number;
}

export function readReservation(): MailReservation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(UNITAS_MAIL_RESERVATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MailReservation>;
    if (typeof parsed.handle !== 'string' || validateHandle(parsed.handle) !== 'ok') return null;
    return { handle: normalizeHandle(parsed.handle), at: typeof parsed.at === 'number' ? parsed.at : 0 };
  } catch {
    return null;
  }
}

export function writeReservation(handle: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UNITAS_MAIL_RESERVATION_KEY, JSON.stringify({ handle: normalizeHandle(handle), at: Date.now() }));
  } catch {
    // private mode / quota -- the metadata copy on the account is the record.
  }
}
