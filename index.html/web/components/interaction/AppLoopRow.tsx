'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { DIRECT_APP_SHORTCUTS } from '@/lib/appShortcuts';
import { AppDetailCard } from '@/components/interaction/AppDetailCard';

interface AppLoopRowProps {
  accent: string;
  label: string;
  onHover?: () => void;
}

/**
 * The pinned "바로가기" webmail/social launcher bar (owner instruction
 * 2026-09-03: "숏컷 게임 페이지 맨 하단의 바로가기 모듈을 U-AI 팝업창 맨
 * 아랫단에 항상 고정 노출"). A `shrink-0` sibling below the scrollable
 * content in every U-AI DialogTower -- HotShortcutResultModal's knowledge
 * ladder AND OmniSynapseSearch's live-search result tower -- so it never
 * scrolls out of view. Tapping a tile toggles AppDetailCard open beneath the
 * row instead of navigating immediately (owner instruction 2026-09-03:
 * "클릭 시 상세 내용과 설명 카드가 토글 형태로 나타나도록").
 */
export function AppLoopRow({ accent, label, onHover }: AppLoopRowProps) {
  const tEmail = useTranslations('Email');
  const tSocial = useTranslations('Social');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const expanded = DIRECT_APP_SHORTCUTS.find((app) => app.key === expandedKey) ?? null;

  return (
    <div className="shrink-0 border-t px-2.5 pb-3 pt-2 sm:px-4" style={{ borderColor: `${accent}22` }}>
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.3em] text-gray-500">{label}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {DIRECT_APP_SHORTCUTS.map((app) => {
          const tApp = app.family === 'email' ? tEmail : tSocial;
          const active = expandedKey === app.key;
          return (
            <button
              key={app.key}
              type="button"
              title={tApp('openAria', { brand: app.brand })}
              aria-label={tApp('openAria', { brand: app.brand })}
              aria-expanded={active}
              onMouseEnter={() => onHover?.()}
              onClick={() => setExpandedKey((prev) => (prev === app.key ? null : app.key))}
              style={{
                borderColor: `${app.color}55`,
                color: app.color,
                backgroundColor: active ? `${app.color}1a` : undefined,
              }}
              className="flex h-9 shrink-0 items-center gap-1.5 border bg-void/50 px-2.5 transition-colors hover:bg-void/90"
            >
              <app.icon size={14} aria-hidden="true" />
              <span className="whitespace-nowrap text-[11px] font-bold">{app.brand}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {expanded && (
          <AppDetailCard
            key={expanded.key}
            app={expanded}
            description={(expanded.family === 'email' ? tEmail : tSocial)('hint')}
            openLabel={(expanded.family === 'email' ? tEmail : tSocial)('openAria', { brand: expanded.brand })}
            onHover={onHover}
            onOpen={() => setExpandedKey(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
