/**
 * REV-19 §8 -- `@theunitas.global` mail handle reservation (pure).
 *
 * Serverless-viable by construction: the handle rides Supabase Auth's
 * `user_metadata` at sign-up (`options.data.unitas_mail_handle`) -- no
 * table, no migration -- and, for guests, a per-device localStorage note.
 * Actual mailbox provisioning needs MX + a mail provider the platform does
 * not run yet, so every surface says "reserved · mailbox activates when
 * UNITAS Mail opens" and never claims a working inbox.
 *
 * REV-19 follow-up -- uniqueness + validation hardening:
 *  - the FORMAT gate here is strict ASCII (`a-z 0-9 . - _`, 3-20 chars, no
 *    leading / trailing / doubled punctuation, at least one letter) with
 *    NFKC-folded look-alikes rejected outright, a widened reserved list
 *    (role accounts, mail-infrastructure names, auth / payment words) and
 *    brand-impersonation rules (`unitas`, `u-ai`, `ucoin`, `upay`
 *    anywhere; `admin`, `official`, `support`, `security` as a prefix).
 *  - the UNIQUENESS gate lives server-side (lib/auth/mailHandleServer.ts):
 *    `GET /api/mail/handle` answers availability while the visitor types
 *    and `POST /api/mail/handle/claim` binds the handle to the signed-in
 *    account atomically (a primary-key insert -- two accounts can never
 *    hold the same handle, whoever claims first keeps it). The client
 *    treats `taken` exactly like `reserved`: the form does not submit.
 */

export const UNITAS_MAIL_DOMAIN = 'theunitas.global';
export const UNITAS_MAIL_METADATA_KEY = 'unitas_mail_handle';
/** ISO time the handle was bound to the account by the claim route. */
export const UNITAS_MAIL_CLAIMED_KEY = 'unitas_mail_handle_claimed_at';
/** A handle that lost the race at claim time (kept so the UI can explain). */
export const UNITAS_MAIL_LOST_KEY = 'unitas_mail_handle_lost';
export const UNITAS_MAIL_RESERVATION_KEY = 'unitas.mail.reservation.v1';
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

/** Handles nobody may reserve (role accounts, brand, abuse, infrastructure). */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // role / infrastructure (RFC 2142 + common mail-provider set)
  'admin', 'administrator', 'root', 'sysadmin', 'postmaster', 'hostmaster', 'webmaster', 'abuse', 'noreply', 'no-reply',
  'no_reply', 'mailer-daemon', 'mailer_daemon', 'daemon', 'noc', 'usenet', 'news', 'uucp', 'ftp', 'www', 'smtp', 'imap',
  'pop', 'pop3', 'mx', 'mail', 'email', 'e-mail', 'ns', 'ns1', 'ns2', 'dns', 'dmarc', 'spf', 'dkim', 'autoconfig',
  'autodiscover', 'wpad', 'isatap', 'localhost', 'server', 'system', 'sys', 'null', 'undefined', 'nan', 'void',
  // support / trust
  'support', 'help', 'helpdesk', 'security', 'trust', 'safety', 'report', 'abuse-report', 'privacy', 'legal', 'dpo',
  'compliance', 'terms', 'policy', 'moderator', 'moderation', 'mod', 'staff', 'team', 'official', 'verified',
  // business / brand
  'ceo', 'cfo', 'cto', 'coo', 'founder', 'owner', 'dooyeong', 'hwang', 'unitas', 'theunitas', 'theunitasglobal',
  'unitasglobal', 'u-ai', 'uai', 'u_ai', 'ucoin', 'u-coin', 'u_coin', 'upay', 'u-pay', 'u_pay', 'umessenger', 'u-messenger',
  'ushorts', 'u-shorts', 'umail', 'u-mail', 'info', 'contact', 'hello', 'press', 'media', 'pr', 'marketing', 'sales',
  'partners', 'partner', 'careers', 'jobs', 'hr', 'billing', 'payments', 'payment', 'invoice', 'invoices', 'finance',
  'accounts', 'account', 'accounting', 'refund', 'refunds',
  // auth / product words
  'login', 'logout', 'signin', 'signup', 'register', 'auth', 'oauth', 'sso', 'password', 'passwords', 'reset', 'verify',
  'verification', 'api', 'app', 'apps', 'dev', 'developer', 'developers', 'status', 'blog', 'newsletter', 'notification',
  'notifications', 'alert', 'alerts', 'bot', 'bots', 'robot', 'sovereign',
  // identities nobody owns
  'anonymous', 'anon', 'guest', 'user', 'users', 'member', 'members', 'everyone', 'all', 'nobody', 'someone', 'test',
  'testing', 'tester', 'example', 'sample', 'demo', 'default', 'unknown', 'temp', 'tmp',
]);

/** Brand words that may not appear ANYWHERE inside a handle. */
export const BRAND_FRAGMENTS: readonly string[] = ['unitas', 'u-ai', 'ucoin', 'u-coin', 'upay', 'u-pay', 'umessenger'];
/** Role words that may not START a handle (`admin2`, `support.kai`, ...). */
export const ROLE_PREFIXES: readonly string[] = ['admin', 'official', 'support', 'security', 'postmaster', 'noreply', 'no-reply'];

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

