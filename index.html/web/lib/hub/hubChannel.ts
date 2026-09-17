'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isHubServerConfigured } from '@/lib/hub/hubLedger';

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
 * Fail-open: when the public Supabase env is absent OR UNREADABLE (a preview
 * build, a test harness, a `vercel env pull` that wrote `[SENSITIVE]` instead
 * of the secret) `createHubChannel` returns `null` and every surface falls
 * back to a device-local mode that says so on screen. Unreadable is checked
 * by shape before the socket is opened, so a placeholder key degrades here
 * instead of failing the WebSocket handshake a round trip later.
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

/**
 * Can the live wire be opened at all? This is not a second opinion -- it is
 * `hubLedger.isHubServerConfigured` itself, re-exported under the name this
 * module's consumers know. Both questions are the same question about the same
 * public env pair, and they used to be answered by two separate copies of
 * `Boolean(url && anonKey)`; a placeholder key is a non-empty string, so both
 * copies said "configured" and the UI claimed the server ledger was live right
 * before everything 401'd.
 *
 * The implementation lives in `hubLedger.ts` rather than here because that is
 * the module that owns the "is the server ledger reachable" question, and
 * because the dependency only ever points this way: `hubLedger` does not
 * import this file (no cycle), and both components that import this file
 * (KnowledgeExchange, ThemeChatRooms) already import `hubLedger`, so the edge
 * costs no chunk that was not already loaded.
 *
 * Keep this export: it is the public name, and aliasing rather than wrapping
 * is what makes drift between the two impossible instead of merely unlikely.
 */
export { isHubServerConfigured as isHubRealtimeConfigured };

export function createHubChannel(room: string, presenceKey: string): HubChannelHandle | null {
  if (!isHubServerConfigured()) return null;
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
