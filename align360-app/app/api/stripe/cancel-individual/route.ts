import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured, connect } from '@/lib/stripe/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE = ['active', 'trialing'];

/**
 * Cancels the signed-in user's own (individual) subscription, if any is active.
 * Called right after accepting an org invite: the org now covers their access,
 * so an existing personal subscription would otherwise keep charging them on
 * top of what the org already pays for their seat (Drew, 2026-07-22 — no
 * automatic transfer existed before this route).
 *
 * Cancels IMMEDIATELY (not cancel_at_period_end) since org access replaces it
 * right away. Does NOT issue a refund for the current period — crediting/
 * refunding already-collected money is a separate, more sensitive decision
 * left to a human; this only stops future charges.
 */
export async function POST() {
  if (!stripeConfigured) return NextResponse.json({ canceled: false });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ canceled: false, signedIn: false });

  const db = createServiceClient();
  const { data: subs } = await db
    .from('subscriptions')
    .select('id')
    .eq('owner_type', 'user')
    .eq('owner_id', user.id)
    .in('status', ACTIVE);

  if (!subs || subs.length === 0) return NextResponse.json({ canceled: false });

  const stripe = getStripe();
  const opts = connect.connectedAccountId ? { stripeAccount: connect.connectedAccountId } : {};
  let canceledAny = false;
  for (const s of subs) {
    try {
      const updated = await stripe.subscriptions.cancel(s.id as string, {}, opts);
      await db.from('subscriptions').update({ status: updated.status, updated_at: new Date().toISOString() }).eq('id', s.id as string);
      canceledAny = true;
    } catch (e) {
      console.error('cancel-individual: failed to cancel', s.id, e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ canceled: canceledAny });
}
