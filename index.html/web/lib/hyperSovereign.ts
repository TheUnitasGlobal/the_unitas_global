import { Atom, Dna, Hourglass, Infinity as InfinityIcon, Orbit, type LucideIcon } from 'lucide-react';
import type { ConstitutionAxis } from './uai/types';
import { MODULE_REGISTRY } from './module-registry';

/**
 * "차세대 초지능 소버린 숏컷" (Hyper-Sovereign Shortcuts, owner instruction
 * 2026-09-04 round 6): five cognitive engines that sit beside the classic
 * 실시간 숏컷 strip. Where a classic shortcut *retrieves* (a cached
 * knowledge tier), a hyper-sovereign shortcut *computes*: it takes a seed
 * from the visitor and runs a deterministic simulation grounded in the
 * 100-doctrine constitution (CLAUDE.md §2), the 16 governance axes (§3.3),
 * the §3.2 elemental dynamics and the §3.5 causality/probability calculus --
 * then invites the visitor to mutate the result again and again (증식 /
 * 인과율 해킹 / 트윈 진화 / 재단조), which is the addictive loop.
 *
 * Everything in this file is pure + isomorphic: the same seed always yields
 * the same result on the client (instant, 0원) and on the server, where the
 * /api/u-ai/hyper-shortcut route re-derives the identical skeleton so the
 * LLM narration it caches in genesis_memory is always describing the very
 * numbers the visitor is looking at. No randomness that isn't seeded.
 */

export type HyperEngineKey = 'ideaReplicator' | 'fateEngine' | 'omniTwin' | 'chronoForge' | 'marginInfinity';

export interface HyperEngine {
  key: HyperEngineKey;
  icon: LucideIcon;
  color: string;
  glow: string;
  /** Whether the U-AI oracle narration route is worth calling for it. */
  narrated: boolean;
}

export const HYPER_ENGINES: HyperEngine[] = [
  { key: 'ideaReplicator', icon: Dna, color: '#34d399', glow: '#6ee7b7', narrated: true },
  { key: 'fateEngine', icon: Orbit, color: '#c084fc', glow: '#e9d5ff', narrated: true },
  { key: 'omniTwin', icon: Atom, color: '#22d3ee', glow: '#67e8f9', narrated: true },
  { key: 'chronoForge', icon: Hourglass, color: '#fbbf24', glow: '#fde68a', narrated: true },
  { key: 'marginInfinity', icon: InfinityIcon, color: '#d4af37', glow: '#fde047', narrated: false },
];

export function isHyperEngineKey(value: string): value is HyperEngineKey {
  return HYPER_ENGINES.some((e) => e.key === value);
}

export function hyperEngine(key: HyperEngineKey): HyperEngine {
  return HYPER_ENGINES.find((e) => e.key === key) ?? HYPER_ENGINES[0];
}

/** The 16 governance axes (§3.3) by key -- mirrors lib/governance.ts order
 *  without importing its icon table. */
export const GOVERNANCE_AXIS_KEYS = [
  'language',
  'culture',
  'society',
  'structure',
  'art',
  'expression',
  'pragma',
  'economy',
  'engineering',
  'technology',
  'law',
  'institution',
  'education',
  'welfare',
  'security',
  'strategy',
] as const;

export const CONSTITUTION_AXES: ConstitutionAxis[] = ['logic', 'future', 'economy', 'security', 'sovereign', 'art'];

export const IDEA_PATTERNS = [
  'agentRental',
  'dataTwin',
  'microBurnSaaS',
  'autonomousMarketplace',
  'sovereignAcademy',
  'predictiveOracle',
  'cachedIntelligence',
  'nomadFactory',
] as const;
export type IdeaPattern = (typeof IDEA_PATTERNS)[number];

export const ELEMENTS = ['earth', 'water', 'fire', 'wind', 'lightning'] as const;
export type Element = (typeof ELEMENTS)[number];

export const MAX_HYPER_SEED = 80;
export const MAX_HYPER_VARIANT = 48;

const MODULE_KEYS = MODULE_REGISTRY.map((m) => m.key);

/** FNV-1a 32-bit. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Trim + collapse whitespace + lowercase + cap: the cache identity of a seed. */
export function normalizeHyperSeed(seed: string): string {
  return Array.from(seed.trim().replace(/\s+/g, ' ').toLowerCase()).slice(0, MAX_HYPER_SEED).join('');
}

