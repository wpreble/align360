import { createClient } from '@/lib/supabase/server';
import { costUsd, creditsFor, ALPHA_FREE_ALLOWANCE } from '@/lib/credits';
import { isTeamEmail } from '@/lib/admin';

// Server-side credit metering for the AI routes. Everything here is BEST-EFFORT
// and FAILS OPEN: if the user is not signed in, the RPCs are missing, or anything
// throws, the AI request proceeds as normal. Hard-stop enforcement only engages
// when CREDITS_ENFORCED=true AND the user is definitively out of credits, so this
// can ship without risking the AI that already works in production.

const enforced = () => process.env.CREDITS_ENFORCED === 'true';

/** Pre-call gate. ok=false (block) only when enforcement is on and remaining<=0. */
export async function creditPrecheck(): Promise<{ ok: boolean; remaining: number | null }> {
  if (!enforced()) return { ok: true, remaining: null };
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: true, remaining: null };
    if (isTeamEmail(user.email)) return { ok: true, remaining: null }; // internal team: unlimited
    const { data, error } = await supabase.rpc('credit_status', { p_allowance: ALPHA_FREE_ALLOWANCE });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return { ok: true, remaining: null };
    const remaining = Number(row.remaining ?? 0);
    if (remaining <= 0) return { ok: false, remaining };
    return { ok: true, remaining };
  } catch {
    return { ok: true, remaining: null };
  }
}

/** Record one AI call's usage and debit credits. Best-effort; never throws. */
export async function meterUsage(feature: string, model: string, inputTokens: number, outputTokens: number): Promise<void> {
  try {
    const inTok = Math.max(0, Math.round(inputTokens || 0));
    const outTok = Math.max(0, Math.round(outputTokens || 0));
    if (inTok === 0 && outTok === 0) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (isTeamEmail(user.email)) return; // internal team: not metered
    const credits = Math.max(1, Math.round(creditsFor(model, inTok, outTok)));
    const costMicros = Math.round(costUsd(model, inTok, outTok) * 1e6);
    await supabase.rpc('credit_charge', {
      p_allowance: ALPHA_FREE_ALLOWANCE,
      p_feature: feature,
      p_model: model,
      p_in: inTok,
      p_out: outTok,
      p_cost_micros: costMicros,
      p_credits: credits,
    });
  } catch {
    /* best-effort */
  }
}
