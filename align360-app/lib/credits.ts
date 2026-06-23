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
 * Provider rates, USD per 1,000,000 tokens. PLACEHOLDER values — confirm against
 * the live model price sheet before launch.
 */
export const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'gpt-5.5': { input: 1.25, output: 10 },
  default: { input: 1.25, output: 10 },
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
