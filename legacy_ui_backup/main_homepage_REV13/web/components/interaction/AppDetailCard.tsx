'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import {
  ExternalLink,
  Activity,
  TrendingUp,
  Minus,
  TrendingDown,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import type { DirectAppShortcut } from '@/lib/appShortcuts';
import { useShortcutFeed } from '@/lib/uai/useShortcutFeed';
import { isViableShortcutQuery } from '@/lib/uai/shortcutCore';
import type { AnalyticsLabels } from '@/lib/uai/shortcutAnalytics';
import type { ConstitutionAxis, LensKey } from '@/lib/uai/types';

interface AppDetailCardProps {
  app: DirectAppShortcut;
  /** "{brand} 바로가기" / "{brand} 열기" -- doubles as the open button's
   *  visible label and its title/aria-label. */
  openLabel: string;
  onHover?: () => void;
  onOpen?: () => void;
}

const TREND_ICON: Record<'rising' | 'stable' | 'cooling', LucideIcon> = {
  rising: TrendingUp,
  stable: Minus,
  cooling: TrendingDown,
};

function hoursSince(ts: number | null): number | null {
  if (!ts) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 3_600_000));
}

/** "X" is the one brand name under the engine's 2-char viability floor --
 *  padded so it still seeds a real tier instead of silently staying empty. */
function seedQuery(brand: string): string {
  return isViableShortcutQuery(brand) ? brand : `${brand} app`;
}

/**
 * The "심층 세부 설명과 백과사전급 팝업 카드" (owner instruction 2026-09-04):
 * social/email tiles used to toggle open a thin card carrying nothing but a
 * static one-line hint and a "go to link" button -- standardized here to the
 * SAME encyclopedic engine every other U-AI shortcut renders through
 * (HotShortcutResultModal's TierCard): live web-sourced sources, the
 * LLM-forged 6-axis UNITAS deep report and a pulse gauge, all served by the
 * existing 24h sovereign shortcut-cache engine keyed on the brand name --
 * zero new backend work. Leaving the site is still an explicit, separate tap
 * on the pinned "바로가기" button; the static guide sentence is gone, its
 * place taken by whatever the engine actually finds. Keyword chips pivot
 * this same card to the tapped subject instead of opening a new popup.
 * Shared between HotShortcutMatrixStrip's tab grid and AppLoopRow's pinned
 * bar so both toggle surfaces read identically.
 */
export function AppDetailCard({ app, openLabel, onHover, onOpen }: AppDetailCardProps) {
  const locale = useLocale();
  const tModal = useTranslations('HotShortcutModal');
  const tUai = useTranslations('UAI');
  const tEcosystems = useTranslations('Ecosystems');
  const [query, setQuery] = useState(() => seedQuery(app.brand));

  const labels: AnalyticsLabels = {
    ecosystems: (key: string) => tEcosystems(key),
    constitution: (axis: ConstitutionAxis) => tUai(`constitution.${axis}`),
    lens: (key: LensKey) => tUai(`lens.${key}`),
  };

  const feed = useShortcutFeed(query, locale, labels);
  const analysis = feed.analysis;
  const report = feed.report;
  const leadSnippet = analysis?.web.sources[0]?.snippet ?? '';
  const TrendIcon = analysis ? TREND_ICON[analysis.pulse.trend] : Activity;
  const cachedHours = analysis && analysis.source !== 'local' ? hoursSince(analysis.synthesizedAt) : null;
  const title = query === seedQuery(app.brand) ? app.brand : query;

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
        className="mt-2 border bg-void/60 p-4"
        style={{ borderColor: `${app.color}55`, boxShadow: `0 0 24px ${app.glow}1f` }}
      >
        <div className="flex items-start gap-3">
          <app.icon size={22} className="mt-0.5 shrink-0" style={{ color: app.color }} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-white">{title}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-gray-600">{host}</p>
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

        <div className="mt-3 border-l-2 pl-3" style={{ borderColor: `${app.color}88` }}>
          {analysis ? (
            <p className="text-[14px] leading-relaxed text-gray-200 sm:text-[16px]">
              {leadSnippet ||
                tUai('constitutionAxisNote', { axis: tUai(`constitution.${analysis.report.redesignAxis}`) })}
            </p>
          ) : (
            <p className="animate-pulse text-[12px] text-gray-500">{tModal('analyzing')}</p>
          )}
        </div>

        {analysis && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {analysis.web.sourced && (
                <span className="border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {tUai('webSourcedBadge', { count: analysis.web.sources.length })}
                </span>
              )}
              {cachedHours !== null && (
                <span
                  className="border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: `${app.color}cc`, borderColor: `${app.color}33` }}
                >
                  {cachedHours === 0 ? tModal('synthesizedJustNow') : tModal('synthesizedAgo', { hours: cachedHours })}
                </span>
              )}
            </div>

            {report && (
              <div className="border p-3" style={{ borderColor: `${app.color}33`, backgroundColor: `${app.color}0a` }}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: app.color }}>
                  {tModal('deepLabel')}
                </p>
                <div className="space-y-2">
                  <p className="text-[13px] italic leading-relaxed text-gray-100 [text-wrap:balance]">{report.vector}</p>
                  <p className="text-[12px] leading-relaxed text-gray-300">{report.synthesis}</p>
                  <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {report.axes.map((ax) => (
                      <li key={ax.axis} className="border border-white/10 p-2">
                        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: app.color }}>
                          {tUai(`constitution.${ax.axis}`)}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-gray-300">{ax.redesign}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Activity size={10} aria-hidden="true" />
                  {tModal('pulseLabel')}
                </span>
                <span className="flex items-center gap-1.5" style={{ color: app.color }}>
                  <TrendIcon size={11} aria-hidden="true" />
                  {tModal(`pulse.${analysis.pulse.trend}`)}
                  <span className="text-gray-500">· {analysis.pulse.momentum}%</span>
                </span>
              </div>
              <div className="h-1 w-full bg-white/10">
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: app.color, boxShadow: `0 0 10px ${app.glow}88` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${analysis.pulse.momentum}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">{tModal('feedLabel')}</p>
              {analysis.web.sources.length > 0 ? (
                <ul className="space-y-1">
                  {analysis.web.sources.slice(0, 5).map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onMouseEnter={() => onHover?.()}
                        className="group flex items-start gap-1.5 text-[13px] text-gray-300 transition-colors hover:text-white"
                      >
                        <ExternalLink size={11} className="mt-0.5 shrink-0 text-gray-500 group-hover:text-accent" aria-hidden="true" />
                        <span className="line-clamp-2">
                          <span className="font-bold" style={{ color: app.color }}>
                            {source.title}
                          </span>
                          {source.snippet && <span className="text-gray-400"> — {source.snippet.slice(0, 110)}</span>}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-gray-500">{tModal('feedEmpty')}</p>
              )}
            </div>

            {analysis.keywords.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">
                  {tModal('keywordsLabel')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.keywords.map((chip) => (
                    <button
                      key={`${chip.kind}-${chip.query}`}
                      type="button"
                      onMouseEnter={() => onHover?.()}
                      onClick={() => setQuery(chip.query)}
                      title={tModal('keywordHint')}
                      className="flex items-center gap-1 border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:bg-white/5"
                      style={{
                        borderColor: chip.kind === 'entity' ? `${app.color}66` : 'rgba(255,255,255,0.15)',
                        color: chip.kind === 'entity' ? app.color : '#d1d5db',
                      }}
                    >
                      {chip.label}
                      <ArrowRight size={10} className="opacity-60" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
