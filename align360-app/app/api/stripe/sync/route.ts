import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured, connect } from '@/lib/stripe/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE = ['active', 'trialing'];

/**
 * Authoritatively reconcile the signed-in user's subscription state from Stripe
 * into our `subscriptions` table. This makes access activation NOT depend on the
 * webhook having fired, fixing the post-checkout race / a missing-or-lagging
 * webhook (the symptom: "I subscribed but got bounced back to /subscribe").
 * The Stripe customer row is written synchronously at checkout, so we can always
 * look the customer up here and pull their live subscriptions.
 */
export async function POST() {
  if (!stripeConfigured) return NextResponse.json({ access: false, synced: false });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ access: false, signedIn: false });

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
    if (!cust?.id) return NextResponse.json({ access: false, synced: true, reason: 'no_customer' });

    const subs = await stripe.subscriptions.list({ customer: cust.id as string, status: 'all', limit: 20 }, opts);
    let access = false;
    for (const sub of subs.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = (sub as any).items?.data?.[0];
      await db.from('subscriptions').upsert(
        {
          id: sub.id,
          stripe_customer_id: cust.id,
          owner_type: 'user',
          owner_id: user.id,
          status: sub.status,
          price_id: item?.price?.id ?? null,
          quantity: item?.quantity ?? 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (ACTIVE.includes(sub.status)) access = true;
    }
    return NextResponse.json({ access, synced: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : 'sync failed';
    console.error('stripe sync error:', m);
    return NextResponse.json({ access: false, synced: false, error: m });
  }
}
