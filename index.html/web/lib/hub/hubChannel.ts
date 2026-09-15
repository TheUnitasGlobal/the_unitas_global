'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * REV-29 MISSION 4 -- the UNITAS hub's live wire.
 *
 * Every social surface of the hub (theme chat rooms, the exchange's trade
 * ticker, the presence counters) rides ONE primitive: a Supabase Realtime
 * broadcast + presence channel. It never touches Postgres -- there is no
 * schema, no row, no audit trail -- which is exactly why the whole hub could
 * be built without a migration. What one visitor sends, every other visitor
 * in the same room sees within the round trip; nothing is stored on the
 * server, and each device keeps its own short history (lib/hub/themeChat.ts).
 *
 * Fail-open: when the public Supabase env is absent (a preview build, a
 * test harness) `createHubChannel` returns `null` and every surface falls
 * back to a device-local mode that says so on screen.
 *
 * Naming: `hub:<room>` beside `game:<roomId>` (lib/realtime/gameChannel.ts)
 * and `wallet-<userId>` (WalletProvider) -- one channel per scope.
 */
export interface HubChannelHandle {
  channel: RealtimeChannel;
  broadcast: (event: string, payload: Record<string, unknown>) => Promise<void>;
  onBroadcast: (event: string, handler: (payload: Record<string, unknown>) => void) => HubChannelHandle;
  track: (state: Record<string, unknown>) => Promise<void>;
  /** Fires with the number of presences whenever the room's set changes. */
  onPresenceCount: (handler: (count: number) => void) => HubChannelHandle;
  /** Resolves once the socket has joined the room (or failed to). */
  ready: Promise<boolean>;
  unsubscribe: () => void;
}

export function isHubRealtimeConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createHubChannel(room: string, presenceKey: string): HubChannelHandle | null {
  if (!isHubRealtimeConfigured()) return null;
  let channel: RealtimeChannel;
  try {
    channel = getSupabaseBrowserClient().channel(`hub:${room}`, {
      config: { broadcast: { self: false }, presence: { key: presenceKey } },
    });
  } catch {
    return null;
  }

  let resolveReady: (ok: boolean) => void = () => undefined;
  const ready = new Promise<boolean>((resolve) => {
    resolveReady = resolve;
  });

  const handle: HubChannelHandle = {
    channel,
    ready,
    async broadcast(event, payload) {
      try {
        await channel.send({ type: 'broadcast', event, payload });
      } catch {
        // the socket is down -- the local copy still renders
      }
    },
    onBroadcast(event, handler) {
      channel.on('broadcast', { event }, ({ payload }) => handler((payload ?? {}) as Record<string, unknown>));
      return handle;
    },
    async track(state) {
      try {
        await channel.track(state);
      } catch {
        // presence is a nicety
      }
    },
    onPresenceCount(handler) {
      channel.on('presence', { event: 'sync' }, () => {
        try {
          handler(Object.keys(channel.presenceState()).length);
        } catch {
          handler(0);
        }
      });
      return handle;
    },
    unsubscribe() {
      try {
        channel.unsubscribe();
      } catch {
        // already gone
      }
    },
  };

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') resolveReady(true);
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') resolveReady(false);
  });
  return handle;
}
