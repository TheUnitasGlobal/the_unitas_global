'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, GitBranch, Loader2, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { DialogTower } from '@/components/ui/DialogTower';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import {
  FATE_HORIZONS,
  HYPER_ENGINES,
  MARGIN_DEFAULTS,
  computeFate,
  forgeTimeline,
  forgeTwin,
  hyperEngine,
  normalizeHyperSeed,
  replicateIdeas,
  simulateMargin,
  type BusinessIdea,
  type FateHorizon,
  type HyperEngineKey,
  type MarginInput,
} from '@/lib/hyperSovereign';
import { MODULE_REGISTRY, moduleTitleNamespace } from '@/lib/unitasRankings';
import { useHyperReport } from '@/lib/uai/hyperShortcutClient';
import type { HyperReport } from '@/lib/uai/hyperShortcut';
import type { ConstitutionAxis } from '@/lib/uai/types';

interface HyperSovereignTowerProps {
  engine: HyperEngineKey | null;
  onClose: () => void;
  /** Hop to another engine without leaving the tower (the switch row). */
  onSwitch: (engine: HyperEngineKey) => void;
}

/** The seed survives a locale remount and a re-open (same shape as the
 *  shortcut ladder's sessionStorage persistence). */
const SEED_STORAGE_KEY = 'unitas.hyper.seed.v1';

const CONSTITUTION_COLOR: Record<ConstitutionAxis, string> = {
  logic: '#22d3ee',
  future: '#a855f7',
  economy: '#f59e0b',
  security: '#10b981',
  sovereign: '#d4af37',
  art: '#f43f5e',
};

const ELEMENT_COLOR: Record<string, string> = {
  earth: '#a3e635',
  water: '#38bdf8',
  fire: '#f97316',
  wind: '#c4b5fd',
  lightning: '#fde047',
};

