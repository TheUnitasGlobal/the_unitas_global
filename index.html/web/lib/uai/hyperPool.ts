import {
  CONSTITUTION_AXES,
  FATE_HORIZONS,
  computeFate,
  forgeTimeline,
  forgeTwin,
  hyperItemCount,
  normalizeHyperSeed,
  replicateIdeas,
  type FateHorizon,
  type HyperEngineKey,
} from '../hyperSovereign';
import { MODULE_REGISTRY } from '../module-registry';
import type { ConstitutionAxis } from './types';
import { HYPER_POOL_MODEL, type HyperReport, type HyperReportItem } from './hyperShortcut';

/**
 * The Pre-warmed Sovereign Pool (owner instruction 2026-09-04 round 7):
 * the fail-safe behind /api/u-ai/hyper-shortcut for the moment the daily
 * free-forge cap (DAILY_REDESIGN_CAP) is reached or the LLM provider answers
 * a rate-limit / outage. Instead of an empty `ok:false`, the route returns
 * the *best-fitting deterministic narration* assembled from a pool of
 * pre-localized templates (messages/<locale>.json → HyperSovereign.pool, 20
 * locales) filled with the exact numbers of the visitor's own skeleton --
 * so the words still describe the figures on screen, in the visitor's
 * language, at 0원, offline-deterministic, with no LLM in the loop.
 *
 * Pool reports are never written to genesis_memory: the LLM narration
 * still forges once the cap or the outage clears, and the client only
 * memoises a pooled report briefly (hyperShortcutClient.ts).
 *
 * Server-only (dynamic JSON import); the pure builder is unit-tested with
 * the message catalog passed in explicitly.
 */

export type PoolMessages = Record<string, unknown>;

const messageCache = new Map<string, PoolMessages>();

async function importMessages(locale: string): Promise<PoolMessages | null> {
  const hit = messageCache.get(locale);
  if (hit) return hit;
  try {
    const mod = (await import(`../../messages/${locale}.json`)) as { default?: PoolMessages };
    const messages = (mod.default ?? mod) as PoolMessages;
    messageCache.set(locale, messages);
    return messages;
  } catch {
    return null;
  }
}

/** The locale's catalog plus English as the per-key fallback. `locale`
 *  must already be validated against routing.locales by the caller. */
export async function loadPoolMessages(locale: string): Promise<{ messages: PoolMessages; fallback: PoolMessages }> {
  const fallback = (await importMessages('en')) ?? {};
  const messages = (locale === 'en' ? null : await importMessages(locale)) ?? fallback;
  return { messages, fallback };
}

function get(messages: PoolMessages, path: string): string | null {
  let cur: unknown = messages;
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' && cur ? cur : null;
}

/** `{name}` substitution -- deliberately not ICU so the templates never
 *  pass through a parser that could choke on an apostrophe. */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

interface Lexicon {
  tpl(key: string): string;
  gov(key: string): string;
  constitution(axis: ConstitutionAxis): string;
  pattern(key: string): string;
  element(key: string): string;
  module(key: string): string;
}

function lexicon(messages: PoolMessages, fallback: PoolMessages): Lexicon {
  const lookup = (path: string) => get(messages, path) ?? get(fallback, path);
  return {
    tpl: (key) => lookup(`HyperSovereign.pool.${key}`) ?? '',
    gov: (key) => lookup(`Governance.axes.${key}.title`) ?? key,
    constitution: (axis) => lookup(`UAI.constitution.${axis}`) ?? axis,
    pattern: (key) => lookup(`HyperSovereign.patterns.${key}`) ?? key,
    element: (key) => lookup(`HyperSovereign.element.${key}`) ?? key,
    module: (key) => {
      const entry = MODULE_REGISTRY.find((m) => m.key === key);
      if (!entry) return key;
      const ns = entry.tier === 'ecosystem' ? 'Ecosystems' : 'Modules';
      return lookup(`${ns}.${entry.messageKey}.title`) ?? entry.key;
    },
  };
}

/**
 * Build the pooled narration for one (engine, seed, variant) from the
 * locale's templates. Mirrors buildHyperSkeleton's variant grammar exactly
 * and re-runs the same deterministic engine, so every figure quoted is the
 * one the client is rendering. Returns null for a non-narrated engine, an
 * unparsable variant or a catalog without pool templates.
 */
