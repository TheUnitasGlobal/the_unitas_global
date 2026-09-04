'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldHalf, Sparkles, Lock, Globe, Layers, Wand2, Search, ArrowRight } from 'lucide-react';
import {
  UAI_DEEP_INSIGHT_COST,
  type ConstitutionRedesignReport,
  type DeepReport,
  type SurfaceReport,
} from '@/lib/uai/types';
import type { UaiError, UaiPhase } from '@/lib/uai/useUai';
import { UnitasModuleRankings } from '@/components/home/UnitasModuleRankings';

interface UaiDashboardProps {
  phase: UaiPhase;
  surface: SurfaceReport | null;
  deep: DeepReport | null;
  /** FREE 6-axis Sovereign Redesign — forged at the search threshold / a paid
   *  burn, then served from Genesis Memory at engine cost 0원. */
  insight?: ConstitutionRedesignReport | null;
  /** cumulative search count for the current query. */
  trendHits?: number;
  /** the threshold round-trip is in flight. */
  insightForging?: boolean;
  error: UaiError | null;
  canDeep: boolean;
  deepAvailable: boolean;
  hasSession: boolean;
  onRunDeep: () => void;
  onSelectEcosystem?: (ecosystemKey: string) => void;
  /** Re-run the free surface search with a follow-up query (Phase-1 loop). */
  onRunQuery?: (query: string) => void;
  /** Home embed: show only the top-3 swarm + a "full report" affordance. */
  compact?: boolean;
  /** Tower (popup) mode: split-renders the report into two stacked zones --
   *  상단 = live search results/feed, 하단 = the new sovereign design
   *  structures (insight, doctrine deconstruction, redesign, deep gate). */
  split?: boolean;
  fullReportHref?: string;
}

const BAND_COLOR: Record<string, string> = { low: '#64748b', mid: '#22d3ee', high: '#d4af37' };
const SHIELD_COLOR: Record<string, string> = { clear: '#34d399', caution: '#fbbf24', biased: '#f87171' };
const AXIS_COLOR: Record<string, string> = {
  logic: '#38bdf8',
  future: '#a78bfa',
  economy: '#34d399',
  security: '#f87171',
  sovereign: '#d4af37',
  art: '#f472b6',
};

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(3, value)}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  );
}

