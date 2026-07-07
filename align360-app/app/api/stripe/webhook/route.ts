import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/server';
import { ALPHA_FREE_ALLOWANCE } from '@/lib/credits';
import { hubspotUpsertContact, splitName } from '@/lib/hubspot';

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

  // Idempotency: claim the event id atomically (INSERT ... ON CONFLICT DO NOTHING).
  // A plain SELECT-then-INSERT races two concurrent deliveries of the same event;
  // the upsert is one statement, so only the first caller gets a row back.
  const db = createServiceClient();
  const { data: claimed } = await db
    .from('stripe_events')
    .upsert({ id: event.id, type: event.type }, { onConflict: 'id', ignoreDuplicates: true })
    .select('id');
  if (!claimed || claimed.length === 0) return NextResponse.json({ received: true, duplicate: true });

  // Upsert our subscriptions row from a Stripe subscription object. owner_type/
  // owner_id come from the subscription metadata set at checkout.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upsertSub = async (sub: any) => {
    const item = sub.items?.data?.[0];
    const ownerId = sub.metadata?.owner_id;
    if (!ownerId) return; // unattributable without metadata
    await db.from('subscriptions').upsert(
      {
        id: sub.id,
        stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        owner_type: sub.metadata?.owner_type || 'user',
        owner_id: ownerId,
        status: sub.status,
        price_id: item?.price?.id ?? null,
        quantity: item?.quantity ?? 1,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: !!sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  };

  // Connect events arrive on the platform endpoint with event.account = connected acct.
  const acctOpts = event.account ? { stripeAccount: event.account } : {};
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await upsertSub(event.data.object);
      break;
    case 'checkout.session.completed': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = event.data.object as any;
      if (s.mode === 'payment' && s.metadata?.kind === 'topup' && s.payment_status === 'paid') {
        // One-time credit top-up → grant to the persistent pool (idempotent via the
        // stripe_events dedupe above, so this runs once per event).
        const credits = parseInt(s.metadata.credits || '0', 10);
        if (credits > 0 && s.metadata.owner_id) {
          await db.rpc('credit_grant_topup', {
            p_session_id: s.id,
            p_owner_type: s.metadata.owner_type || 'user',
            p_owner_id: s.metadata.owner_id,
            p_credits: credits,
            p_allowance: ALPHA_FREE_ALLOWANCE,
          });
        }
      } else if (s.subscription) {
        await upsertSub(await stripe.subscriptions.retrieve(s.subscription, undefined, acctOpts));
        // Best-effort CRM: mark the paying buyer a customer in HubSpot (segmentation +
        // the "paid customers" list). Email comes from Stripe Checkout's collected details.
        await hubspotUpsertContact(s.customer_details?.email || s.customer_email, {
          ...splitName(s.customer_details?.name),
          lifecyclestage: 'customer',
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
