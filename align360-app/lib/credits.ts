// Credit metering. AI usage (tokens) → provider USD cost → user-facing "credits".
// Credits are the user-facing unit so UX is decoupled from raw model pricing and
// from margin decisions. Internally we keep the true USD cost for analytics.
//
// Plans grant a monthly credit allowance sized so AI spend stays within a target
// share of revenue (the AI_BUDGET_SHARE guardrail). Enforcement (pre-call balance
// check + post-call debit) is wired into the AI routes in Phase 3.

/** 1 credit = $0.01 of provider cost. Adjust to mark up / down. */
export const USD_PER_CREDIT = 0.01;

/** Target ceiling for AI spend as a share of plan revenue (guardrail). */
export const AI_BUDGET_SHARE = 0.15; // 15%

/**
 * Provider rates, USD per 1,000,000 tokens. Source: OpenAI developer-docs pricing,
 * accessed 2026-06-23. Reasoning tokens bill as OUTPUT tokens (counted below).
 * `cachedInput` is the discounted rate for cache-hit input tokens (not yet applied).
 */
export const MODEL_RATES: Record<string, { input: number; output: number; cachedInput?: number }> = {
  'gpt-5.5': { input: 5.0, output: 30.0, cachedInput: 0.5 },
  'gpt-5.5-pro': { input: 30.0, output: 180.0 },
  'gpt-5.4': { input: 2.5, output: 15.0, cachedInput: 0.25 },
  'gpt-5': { input: 1.25, output: 10.0, cachedInput: 0.125 },
  'gpt-5-mini': { input: 0.25, output: 2.0, cachedInput: 0.025 },
  'gpt-5-nano': { input: 0.05, output: 0.4, cachedInput: 0.005 },
  default: { input: 5.0, output: 30.0 }, // app default OPENAI_MODEL is gpt-5.5
};

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const r = MODEL_RATES[model] ?? MODEL_RATES.default;
  return (inputTokens / 1e6) * r.input + (outputTokens / 1e6) * r.output;
}

export function usdToCredits(usd: number): number {
  return usd / USD_PER_CREDIT;
}

export function creditsFor(model: string, inputTokens: number, outputTokens: number): number {
  return usdToCredits(costUsd(model, inputTokens, outputTokens));
}

/** Monthly credit allowance for a plan priced at `priceCents`, at the guardrail share. */
export function monthlyCreditsForPlan(priceCents: number, share = AI_BUDGET_SHARE): number {
  const aiBudgetUsd = (priceCents / 100) * share;
  return Math.round(usdToCredits(aiBudgetUsd));
}
