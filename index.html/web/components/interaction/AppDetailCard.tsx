'use client';

import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import type { DirectAppShortcut } from '@/lib/appShortcuts';

interface AppDetailCardProps {
  app: DirectAppShortcut;
  /** Family-level description (Email.hint / Social.hint -- already
   *  localized in all 20 locales). */
  description: string;
  /** "{brand} 바로가기" / "{brand} 열기" -- doubles as the open button's
   *  visible label and its title/aria-label. */
  openLabel: string;
  onHover?: () => void;
  onOpen?: () => void;
}

/**
 * The "상세 내용과 설명 카드" (owner instruction 2026-09-03): social/email
 * tiles used to be plain one-click `<a>` launchers straight out to the app;
 * now a tap toggles this card open first -- brand, family description, host
 * -- and leaving the site is an explicit second action from here, matching
 * how every sibling shortcut tile in the same strip already opens its own
 * detail surface before anything happens. Shared between
 * HotShortcutMatrixStrip's tab grid and AppLoopRow's pinned bar so both
 * toggle surfaces read identically.
 */
export function AppDetailCard({ app, description, openLabel, onHover, onOpen }: AppDetailCardProps) {
  let host = app.url;
  try {
    host = new URL(app.url).host;
  } catch {
    // keep the raw url as a fallback label
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -6, height: 0 }}
      transition={{ duration: 0.18 }}
      className="w-full overflow-hidden"
    >
      <div
        className="mt-2 flex items-start gap-3 border bg-void/60 p-4"
        style={{ borderColor: `${app.color}55`, boxShadow: `0 0 24px ${app.glow}1f` }}
      >
        <app.icon size={22} className="mt-0.5 shrink-0" style={{ color: app.color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-white">{app.brand}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-gray-400">{description}</p>
          <p className="mt-1.5 truncate font-mono text-[11px] text-gray-600">{host}</p>
        </div>
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          title={openLabel}
          aria-label={openLabel}
          onMouseEnter={() => onHover?.()}
          onClick={onOpen}
          style={{ borderColor: `${app.color}66`, color: app.color }}
          className="flex shrink-0 items-center gap-1.5 self-center border px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-white/5"
        >
          {openLabel}
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </motion.div>
  );
}
