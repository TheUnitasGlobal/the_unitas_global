import { ECOSYSTEMS } from '@/lib/ecosystems';
import type {
  Band,
  ConstitutionAxis,
  ConstitutionScore,
  Directionality,
  LensKey,
  LensScore,
  QueryArchetype,
  ShieldVerdict,
  SurfaceReport,
  SwarmScore,
  WebSynthesis,
} from './types';

/**
 * Phase-1 surface analysis -- 100% deterministic, client-side, zero cost.
 *
 * It no longer merely matches the query against static data: when the live
 * web-synthesis pass (webSynthesis.ts -- keyless Wikipedia/Wikimedia REST,
 * behind NEXT_PUBLIC_UAI_WEB_SYNTHESIS) returns a digest, that real online
 * text is folded into every score below. When it doesn't, the same maths run
 * on the query alone -- the output shape is identical either way.
 *
 * On top of the original triple lens / shield / swarm it now runs the
 * **71-doctrine deconstruction**: the Hyper-Constitution Codex collapsed to 6
 * load-bearing axes (logic·law·risk / future·science·cosmos / economy·payment·
 * markets·bitcoin / security·hacker·cyber·forensic / sovereign·decentral /
 * art·philosophy), each scored, so the free tier can hand back a "redesign
 * this from the blind-spot axis" directive instead of a flat summary
 * (owner instruction 2026-08-30). Big-tech-grade web digest 90% + this
 * doctrine redesign 10%.
 *
 * All outputs are numbers or enum tags -- every piece of display text is
 * resolved from `messages/*.json` (`UAI.*`) by the dashboard, so this stays
 * locale-agnostic.
 */

const LENS_LEXICON: Record<LensKey, RegExp> = {
  tech: /\b(ai|ml|model|algorithm|code|software|hardware|data|system|api|cloud|automat|robot|quantum|neural|build|deploy|architecture|protocol|chip|gpu|llm|machine|engineer|dev)\w*/gi,
  economy: /\b(price|cost|money|invest|market|profit|revenue|budget|fee|coin|token|salary|roi|fund|capital|econom|financ|margin|tax|trade|pay|worth|cheap|expensive|value)\w*/gi,
  opinion: /\b(people|think|feel|trend|social|public|opinion|popular|community|culture|debate|controvers|sentiment|ethic|should|fair|trust|reputation|viral|consensus|belief)\w*/gi,
};

const COMMERCIAL_LEXICON =
  /\b(buy|best|cheapest|deal|discount|coupon|review|vs|versus|recommend|top\s?\d*|worth\s+it|should\s+i\s+(buy|get)|which\s+.*(better|best)|affiliate|sponsor|promo|sale|brand)\w*/gi;

/**
 * The 71 '초' doctrines folded into 6 scored axes. Each regex is the English
 * keyword surface for that axis; non-English queries still get a spread from
 * the deterministic per-axis fingerprint below. The 2026-08-30 71-doctrine
 * expansion widened every axis: logic now also carries law/risk/pros-cons,
 * future carries science/cosmos/geopolitics/prediction, economy carries
 * payment/stock/bitcoin/crypto/on-chain/hedging, security carries
 * hacker/cyber/forensic defence.
 */
const CONSTITUTION_LEXICON: Record<ConstitutionAxis, RegExp> = {
  logic:
    /\b(logic|reason|proof|prove|analy|structure|framework|design|architect|precis|rigor|verif|evidence|method|system|model|define|assumption|deconstruct|law|legal|regulat|complian|contract|liabilit|pros?\s?and\s?cons?|tradeoff|risk|downside|upside|probabilit|scenario)\w*/gi,
  future:
    /\b(future|forecast|predict|trend|innovat|novel|original|ai|next|emerg|disrupt|frontier|vision|tomorrow|transform|202\d|203\d|revolution|paradigm|breakthrough|scien|physics|space|cosmos|universe|quantum|geopolit|research)\w*/gi,
  economy:
    /\b(cost|price|capital|invest|efficien|scal|growth|revenue|margin|budget|lean|roi|profit|market|monet|fund|cheap|expensive|resource|leverage|payment|checkout|billing|stock|equit|share|ticker|bitcoin|btc|crypto|ethereum|token|on.?chain|wallet|hedge|portfolio|yield|dividend|valuation)\w*/gi,
  security:
    /\b(secur|risk|threat|protect|integrit|privacy|safe|audit|complian|ethic|trust|defen|vulnerab|attack|breach|fail|prevent|resilien|backup|hack|hacker|exploit|malware|ransom|phish|cyber|forensic|zero.?day|intrusion|firewall|encrypt|patch)\w*/gi,
  sovereign:
    /\b(sovereign|decentral|autonom|independ|self|automat|distribut|control|own|freedom|permissionless|censor|custod|local|peer|edge|zero.?trust)\w*/gi,
  art: /\b(art|aesthetic|meaning|philosoph|beaut|cultur|story|narrat|myth|era|human|emotion|wonder|experience|craft|taste|elegan|soul)\w*/gi,
};

const CONSTITUTION_AXES = Object.keys(CONSTITUTION_LEXICON) as ConstitutionAxis[];

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

