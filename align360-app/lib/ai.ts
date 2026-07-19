import OpenAI from 'openai';

// One place to resolve which AI provider a model id targets and build
// provider-correct request params. All three providers speak the OpenAI
// /v1/chat/completions shape, so only the base URL, auth, headers, and a couple
// of param names differ. Model-id conventions pick the provider:
//   - grade-suffixed id (e.g. "glm-5.2:public") + CHARIS_API_KEY → Charis
//       (Covenant Labs gateway; cheaper GLM, routes/falls back to other providers)
//   - "vendor/model" id (e.g. "z-ai/glm-5.2") + OPENROUTER_API_KEY → OpenRouter
//   - plain id (gpt-5.5, gpt-5-mini) → OpenAI
// No current OpenAI/OpenRouter id contains ':', so the Charis check is unambiguous.
export type Provider = 'openai' | 'openrouter' | 'charis';

export function resolveModel(envVar: string, fallback: string): { model: string; provider: Provider; apiKey: string } {
  const model = process.env[envVar] || fallback;
  if (model.includes(':') && process.env.CHARIS_API_KEY) {
    return { model, provider: 'charis', apiKey: process.env.CHARIS_API_KEY };
  }
  if (model.includes('/') && process.env.OPENROUTER_API_KEY) {
    return { model, provider: 'openrouter', apiKey: process.env.OPENROUTER_API_KEY };
  }
  return { model, provider: 'openai', apiKey: process.env.OPENAI_API_KEY || '' };
}

export function makeClient(provider: Provider, apiKey: string): OpenAI {
  if (provider === 'charis') {
    return new OpenAI({
      apiKey,
      baseURL: process.env.CHARIS_BASE_URL || 'https://gateway.charis.im/v1',
      defaultHeaders: { 'X-Chain': process.env.CHARIS_CHAIN || 'base' },
    });
  }
  if (provider === 'openrouter') {
    return new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1', defaultHeaders: { 'HTTP-Referer': 'https://align360-app.vercel.app', 'X-Title': 'Align360' } });
  }
  return new OpenAI({ apiKey });
}

/**
 * Provider-correct generation params. OpenRouter uses max_tokens + the unified
 * `reasoning` flag; OpenAI uses max_completion_tokens + reasoning_effort.
 */
/**
 * Parse model JSON defensively. GLM (and others) occasionally wrap JSON in
 * markdown fences or emit a stray prefix/suffix even under response_format
 * json_object. Try strict parse, then fenced block, then the outermost {...}.
 * Returns null if nothing parses (caller falls back / retries).
 */
export function parseJsonLoose<T = unknown>(text: string | null | undefined): T | null {
  if (!text) return null;
  const tryParse = (s: string): T | null => {
    try { return JSON.parse(s) as T; } catch { return null; }
  };
  const direct = tryParse(text);
  if (direct) return direct;
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const f = tryParse(fence[1].trim());
    if (f) return f;
  }
  const i = trimmed.indexOf('{');
  const j = trimmed.lastIndexOf('}');
  if (i >= 0 && j > i) {
    const f = tryParse(trimmed.slice(i, j + 1));
    if (f) return f;
  }
  return null;
}

export function genParams(
  provider: Provider,
  opts: { maxTokens: number; json?: boolean; reasoning?: 'off' | 'low'; temperature?: number },
): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (opts.json) p.response_format = { type: 'json_object' };
  if (provider === 'openai') {
    p.max_completion_tokens = opts.maxTokens;
    p.reasoning_effort = 'low';
  } else {
    // OpenRouter + Charis: max_tokens + the unified `reasoning` flag (both accept it;
    // verified against Charis 2026-07-14). GLM reasons by default, so `off` matters
    // for cost/latency. Temperature is applied here only — some OpenAI models
    // (e.g. gpt-5.5) reject a non-default temperature, so it stays unset for OpenAI.
    p.max_tokens = opts.maxTokens;
    p.reasoning = opts.reasoning === 'off' ? { enabled: false } : { effort: 'low' };
    if (typeof opts.temperature === 'number') p.temperature = opts.temperature;
  }
  return p;
}