function Bar({ value, color, label, suffix = '%' }: { value: number; color: string; label: ReactNode; suffix?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-[12px] font-bold uppercase tracking-widest text-gray-400 sm:w-36">{label}</span>
      <span className="relative h-2 min-w-0 flex-1 overflow-hidden bg-white/5">
        <motion.span
          className="absolute inset-y-0 left-0"
          style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}88` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </span>
      <span className="w-12 shrink-0 text-right text-[12px] font-bold tabular-nums text-white">
        {value}
        {suffix}
      </span>
    </div>
  );
}

function Panel({ title, children, accent }: { title: ReactNode; children: ReactNode; accent: string }) {
  return (
    <section className="border border-white/10 bg-void/40 p-4 sm:p-5">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-widest" style={{ color: accent }}>
        {title}
      </p>
      {children}
    </section>
  );
}

/**
 * The Hyper-Sovereign engine tower (owner instruction 2026-09-04 round 6):
 * the popup every 초소버린 숏컷 tile opens. Same DialogTower frame + toolbar
 * as the shortcut ladder and the U-AI search result, but the body is an
 * *instrument*, not a report: the visitor feeds a seed, the deterministic
 * engine (lib/hyperSovereign.ts) answers instantly at 0원, and every
 * result carries a mutation control (증식 / 인과율 해킹 / 트윈 진화 / 재단조 /
 * live sliders) that re-runs it into a new state -- the loop that makes it
 * addictive. The U-AI oracle (lib/uai/hyperShortcutClient.ts) then layers
 * localized narration over the very same numbers, cached forever per
 * (locale, engine, seed, variant). Engines can be hopped between from the
 * switch row without ever leaving the tower.
 */
export function HyperSovereignTower({ engine, onClose, onSwitch }: HyperSovereignTowerProps) {
  const locale = useLocale();
  const t = useTranslations('HyperSovereign');
  const tModal = useTranslations('HotShortcutModal');
  const tGov = useTranslations('Governance');
  const tUai = useTranslations('UAI');
  const tEco = useTranslations('Ecosystems');
  const tModules = useTranslations('Modules');
  const { playHoverSfx, playQuestEnterSfx } = useSpatialAudio();

  const [seedInput, setSeedInput] = useState('');
  const [seed, setSeed] = useState('');
  const [ideas, setIdeas] = useState<BusinessIdea[]>([]);
  const [focus, setFocus] = useState<{ parent: string | null; generation: number }>({ parent: null, generation: 0 });
  const [narrations, setNarrations] = useState<Record<string, HyperReport>>({});
  const [horizon, setHorizon] = useState<FateHorizon>(3);
  const [hacked, setHacked] = useState<ConstitutionAxis[]>([]);
  const [twinGeneration, setTwinGeneration] = useState(0);
  const [chronoVariant, setChronoVariant] = useState(0);
  const [margin, setMargin] = useState<MarginInput>(MARGIN_DEFAULTS);
  const [stack, setStack] = useState<HyperEngineKey[]>([]);

  const open = engine !== null;
  const meta = hyperEngine(engine ?? 'ideaReplicator');
  const baseYear = new Date().getFullYear();

  // Restore the seed on open.
  useEffect(() => {
    if (!open) return;
    try {
      const saved = sessionStorage.getItem(SEED_STORAGE_KEY) ?? '';
      if (saved) {
        setSeedInput(saved);
        setSeed(saved);
      }
    } catch {
      // sessionStorage unavailable -- persistence is a nicety.
    }
  }, [open]);

  useEffect(() => {
    try {
      if (seed) sessionStorage.setItem(SEED_STORAGE_KEY, seed);
    } catch {
      // non-fatal.
    }
  }, [seed]);

  // A new seed re-roots the idea tree and resets every mutation counter.
  useEffect(() => {
    setIdeas(seed ? replicateIdeas(seed, null, 0) : []);
    setFocus({ parent: null, generation: 0 });
    setHacked([]);
    setTwinGeneration(0);
    setChronoVariant(0);
  }, [seed]);

  const variant = useMemo(() => {
    switch (engine) {
      case 'ideaReplicator':
        return `${focus.parent ?? 'root'}:${focus.generation}`;
      case 'fateEngine':
        return `${horizon}:${[...hacked].sort().join('+') || 'none'}`;
      case 'omniTwin':
        return `${twinGeneration}`;
      case 'chronoForge':
        return `${chronoVariant}:${baseYear}`;
      default:
        return '';
    }
  }, [engine, focus, horizon, hacked, twinGeneration, chronoVariant, baseYear]);

  const narrated = Boolean(engine) && meta.narrated && Boolean(seed);
  const { report, loading: oracleLoading } = useHyperReport(engine ?? 'ideaReplicator', seed, variant, locale, narrated);

  useEffect(() => {
    if (!report || !engine) return;
    setNarrations((prev) => ({ ...prev, [`${engine}:${report.variant}`]: report }));
  }, [report, engine]);

  const fate = useMemo(() => (seed ? computeFate(seed, horizon, hacked) : null), [seed, horizon, hacked]);
  const twin = useMemo(() => (seed ? forgeTwin(seed, twinGeneration) : null), [seed, twinGeneration]);
  const timeline = useMemo(() => (seed ? forgeTimeline(seed, chronoVariant, baseYear) : []), [seed, chronoVariant, baseYear]);
  const marginResult = useMemo(() => simulateMargin(margin), [margin]);

  function moduleTitle(key: string): string {
    const module = MODULE_REGISTRY.find((m) => m.key === key);
    if (!module) return key;
    const tt = moduleTitleNamespace(module) === 'Ecosystems' ? tEco : tModules;
    return tt(`${module.messageKey}.title`);
  }

  function axisTitle(key: string): string {
    return tGov(`axes.${key}.title`);
  }

  function submitSeed(e: FormEvent) {
    e.preventDefault();
    const next = normalizeHyperSeed(seedInput);
    if (!next) return;
    playQuestEnterSfx();
    if (next === seed) {
      // Same seed again = a manual re-roll of the active mutation.
      mutate();
      return;
    }
    setSeed(next);
  }

  /** The engine's own "again" control. */
  function mutate() {
    switch (engine) {
      case 'ideaReplicator':
        setIdeas(seed ? replicateIdeas(seed, null, 0) : []);
        setFocus({ parent: null, generation: 0 });
        break;
      case 'fateEngine':
        setHacked([]);
        break;
      case 'omniTwin':
        setTwinGeneration((g) => g + 1);
        break;
      case 'chronoForge':
        setChronoVariant((v) => v + 1);
        break;
      case 'marginInfinity':
        setMargin(MARGIN_DEFAULTS);
        break;
      default:
        break;
    }
  }

  function replicate(parent: BusinessIdea) {
    if (ideas.some((i) => i.parentId === parent.id)) {
      setFocus({ parent: parent.id, generation: parent.generation + 1 });
      return;
    }
    playQuestEnterSfx();
    const children = replicateIdeas(seed, parent.id, parent.generation + 1);
    setIdeas((prev) => [...prev, ...children]);
    setFocus({ parent: parent.id, generation: parent.generation + 1 });
  }

  function toggleHack(axis: ConstitutionAxis) {
    playQuestEnterSfx();
    setHacked((prev) => (prev.includes(axis) ? prev.filter((a) => a !== axis) : [...prev, axis]));
  }

  function switchEngine(next: HyperEngineKey) {
    if (!engine || next === engine) return;
    playHoverSfx();
    setStack((prev) => [...prev, engine]);
    onSwitch(next);
  }

  function goBack() {
    const prev = stack[stack.length - 1];
    if (prev) {
      setStack((s) => s.slice(0, -1));
      onSwitch(prev);
      return;
    }
    onClose();
  }

  function goHome() {
    setStack([]);
    setSeedInput('');
    setSeed('');
    setMargin(MARGIN_DEFAULTS);
    try {
      sessionStorage.removeItem(SEED_STORAGE_KEY);
    } catch {
      // non-fatal.
    }
  }

  const accent = meta.color;
  const accentGlow = meta.glow;

  const seedPlaceholder =
    engine === 'fateEngine' ? t('goalPlaceholder') : engine === 'omniTwin' ? t('subjectPlaceholder') : t('seedPlaceholder');

  const primaryButton =
    'flex shrink-0 items-center gap-2 border px-4 py-3 text-[13px] font-bold uppercase tracking-widest transition-colors hover:bg-white/5 sm:text-[15px]';

  function narrationFor(key: string): HyperReport | null {
    return narrations[key] ?? null;
  }

  // ---------------------------------------------------------------- ideas
  function renderIdea(idea: BusinessIdea, index: number, depth: number): ReactNode {
    const group = narrationFor(`ideaReplicator:${idea.parentId ?? 'root'}:${idea.generation}`);
    const narrated = group?.items[index] ?? null;
    const children = ideas.filter((i) => i.parentId === idea.id);
    const hasChildren = children.length > 0;
    return (
      <li key={idea.id} className={depth > 0 ? 'ml-3 border-l pl-3 sm:ml-5 sm:pl-4' : ''} style={{ borderColor: `${accent}33` }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: index * 0.05 }}
          className="border border-white/10 bg-void/50 p-4"
        >
          <div className="flex flex-wrap items-start gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center border text-[11px] font-bold"
              style={{ borderColor: `${accent}66`, color: accent }}
            >
              {idea.generation === 0 ? 'S' : `G${idea.generation}`}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold leading-snug text-white sm:text-[17px]">
                {narrated?.title || `${axisTitle(idea.axisKey)} × ${moduleTitle(idea.moduleKey)}`}
              </p>
              <p className="mt-0.5 text-[12px] uppercase tracking-widest text-gray-400">
                {t(`patterns.${idea.pattern}`)} · {axisTitle(idea.axisKey)} · {moduleTitle(idea.moduleKey)}
              </p>
            </div>
            <span className="shrink-0 border border-white/15 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {t('generation', { n: idea.generation })}
            </span>
          </div>
          {narrated?.body && <p className="mt-3 text-[14px] leading-relaxed text-gray-200">{narrated.body}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-3">
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
              <dt className="text-gray-500">{t('metrics.capital')}</dt>
              <dd className="font-bold" style={{ color: accent }}>
                {t('capitalZero')}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
              <dt className="text-gray-500">{t('metrics.launchDays')}</dt>
              <dd className="font-bold text-white">{idea.metrics.launchDays}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
              <dt className="text-gray-500">{t('metrics.automation')}</dt>
              <dd className="font-bold text-white">{idea.metrics.automation}%</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
              <dt className="text-gray-500">{t('metrics.margin')}</dt>
              <dd className="font-bold text-white">×{idea.metrics.marginX}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
              <dt className="text-gray-500">{t('metrics.viability')}</dt>
              <dd className="font-bold text-white">{idea.metrics.viability}%</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
              <dt className="text-gray-500">{t('metrics.blueOcean')}</dt>
              <dd className="font-bold text-white">{idea.metrics.blueOcean}%</dd>
            </div>
          </dl>
          {!hasChildren && idea.generation < 12 && (
            <button
              type="button"
              onMouseEnter={() => playHoverSfx()}
              onClick={() => replicate(idea)}
              className={`${primaryButton} mt-3`}
              style={{ borderColor: `${accent}66`, color: accent }}
            >
              <GitBranch size={15} aria-hidden="true" />
              {t('replicate')}
            </button>
          )}
        </motion.div>
        {hasChildren && <ul className="mt-2 space-y-2">{children.map((child, i) => renderIdea(child, i, depth + 1))}</ul>}
      </li>
    );
  }

  function renderIdeaReplicator() {
    const roots = ideas.filter((i) => i.parentId === null);
    if (roots.length === 0) return <p className="text-[14px] text-gray-400">{t('emptyState')}</p>;
    return (
      <Panel title={t('lineage')} accent={accent}>
        <ul className="space-y-2">{roots.map((idea, i) => renderIdea(idea, i, 0))}</ul>
      </Panel>
    );
  }

  // ----------------------------------------------------------------- fate
  function renderFate() {
    if (!fate) return <p className="text-[14px] text-gray-400">{t('emptyState')}</p>;
    const leverNarration = narrationFor(`fateEngine:${variant}`);
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('probability')} accent={accent}>
          <div className="flex flex-wrap items-end gap-4">
            <AnimatePresence mode="popLayout">
              <motion.p
                key={fate.probability}
                initial={{ opacity: 0, scale: 0.85, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="text-[64px] font-bold leading-none tabular-nums text-white sm:text-[80px]"
                style={{ textShadow: `0 0 32px ${accentGlow}66` }}
              >
                {fate.probability}
                <span className="text-[28px]">%</span>
              </motion.p>
            </AnimatePresence>
            <div className="mb-2 flex flex-col gap-1 text-[12px] text-gray-400">
              <span>
                {t('horizon')} · {t('yearsShort', { n: horizon })}
              </span>
              <span>
                {t('entropy')} · {fate.entropy}/100
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {FATE_HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onMouseEnter={() => playHoverSfx()}
                onClick={() => setHorizon(h)}
                className={`border px-3 py-2 text-[12px] font-bold uppercase tracking-widest transition-colors sm:text-[13px] ${
                  h === horizon ? 'text-white' : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white'
                }`}
                style={h === horizon ? { borderColor: accent, backgroundColor: `${accent}1a` } : undefined}
              >
                {t('yearsShort', { n: h })}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{t('trajectory')}</p>
            {fate.trajectory.map((p) => (
              <Bar key={p.year} value={p.probability} color={accent} label={t('yearsShort', { n: p.year })} />
            ))}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title={t('constitution')} accent={accent}>
            <div className="space-y-2">
              {fate.axes.map((a) => (
                <Bar key={a.axis} value={a.score} color={CONSTITUTION_COLOR[a.axis]} label={tUai(`constitution.${a.axis}`)} />
              ))}
            </div>
          </Panel>
          <Panel title={t('levers')} accent={accent}>
            <ul className="space-y-2">
              {fate.levers.map((lever, i) => {
                const narratedLever = leverNarration?.items[i] ?? null;
                return (
                  <li key={lever.axis} className="border border-white/10 bg-void/50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0"
                        style={{ backgroundColor: CONSTITUTION_COLOR[lever.axis], boxShadow: `0 0 10px ${CONSTITUTION_COLOR[lever.axis]}` }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 text-[14px] font-bold text-white">
                        {narratedLever?.title || tUai(`constitution.${lever.axis}`)}
                      </span>
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: accent }}>
                        +{lever.delta}%
                      </span>
                      <button
                        type="button"
                        onMouseEnter={() => playHoverSfx()}
                        onClick={() => toggleHack(lever.axis)}
                        aria-pressed={lever.applied}
                        className={`flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                          lever.applied ? 'text-void' : 'hover:bg-white/5'
                        }`}
                        style={
                          lever.applied
                            ? { borderColor: accent, backgroundColor: accent }
                            : { borderColor: `${accent}66`, color: accent }
                        }
                      >
                        <Zap size={12} aria-hidden="true" />
                        {lever.applied ? t('hacked') : t('hack')}
                      </button>
                    </div>
                    {narratedLever?.body && <p className="mt-2 text-[13px] leading-relaxed text-gray-300">{narratedLever.body}</p>}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------- twin
  function renderTwin() {
    if (!twin) return <p className="text-[14px] text-gray-400">{t('emptyState')}</p>;
    const narration = narrationFor(`omniTwin:${variant}`);
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('signature')} accent={accent}>
          <AnimatePresence mode="popLayout">
            <motion.p
              key={twin.signature}
              initial={{ opacity: 0, letterSpacing: '0.6em' }}
              animate={{ opacity: 1, letterSpacing: '0.18em' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="break-all font-mono text-[22px] font-bold text-white sm:text-[28px]"
              style={{ textShadow: `0 0 24px ${accentGlow}66` }}
            >
              {twin.signature}
            </motion.p>
          </AnimatePresence>
          <p className="mt-2 text-[12px] text-gray-400">
            {t('generation', { n: twin.generation })} · {t('entropy')} {twin.entropy}/100
          </p>
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{t('elements')}</p>
            {twin.elements.map((e) => (
              <Bar key={e.element} value={e.score} color={ELEMENT_COLOR[e.element]} label={t(`element.${e.element}`)} />
            ))}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title={t('constitution')} accent={accent}>
            <div className="space-y-2">
              {twin.constitution.map((c) => (
                <Bar key={c.axis} value={c.score} color={CONSTITUTION_COLOR[c.axis]} label={tUai(`constitution.${c.axis}`)} />
              ))}
            </div>
          </Panel>
          <Panel title={t('resonance')} accent={accent}>
            <ul className="space-y-2">
              {twin.resonance.map((r, i) => {
                const item = narration?.items[i] ?? null;
                return (
                  <li key={r.axisKey} className="border border-white/10 bg-void/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-[14px] font-bold text-white">{item?.title || axisTitle(r.axisKey)}</span>
                      <span className="text-[12px] uppercase tracking-widest text-gray-500">{axisTitle(r.axisKey)}</span>
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: accent }}>
                        {r.score}%
                      </span>
                    </div>
                    {item?.body && <p className="mt-1.5 text-[13px] leading-relaxed text-gray-300">{item.body}</p>}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- chrono
  function renderChrono() {
    if (timeline.length === 0) return <p className="text-[14px] text-gray-400">{t('emptyState')}</p>;
    const narration = narrationFor(`chronoForge:${variant}`);
    return (
      <Panel title={t('milestone')} accent={accent}>
        <ol className="relative space-y-3 border-l pl-5" style={{ borderColor: `${accent}44` }}>
          {timeline.map((m, i) => {
            const item = narration?.items[i] ?? null;
            return (
              <motion.li
                key={`${m.year}-${chronoVariant}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: i * 0.07 }}
                className="relative border border-white/10 bg-void/50 p-4"
              >
                <span
                  className="absolute -left-[1.85rem] top-5 h-3 w-3 border-2 bg-quantum"
                  style={{ borderColor: accent, boxShadow: `0 0 12px ${accentGlow}` }}
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[20px] font-bold tabular-nums text-white" style={{ textShadow: `0 0 16px ${accentGlow}44` }}>
                    {t('yearLabel', { year: m.year })}
                  </span>
                  <span className="text-[12px] uppercase tracking-widest text-gray-400">
                    +{t('yearsShort', { n: m.offset })} · {axisTitle(m.axisKey)} · {t(`patterns.${m.pattern}`)}
                  </span>
                  <span className="ml-auto text-[13px] font-bold tabular-nums" style={{ color: accent }}>
                    {m.probability}%
                  </span>
                </div>
                <p className="mt-1.5 text-[15px] font-bold text-white">{item?.title || `${axisTitle(m.axisKey)} · ${t(`patterns.${m.pattern}`)}`}</p>
                {item?.body && <p className="mt-1.5 text-[13px] leading-relaxed text-gray-300">{item.body}</p>}
                <div className="mt-2 flex items-center gap-1.5" aria-label={t('magnitude', { n: m.magnitude })} title={t('magnitude', { n: m.magnitude })}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <span
                      key={k}
                      className="h-1.5 w-5"
                      style={{ backgroundColor: k < m.magnitude ? accent : 'rgba(255,255,255,0.08)' }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </motion.li>
            );
          })}
        </ol>
      </Panel>
    );
  }

  // --------------------------------------------------------------- margin
  function slider(key: keyof MarginInput, min: number, max: number, step: number, format: (v: number) => string) {
    return (
      <label className="block">
        <span className="flex items-center justify-between text-[12px] font-bold uppercase tracking-widest text-gray-400">
          {t(`sliders.${key}`)}
          <span className="tabular-nums text-white">{format(margin[key])}</span>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={margin[key]}
          onChange={(e) => setMargin((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
          className="mt-1.5 w-full accent-[#d4af37]"
        />
      </label>
    );
  }

  function renderMargin() {
    const r = marginResult;
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('engines.marginInfinity.title')} accent={accent}>
          <div className="space-y-4">
            {slider('price', 0, 20, 0.5, (v) => `${v} U-COIN`)}
            {slider('burn', 0, 5, 0.05, (v) => `${v.toFixed(2)} U-COIN`)}
            {slider('cacheHit', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
            {slider('calls', 0, 100000, 500, (v) => v.toLocaleString())}
          </div>
        </Panel>
        <Panel title={t('margin')} accent={accent}>
          <AnimatePresence mode="popLayout">
            <motion.p
              key={r.marginX === null ? 'inf' : r.marginPct}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-[64px] font-bold leading-none tabular-nums text-white sm:text-[80px]"
              style={{ textShadow: `0 0 32px ${accentGlow}66` }}
            >
              {r.marginX === null ? '∞' : `${r.marginPct}%`}
            </motion.p>
          </AnimatePresence>
          <p className="mt-1 text-[12px] uppercase tracking-widest text-gray-400">
            {r.marginX === null ? t('marginInfinite') : `×${r.marginX}`}
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
            <div>
              <dt className="text-gray-500">{t('revenue')}</dt>
              <dd className="mt-0.5 font-bold tabular-nums text-white">{r.revenue.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('cost')}</dt>
              <dd className="mt-0.5 font-bold tabular-nums text-white">{r.cost.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('marginalCost')}</dt>
              <dd className="mt-0.5 font-bold tabular-nums text-white">{r.marginalCost}</dd>
            </div>
          </dl>
          <div className="mt-5 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{t('marginCurve')}</p>
            {r.curve.map((p) => (
              <Bar key={p.cacheHit} value={Math.max(0, p.marginPct)} color={accent} label={`${Math.round(p.cacheHit * 100)}%`} />
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function renderEngineBody() {
    switch (engine) {
      case 'ideaReplicator':
        return renderIdeaReplicator();
      case 'fateEngine':
        return renderFate();
      case 'omniTwin':
        return renderTwin();
      case 'chronoForge':
        return renderChrono();
      case 'marginInfinity':
        return renderMargin();
      default:
        return null;
    }
  }

  const mutateLabel =
    engine === 'ideaReplicator'
      ? t('rerun')
      : engine === 'fateEngine'
        ? t('rerun')
        : engine === 'omniTwin'
          ? t('evolve')
          : engine === 'chronoForge'
            ? t('forge')
            : t('rerun');

  return (
    <DialogTower
      open={open}
      title="HYPER-SOVEREIGN ENGINE"
      titleId="hyper-sovereign-tower-title"
      accent={accent}
      accentGlow={accentGlow}
      historyMarker="unitasHyperTower"
      labels={{
        refresh: tModal('refreshAria'),
        home: tModal('homeButton'),
        back: tModal('backButton'),
        close: tModal('closeAria'),
      }}
      onRefresh={mutate}
      onBack={goBack}
      onHome={goHome}
      onClose={onClose}
      onButtonHover={playHoverSfx}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto w-full max-w-5xl space-y-5">
          {/* Engine switch row -- hop between the five engines in place. */}
          <div className="flex flex-nowrap gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={t('switchEngine')}>
            {HYPER_ENGINES.map((e) => {
              const active = e.key === engine;
              return (
                <button
                  key={e.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => switchEngine(e.key)}
                  style={{
                    borderColor: active ? e.color : `${e.color}44`,
                    backgroundColor: active ? `${e.color}14` : undefined,
                  }}
                  className={`flex shrink-0 items-center gap-2.5 border px-4 py-3 text-left transition-colors hover:border-white/30 ${
                    active ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <e.icon size={18} style={{ color: e.color }} aria-hidden="true" />
                  <span className="whitespace-nowrap text-[13px] font-bold uppercase tracking-widest sm:text-[15px]">
                    {t(`engines.${e.key}.title`)}
                  </span>
                </button>
              );
            })}
          </div>

          {engine && (
            <header className="flex items-start gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center border"
                style={{ borderColor: `${accent}66`, color: accent, boxShadow: `0 0 24px ${accentGlow}33` }}
              >
                <meta.icon size={24} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-bold leading-tight text-white sm:text-[26px]" style={{ textShadow: `0 0 18px ${accentGlow}44` }}>
                  {t(`engines.${engine}.title`)}
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-gray-300 sm:text-[15px]">{t(`engines.${engine}.description`)}</p>
              </div>
            </header>
          )}

          {engine && engine !== 'marginInfinity' && (
            <form onSubmit={submitSeed} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                type="text"
                value={seedInput}
                maxLength={80}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder={seedPlaceholder}
                aria-label={seedPlaceholder}
                className="min-w-0 flex-1 border border-white/15 bg-void/60 px-4 py-3 text-[15px] text-white placeholder:text-gray-500 focus:border-white/40 focus:outline-none"
              />
              <button
                type="submit"
                onMouseEnter={() => playHoverSfx()}
                className={primaryButton}
                style={{ borderColor: accent, backgroundColor: `${accent}1a`, color: accent }}
              >
                <ArrowRight size={15} aria-hidden="true" />
                {t(`engines.${engine}.cta`)}
              </button>
              {seed && (
                <button
                  type="button"
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => {
                    playQuestEnterSfx();
                    mutate();
                  }}
                  className={primaryButton}
                  style={{ borderColor: `${accent}66`, color: accent }}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  {mutateLabel}
                </button>
              )}
            </form>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${engine}:${seed}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderEngineBody()}
            </motion.div>
          </AnimatePresence>

          {narrated && (
            <section className="border-l-2 pl-4" style={{ borderColor: `${accent}66` }}>
              <p className="mb-1.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                <Sparkles size={13} aria-hidden="true" />
                {t('oracleLabel')}
              </p>
              {report ? (
                <>
                  {report.headline && <p className="text-[16px] font-bold leading-snug text-white">{report.headline}</p>}
                  {report.oracle && <p className="mt-1.5 text-[14px] italic leading-relaxed text-gray-300">{report.oracle}</p>}
                </>
              ) : oracleLoading ? (
                <p className="flex items-center gap-2 text-[13px] text-gray-400">
                  <Loader2 size={13} className="animate-spin" style={{ color: accent }} aria-hidden="true" />
                  {t('oracleLoading')}
                </p>
              ) : (
                <p className="text-[13px] text-gray-500">{t('oracleUnavailable')}</p>
              )}
            </section>
          )}

          <p className="text-[11px] text-gray-500">{t('disclaimer')}</p>
        </div>
      </div>
    </DialogTower>
  );
}
