'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Radio, Send } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { HubDot } from '@/components/home/hub/HubDot';
import { HOT_NEWS_AXES, hotNewsAxisMeta } from '@/lib/live/hotNewsAxes';
import { createHubChannel, type HubChannelHandle } from '@/lib/hub/hubChannel';
import {
  CHAT_HISTORY,
  CHAT_MAX_TEXT,
  canSend,
  isChatMessagePayload,
  makeMessage,
  mergeMessages,
  readRoomHistory,
  sanitizeChatText,
  writeRoomHistory,
  type ChatMessage,
  type ChatRoomKey,
} from '@/lib/hub/themeChat';
import { hasHubSession, hubPostMessage, hubRoomHistory, isHubServerConfigured, type HubServerError } from '@/lib/hub/hubLedger';
import { PULSE_SLOT_MS, talkPresence, talkPulse } from '@/lib/square/talkPulse';
import { useHubIdentity } from './useHubIdentity';

/**
 * REV-29 MISSION 4 -- 테마별 대화방. Twenty-two rooms, one per news axis.
 * A room is one hub broadcast channel: what a visitor sends reaches every
 * other visitor in the room within the round trip. The presence counter is
 * the room's live head-count.
 *
 * REV-30 M1 adds DURABILITY without touching that. The broadcast is still
 * what makes a room feel live -- it is unchanged. What is new: a signed-in
 * author's message is also written to `hub_messages` (RLS, server-sanitised,
 * server flood-guarded), and opening a room loads that history first, so a
 * room on a new device is no longer blank. A guest still broadcasts and
 * still keeps this device's own last 60 messages, and the room says which of
 * the two it is doing.
 */
