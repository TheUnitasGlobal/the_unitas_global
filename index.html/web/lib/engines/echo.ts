// Deterministic client-side "reflection" pipeline for the Echo ecosystem
// (Ecosystems.echo.rules: "Each query ripples through three reflection
// cycles before surfacing an answer"). Rule-based text transformation, not
// an external AI call -- same query always produces the same reflections.

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'will', 'would',
  'should', 'could', 'about', 'what', 'when', 'where', 'which', 'their',
  'there', 'here', 'them', 'they', 'your', 'into', 'than', 'then', 'just',
]);

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function keyTerms(query: string, count = 2): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const unique = Array.from(new Set(words));
  return unique.sort((a, b) => b.length - a.length).slice(0, count);
}

export interface EchoReflection {
  cycle: number;
  label: string;
  text: string;
}

export interface EchoResult {
  reflections: EchoReflection[];
  synthesis: string;
}

export function runEchoReflection(query: string): EchoResult {
  const trimmed = query.trim();
  const terms = keyTerms(trimmed);
  const seed = hashSeed(trimmed);
  const primary = terms[0] ?? 'this';
  const secondary = terms[1] ?? terms[0] ?? 'it';

  const reflections: EchoReflection[] = [
    {
      cycle: 1,
      label: 'Surface Reflection',
      text:
        primary === secondary
          ? `You are really asking about ${primary}.`
          : `You are really asking about ${primary}, framed through ${secondary}.`,
    },
    {
      cycle: 2,
      label: 'Inverted Reflection',
      text: `Consider the opposite: what would it mean if ${primary} turned out to be false, or irrelevant?`,
    },
    {
      cycle: 3,
      label: 'Structural Reflection',
      text: `Strip away urgency and framing -- the underlying structure is a choice between acting on ${primary} now, or gathering more signal on ${secondary} first.`,
    },
  ];

  const closings = [
    `Echo returns not an answer, but the shape of your question: it hinges on ${primary}.`,
    `Echo's three cycles converge on one point of leverage: ${primary} over ${secondary}.`,
    `What ripples back is a sharper question, not a verdict -- resolve ${primary} first.`,
  ];

  return { reflections, synthesis: closings[seed % closings.length] };
}
