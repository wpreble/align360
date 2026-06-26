import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured, connect } from '@/lib/stripe/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isValidPack, topupPriceCents } from '@/lib/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-time credit top-up checkout (Stripe `payment` mode). The webhook
 * (checkout.session.completed, kind=topup) grants the credits to the persistent
 * top-up pool. Owner is always the signed-in user (org pooling is separate).
 */
export async function POST(req: Request) {
  if (!stripeConfigured) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { credits?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const credits = Math.floor(Number(body.credits) || 0);
  if (!isValidPack(credits)) return NextResponse.json({ error: 'Invalid credit pack' }, { status: 400 });

  const stripe = getStripe();
  const opts = connect.connectedAccountId ? { stripeAccount: connect.connectedAccountId } : {};

  try {
    // Reuse or create the Stripe customer for this user (service role — no client insert policy).
    const db = createServiceClient();
    const { data: existing } = await db.from('stripe_customers').select('id').eq('owner_type', 'user').eq('owner_id', user.id).maybeSingle();
    let customerId = existing?.id as string | undefined;
    if (!customerId) {
      const cust = await stripe.customers.create({ email: user.email, metadata: { owner_type: 'user', owner_id: user.id } }, opts);
      customerId = cust.id;
      await db.from('stripe_customers').insert({ id: customerId, owner_type: 'user', owner_id: user.id });
    }

    const origin = new URL(req.url).origin;
    const amount = topupPriceCents(credits);
    const paymentIntentData =
      connect.connectedAccountId && connect.applicationFeePercent > 0
        ? { application_fee_amount: Math.round((amount * connect.applicationFeePercent) / 100) }
        : undefined;

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer: customerId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: amount,
              product_data: { name: `${credits.toLocaleString()} Align360 credits` },
            },
          },
        ],
        ...(paymentIntentData ? { payment_intent_data: paymentIntentData } : {}),
        success_url: `${origin}/chat?topup=success`,
        cancel_url: `${origin}/chat?topup=cancel`,
        metadata: { kind: 'topup', owner_type: 'user', owner_id: user.id, user_id: user.id, credits: String(credits) },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      opts,
    );
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const m = e instanceof Error ? e.message : 'topup failed';
    console.error('topup error:', m);
    return NextResponse.json({ error: m }, { status: 502 });
  }
}
