'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { LedgerEntry } from '@/lib/walletSimulation';

type LedgerStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

interface CoinLedgerState {
  status: LedgerStatus;
  entries: LedgerEntry[];
  reload: () => void;
}

/**
 * Reads the caller's own recent `coin_ledger` rows (newest first). Degrades to
 * `status: 'unavailable'` -- never throws -- when Supabase isn't configured,
 * the table/policy isn't live yet, or the user is signed out. Consumers show a
 * neutral "pending" state for anything but `'ready'`.
 */
export function useCoinLedger(enabled: boolean, userId: string | undefined): CoinLedgerState {
  const [status, setStatus] = useState<LedgerStatus>('idle');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !userId) {
      setStatus('idle');
      setEntries([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('coin_ledger')
          .select('amount, kind, module, balance_after, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(12);

        if (cancelled) return;
        if (error) {
          setStatus('unavailable');
          setEntries([]);
          return;
        }
        setEntries((data ?? []) as LedgerEntry[]);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('unavailable');
          setEntries([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId, nonce]);

  return { status, entries, reload };
}
