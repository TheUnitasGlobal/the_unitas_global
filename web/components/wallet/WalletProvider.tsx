'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { RealtimeChannel, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface WalletContextValue {
  session: Session | null;
  /** null = signed out or balance not yet loaded; a number once known. */
  balance: number | null;
  loading: boolean;
  /** false if NEXT_PUBLIC_SUPABASE_URL/ANON_KEY aren't set -- degrades gracefully. */
  configured: boolean;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Same coin-core wallet as the root static site: reads the caller's own
 * `wallets` row and keeps it live via a Supabase Realtime subscription (see
 * the root repo's assets/js/coin-core.js for the vanilla-JS twin of this
 * pattern). Renders children regardless of whether Supabase env vars are
 * configured -- consumers should treat `configured: false` / `balance:
 * null` as "show a neutral state", not an error.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let supabase: SupabaseClient;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      setConfigured(false);
      setLoading(false);
      return;
    }

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    async function loadBalance(userId: string) {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();
      if (cancelled) return;
      if (error) {
        console.error('Wallet fetch error:', error);
        return;
      }
      setBalance(data ? data.balance : 0);
    }

    function subscribeToWallet(userId: string) {
      channel?.unsubscribe();
      channel = supabase
        .channel(`wallet-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` },
          () => loadBalance(userId),
        )
        .subscribe();
    }

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      if (data.session) {
        await loadBalance(data.session.user.id);
        subscribeToWallet(data.session.user.id);
      }
      setLoading(false);
    }
    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadBalance(newSession.user.id);
        subscribeToWallet(newSession.user.id);
      } else {
        setBalance(null);
        channel?.unsubscribe();
        channel = null;
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      channel?.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ session, balance, loading, configured }),
    [session, balance, loading, configured],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return ctx;
}
