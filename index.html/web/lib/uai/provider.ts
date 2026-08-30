/**
 * U-AI deep-insight LLM provider adapter. Server-only.
 *
 * Anthropic (Claude) is the intended engine and is used whenever
 * ANTHROPIC_API_KEY is set. OPENAI_API_KEY is a drop-in fallback so the
 * feature can go live before the Anthropic key is provisioned (the repo's
 * .env.example lists both) -- adding ANTHROPIC_API_KEY later switches the
 * engine back with zero code change. The key never leaves the server; BYOK
 * is not accepted.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export type InsightProvider = 'anthropic' | 'openai';

export function insightProviderAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

function activeProvider(): { provider: InsightProvider; key: string; model: string } | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      key: process.env.ANTHROPIC_API_KEY,
      model: process.env.UAI_ANTHROPIC_MODEL || 'claude-sonnet-5',
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      key: process.env.OPENAI_API_KEY,
      model: process.env.UAI_OPENAI_MODEL || 'gpt-4o',
    };
  }
  return null;
}

/**
 * Runs the deep-insight prompt against the active provider. Returns the raw
 * model text (still to be parsed by parseInsightResponse) plus the model id
 * used. Throws on any transport / HTTP error so the route can treat it as a
 * generation failure.
 */
export async function generateInsight(
  system: string,
  userPrompt: string,
): Promise<{ text: string; model: string }> {
  const active = activeProvider();
  if (!active) throw new Error('No insight provider configured');

  if (active.provider === 'anthropic') {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': active.key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: active.model,
        max_tokens: 1800,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return { text: data.content?.map((c) => c.text ?? '').join('') ?? '', model: active.model };
  }

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${active.key}` },
    body: JSON.stringify({
      model: active.model,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { text: data.choices?.[0]?.message?.content ?? '', model: active.model };
}
