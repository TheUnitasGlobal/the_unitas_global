'use client';

import {
  normalizeHandle,
  validateHandle,
  type HandleAvailability,
  type HandleCheckResponse,
  type HandleClaimResponse,
} from '@/lib/auth/unitasHandle';

/**
 * REV-19 follow-up -- browser side of the handle uniqueness gate.
 * `checkHandleAvailability` is what the sign-up field calls (debounced,
 * abortable) while the visitor types; `claimReservedHandle` is what the
 * MailHandleClaimer fires once a session exists. Both fail-open into
 * honest `unchecked` / `error` answers -- never a false "available".
 */

export const HANDLE_CHECK_DEBOUNCE_MS = 450;
export const HANDLE_CHECK_TIMEOUT_MS = 6000;

export async function checkHandleAvailability(handle: string, signal?: AbortSignal): Promise<HandleAvailability> {
  const h = normalizeHandle(handle);
  if (validateHandle(h) !== 'ok') return 'unchecked';
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = window.setTimeout(() => ctrl.abort(), HANDLE_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/mail/handle?handle=${encodeURIComponent(h)}`, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return 'unchecked';
    const body = (await res.json()) as HandleCheckResponse;
    if (body.verdict !== 'ok') return 'unchecked';
    return body.availability === 'taken' ? 'taken' : body.availability === 'available' ? 'available' : 'unchecked';
  } catch {
    return 'unchecked';
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function claimReservedHandle(accessToken: string): Promise<HandleClaimResponse> {
  try {
    const res = await fetch('/api/mail/handle/claim', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const body = (await res.json()) as HandleClaimResponse;
    return body && typeof body.status === 'string' ? body : { ok: false, status: 'error' };
  } catch {
    return { ok: false, status: 'error' };
  }
}
