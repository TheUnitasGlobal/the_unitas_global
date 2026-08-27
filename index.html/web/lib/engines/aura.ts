// Deterministic lexicon-based tone reader for the Aura ecosystem
// (Ecosystems.aura.rules: "No direct questions -- Aura reads tone, not
// text."). Real (if simple) sentiment/intensity/formality scoring over
// whatever statement is pasted in -- not a real emotion-detection model.

const POSITIVE_RE = /\b(good|great|love|happy|excited|win|success|glad|hope|confident|proud)\b/gi;
const NEGATIVE_RE = /\b(bad|hate|angry|sad|fear|worried|lose|fail|upset|frustrat|anxious|regret)\b/gi;
const INTENSE_RE = /\b(extremely|urgent|furious|desperate|immediately|now|critical|explosive)\b/gi;
const CALM_RE = /\b(calm|steady|eventually|gradually|whenever|relaxed|patient)\b/gi;
const FORMAL_RE = /\b(therefore|furthermore|hereby|pursuant|shall|accordingly)\b/gi;
const CASUAL_RE = /\b(gonna|wanna|kinda|yeah|lol|hey|stuff|thing)\b|'(ll|re|ve|m|t)\b/gi;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

export interface AuraResult {
  rejected: boolean;
  valence: number; // 0-100, negative -> positive
  arousal: number; // 0-100, calm -> intense
  formality: number; // 0-100, casual -> formal
  valenceBandKey: string;
  arousalBandKey: string;
  formalityBandKey: string;
}

export function readAuraStatement(statement: string): AuraResult {
  const trimmed = statement.trim();
  if (trimmed.endsWith('?') || /^(why|how|what|when|where|who|is|are|do|does|can|will)\b/i.test(trimmed)) {
    return {
      rejected: true,
      valence: 50,
      arousal: 50,
      formality: 50,
      valenceBandKey: 'auraNeutralValence',
      arousalBandKey: 'auraCalm',
      formalityBandKey: 'auraBalancedFormality',
    };
  }

  const pos = countMatches(trimmed, POSITIVE_RE);
  const neg = countMatches(trimmed, NEGATIVE_RE);
  const intense = countMatches(trimmed, INTENSE_RE) + (trimmed.match(/!/g) ?? []).length;
  const calmCount = countMatches(trimmed, CALM_RE);
  const formal = countMatches(trimmed, FORMAL_RE);
  const casual = countMatches(trimmed, CASUAL_RE);

  const valence = Math.max(0, Math.min(100, 50 + (pos - neg) * 12));
  const arousal = Math.max(0, Math.min(100, 50 + (intense - calmCount) * 14));
  const formality = Math.max(0, Math.min(100, 50 + (formal - casual) * 14));

  const valenceBandKey = valence >= 60 ? 'auraPositiveValence' : valence <= 40 ? 'auraNegativeValence' : 'auraNeutralValence';
  const arousalBandKey = arousal >= 60 ? 'auraIntense' : arousal <= 40 ? 'auraCalm' : 'auraModerateArousal';
  const formalityBandKey =
    formality >= 60 ? 'auraFormalTone' : formality <= 40 ? 'auraCasualTone' : 'auraBalancedFormality';

  return { rejected: false, valence, arousal, formality, valenceBandKey, arousalBandKey, formalityBandKey };
}
