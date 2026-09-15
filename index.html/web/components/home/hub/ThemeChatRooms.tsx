'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Radio, Send } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { HOT_NEWS_AXES, hotNewsAxisMeta } from '@/lib/live/hotNewsAxes';
import { createHubChannel, type HubChannelHandle } from '@/lib/hub/hubChannel';
import {
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
import { useHubIdentity } from './useHubIdentity';

/**
 * REV-29 MISSION 4 -- 테마별 대화방. Twenty-two rooms, one per news axis.
 * A room is one hub broadcast channel: what a visitor sends reaches every
 * other visitor in the room within the round trip and is stored NOWHERE on
 * the server; each device keeps its own last 60 messages per room. The
 * presence counter is the room's live head-count. Without the public
 * Supabase env the room runs device-local and says so.
 */
export function ThemeChatRooms() {
  const t = useTranslations('Rev29.rooms');
  const tHub = useTranslations('Rev29.hub');
  const tNews = useTranslations('HotNews');
  const locale = useLocale();
  const { playHoverSfx, playQuestEnterSfx } = useSpatialAudio();
  const me = useHubIdentity();

  const [room, setRoom] = useState<ChatRoomKey>(HOT_NEWS_AXES[0].key);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [online, setOnline] = useState<number | null>(null);
  const [live, setLive] = useState<boolean | null>(null);
  const channelRef = useRef<HubChannelHandle | null>(null);
  const lastSentRef = useRef<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const meta = hotNewsAxisMeta(room);
  const roomLabel = tNews(`category.${room}`);

  // Room change: history from the device, then the live wire.
  useEffect(() => {
    setMessages(readRoomHistory(room));
    setOnline(null);
    const handle = createHubChannel(`chat:${room}`, me.id);
    if (!handle) {
      setLive(false);
      return;
    }
    channelRef.current = handle;
    handle
      .onBroadcast('msg', (payload) => {
        if (isChatMessagePayload(payload) && payload.room === room) setMessages((prev) => mergeMessages(prev, [payload]));
      })
      .onPresenceCount(setOnline);
    void handle.ready.then((ok) => {
      setLive(ok);
      if (ok) void handle.track({ name: me.name });
    });
    return () => {
      channelRef.current = null;
      handle.unsubscribe();
    };
  }, [room, me.id, me.name]);

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
      if (!text || !canSend(lastSentRef.current, at)) return;
      lastSentRef.current = at;
      const msg = makeMessage(room, me.name, me.id, text, at);
      setMessages((prev) => mergeMessages(prev, [msg]));
      setDraft('');
      playQuestEnterSfx();
      void channelRef.current?.broadcast('msg', msg as unknown as Record<string, unknown>);
    },
    [draft, room, me.id, me.name, playQuestEnterSfx],
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
            <axis.icon size={15} style={{ color: axis.color }} aria-hidden="true" />
            {tNews(`category.${axis.key}`)}
          </button>
        ))}
      </div>

      <div className="qw-room" data-hub-room={room} style={{ '--qw-hub-accent': meta.color } as CSSProperties}>
        <div className="qw-room-head">
          <p className="flex items-center gap-2 text-[15px] font-bold text-white">
            <meta.icon size={16} style={{ color: meta.color }} aria-hidden="true" />
            {roomLabel}
          </p>
          <p className="qw-hub-meta flex items-center gap-1.5 text-[12px] text-gray-500" data-hub-live={live === null ? 'pending' : live ? '1' : '0'}>
            <Radio size={12} aria-hidden="true" />
            {live === false ? tHub('localOnly') : online !== null ? tHub('online', { count: online }) : tHub('live')}
          </p>
        </div>

        <ol ref={listRef} className="qw-room-list" data-hub-room-list="" aria-live="polite">
          <li className="qw-room-msg qw-room-msg--system">{t('welcome', { room: roomLabel })}</li>
          {messages.length === 0 && <li className="qw-room-msg qw-room-msg--system">{t('empty')}</li>}
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
          <button type="submit" className="qw-pill-btn" data-on="1" disabled={!draft.trim()} onMouseEnter={() => playHoverSfx()} data-hub-room-send="">
            <Send size={13} aria-hidden="true" />
            {t('send')}
          </button>
        </form>
        <p className="mt-1 text-[11px] text-gray-500">{t('speakingAs', { name: me.name })}</p>
      </div>
    </div>
  );
}
