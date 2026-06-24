import OpenAI from 'openai';

// One place to resolve which AI provider a model id targets and build
// provider-correct request params. A "vendor/model" id (e.g. z-ai/glm-5.2) routes
// through OpenRouter; a plain id (gpt-5.5, gpt-5-mini) goes to OpenAI.

export function resolveModel(envVar: string, fallback: string) {
  const model = process.env[envVar] || fallback;
  const useOpenRouter = model.includes('/') && !!process.env.OPENROUTER_API_KEY;
  const apiKey = useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  return { model, useOpenRouter, apiKey: apiKey || '' };
}

export function makeClient(useOpenRouter: boolean, apiKey: string): OpenAI {
  return new OpenAI(
    useOpenRouter
      ? { apiKey, baseURL: 'https://openrouter.ai/api/v1', defaultHeaders: { 'HTTP-Referer': 'https://align360-app.vercel.app', 'X-Title': 'Align360' } }
      : { apiKey },
  );
}

/**
 * Provider-correct generation params. OpenRouter uses max_tokens + the unified
 * `reasoning` flag; OpenAI uses max_completion_tokens + reasoning_effort.
 */
export function genParams(
  useOpenRouter: boolean,
  opts: { maxTokens: number; json?: boolean; reasoning?: 'off' | 'low' },
): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (opts.json) p.response_format = { type: 'json_object' };
  if (useOpenRouter) {
    p.max_tokens = opts.maxTokens;
    p.reasoning = opts.reasoning === 'off' ? { enabled: false } : { effort: 'low' };
  } else {
    p.max_completion_tokens = opts.maxTokens;
    p.reasoning_effort = 'low';
  }
  return p;
}
