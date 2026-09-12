'use client';

import { useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * REV-20 SPEC.md §12 D-3 -- one-time sweep of the metadata UNITAS Shorts
 * left behind when it was fully retired in commit 359c4c3
 * (lib/live/shortsPass.ts / ShortsCreatorPass.tsx / UnitasShortsPanel.tsx
 * were deleted, but nothing ever visited the storage they had already
 * written on real devices/accounts). The founder's own follow-up directive
 * overrides SPEC's original "leave it, harmless" recommendation with an
 * explicit cleanup, so this runs it -- gated so it costs nothing after the
 * first successful pass on a given device.
 *
 * Two orphan surfaces, both dead code references now:
 *  - `localStorage['unitas.shorts.pass.v1']` / `['unitas.device.v1']`
 *    (SHORTS_PASS_KEY / DEVICE_SEED_KEY in the deleted shortsPass.ts) --
 *    pure device-local, safe to drop unconditionally, no network involved.
 *  - `auth.users.user_metadata.unitas_shorts_pass` (SHORTS_PASS_METADATA_KEY)
 *    for a signed-in visitor who reserved a pass before the retirement --
 *    cleared via a client-side `updateUser({ data })` merge (nulling a key
 *    removes it), the same primitive AccountSettingsModal/PhoneVerifyPanel
 *    already use for user_metadata writes. Best-effort: a failure here
 *    (offline, no session, RLS) is silently swallowed -- this is tidiness,
 *    never a gate on anything the visitor is doing.
 */

const LOCAL_KEYS = ['unitas.shorts.pass.v1', 'unitas.device.v1'] as const;
const METADATA_KEY = 'unitas_shorts_pass';
/** Marks this device as already swept so repeat visits don't re-run the
 *  (harmless but pointless) `updateUser` call every load forever. */
const DONE_FLAG = 'unitas.shorts.orphanCleanup.v1.done';

export function ShortsOrphanCleanup() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (window.localStorage.getItem(DONE_FLAG) === '1') return;
      } catch {
        return; // localStorage unavailable -- nothing safe to do here.
      }

      for (const key of LOCAL_KEYS) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          /* private mode / quota -- no-op, not fatal */
        }
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled && user?.user_metadata && METADATA_KEY in user.user_metadata) {
          await supabase.auth.updateUser({ data: { [METADATA_KEY]: null } });
        }
      } catch {
        /* signed out / offline / RLS -- best-effort only */
      }

      try {
        window.localStorage.setItem(DONE_FLAG, '1');
      } catch {
        /* no-op */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
