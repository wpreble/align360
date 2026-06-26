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
export const AI_BUDGET_SHARE = 0.12; // 12% (Will, 2026-06-25)

/** Top-up / add-on credits are sold at a markup over their true cost. */
export const CREDIT_MARKUP = 3; // 3x cost → ~$0.03 per credit
export const USD_PER_CREDIT_SELL = 0.01 * CREDIT_MARKUP;

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
  // GLM 5.2 via OpenRouter (measured 2026-06-24): ~$1.40/M in, ~$4.40/M out.
  'z-ai/glm-5.2': { input: 1.4, output: 4.4 },
  default: { input: 5.0, output: 30.0 }, // app default OPENAI_MODEL is gpt-5.5
};

/** Look up a rate by exact id, then by vendor/model prefix (handles versioned
 *  ids like "z-ai/glm-5.2-20260616"), falling back to the conservative default. */
export function rateFor(model: string): { input: number; output: number; cachedInput?: number } {
  if (MODEL_RATES[model]) return MODEL_RATES[model];
  for (const key of Object.keys(MODEL_RATES)) {
    if (key !== 'default' && model.startsWith(key)) return MODEL_RATES[key];
  }
  return MODEL_RATES.default;
}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const r = rateFor(model);
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

/** Per-plan monthly allowance (credits). Individual $49, org seat $19, at 12%. */
export const PLAN_ALLOWANCE = {
  individual: monthlyCreditsForPlan(4900), // 588
  org_seat: monthlyCreditsForPlan(1900),   // 228
} as const;

/** Alpha: signups are free but still metered. Everyone gets the individual
 *  allowance so usage data is real and the hard-stop can be exercised. */
export const ALPHA_FREE_ALLOWANCE = PLAN_ALLOWANCE.individual;

/** Price (in cents) to sell `credits` as a top-up / add-on pack (markup applied). */
export function topupPriceCents(credits: number): number {
  return Math.round(credits * USD_PER_CREDIT_SELL * 100);
}

/** Credits granted for a top-up of `priceCents` (inverse of topupPriceCents). */
export function creditsForTopup(priceCents: number): number {
  return Math.round((priceCents / 100) / USD_PER_CREDIT_SELL);
}

/** Top-up packs offered in the UI (credits). Price derives from topupPriceCents:
 *  at $0.03/credit that is $15 / $45 / $150. */
export const CREDIT_PACKS = [500, 1500, 5000] as const;
export function isValidPack(credits: number): boolean {
  return (CREDIT_PACKS as readonly number[]).includes(credits);
}