/** Keyword hints that tilt a seed's constitution profile the way the
 *  visitor's own words suggest -- multilingual-light, same spirit as
 *  lib/uai/heuristics.ts. */
const AXIS_HINTS: Record<ConstitutionAxis, RegExp> = {
  logic: /\b(ai|logic|system|data|code|engineer|design|plan|structure)\b|논리|설계|시스템|데이터|코드|공학|構造|設計|逻辑|数据/i,
  future: /\b(future|innovat|startup|new|tomorrow|vision|next|space|quantum)\b|미래|혁신|스타트업|비전|우주|양자|未来|革新|创新/i,
  economy: /\b(money|revenue|income|profit|coin|business|market|sell|price|invest|wealth|rich)\b|수익|돈|매출|비즈니스|시장|투자|부자|코인|収益|投資|收入|利润|投资/i,
  security: /\b(secure|safety|legal|law|protect|defen[cs]e|privacy|trust|insurance)\b|보안|안전|법|보호|신뢰|보험|安全|法律|保护|信任/i,
  sovereign: /\b(free|freedom|independent|sovereign|own|nomad|remote|solo|self)\b|자유|독립|소버린|주권|노마드|1인|혼자|自由|独立|主权/i,
  art: /\b(art|design|music|film|write|story|brand|beauty|creative|craft)\b|예술|디자인|음악|영화|글|브랜드|창작|芸術|音楽|艺术|设计|音乐/i,
};

function axisProfile(seed: string, salt: string): Array<{ axis: ConstitutionAxis; score: number }> {
  const rng = mulberry32(hashSeed(`${normalizeHyperSeed(seed)}::${salt}`));
  return CONSTITUTION_AXES.map((axis) => {
    const base = 38 + rng() * 44;
    const boost = AXIS_HINTS[axis].test(seed) ? 12 + rng() * 10 : 0;
    return { axis, score: Math.round(clamp(base + boost, 20, 97)) };
  });
}

function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, values.length);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// 1. 비즈니스 자가증식 (Business Self-Replication)
// ---------------------------------------------------------------------------

export interface IdeaMetrics {
  /** Always 0 -- the 무자본 doctrine is a constant, not a variable. */
  capital: 0;
  launchDays: number;
  automation: number;
  marginX: number;
  viability: number;
  blueOcean: number;
}

export interface BusinessIdea {
  id: string;
  generation: number;
  parentId: string | null;
  axisKey: (typeof GOVERNANCE_AXIS_KEYS)[number];
  moduleKey: string;
  pattern: IdeaPattern;
  metrics: IdeaMetrics;
}

export const IDEA_CHILDREN = 3;

/** Spawn one generation of ideas under `parentId` (null = the root seed).
 *  Children inherit the seed's profile but converge faster (fewer launch
 *  days, higher automation) each generation -- the self-replication reads
 *  as *evolution*, not a reshuffle. */
