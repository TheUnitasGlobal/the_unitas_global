'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { RealtimeChannel, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const PROFILE_COLUMNS = 'full_name, phone, phone_verified, nationality, gender, age, blood, mbti';

export interface Profile {
  full_name: string | null;
  phone: string | null;
  phone_verified: boolean;
  nationality: string | null;
  gender: string | null;
  age: number | null;
  blood: string | null;
  mbti: string | null;
}

interface WalletContextValue {
  session: Session | null;
  /** null = signed out or balance not yet loaded; a number once known. */
  balance: number | null;
  /** null = signed out or profile not yet loaded. */
  profile: Profile | null;
  loading: boolean;
  /** false if NEXT_PUBLIC_SUPABASE_URL/ANON_KEY aren't set -- degrades gracefully. */
  configured: boolean;
  refreshProfile: () => Promise<void>;
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
  const [profile, setProfile] = useState<Profile | null>(null);
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

    async function loadProfile(userId: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', userId)
        .single();
      if (cancelled) return;
      if (error) {
        console.error('Profile fetch error:', error);
        return;
      }
      setProfile(data as unknown as Profile);
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
        await Promise.all([loadBalance(data.session.user.id), loadProfile(data.session.user.id)]);
        subscribeToWallet(data.session.user.id);
      }
      setLoading(false);
    }
    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadBalance(newSession.user.id);
        loadProfile(newSession.user.id);
        subscribeToWallet(newSession.user.id);
      } else {
        setBalance(null);
        setProfile(null);
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

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', session.user.id)
        .single();
      if (!error) setProfile(data as unknown as Profile);
    } catch {
      // not configured -- nothing to refresh
    }
  }, [session]);

  const value = useMemo(
    () => ({ session, balance, profile, loading, configured, refreshProfile }),
    [session, balance, profile, loading, configured, refreshProfile],
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