/** Small deterministic string hash (FNV-1a-ish) -> unsigned 32-bit. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function bandOf(score: number): Band {
  if (score >= 66) return 'high';
  if (score >= 33) return 'mid';
  return 'low';
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

const EMPTY_WEB: WebSynthesis = {
  sourced: false,
  sources: [],
  digest: '',
  lang: null,
  fetchedAt: 0,
};

export function analyzeSurface(
  query: string,
  tEcosystems: (key: string) => string,
  context = '',
  web: WebSynthesis = EMPTY_WEB,
): SurfaceReport {
  const trimmed = query.trim();
  const digest = web.digest ?? '';
  // The live web digest joins the haystack, so every score below reflects the
  // real online material -- not just the raw query.
  const haystack = `${trimmed} ${context} ${digest}`.trim();
  const lower = haystack.toLowerCase();
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const digestWords = digest ? digest.split(/\s+/).filter(Boolean).length : 0;

  const directionality: Directionality =
    /\?\s*$|^(why|how|what|when|where|who|which|explain|should|can|is|are|does)\b/i.test(trimmed)
      ? 'divergent'
      : 'convergent';

  const archetype: QueryArchetype =
    directionality === 'divergent'
      ? 'explore'
      : wordCount <= 4
        ? 'decide'
        : 'analyze';

  // Triple lens: raw keyword density -> 0-100, floored so every bar is
  // visible even for a terse query. A longer, richer query -- or a fat web
  // digest -- lifts every lens.
  const richness = Math.min(1, (wordCount + digestWords / 6) / 12);
  const sourcedFloor = web.sourced ? 8 : 0;
  const lenses: LensScore[] = (Object.keys(LENS_LEXICON) as LensKey[]).map((key) => {
    const hits = countMatches(lower, LENS_LEXICON[key]);
    const raw = hits * 20 + richness * 22 + (trimmed ? 12 : 0) + sourcedFloor;
    const score = clamp(raw);
    return { key, score, band: bandOf(score) };
  });

  // Shield gauge: commercial-intent pull. A genuine question ("?") relieves
  // it; comparison/purchase language drives it up.
  const commercialHits = countMatches(lower, COMMERCIAL_LEXICON);
  const shieldScore = clamp(
    commercialHits * 30 + (/\b(product|price|\$|€|₩)\b/i.test(haystack) ? 14 : 0) - (trimmed.endsWith('?') ? 10 : 0) + 6,
  );
  const shieldVerdict: ShieldVerdict =
    shieldScore >= 60 ? 'biased' : shieldScore >= 30 ? 'caution' : 'clear';

  // 71-doctrine deconstruction: keyword surface + a deterministic per-axis
  // fingerprint (so non-English queries still decompose distinctly) + a bonus
  // when the axis is actually attested in the live web digest.
  const seed = hashString(trimmed.toLowerCase() || 'unitas');
  const digestLower = digest.toLowerCase();
  const rawConstitution = CONSTITUTION_AXES.map((axis) => {
    const hits = countMatches(lower, CONSTITUTION_LEXICON[axis]);
    const digestHits = digestLower ? countMatches(digestLower, CONSTITUTION_LEXICON[axis]) : 0;
    const fingerprint = (hashString(`${axis}:${seed}`) % 34) + (trimmed ? 8 : 0);
    const digestBonus = digestHits > 0 ? 16 : 0;
    return { axis, raw: hits * 18 + fingerprint + digestBonus + richness * 14 };
  });
  const constitution: ConstitutionScore[] = rawConstitution
    .map(({ axis, raw }) => {
      const score = clamp(raw);
      return { axis, score, band: bandOf(score) };
    })
    .sort((a, b) => b.score - a.score);
  const topConstitutionAxis = constitution[0].axis;
  const redesignAxis = constitution[constitution.length - 1].axis;

  // 11-ecosystem swarm -- keyword overlap against each (translated) title +
  // description, normalised against the top match. The web digest widens the
  // term set so a vague query can still light up the right ecosystem.
  const terms = `${lower}`.split(/\s+/).filter((w) => w.length >= 3);
  const rawSwarm = ECOSYSTEMS.map((eco): SwarmScore & { raw: number } => {
    const title = tEcosystems(`${eco.messageKey}.title`);
    const description = tEcosystems(`${eco.messageKey}.description`);
    const text = `${title} ${description} ${eco.key}`.toLowerCase();
    let raw = terms.reduce((acc, w) => acc + (text.includes(w) ? 2 : 0), 0);
    if (trimmed && text.includes(trimmed.toLowerCase())) raw += 3;
    return { key: eco.key, messageKey: eco.messageKey, color: eco.color, score: 0, raw };
  });
  const maxRaw = Math.max(1, ...rawSwarm.map((s) => s.raw));
  const swarm: SwarmScore[] = rawSwarm
    .map(({ raw, ...rest }) => ({ ...rest, score: raw === 0 ? 0 : clamp((raw / maxRaw) * 100) }))
    .sort((a, b) => b.score - a.score);

  return {
    query: trimmed,
    directionality,
    archetype,
    lenses,
    shield: { score: shieldScore, verdict: shieldVerdict },
    checklistArchetype: archetype,
    constitution,
    topConstitutionAxis,
    redesignAxis,
    web,
    swarm,
    topEcosystemKey: swarm[0]?.score ? swarm[0].key : null,
  };
}