export function UaiDashboard({
  phase,
  surface,
  deep,
  insight = null,
  trendHits = 0,
  insightForging = false,
  error,
  canDeep,
  deepAvailable,
  hasSession,
  onRunDeep,
  onSelectEcosystem,
  onRunQuery,
  compact = false,
  split = false,
  fullReportHref,
}: UaiDashboardProps) {
  const t = useTranslations('UAI');
  const tEco = useTranslations('Ecosystems');
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [swarmOpen, setSwarmOpen] = useState(false);
  const deepGateRef = useRef<HTMLDivElement | null>(null);

  const swarmRows = useMemo(() => {
    if (!surface) return [];
    return compact && !swarmOpen ? surface.swarm.slice(0, 3) : surface.swarm;
  }, [surface, compact, swarmOpen]);

  // "추가 검색 쿼리 · 관점 선택지" -- Phase-1 follow-up loop. Every entry is a
  // real, runnable query: two constitution-axis re-frames (the axis the subject
  // already leans into + the blind-spot axis the redesign vector attacks) plus
  // the titles of any real web sources folded into the digest.
  const followups = useMemo(() => {
    if (!surface) return [] as string[];
    const q = surface.query;
    const out: string[] = [
      `${q} · ${t(`constitution.${surface.topConstitutionAxis}`)}`,
      `${q} · ${t(`constitution.${surface.redesignAxis}`)}`,
    ];
    surface.web.sources.slice(0, 3).forEach((s) => {
      if (s.title && s.title.toLowerCase() !== q.toLowerCase()) out.push(s.title);
    });
    return Array.from(new Set(out)).slice(0, 5);
  }, [surface, t]);

  const goPaid = () => {
    if (canDeep) onRunDeep();
    deepGateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (phase === 'idle') return null;

  return (
    <div
      className={`glow-box flex flex-col gap-8 bg-quantum/90 text-[16px] leading-relaxed backdrop-blur-xl sm:text-[17px] ${
        split ? 'mt-3 p-4 sm:p-5' : 'mt-4 p-6 sm:p-8'
      }`}
    >
      {/* Reporter tier switch -- compact, always at the very top of the result
          window (owner instruction 2026-08-30). FREE is the live view; PAID
          opens the coin-burning deep report (or the sign-in gate). */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 border border-neon/50 bg-neon/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider text-neon">
          <Sparkles size={13} aria-hidden="true" /> {t('reporterFree')}
        </span>
        <button
          type="button"
          onClick={goPaid}
          className="inline-flex items-center gap-1.5 border border-accent/50 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-void"
        >
          {!hasSession && <Lock size={12} aria-hidden="true" />}
          {t('reporterPaid')}
        </button>
      </div>

      {/* Brand HUD title (English, not localized -- matches the tower's
          toolbar); the old directionality badge ("수렴형 의도" etc.) was
          cleansed per owner instruction 2026-09-02. */}
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">U-AI SEARCH RESULT</p>

      {(phase === 'surface-loading' || !surface) && (
        <p className="animate-pulse text-sm text-gray-400">{t('surfaceScanning')}</p>
      )}

      {surface && (
        <>
          {/* Phase 1 -- live web synthesis provenance (or local-fallback flag).
              Compact home embed shows the one-line badge only. */}
          <section className="space-y-2">
            <p className="flex items-center gap-1.5 text-[14px] font-bold uppercase tracking-widest text-gray-500">
              <Globe size={13} aria-hidden="true" /> {t('webSourcesLabel')}
            </p>
            <p className="text-[12px] text-gray-500">{t('webBlendNote')}</p>
            {compact ? (
              <p className="text-[12px] text-gray-500">
                {surface.web.sourced
                  ? t('webSourcedBadge', { count: surface.web.sources.length })
                  : t('webLocalBadge')}
              </p>
            ) : surface.web.sourced ? (
              <>
                <p className="text-[12px] text-neon/70">
                  {t('webSourcedBadge', { count: surface.web.sources.length })}
                </p>
                <ul className="space-y-1.5">
                  {surface.web.sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border-l-2 border-neon/40 pl-3 text-[13px] leading-snug text-gray-300 transition-colors hover:text-white"
                      >
                        <span className="font-bold text-gray-200">{s.title}</span>
                        <span className="mt-0.5 block text-[12px] text-gray-500">{s.snippet}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[12px] text-gray-500">{t('webLocalBadge')}</p>
            )}
          </section>

          {/* FREE 6-axis Sovereign Redesign -- the assetized "UNITAS Insight
              Report": forged once at the 3rd cumulative search (or a paid
              burn), then served from Genesis Memory forever at engine cost 0원
              (owner instruction 2026-08-31). Rendered directly below the
              meta-search provenance, per the directive. */}
          {/* 분할 아키텍처 divider -- in split (tower) mode everything below
              this line is the 하단 "신규 설계 구조" zone; everything above it
              is the 상단 live results/feed zone (flex order re-slots the
              sections without touching their standalone rendering). */}
          {split && <div aria-hidden="true" className="order-1 border-t-2 border-accent/30" />}

          {(insight || insightForging || trendHits > 0) && (
            <section className={`space-y-4 border-y border-accent/20 py-6 ${split ? 'order-2' : ''}`}>
              <p className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-[0.25em] text-accent">
                <Wand2 size={15} aria-hidden="true" /> {t('insightLabel')}
              </p>

              {insight ? (
                compact ? (
                  <div className="space-y-2">
                    {/* The "제네시스 메모리에서 제공 · 엔진 원가 $0" cached note
                        was permanently deleted (owner instruction 2026-09-02);
                        only the fresh-forge badge remains. */}
                    {!insight.cached && (
                      <p className="text-[12px] uppercase tracking-widest text-neon/70">
                        {t('insightFreshBadge')}
                      </p>
                    )}
                    <p className="text-[16px] leading-relaxed text-gray-200 [text-wrap:balance]">
                      {insight.synthesis}
                    </p>
                  </div>
                ) : (
                  <>
                    {!insight.cached && (
                      <p className="text-[12px] uppercase tracking-widest text-neon/70">
                        {t('insightFreshBadge')}
                      </p>
                    )}
                    <p className="border-l-2 border-accent/50 pl-4 font-serif text-[20px] leading-relaxed text-gray-100 [text-wrap:balance] sm:text-[22px]">
                      {insight.synthesis}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {insight.axes.map((ax) => (
                        <div
                          key={ax.axis}
                          className="border border-white/10 bg-void/40 p-4"
                          style={{ borderTopColor: AXIS_COLOR[ax.axis], borderTopWidth: 2 }}
                        >
                          <p
                            className="text-[14px] font-bold uppercase tracking-widest"
                            style={{ color: AXIS_COLOR[ax.axis] }}
                          >
                            {t(`constitution.${ax.axis}`)}
                          </p>
                          <p className="mt-2 text-[14px] leading-relaxed text-gray-400">
                            <span className="font-bold text-gray-300">{t('insightAxisReading')} · </span>
                            {ax.reading}
                          </p>
                          <p className="mt-2 text-[14px] leading-relaxed text-gray-200">
                            <span className="font-bold text-accent">{t('insightAxisRedesign')} · </span>
                            {ax.redesign}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="border border-accent/30 bg-black/30 p-4">
                      <p className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.3em] text-accent">
                        {t('insightVectorLabel')}
                      </p>
                      <p className="text-[16px] italic leading-relaxed text-gray-100 [text-wrap:balance]">
                        {insight.vector}
                      </p>
                    </div>
                    <p className="text-right text-[11px] uppercase tracking-widest text-gray-600">
                      {t('modelNote', { model: insight.model })}
                    </p>
                  </>
                )
              ) : insightForging || trendHits >= 3 ? (
                <p className="animate-pulse text-[13px] italic text-neon/80">{t('insightForging')}</p>
              ) : (
                <p className="text-[13px] text-gray-500">{t('insightPending', { hits: trendHits })}</p>
              )}
            </section>
          )}

          {/* Phase 1 -- 3-second triple lens */}
          <section className="space-y-3">
            <p className="text-[14px] font-bold uppercase tracking-widest text-gray-500">{t('lensLabel')}</p>
            {surface.lenses.map((lens) => (
              <div key={lens.key} className="grid grid-cols-[96px_1fr_auto] items-center gap-3">
                <span className="text-[14px] font-medium text-gray-300">{t(`lens.${lens.key}`)}</span>
                <Bar value={lens.score} color={BAND_COLOR[lens.band]} />
                <span className="w-10 text-right font-mono text-[12px] text-gray-500">{lens.score}</span>
              </div>
            ))}
          </section>

          {/* Phase 1 -- 71-doctrine deconstruction (constitution axes) */}
          {!compact && (
            <section className={`space-y-3 ${split ? 'order-2' : ''}`}>
              <p className="flex items-center gap-1.5 text-[14px] font-bold uppercase tracking-widest text-gray-500">
                <Layers size={13} aria-hidden="true" /> {t('constitutionLabel')}
              </p>
              {surface.constitution.map((c) => (
                <div key={c.axis} className="grid grid-cols-[96px_1fr_auto] items-center gap-3">
                  <span className="text-[14px] font-medium text-gray-300">{t(`constitution.${c.axis}`)}</span>
                  <Bar value={c.score} color={AXIS_COLOR[c.axis]} />
                  <span className="w-10 text-right font-mono text-[12px] text-gray-500">{c.score}</span>
                </div>
              ))}
              <p className="text-[12px] text-gray-500">
                {t('constitutionAxisNote', { axis: t(`constitution.${surface.redesignAxis}`) })}
              </p>
            </section>
          )}

          {/* Phase 1 -- commercial-bias shield gauge */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[14px] font-bold uppercase tracking-widest text-gray-500">
                <ShieldHalf size={13} aria-hidden="true" /> {t('shieldLabel')}
              </p>
              <span
                className="border px-2 py-0.5 text-[13px] font-bold uppercase tracking-widest"
                style={{ color: SHIELD_COLOR[surface.shield.verdict], borderColor: `${SHIELD_COLOR[surface.shield.verdict]}66` }}
              >
                {t(`shield.${surface.shield.verdict}`)}
              </span>
            </div>
            <Bar value={surface.shield.score} color={SHIELD_COLOR[surface.shield.verdict]} />
          </section>

          {/* Phase 1 -- 3-step action checklist */}
          <section className="space-y-2">
            <p className="text-[14px] font-bold uppercase tracking-widest text-gray-500">{t('checklistLabel')}</p>
            <ul className="space-y-2">
              {(t.raw(`checklist.${surface.checklistArchetype}`) as string[]).map((step, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))}
                    className="flex w-full items-start gap-2.5 text-left"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[12px] ${
                        checked[i] ? 'border-neon bg-neon/20 text-neon' : 'border-white/25 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className={`text-[15px] leading-snug ${checked[i] ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                      {step}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Phase 1 -- follow-up queries + angle options (Phase-1 loop).
              Shown in every mode -- on the home embed it deep-links to the full
              report, on the full page it re-runs the free search in place. */}
          {(onRunQuery || fullReportHref) && followups.length > 0 && (
            <section className="space-y-2.5 border-t border-white/10 pt-5">
              <p className="flex items-center gap-1.5 text-[14px] font-bold uppercase tracking-widest text-gray-500">
                <Search size={13} aria-hidden="true" /> {t('followupLabel')}
              </p>
              <p className="text-[12px] text-gray-500">{t('followupHint')}</p>
              <div className="flex flex-wrap gap-2">
                {followups.map((fq) =>
                  onRunQuery ? (
                    <button
                      key={fq}
                      type="button"
                      onClick={() => onRunQuery(fq)}
                      className="inline-flex items-center gap-1.5 border border-white/15 bg-void/50 px-3 py-1.5 text-[13px] text-gray-300 transition-colors hover:border-accent hover:text-white"
                    >
                      {fq}
                      <ArrowRight size={13} aria-hidden="true" className="text-accent" />
                    </button>
                  ) : (
                    <a
                      key={fq}
                      href={`${fullReportHref?.split('?')[0]}?q=${encodeURIComponent(fq)}`}
                      className="inline-flex items-center gap-1.5 border border-white/15 bg-void/50 px-3 py-1.5 text-[13px] text-gray-300 transition-colors hover:border-accent hover:text-white"
                    >
                      {fq}
                      <ArrowRight size={13} aria-hidden="true" className="text-accent" />
                    </a>
                  ),
                )}
              </div>
            </section>
          )}

          {/* Phase 1 -- 71-doctrine redesign vectors (blind-spot axis) */}
          {!compact && (
            <section className={`space-y-2 ${split ? 'order-2' : ''}`}>
              <p className="flex items-center gap-1.5 text-[14px] font-bold uppercase tracking-widest text-gray-500">
                <Wand2 size={13} aria-hidden="true" /> {t('redesignLabel')}
              </p>
              <ol className="space-y-2">
                {(t.raw('redesign') as string[]).map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-[15px] leading-snug text-gray-300">
                    <span className="font-mono text-[12px] text-accent">{String(i + 1).padStart(2, '0')}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Swarm cross-reasoning -- the UNITAS ecosystem/module list, revealed
              only once a search has produced a report (owner instruction
              2026-08-30). */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setSwarmOpen((v) => !v)}
              className="flex w-full items-center justify-between"
              aria-expanded={swarmOpen}
            >
              <span className="text-[14px] font-bold uppercase tracking-widest text-gray-500">{t('swarmLabel')}</span>
              <span className="text-accent">{swarmOpen || !compact ? '' : '+'}</span>
            </button>
            <div className="space-y-2">
              {swarmRows.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onSelectEcosystem?.(s.key)}
                  disabled={!onSelectEcosystem}
                  className="block w-full text-left disabled:cursor-default"
                >
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="text-gray-300">{tEco(`${s.messageKey}.title`)}</span>
                    <span className="font-mono text-gray-500">{s.score}</span>
                  </div>
                  <Bar value={s.score} color={s.color} />
                </button>
              ))}
            </div>
          </section>

          {/* Phase 2-4 gate */}
          <section ref={deepGateRef} className={`border-t border-white/10 pt-5 ${split ? 'order-2' : ''}`}>
            <p className="mb-1 flex items-center gap-1.5 text-[14px] font-bold uppercase tracking-[0.25em] text-accent">
              <Sparkles size={13} aria-hidden="true" /> {t('deepLabel')}
            </p>
            <p className="mb-3 text-[12px] text-gray-500">{t('deepHint')}</p>

            {error && <p className="mb-3 text-[13px] font-bold text-red-400">{t(`err.${error}`)}</p>}

            {!deep && phase !== 'deep-loading' && (
              <>
                {deepAvailable ? (
                  <button
                    type="button"
                    onClick={onRunDeep}
                    disabled={!canDeep}
                    className="flex w-full items-center justify-center gap-2 border border-accent bg-accent/10 py-3 text-[14px] font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {!hasSession && <Lock size={13} aria-hidden="true" />}
                    {hasSession ? t('deepCta', { cost: UAI_DEEP_INSIGHT_COST }) : t('err.signin')}
                  </button>
                ) : (
                  <p className="border border-white/10 bg-void/50 px-3 py-3 text-center text-[12px] uppercase tracking-widest text-gray-500">
                    {t('deepLocked')}
                  </p>
                )}
                {compact && fullReportHref && (
                  <a
                    href={fullReportHref}
                    className="mt-2 block w-full border border-white/15 py-2.5 text-center text-[14px] font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-accent hover:text-accent"
                  >
                    {t('openFullReport')}
                  </a>
                )}
              </>
            )}

            {phase === 'deep-loading' && (
              <p className="animate-pulse text-center text-sm italic text-neon/80">{t('deepScanning')}</p>
            )}
          </section>

          <AnimatePresence>
            {deep && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`space-y-6 border-t border-white/10 pt-6 ${split ? 'order-2' : ''}`}
              >
                {/* Chronos */}
                <section>
                  <p className="mb-3 text-[13px] font-bold uppercase tracking-widest text-gray-500">{t('chronosLabel')}</p>
                  <ol className="relative space-y-4 border-l border-white/15 pl-5">
                    {deep.chronos.map((point) => (
                      <li key={point.horizon} className="relative">
                        <span className="absolute -left-[23px] top-1 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                        <p className="text-[13px] font-bold uppercase tracking-widest text-accent">
                          {t(`chronos.${point.horizon}`)}
                        </p>
                        <p className="mt-1 text-[15px] leading-relaxed text-gray-300">{point.text}</p>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* Binary verdict */}
                <section className="border border-white/10 bg-void/50 p-4">
                  <p className="mb-3 text-[13px] font-bold uppercase tracking-widest text-gray-500">{t('binaryLabel')}</p>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {(['A', 'B'] as const).map((opt) => {
                      const picked = deep.binary.pick === opt;
                      return (
                        <div
                          key={opt}
                          className={`border p-3 text-[13px] ${
                            picked ? 'border-neon bg-neon/10 text-white' : 'border-white/10 text-gray-400'
                          }`}
                        >
                          <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            {opt}
                          </span>
                          {opt === 'A' ? deep.binary.optionA : deep.binary.optionB}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mb-2 flex items-center justify-between text-[12px]">
                    <span className="text-gray-500">{t('confidence')}</span>
                    <span className="font-mono text-neon">{deep.binary.confidence}%</span>
                  </div>
                  <Bar value={deep.binary.confidence} color="#22d3ee" />
                  <p className="mt-3 text-[15px] leading-relaxed text-gray-300">{deep.binary.rationale}</p>
                </section>

                {/* Red pen */}
                <section>
                  <p className="mb-2 text-[13px] font-bold uppercase tracking-widest text-gray-500">{t('redPenLabel')}</p>
                  <ul className="space-y-2">
                    {deep.redPen.map((line, i) => (
                      <li key={i} className="border-l-2 border-red-400/60 pl-3 text-[15px] leading-relaxed text-gray-300">
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>

                {/* The VOID */}
                <section className="border border-accent/25 bg-black/30 p-4">
                  <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.3em] text-accent">{t('voidLabel')}</p>
                  <p className="text-[18px] italic leading-relaxed text-gray-200 [text-wrap:balance]">{deep.voidInsight}</p>
                </section>

                {/* Efficiency path */}
                <section>
                  <p className="mb-2 text-[13px] font-bold uppercase tracking-widest text-gray-500">{t('pathLabel')}</p>
                  <ol className="space-y-2">
                    {deep.efficiencyPath.map((step, i) => (
                      <li key={i} className="flex gap-2.5 text-[15px] leading-snug text-gray-300">
                        <span className="font-mono text-[12px] text-accent">{String(i + 1).padStart(2, '0')}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </section>

                <p className="text-right text-[11px] uppercase tracking-widest text-gray-600">
                  {deep.cached && <span className="mr-2 text-neon/70">{t('cachedBadge')}</span>}
                  {t('modelNote', { model: deep.model })}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* "실시간 유니타스 랭킹" -- mounted here (팝업) and again at the home
              page's bottom (페이지 최하단), per owner instruction 2026-09-04
              round 2. Skipped in the compact home-embed card so that smaller
              surface doesn't inherit a full cross-module leaderboard. */}
          {!compact && (
            <div className={split ? 'order-2' : ''}>
              <UnitasModuleRankings />
            </div>
          )}
        </>
      )}
    </div>
  );
}