export function ThemeChatRooms() {
  const t = useTranslations('Rev29.rooms');
  const tHub = useTranslations('Rev29.hub');
  const tRev30 = useTranslations('Rev30');
  const t36 = useTranslations('Rev36');
  const tNews = useTranslations('HotNews');
  const locale = useLocale();
  const { playHoverSfx, playQuestEnterSfx } = useSpatialAudio();
  const me = useHubIdentity();

  const [room, setRoom] = useState<ChatRoomKey>(HOT_NEWS_AXES[0].key);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [online, setOnline] = useState<number | null>(null);
  const [live, setLive] = useState<boolean | null>(null);
  /** REV-30 M1: does this visitor's own message survive the device? */
  const [durable, setDurable] = useState(false);
  const [serverError, setServerError] = useState<HubServerError | null>(null);
  const [sending, setSending] = useState(false);
  // REV-36: the pulse instant, from a state initialiser, refreshed each slot.
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef<HubChannelHandle | null>(null);
  const lastSentRef = useRef<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const meta = hotNewsAxisMeta(room);
  const roomLabel = tNews(`category.${room}`);
  // The simulated head of the room (lib/square/talkPulse.ts): deterministic,
  // offline-identical, never "mine" (authorId is the reserved sim: prefix), and
  // marked data-hub-msg-sim -- so the real-message contracts stay untouched.
  const pulseRows = useMemo(() => talkPulse(room, now), [room, now]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), PULSE_SLOT_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const signedIn = isHubServerConfigured() && (await hasHubSession());
      if (!cancelled) setDurable(signedIn);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Room change: the device's copy paints instantly, the durable history
  // merges in behind it (mergeMessages de-duplicates by id and keeps time
  // order, so a message in both appears once), and the live wire opens. ONE
  // cancelled flag covers both async arms -- a fast room flick must not let
  // the previous room's history land in the new room.
  useEffect(() => {
    let cancelled = false;
    setMessages(readRoomHistory(room));
    setOnline(null);

    if (durable) {
      void hubRoomHistory(room, CHAT_HISTORY).then((rows) => {
        if (!cancelled && rows.length > 0) setMessages((prev) => mergeMessages(prev, rows));
      });
    }

    const handle = createHubChannel(`chat:${room}`, me.id);
    if (!handle) {
      setLive(false);
      return () => {
        cancelled = true;
      };
    }
    channelRef.current = handle;
    handle
      .onBroadcast('msg', (payload) => {
        if (isChatMessagePayload(payload) && payload.room === room) setMessages((prev) => mergeMessages(prev, [payload]));
      })
      .onPresenceCount(setOnline);
    void handle.ready.then((ok) => {
      if (cancelled) return;
      setLive(ok);
      if (ok) void handle.track({ name: me.name });
    });
    return () => {
      cancelled = true;
      channelRef.current = null;
      handle.unsubscribe();
    };
  }, [room, me.id, me.name, durable]);

  useEffect(() => {
    writeRoomHistory(room, messages);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [room, messages]);

  const send = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const text = sanitizeChatText(draft);
      const at = Date.now();
      if (!text || sending || !canSend(lastSentRef.current, at)) return;
      lastSentRef.current = at;
      setDraft('');
      setServerError(null);
      playQuestEnterSfx();

      if (!durable) {
        const msg = makeMessage(room, me.name, me.id, text, at);
        setMessages((prev) => mergeMessages(prev, [msg]));
        void channelRef.current?.broadcast('msg', msg as unknown as Record<string, unknown>);
        return;
      }

      // Durable path: the server sanitises, flood-guards and stores, then
      // hands back the row it kept -- that row is what is rendered and what
      // is broadcast, so every participant sees the same text the database
      // holds rather than an optimistic copy that might differ.
      setSending(true);
      void hubPostMessage(room, text, me.name).then((res) => {
        setSending(false);
        if (!res.ok || !res.data) {
          setServerError(res.error);
          // The message did not land. Put the draft back rather than
          // pretending it was sent.
          setDraft(text);
          lastSentRef.current = null;
          return;
        }
        const stored = res.data;
        setMessages((prev) => mergeMessages(prev, [stored]));
        void channelRef.current?.broadcast('msg', stored as unknown as Record<string, unknown>);
      });
    },
    [draft, room, me.id, me.name, playQuestEnterSfx, durable, sending],
  );

  const timeFmt = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);

  return (
    <div className="qw-rooms" data-hub-rooms="">
      <p className="qw-hub-meta text-[13px] text-gray-400">{t('lede')}</p>

      <div className="qw-hub-strip select-none mt-3" role="tablist" aria-label={t('roomAria', { room: roomLabel })} data-hub-room-rail="">
        {HOT_NEWS_AXES.map((axis) => (
          <button
            key={axis.key}
            type="button"
            role="tab"
            aria-selected={room === axis.key}
            data-active={room === axis.key ? '1' : '0'}
            data-room={axis.key}
            className="qw-hub-chip"
            style={{ '--qw-hub-accent': axis.color } as CSSProperties}
            onMouseEnter={() => playHoverSfx()}
            onClick={() => setRoom(axis.key)}
          >
            <HubDot color={axis.color} />
            {tNews(`category.${axis.key}`)}
          </button>
        ))}
      </div>

      <div className="qw-room" data-hub-room={room} style={{ '--qw-hub-accent': meta.color } as CSSProperties}>
        <div className="qw-room-head">
          <p className="flex items-center gap-2 text-[15px] font-bold text-white">
            <HubDot color={meta.color} size={10} />
            {roomLabel}
          </p>
          <p className="qw-hub-meta flex items-center gap-1.5 text-[12px] text-gray-500" data-hub-live={live === null ? 'pending' : live ? '1' : '0'}>
            <Radio size={12} aria-hidden="true" />
            {online !== null ? (
              tHub('online', { count: online })
            ) : (
              <span data-hub-presence-sim="1">{t36('talk.presence', { count: talkPresence(room, now) })}</span>
            )}
            <span data-hub-durable={durable ? '1' : '0'}>· {durable ? tRev30('room.durable') : tRev30('room.deviceOnly')}</span>
          </p>
        </div>

        <ol ref={listRef} className="qw-room-list" data-hub-room-list="" aria-live="polite">
          <li className="qw-room-msg qw-room-msg--system">{t('welcome', { room: roomLabel })}</li>
          <li className="qw-room-msg qw-room-msg--system" data-hub-pulse-note="">
            {t36('talk.pulseRoom')} · {t36('pulse.sim')}
          </li>
          {pulseRows.map((m) => (
            <li key={m.id} className="qw-room-msg qw-room-msg--pulse" data-mine="0" data-hub-msg-sim="1">
              <span className="qw-room-author">{m.author}</span>
              <span className="qw-room-text">{m.text}</span>
              <span className="qw-room-time">{timeFmt.format(new Date(m.at))}</span>
            </li>
          ))}
          {messages.length === 0 && pulseRows.length === 0 && <li className="qw-room-msg qw-room-msg--system">{t('empty')}</li>}
          {messages.map((m) => (
            <li key={m.id} className="qw-room-msg" data-mine={m.authorId === me.id ? '1' : '0'} data-hub-msg="">
              <span className="qw-room-author">{m.authorId === me.id ? t('you') : m.author}</span>
              <span className="qw-room-text">{m.text}</span>
              <span className="qw-room-time">{timeFmt.format(new Date(m.at))}</span>
            </li>
          ))}
        </ol>

        <form className="qw-room-composer" onSubmit={send}>
          <input
            type="text"
            value={draft}
            maxLength={CHAT_MAX_TEXT}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            onChange={(e) => setDraft(e.target.value)}
            data-hub-room-input=""
          />
          <button type="submit" className="qw-pill-btn" data-on="1" disabled={!draft.trim() || sending} onMouseEnter={() => playHoverSfx()} data-hub-room-send="">
            <Send size={13} aria-hidden="true" />
            {t('send')}
          </button>
        </form>
        {serverError && (
          <p className="mt-1 text-[11px] font-bold text-red-400" role="alert" data-hub-room-error={serverError}>
            {tRev30(`error.${serverError}`)}
          </p>
        )}
        <p className="mt-1 text-[11px] text-gray-500">{t('speakingAs', { name: me.name })}</p>
      </div>
    </div>
  );
}
