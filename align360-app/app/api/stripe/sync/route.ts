import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured, connect } from '@/lib/stripe/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE = ['active', 'trialing'];

/**
 * Authoritatively reconcile the signed-in user's subscription state from Stripe
 * into our `subscriptions` table, for BOTH their personal subscription and any
 * organization they own/admin. Makes access activation independent of the webhook
 * (fixes the post-checkout race / missing webhook: "subscribed but bounced back
 * to /subscribe"). The Stripe customer row is written synchronously at checkout,
 * so we can always look it up here and pull live subscriptions.
 */
export async function POST() {
  if (!stripeConfigured) return NextResponse.json({ access: false, synced: false });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ access: false, signedIn: false });

  const db = createServiceClient();
  const stripe = getStripe();
  const opts = connect.connectedAccountId ? { stripeAccount: connect.connectedAccountId } : {};

  // Pull live subs for one Stripe customer and upsert them under (ownerType, ownerId).
  const reconcile = async (customerId: string, ownerType: 'user' | 'org', ownerId: string): Promise<boolean> => {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 }, opts);
    let active = false;
    for (const sub of subs.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = (sub as any).items?.data?.[0];
      await db.from('subscriptions').upsert(
        {
          id: sub.id,
          stripe_customer_id: customerId,
          owner_type: ownerType,
          owner_id: ownerId,
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
      if (ACTIVE.includes(sub.status)) active = true;
    }
    return active;
  };

  try {
    let access = false;

    // Personal subscription.
    const { data: cust } = await db.from('stripe_customers').select('id').eq('owner_type', 'user').eq('owner_id', user.id).maybeSingle();
    if (cust?.id) access = (await reconcile(cust.id as string, 'user', user.id)) || access;

    // Orgs the user owns or admins.
    const { data: mems } = await db.from('organization_members').select('org_id').eq('user_id', user.id).in('role', ['owner', 'admin']);
    const orgIds = Array.from(new Set((mems || []).map((m) => m.org_id as string)));
    if (orgIds.length) {
      const { data: orgCusts } = await db.from('stripe_customers').select('id, owner_id').eq('owner_type', 'org').in('owner_id', orgIds);
      for (const oc of orgCusts || []) {
        access = (await reconcile(oc.id as string, 'org', oc.owner_id as string)) || access;
      }
    }

    return NextResponse.json({ access, synced: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : 'sync failed';
    console.error('stripe sync error:', m);
    return NextResponse.json({ access: false, synced: false, error: m });
  }
}
