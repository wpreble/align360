import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook — the source of truth for billing state. Verifies the signature,
 * dedupes via the stripe_events ledger, then (Phase 3) upserts subscriptions.
 * Public route (no session); security is the signature check.
 */
export async function POST(req: Request) {
  if (!stripeConfigured || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }
  const stripe = getStripe();
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
  }

  // Idempotency: process each event id at most once.
  const db = createServiceClient();
  const { data: seen } = await db.from('stripe_events').select('id').eq('id', event.id).maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });
  await db.from('stripe_events').insert({ id: event.id, type: event.type });

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.paid':
    case 'invoice.payment_failed':
      // TODO (Phase 3): upsert `subscriptions` (status, quantity, period) from the
      // event payload; reset the credit allowance on each new billing period.
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
