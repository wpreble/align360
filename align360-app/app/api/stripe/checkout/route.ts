import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured, connect } from '@/lib/stripe/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOOKUP = { individual: 'a360_individual_monthly', org: 'a360_org_pilot_seat_monthly' } as const;
const MIN_ORG_SEATS = 5;

export async function POST(req: Request) {
  if (!stripeConfigured) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 });

  // In-handler auth (defense-in-depth beyond middleware).
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { mode?: 'individual' | 'org'; orgId?: string; seats?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const mode = body.mode === 'org' ? 'org' : 'individual';

  let ownerType: 'user' | 'org' = 'user';
  let ownerId = user.id;
  let quantity = 1;
  if (mode === 'org') {
    if (!body.orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });
    const { data: mem } = await supabase.from('organization_members').select('role').eq('org_id', body.orgId).eq('user_id', user.id).maybeSingle();
    if (!mem || !['owner', 'admin'].includes(mem.role)) return NextResponse.json({ error: 'Not an org admin' }, { status: 403 });
    ownerType = 'org';
    ownerId = body.orgId;
    quantity = Math.max(MIN_ORG_SEATS, Math.floor(Number(body.seats) || MIN_ORG_SEATS));
  }

  const stripe = getStripe();
  // Direct Charges on the connected account when configured; else platform (test).
  const opts = connect.connectedAccountId ? { stripeAccount: connect.connectedAccountId } : {};

  try {
    const prices = await stripe.prices.list({ lookup_keys: [LOOKUP[mode]], active: true, limit: 1 }, opts);
    const price = prices.data[0];
    if (!price) return NextResponse.json({ error: `Price ${LOOKUP[mode]} not found — run scripts/stripe-setup-products.ts.` }, { status: 500 });

    // Reuse or create the Stripe customer for this owner (service role — no client insert policy).
    const db = createServiceClient();
    const { data: existing } = await db.from('stripe_customers').select('id').eq('owner_type', ownerType).eq('owner_id', ownerId).maybeSingle();
    let customerId = existing?.id as string | undefined;
    if (!customerId) {
      const cust = await stripe.customers.create({ email: user.email, metadata: { owner_type: ownerType, owner_id: ownerId } }, opts);
      customerId = cust.id;
      await db.from('stripe_customers').insert({ id: customerId, owner_type: ownerType, owner_id: ownerId });
    }

    const origin = new URL(req.url).origin;
    const back = mode === 'org' ? `org/${ownerId}` : 'insights';
    const subscriptionData: Record<string, unknown> = { metadata: { owner_type: ownerType, owner_id: ownerId } };
    if (connect.connectedAccountId && connect.applicationFeePercent > 0) {
      subscriptionData.application_fee_percent = connect.applicationFeePercent;
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: price.id, quantity }],
        subscription_data: subscriptionData,
        success_url: `${origin}/${back}?checkout=success`,
        cancel_url: `${origin}/${back}?checkout=cancel`,
        metadata: { owner_type: ownerType, owner_id: ownerId, user_id: user.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      opts,
    );
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const m = e instanceof Error ? e.message : 'checkout failed';
    console.error('checkout error:', m);
    return NextResponse.json({ error: m }, { status: 502 });
  }
}
