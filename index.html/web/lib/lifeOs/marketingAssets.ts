// Brand Kit marketing asset generator (founder directive 2026-09-08):
// zero-cost, on-brand ad copy generation, reimplementing the *pattern*
// behind Google Labs' Pomelli (business brand-kit -> generated marketing
// content) and Opal (a short chained AI workflow: input -> LLM step ->
// deterministic post-processing -> structured output) natively -- neither
// product exposes a public API to call (research 2026-09-08: both are
// closed Labs web apps with no documented REST/SDK surface), and this app
// already has the one input Pomelli would otherwise scrape a website for:
// the founder-approved brand tokens and voice rules already codified in
// brandKit.ts. So the "brand DNA" step is skipped entirely -- it's already
// data, not something to re-derive from a URL -- and only the generation
// + sanitization steps are reimplemented:
//
//   brief (founder's one-line campaign idea)
//     -> LLM draft, constrained to the existing brand tokens/voice
//     -> deterministic brand-voice sanitization (checkBrandVoice/
//        applyBrandVoice, already unit-tested) as a final, non-negotiable
//        safety net -- the model is instructed to avoid the same phrasing
//        the rules forbid, but the regex pass is what actually guarantees
//        it, the same way it already guarantees it for hand-written copy.
//
// No image generation: none of the configured providers (lib/uai/
// provider.ts) expose an image endpoint, and faking a "photoshoot" feature
// (Pomelli's other headline capability) without one would be dishonest
// scaffolding. This module is text-only by design.

import { generateInsight, insightProviderAvailable } from '@/lib/uai/provider';
import {
  BRAND_COLOR_TOKENS,
  BRAND_TYPOGRAPHY,
  VOICE_RULES,
  applyBrandVoice,
  checkBrandVoice,
} from './brandKit';

export interface MarketingAssetSet {
  headline: string;
  body: string;
  cta: string;
  socialCaption: string;
  hashtags: string[];
  visualBrief: string;
}

export interface GeneratedMarketingAssets {
  assets: MarketingAssetSet;
  /** How many phrases the deterministic voice sanitizer had to rewrite across all fields -- 0 means the model already stayed on-brand unassisted. */
  sanitizedCount: number;
  model: string;
}

const MAX_BRIEF_LENGTH = 500;

export function buildMarketingAssetPrompt(brief: string, locale = 'ko'): { system: string; user: string } {
  const palette = BRAND_COLOR_TOKENS.map((t) => `${t.name} (${t.value}): ${t.usage}`).join('; ');
  const typography = BRAND_TYPOGRAPHY.map((t) => `${t.role}: ${t.family} -- ${t.usage}`).join('; ');
  const avoid = VOICE_RULES.map((r) => `avoid "${r.pattern.source.replace(/\\s\*|\(\?!.*?\)/g, ' ').trim()}" (${r.reason})`).join('; ');

  const system = [
    'You are the in-house copywriter for THE UNITAS GLOBAL, generating one marketing asset set for the founder\'s own review before use -- never auto-published.',
    `Brand visual system: colors -- ${palette}. Typography -- ${typography}.`,
    `Mandatory phrasing constraints: ${avoid}.`,
    'Tone: precise, technical, quietly confident -- never hype-driven, never using empire/domination language.',
    'Produce a headline, one short body paragraph (2-3 sentences), a call-to-action phrase, a social-media caption, 3-5 hashtags (no # prefix, lowercase, no spaces), and a one-sentence visual brief describing what imagery/layout would pair with this copy using the palette above.',
    `Write every string value in the language for locale "${locale}".`,
    'Return ONLY a single minified JSON object, no markdown fences, no commentary. Schema:',
    '{"headline":"...","body":"...","cta":"...","socialCaption":"...","hashtags":["...","..."],"visualBrief":"..."}',
  ].join('\n');

  const user = `CAMPAIGN BRIEF: ${brief.slice(0, MAX_BRIEF_LENGTH)}`;
  return { system, user };
}

function asString(v: unknown, fallback = '', max = 400): string {
  if (typeof v !== 'string') return fallback;
  const clean = v.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : fallback;
}

function asHashtags(v: unknown, max = 5): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.replace(/^#/, '').replace(/\s+/g, '').toLowerCase().slice(0, 40))
    .filter(Boolean)
    .slice(0, max);
}

/** Runs the deterministic brand-voice sanitizer over every free-text field and reports how many rewrites it made. */
function sanitize(assets: MarketingAssetSet): { assets: MarketingAssetSet; sanitizedCount: number } {
  const fields: (keyof MarketingAssetSet)[] = ['headline', 'body', 'cta', 'socialCaption', 'visualBrief'];
  let sanitizedCount = 0;
  const sanitized = { ...assets };
  for (const field of fields) {
    const original = assets[field] as string;
    sanitizedCount += checkBrandVoice(original).length;
    (sanitized[field] as string) = applyBrandVoice(original);
  }
  return { assets: sanitized, sanitizedCount };
}

export function parseMarketingAssetResponse(raw: string): MarketingAssetSet {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in model response');
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  return {
    headline: asString(parsed.headline, '', 120),
    body: asString(parsed.body, '', 500),
    cta: asString(parsed.cta, '', 60),
    socialCaption: asString(parsed.socialCaption, '', 300),
    hashtags: asHashtags(parsed.hashtags),
    visualBrief: asString(parsed.visualBrief, '', 300),
  };
}

/**
 * End-to-end generation: brief -> LLM draft -> brand-voice sanitization.
 * Fail-open on provider unavailability/failure -- throws a plain Error the
 * route can turn into a 503, matching the rest of the U-AI surface's
 * "no provider configured" handling (never a silent empty result).
 */
export async function generateMarketingAssets(brief: string, locale = 'ko'): Promise<GeneratedMarketingAssets> {
  if (!insightProviderAvailable()) throw new Error('No insight provider configured');
  const { system, user } = buildMarketingAssetPrompt(brief, locale);
  const { text, model } = await generateInsight(system, user, 700);
  const parsed = parseMarketingAssetResponse(text);
  const { assets, sanitizedCount } = sanitize(parsed);
  return { assets, sanitizedCount, model };
}