export function buildPoolReport(
  engine: HyperEngineKey,
  seed: string,
  variant: string,
  messages: PoolMessages,
  fallback: PoolMessages = messages,
): HyperReport | null {
  const lex = lexicon(messages, fallback);
  if (!lex.tpl('ideaHeadline')) return null;

  let headline = '';
  let oracle = '';
  let items: HyperReportItem[] = [];

  switch (engine) {
    case 'ideaReplicator': {
      const [parent, genRaw] = variant.split(':');
      const generation = Number(genRaw ?? '0');
      if (!parent || !Number.isInteger(generation) || generation < 0 || generation > 12) return null;
      const ideas = replicateIdeas(seed, parent === 'root' ? null : parent, generation);
      if (ideas.length === 0) return null;
      items = ideas.map((idea) => ({
        title: fillTemplate(lex.tpl('ideaTitle'), { pattern: lex.pattern(idea.pattern), module: lex.module(idea.moduleKey) }),
        body: fillTemplate(lex.tpl('ideaBody'), {
          days: idea.metrics.launchDays,
          axis: lex.gov(idea.axisKey),
          automation: idea.metrics.automation,
          margin: idea.metrics.marginX,
          viability: idea.metrics.viability,
          blueOcean: idea.metrics.blueOcean,
        }),
      }));
      const lead = ideas.reduce((best, i) => (i.metrics.viability > best.metrics.viability ? i : best), ideas[0]);
      const widest = ideas.reduce((best, i) => (i.metrics.blueOcean > best.metrics.blueOcean ? i : best), ideas[0]);
      headline = fillTemplate(lex.tpl('ideaHeadline'), { n: generation, axis: lex.gov(lead.axisKey) });
      oracle = fillTemplate(lex.tpl('ideaOracle'), { n: ideas.indexOf(widest) + 1, blueOcean: widest.metrics.blueOcean });
      break;
    }
    case 'fateEngine': {
      const [hRaw, hackedRaw] = variant.split(':');
      const horizon = Number(hRaw);
      if (!FATE_HORIZONS.includes(horizon as FateHorizon)) return null;
      const hacked = (hackedRaw && hackedRaw !== 'none' ? hackedRaw.split('+') : []).filter((a): a is ConstitutionAxis =>
        (CONSTITUTION_AXES as string[]).includes(a),
      );
      const fate = computeFate(seed, horizon as FateHorizon, hacked);
      if (fate.levers.length === 0 || fate.trajectory.length === 0) return null;
      items = fate.levers.map((lever) => ({
        title: fillTemplate(lex.tpl('fateTitle'), { axis: lex.constitution(lever.axis) }),
        body: fillTemplate(lex.tpl('fateBody'), {
          axis: lex.constitution(lever.axis),
          delta: lever.delta,
          status: lex.tpl(lever.applied ? 'leverApplied' : 'leverPending'),
        }),
      }));
      const first = fate.trajectory[0];
      const last = fate.trajectory[fate.trajectory.length - 1];
      const strongest = fate.levers.reduce((best, l) => (l.delta > best.delta ? l : best), fate.levers[0]);
      headline = fillTemplate(lex.tpl('fateHeadline'), { probability: fate.probability, horizon, entropy: fate.entropy });
      oracle = fillTemplate(lex.tpl('fateOracle'), {
        first: first.probability,
        firstYear: first.year,
        last: last.probability,
        lastYear: last.year,
        axis: lex.constitution(strongest.axis),
      });
      break;
    }
    case 'omniTwin': {
      const generation = Number(variant);
      if (!Number.isInteger(generation) || generation < 0 || generation > 99) return null;
      const twin = forgeTwin(seed, generation);
      items = twin.resonance.slice(0, hyperItemCount(engine)).map((r) => ({
        title: fillTemplate(lex.tpl('twinTitle'), { axis: lex.gov(r.axisKey), score: r.score }),
        body: fillTemplate(lex.tpl('twinBody'), { axis: lex.gov(r.axisKey), score: r.score }),
      }));
      const lead = twin.elements.reduce((best, e) => (e.score > best.score ? e : best), twin.elements[0]);
      headline = fillTemplate(lex.tpl('twinHeadline'), { signature: twin.signature, n: generation, entropy: twin.entropy });
      oracle = fillTemplate(lex.tpl('twinOracle'), { element: lex.element(lead.element), score: lead.score });
      break;
    }
    case 'chronoForge': {
      const [vRaw, yRaw] = variant.split(':');
      const v = Number(vRaw);
      const baseYear = Number(yRaw);
      if (!Number.isInteger(v) || v < 0 || v > 99 || !Number.isInteger(baseYear) || baseYear < 2000 || baseYear > 2200) return null;
      const timeline = forgeTimeline(seed, v, baseYear);
      if (timeline.length === 0) return null;
      items = timeline.map((m) => ({
        title: fillTemplate(lex.tpl('chronoTitle'), { year: m.year, axis: lex.gov(m.axisKey) }),
        body: fillTemplate(lex.tpl('chronoBody'), {
          probability: m.probability,
          pattern: lex.pattern(m.pattern),
          magnitude: m.magnitude,
          offset: m.offset,
        }),
      }));
      const destination = timeline[timeline.length - 1];
      const hinge = timeline.reduce((best, m) => (m.magnitude * m.probability > best.magnitude * best.probability ? m : best), timeline[0]);
      headline = fillTemplate(lex.tpl('chronoHeadline'), { axis: lex.gov(destination.axisKey), year: destination.year });
      oracle = fillTemplate(lex.tpl('chronoOracle'), { year: hinge.year, axis: lex.gov(hinge.axisKey), probability: hinge.probability });
      break;
    }
    default:
      return null;
  }

  return {
    engine,
    seed: normalizeHyperSeed(seed),
    variant,
    headline,
    items: items.slice(0, hyperItemCount(engine)),
    oracle,
    model: HYPER_POOL_MODEL,
    cached: false,
    pooled: true,
  };
}
