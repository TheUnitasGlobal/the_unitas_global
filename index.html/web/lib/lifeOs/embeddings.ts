// Server-only embedding helper for the Second Brain module. Never imported
// from a client component -- OPENAI_API_KEY must not reach the browser
// bundle. Anthropic has no public embeddings endpoint, so this is the one
// place in the app that calls OpenAI directly rather than through
// lib/uai/provider.ts's Claude-first chat abstraction.
//
// Fails open by design: a missing key, a network error, or a non-200
// response all resolve to `null`, and lib/lifeOs/secondBrain.ts's graph
// builder already degrades to tag-overlap edges when embeddings are absent.
// A note is never blocked from being saved because embedding failed.

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
const MAX_INPUT_CHARS = 8000;

export function embeddingProviderAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !text.trim()) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, MAX_INPUT_CHARS) }),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { data?: { embedding?: unknown }[] };
    const embedding = json.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) return null;
    return embedding as number[];
  } catch {
    return null;
  }
}
