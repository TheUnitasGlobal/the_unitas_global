/**
 * U-AI deep-insight LLM provider adapter. Server-only.
 *
 * Anthropic (Claude) is the intended engine and is used whenever
 * ANTHROPIC_API_KEY is set. OPENAI_API_KEY is a drop-in fallback so the
 * feature can go live before the Anthropic key is provisioned. Beyond those
 * two paid engines, OPENROUTER_API_KEY / NVIDIA_NIM_API_KEY / BYTEZ_API_KEY
 * are zero-/low-cost fallbacks -- all three expose an OpenAI-compatible
 * /chat/completions endpoint, so the feature can still run for free if no
 * premium key is provisioned yet. The repo's .env.example lists all five --
 * adding a higher-priority key later switches the engine back with zero code
 * change. Keys never leave the server; BYOK is not accepted.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const NVIDIA_NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const BYTEZ_URL = 'https://api.bytez.com/models/v2/openai/v1/chat/completions';

export type InsightProvider = 'anthropic' | 'openai' | 'openrouter' | 'nvidia-nim' | 'bytez';

export function insightProviderAvailable(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.NVIDIA_NIM_API_KEY ||
      process.env.BYTEZ_API_KEY,
  );
}

function activeProvider(): { provider: InsightProvider; key: string; model: string; url: string } | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      key: process.env.ANTHROPIC_API_KEY,
      model: process.env.UAI_ANTHROPIC_MODEL || 'claude-sonnet-5',
      url: ANTHROPIC_URL,
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      key: process.env.OPENAI_API_KEY,
      model: process.env.UAI_OPENAI_MODEL || 'gpt-4o',
      url: OPENAI_URL,
    };
  }
  // Free/low-cost fallback tier: unlocks the feature with zero premium spend
  // when neither paid key above is provisioned. Model ids are overridable --
  // each provider's free-tier catalog shifts over time.
  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: 'openrouter',
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.UAI_OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
      url: OPENROUTER_URL,
    };
  }
  if (process.env.NVIDIA_NIM_API_KEY) {
    return {
      provider: 'nvidia-nim',
      key: process.env.NVIDIA_NIM_API_KEY,
      model: process.env.UAI_NVIDIA_NIM_MODEL || 'meta/llama-3.1-8b-instruct',
      url: NVIDIA_NIM_URL,
    };
  }
  if (process.env.BYTEZ_API_KEY) {
    return {
      provider: 'bytez',
      key: process.env.BYTEZ_API_KEY,
      model: process.env.UAI_BYTEZ_MODEL || 'meta-llama/Llama-3.1-8B-Instruct',
      url: BYTEZ_URL,
    };
  }
  return null;
}

/** One multimodal image block for the Anthropic content-array message shape. */
export interface InsightImage {
  mediaType: string;
  data: string;
}

/**
 * Runs the deep-insight prompt against the active provider. Returns the raw
 * model text (still to be parsed by parseInsightResponse) plus the model id
 * used. Throws on any transport / HTTP error so the route can treat it as a
 * generation failure.
 *
 * `images`, when present (up to a few, each independently a photo / an
 * extracted video frame / a canvas sketch -- the server treats all three
 * identically as image bytes), are folded into the Anthropic message as a
 * `content: [{type:'image',...}, ..., {type:'text',...}]` array -- real
 * vision input, not a filename hint. The OpenAI-compatible branch below
 * (which also covers the free openrouter/nvidia-nim/bytez fallbacks)
 * intentionally ignores it: those endpoints' vision support varies per
 * model/provider, and silently degrading to text-only there is safer than
 * assuming a capability that may not exist on whichever free model is
 * configured.
 */
export async function generateInsight(
  system: string,
  userPrompt: string,
  maxTokens = 1800,
  images?: InsightImage[],
): Promise<{ text: string; model: string }> {
  const active = activeProvider();
  if (!active) throw new Error('No insight provider configured');
  const max_tokens = Math.max(256, Math.min(4096, Math.round(maxTokens)));

  if (active.provider === 'anthropic') {
    const content = images?.length
      ? [
          ...images.map((img) => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType, data: img.data },
          })),
          { type: 'text', text: userPrompt },
        ]
      : userPrompt;
    const res = await fetch(active.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': active.key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: active.model,
        max_tokens,
        system,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return { text: data.content?.map((c) => c.text ?? '').join('') ?? '', model: active.model };
  }

  // openai / openrouter / nvidia-nim / bytez all speak the same
  // OpenAI-compatible chat/completions shape -- one branch covers all four.
  // response_format is OpenAI-only (open-weight models on the other three
  // routinely reject an unsupported field); parseInsightResponse already
  // tolerates stray prose/markdown around the JSON payload, so it isn't
  // required for a valid response either way.
  const res = await fetch(active.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${active.key}`,
    },
    body: JSON.stringify({
      model: active.model,
      max_tokens,
      ...(active.provider === 'openai' ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${active.provider} ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { text: data.choices?.[0]?.message?.content ?? '', model: active.model };
}
