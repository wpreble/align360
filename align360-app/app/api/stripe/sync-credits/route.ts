import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured, connect } from '@/lib/stripe/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ALPHA_FREE_ALLOWANCE } from '@/lib/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reconcile the signed-in user's PAID top-up checkout sessions from Stripe and
 * grant any not yet granted. Mirrors what the webhook does, so buying credits
 * works even with no webhook configured. Idempotent: credit_grant_topup claims
 * each session id once, so the webhook and this sync never double-grant.
 */
export async function POST() {
  if (!stripeConfigured) return NextResponse.json({ granted: 0, synced: false });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ granted: 0, signedIn: false });

  const db = createServiceClient();
  const stripe = getStripe();
  const opts = connect.connectedAccountId ? { stripeAccount: connect.connectedAccountId } : {};

  try {
    const { data: cust } = await db
      .from('stripe_customers')
      .select('id')
      .eq('owner_type', 'user')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!cust?.id) return NextResponse.json({ granted: 0, synced: true, reason: 'no_customer' });

    const sessions = await stripe.checkout.sessions.list({ customer: cust.id as string, limit: 50 }, opts);
    let granted = 0;
    for (const s of sessions.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sess = s as any;
      if (sess.mode !== 'payment' || sess.payment_status !== 'paid' || sess.metadata?.kind !== 'topup') continue;
      if (sess.metadata?.owner_id !== user.id) continue; // belt-and-suspenders
      const credits = parseInt(sess.metadata?.credits || '0', 10);
      if (!(credits > 0)) continue;
      // Idempotent: credit_grant_topup no-ops if this session was already granted.
      await db.rpc('credit_grant_topup', {
        p_session_id: sess.id,
        p_owner_type: 'user',
        p_owner_id: user.id,
        p_credits: credits,
        p_allowance: ALPHA_FREE_ALLOWANCE,
      });
      granted++;
    }
    return NextResponse.json({ granted, synced: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : 'sync failed';
    console.error('stripe sync-credits error:', m);
    return NextResponse.json({ granted: 0, synced: false, error: m });
  }
}