export function replicateIdeas(seed: string, parentId: string | null, generation: number, count = IDEA_CHILDREN): BusinessIdea[] {
  const norm = normalizeHyperSeed(seed);
  const rng = mulberry32(hashSeed(`idea::${norm}::${parentId ?? 'root'}::${generation}`));
  const out: BusinessIdea[] = [];
  const usedAxes = new Set<string>();
  for (let i = 0; i < count; i++) {
    let axisKey = pick(rng, GOVERNANCE_AXIS_KEYS);
    // three siblings, three distinct axes -- a generation must spread.
    for (let tries = 0; usedAxes.has(axisKey) && tries < 8; tries++) axisKey = pick(rng, GOVERNANCE_AXIS_KEYS);
    usedAxes.add(axisKey);
    const moduleKey = pick(rng, MODULE_KEYS);
    const pattern = pick(rng, IDEA_PATTERNS);
    const gen = Math.max(0, generation);
    const launchDays = Math.max(1, Math.round(3 + rng() * 27 - gen * 2.5));
    const automation = Math.round(clamp(68 + rng() * 26 + gen * 2, 50, 99));
    const marginX = Math.round((8 + rng() * 40) * (1 + gen * 0.35));
    const viability = Math.round(clamp(52 + rng() * 40 + gen * 1.5, 30, 98));
    const blueOcean = Math.round(clamp(58 + rng() * 40, 30, 99));
    const id = `${gen}-${i}-${hashSeed(`${norm}|${parentId ?? 'root'}|${gen}|${i}`).toString(36)}`;
    out.push({
      id,
      generation: gen,
      parentId,
      axisKey,
      moduleKey,
      pattern,
      metrics: { capital: 0, launchDays, automation, marginX, viability, blueOcean },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. 운명 확률 연산 (Fate Probability Engine, §3.5 인과율 해킹)
// ---------------------------------------------------------------------------

export type FateHorizon = 1 | 3 | 10;
export const FATE_HORIZONS: FateHorizon[] = [1, 3, 10];

export interface FateLever {
  axis: ConstitutionAxis;
  /** Probability points this lever adds once applied (인과율 해킹). */
  delta: number;
  applied: boolean;
}

export interface FateResult {
  /** 0-100, after every applied lever. */
  probability: number;
  axes: Array<{ axis: ConstitutionAxis; score: number }>;
  levers: FateLever[];
  trajectory: Array<{ year: number; probability: number }>;
  /** 0-100 spread of the axis scores -- high = volatile fate. */
  entropy: number;
  horizon: FateHorizon;
}

const HORIZON_FACTOR: Record<FateHorizon, number> = { 1: 0.78, 3: 0.92, 10: 1.02 };
const TRAJECTORY_YEARS: Record<FateHorizon, number[]> = { 1: [1], 3: [1, 2, 3], 10: [1, 2, 3, 5, 7, 10] };

export function computeFate(goal: string, horizon: FateHorizon, hacked: ConstitutionAxis[]): FateResult {
  const profile = axisProfile(goal, `fate::${horizon}`);
  const sorted = [...profile].sort((a, b) => a.score - b.score);
  const levers: FateLever[] = sorted.slice(0, 3).map((weak) => ({
    axis: weak.axis,
    delta: Math.max(3, Math.round((84 - weak.score) * 0.35)),
    applied: hacked.includes(weak.axis),
  }));
  const axes = profile.map((p) => {
    const lever = levers.find((l) => l.axis === p.axis && l.applied);
    return { axis: p.axis, score: Math.round(clamp(p.score + (lever ? lever.delta * 1.6 : 0), 0, 99)) };
  });
  const mean = axes.reduce((a, b) => a + b.score, 0) / axes.length;
  const base = mean * HORIZON_FACTOR[horizon];
  const applied = levers.filter((l) => l.applied).reduce((a, l) => a + l.delta, 0);
  const probability = Math.round(clamp(base + applied * 0.6, 3, 97));
  const entropy = Math.round(clamp((stddev(axes.map((a) => a.score)) / 30) * 100, 0, 100));
  const years = TRAJECTORY_YEARS[horizon];
  const trajectory = years.map((year) => {
    const x = year / horizon;
    // logistic glide from ~35% of the final probability up to the final value.
    const k = 1 / (1 + Math.exp(-6 * (x - 0.45)));
    return { year, probability: Math.round(clamp(probability * (0.35 + 0.65 * k), 1, probability)) };
  });
  return { probability, axes, levers, trajectory, entropy, horizon };
}

// ---------------------------------------------------------------------------
// 3. 삼라만상 데이터 트윈 (Omniverse Data Twin, §3.1 / §3.2 / §3.6)
// ---------------------------------------------------------------------------

export interface TwinResult {
  /** U-Signature: the soul-data archive id of this twin (§3.6). */
  signature: string;
  constitution: Array<{ axis: ConstitutionAxis; score: number }>;
  resonance: Array<{ axisKey: (typeof GOVERNANCE_AXIS_KEYS)[number]; score: number }>;
  elements: Array<{ element: Element; score: number }>;
  entropy: number;
  generation: number;
}

export function forgeTwin(subject: string, generation: number): TwinResult {
  const norm = normalizeHyperSeed(subject);
  const gen = Math.max(0, generation);
  const rng = mulberry32(hashSeed(`twin::${norm}::${gen}`));
  const constitution = axisProfile(subject, `twin::${gen}`).map((p) => ({
    axis: p.axis,
    score: Math.round(clamp(p.score + gen * 1.5, 0, 99)),
  }));
  const resonance = GOVERNANCE_AXIS_KEYS.map((axisKey) => ({ axisKey, score: Math.round(30 + rng() * 69) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const elements = ELEMENTS.map((element) => ({ element, score: Math.round(20 + rng() * 79) }));
  const h1 = hashSeed(`${norm}::sig::${gen}`).toString(16).padStart(8, '0');
  const h2 = hashSeed(`${gen}::sig::${norm}`).toString(16).padStart(8, '0');
  const signature = `U-${h1.slice(0, 4)}-${h1.slice(4, 8)}-${h2.slice(0, 4)}-${h2.slice(4, 8)}`.toUpperCase();
  const entropy = Math.round(clamp((stddev(constitution.map((c) => c.score)) / 30) * 100, 0, 100));
  return { signature, constitution, resonance, elements, entropy, generation: gen };
}

// ---------------------------------------------------------------------------
// 4. 인과율 타임라인 (Causality Timeline Forge, §3.5)
// ---------------------------------------------------------------------------

export interface ChronoMilestone {
  /** Absolute calendar year. */
  year: number;
  /** Years from now (1, 2, 3, 5, 10). */
  offset: number;
  probability: number;
  axisKey: (typeof GOVERNANCE_AXIS_KEYS)[number];
  pattern: IdeaPattern;
  /** 1-5 "magnitude" of the milestone. */
  magnitude: number;
}

export const CHRONO_OFFSETS = [1, 2, 3, 5, 10] as const;

export function forgeTimeline(subject: string, variant: number, baseYear: number): ChronoMilestone[] {
  const norm = normalizeHyperSeed(subject);
  const rng = mulberry32(hashSeed(`chrono::${norm}::${variant}`));
  const usedAxes = new Set<string>();
  return CHRONO_OFFSETS.map((offset, i) => {
    let axisKey = pick(rng, GOVERNANCE_AXIS_KEYS);
    for (let tries = 0; usedAxes.has(axisKey) && tries < 8; tries++) axisKey = pick(rng, GOVERNANCE_AXIS_KEYS);
    usedAxes.add(axisKey);
    // Near milestones are likelier; the 10-year horizon carries the biggest magnitude.
    const probability = Math.round(clamp(88 - i * 11 + rng() * 10, 20, 96));
    return {
      year: baseYear + offset,
      offset,
      probability,
      axisKey,
      pattern: pick(rng, IDEA_PATTERNS),
      magnitude: clamp(1 + i + Math.round(rng()), 1, 5),
    };
  });
}

// ---------------------------------------------------------------------------
// 5. 마이크로번 마진 ∞ (Micro-Burn Margin Simulator, §1)
// ---------------------------------------------------------------------------

export interface MarginInput {
  /** U-COIN charged per call. */
  price: number;
  /** U-COIN of real compute burned per *uncached* call. */
  burn: number;
  /** 0..1 share of calls served from the intelligent cache. */
  cacheHit: number;
  /** Calls per day. */
  calls: number;
}

export interface MarginResult {
  revenue: number;
  cost: number;
  marginPct: number;
  /** revenue / cost; null when cost is 0 -- i.e. ∞. */
  marginX: number | null;
  marginalCost: number;
  curve: Array<{ cacheHit: number; marginPct: number }>;
}

export const MARGIN_DEFAULTS: MarginInput = { price: 3, burn: 0.4, cacheHit: 0.9, calls: 1000 };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function simulateMargin(input: MarginInput): MarginResult {
  const price = Math.max(0, input.price);
  const burn = Math.max(0, input.burn);
  const cacheHit = clamp(input.cacheHit, 0, 1);
  const calls = Math.max(0, Math.round(input.calls));
  const marginalCost = round2(burn * (1 - cacheHit));
  const revenue = round2(calls * price);
  const cost = round2(calls * marginalCost);
  const marginPct = revenue > 0 ? round2(((revenue - cost) / revenue) * 100) : 0;
  const marginX = cost > 0 ? round2(revenue / cost) : null;
  const curve = Array.from({ length: 11 }, (_, i) => {
    const hit = i / 10;
    const c = calls * burn * (1 - hit);
    return { cacheHit: hit, marginPct: revenue > 0 ? round2(((revenue - c) / revenue) * 100) : 0 };
  });
  return { revenue, cost, marginPct, marginX, marginalCost, curve };
}

// ---------------------------------------------------------------------------
// Skeleton serialisation for the U-AI oracle (server re-derives + narrates).
// ---------------------------------------------------------------------------

/** Variant grammar per engine (short, url-safe, ≤ MAX_HYPER_VARIANT):
 *  - ideaReplicator: `<parentId|root>:<generation>`
 *  - fateEngine:     `<horizon>:<hackedAxis+hackedAxis|none>`
 *  - omniTwin:       `<generation>`
 *  - chronoForge:    `<variant>:<baseYear>` */
export function isValidHyperVariant(variant: string): boolean {
  return variant.length > 0 && variant.length <= MAX_HYPER_VARIANT && /^[a-z0-9:+\-]+$/i.test(variant);
}

/** Compact English skeleton of the deterministic result -- the ground truth
 *  the LLM narrates around. Returns null when the variant doesn't parse. */
export function buildHyperSkeleton(engine: HyperEngineKey, seed: string, variant: string): string | null {
  switch (engine) {
    case 'ideaReplicator': {
      const [parent, genRaw] = variant.split(':');
      const generation = Number(genRaw ?? '0');
      if (!parent || !Number.isInteger(generation) || generation < 0 || generation > 12) return null;
      const ideas = replicateIdeas(seed, parent === 'root' ? null : parent, generation);
      return ideas
        .map(
          (idea, i) =>
            `Idea ${i + 1}: governance axis=${idea.axisKey}, UNITAS module=${idea.moduleKey}, pattern=${idea.pattern}, capital=0, launch=${idea.metrics.launchDays} days, automation=${idea.metrics.automation}%, margin=x${idea.metrics.marginX}, viability=${idea.metrics.viability}%, blue-ocean=${idea.metrics.blueOcean}%, generation=${idea.generation}`,
        )
        .join('\n');
    }
    case 'fateEngine': {
      const [hRaw, hackedRaw] = variant.split(':');
      const horizon = Number(hRaw);
      if (!FATE_HORIZONS.includes(horizon as FateHorizon)) return null;
      const hacked = (hackedRaw && hackedRaw !== 'none' ? hackedRaw.split('+') : []).filter((a): a is ConstitutionAxis =>
        (CONSTITUTION_AXES as string[]).includes(a),
      );
      const fate = computeFate(seed, horizon as FateHorizon, hacked);
      return [
        `Goal probability within ${horizon} year(s): ${fate.probability}% (entropy ${fate.entropy}/100).`,
        `Constitution axes: ${fate.axes.map((a) => `${a.axis}=${a.score}`).join(', ')}.`,
        `Causality levers: ${fate.levers.map((l) => `${l.axis} (+${l.delta}pts, ${l.applied ? 'APPLIED' : 'not yet applied'})`).join('; ')}.`,
        `Trajectory: ${fate.trajectory.map((p) => `year ${p.year}=${p.probability}%`).join(', ')}.`,
      ].join('\n');
    }
    case 'omniTwin': {
      const generation = Number(variant);
      if (!Number.isInteger(generation) || generation < 0 || generation > 99) return null;
      const twin = forgeTwin(seed, generation);
      return [
        `U-Signature ${twin.signature}, generation ${twin.generation}, entropy ${twin.entropy}/100.`,
        `Constitution: ${twin.constitution.map((c) => `${c.axis}=${c.score}`).join(', ')}.`,
        `Top governance resonance: ${twin.resonance.map((r) => `${r.axisKey}=${r.score}`).join(', ')}.`,
        `Elements: ${twin.elements.map((e) => `${e.element}=${e.score}`).join(', ')}.`,
      ].join('\n');
    }
    case 'chronoForge': {
      const [vRaw, yRaw] = variant.split(':');
      const v = Number(vRaw);
      const baseYear = Number(yRaw);
      if (!Number.isInteger(v) || v < 0 || v > 99 || !Number.isInteger(baseYear) || baseYear < 2000 || baseYear > 2200) return null;
      return forgeTimeline(seed, v, baseYear)
        .map(
          (m, i) =>
            `Milestone ${i + 1}: year ${m.year} (+${m.offset}y), probability ${m.probability}%, governance axis=${m.axisKey}, pattern=${m.pattern}, magnitude ${m.magnitude}/5`,
        )
        .join('\n');
    }
    case 'marginInfinity':
      return null;
    default:
      return null;
  }
}

/** How many narrated items the oracle should return for an engine. */
export function hyperItemCount(engine: HyperEngineKey): number {
  switch (engine) {
    case 'ideaReplicator':
      return IDEA_CHILDREN;
    case 'fateEngine':
      return 3;
    case 'omniTwin':
      return 3;
    case 'chronoForge':
      return CHRONO_OFFSETS.length;
    default:
      return 0;
  }
}
