'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Ephemeral broadcast/presence channel for live battle, quiz, and game state
 * (cursor position, move events, presence-of-who's-online). Distinct from the
 * `postgres_changes` pattern in WalletProvider.tsx, which watches durable
 * table rows (balance) -- this never touches Postgres and is not an audit
 * trail, so it's the right tool for anything sub-second/ephemeral that would
 * otherwise hammer the database.
 *
 * Naming convention: `game:${roomId}`, mirroring WalletProvider's
 * `wallet-${userId}` per-scope channel naming.
 */
export interface GameChannelHandle {
  channel: RealtimeChannel;
  /** Send an ephemeral event to everyone else subscribed to this room. */
  broadcast: (event: string, payload: Record<string, unknown>) => Promise<void>;
  /** Listen for a named broadcast event from other participants. */
  onBroadcast: (
    event: string,
    handler: (payload: Record<string, unknown>) => void,
  ) => GameChannelHandle;
  /** Announce this client's presence state (e.g. { userId, ready: true }). */
  track: (state: Record<string, unknown>) => Promise<void>;
  /** Fires whenever the room's presence set changes (join/leave/update). */
  onPresenceSync: (handler: () => void) => GameChannelHandle;
  /** Must be called on unmount/game-end -- an un-unsubscribed channel is a
   *  leaked WebSocket listener, which matters on this low-spec machine. */
  unsubscribe: () => void;
}

export function createGameChannel(roomId: string, presenceKey?: string): GameChannelHandle {
  const supabase = getSupabaseBrowserClient();
  const channel = supabase.channel(`game:${roomId}`, {
    config: {
      broadcast: { self: false },
      presence: presenceKey ? { key: presenceKey } : undefined,
    },
  });

  const handle: GameChannelHandle = {
    channel,
    async broadcast(event, payload) {
      await channel.send({ type: 'broadcast', event, payload });
    },
    onBroadcast(event, handler) {
      channel.on('broadcast', { event }, ({ payload }) => handler(payload as Record<string, unknown>));
      return handle;
    },
    async track(state) {
      await channel.track(state);
    },
    onPresenceSync(handler) {
      channel.on('presence', { event: 'sync' }, handler);
      return handle;
    },
    unsubscribe() {
      channel.unsubscribe();
    },
  };

  channel.subscribe();
  return handle;
}