export type HandleVerdict = 'ok' | 'empty' | 'invalid' | 'reserved';

/** Pure: normalize what the visitor typed (lowercase, trimmed, no domain).
 *  Look-alike glyphs are NOT folded to ASCII: `validateHandle` rejects
 *  them, so a Cyrillic `а` can never masquerade as a Latin `a`. */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/@.*$/, '');
}

/** Pure: true when the handle contains any non-ASCII code point (including
 *  full-width / confusable letters that NFKC would fold into ASCII). */
export function hasConfusables(handle: string): boolean {
  if (/[^\x21-\x7e]/.test(handle)) return true;
  try {
    return handle.normalize('NFKC') !== handle;
  } catch {
    return false;
  }
}

/** Pure: brand impersonation / role prefix rules on a normalized handle. */
export function isBrandOrRoleHandle(handle: string): boolean {
  if (RESERVED_HANDLES.has(handle)) return true;
  const flat = handle.replace(/[._-]/g, '');
  for (const fragment of BRAND_FRAGMENTS) {
    if (handle.includes(fragment) || flat.includes(fragment.replace(/[._-]/g, ''))) return true;
  }
  for (const prefix of ROLE_PREFIXES) {
    if (handle.startsWith(prefix)) return true;
  }
  return false;
}

/** Pure: validate a normalized handle. */
export function validateHandle(raw: string): HandleVerdict {
  const h = normalizeHandle(raw);
  if (!h) return 'empty';
  if (hasConfusables(h)) return 'invalid';
  if (h.length < HANDLE_MIN || h.length > HANDLE_MAX || !HANDLE_RE.test(h) || /[._-]{2,}/.test(h)) return 'invalid';
  if (!/[a-z]/.test(h)) return 'invalid'; // digits-only handles read as phone numbers / spam
  if (isBrandOrRoleHandle(h)) return 'reserved';
  return 'ok';
}

/** Pure: the full address for a valid handle. */
export function handleAddress(handle: string): string {
  return `${normalizeHandle(handle)}@${UNITAS_MAIL_DOMAIN}`;
}

/** Server-side availability of a syntactically valid handle. */
export type HandleAvailability = 'available' | 'taken' | 'unchecked';

export interface HandleCheckResponse {
  ok: boolean;
  handle: string;
  verdict: HandleVerdict;
  /** Present only when `verdict === 'ok'`. `unchecked` = the uniqueness
   *  ledger was unreachable (the claim step re-checks at sign-in). */
  availability?: HandleAvailability;
  address?: string;
}

export type HandleClaimStatus = 'claimed' | 'taken' | 'none' | 'invalid' | 'error';

export interface HandleClaimResponse {
  ok: boolean;
  status: HandleClaimStatus;
  handle?: string;
  address?: string;
}

export type MailFieldAvailability = HandleAvailability | 'checking' | null;

/** Pure: may the sign-up form submit with this handle field state? An empty
 *  field always may (the handle is optional); a filled one only when the
 *  format is valid AND the server has not reported it taken. */
export function handleBlocksSubmit(verdict: HandleVerdict, availability: MailFieldAvailability): boolean {
  if (verdict === 'empty') return false;
  if (verdict !== 'ok') return true;
  return availability === 'taken' || availability === 'checking';
}

export type MailFieldState = 'idle' | 'checking' | 'available' | 'unchecked' | 'taken' | 'reserved' | 'invalid';

/** Pure: the single visual state the sign-up field shows for a verdict +
 *  probe result (MailHandleField.tsx). */
export function mailFieldState(verdict: HandleVerdict, availability: MailFieldAvailability): MailFieldState {
  if (verdict === 'empty') return 'idle';
  if (verdict === 'invalid') return 'invalid';
  if (verdict === 'reserved') return 'reserved';
  if (availability === 'checking' || availability === null) return 'checking';
  return availability;
}

export interface MailReservation {
  handle: string;
  at: number;
  /** `pending` until the claim route binds it; `claimed` / `lost` after. */
  status?: 'pending' | 'claimed' | 'lost';
}

export function readReservation(): MailReservation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(UNITAS_MAIL_RESERVATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MailReservation>;
    if (typeof parsed.handle !== 'string' || validateHandle(parsed.handle) !== 'ok') return null;
    const status = parsed.status === 'claimed' || parsed.status === 'lost' ? parsed.status : 'pending';
    return { handle: normalizeHandle(parsed.handle), at: typeof parsed.at === 'number' ? parsed.at : 0, status };
  } catch {
    return null;
  }
}

export function writeReservation(handle: string, status: MailReservation['status'] = 'pending'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      UNITAS_MAIL_RESERVATION_KEY,
      JSON.stringify({ handle: normalizeHandle(handle), at: Date.now(), status }),
    );
  } catch {
    // private mode / quota -- the metadata copy on the account is the record.
  }
}
