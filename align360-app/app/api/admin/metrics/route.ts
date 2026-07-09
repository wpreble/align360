import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Normalize any Stripe recurring price to a monthly-cents figure for MRR.
function toMonthlyCents(unitAmount: number, interval: string, count: number, qty: number): number {
  const perPeriod = unitAmount * qty;
  const c = count || 1;
  switch (interval) {
    case 'day': return Math.round((perPeriod / c) * 30);
    case 'week': return Math.round((perPeriod / c) * (52 / 12));
    case 'year': return Math.round((perPeriod / c) / 12);
    case 'month':
    default: return Math.round(perPeriod / c);
  }
}

async function signups() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { total: null as number | null, recent: [] as { email: string; created_at: string; provider?: string }[] };
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=10&page=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  const total = Number(res.headers.get('x-total-count')) || null;
  const data = await res.json().catch(() => ({}));
  const users = Array.isArray(data?.users) ? data.users : [];
  const recent = users
    .sort((a: { created_at: string }, b: { created_at: string }) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 10)
    .map((u: { email?: string; created_at: string; app_metadata?: { provider?: string } }) => ({
      email: u.email || '(no email)',
      created_at: u.created_at,
      provider: u.app_metadata?.provider,
    }));
  return { total, recent };
}

async function subscriptions() {
  if (!stripeConfigured) return { activeCount: 0, mrrCents: 0, live: null as boolean | null, list: [] };
  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.customer'] });
  let mrrCents = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = subs.data.map((s: any) => {
    const item = s.items?.data?.[0];
    const price = item?.price;
    const monthly = price?.unit_amount
      ? toMonthlyCents(price.unit_amount, price.recurring?.interval || 'month', price.recurring?.interval_count || 1, item?.quantity || 1)
      : 0;
    mrrCents += monthly;
    const cust = s.customer && typeof s.customer === 'object' ? s.customer : null;
    return {
      email: cust?.email || null,
      status: s.status,
      monthlyCents: monthly,
      quantity: item?.quantity || 1,
      interval: price?.recurring?.interval || null,
      created: s.created,
    };
  });
  const live = subs.data.length ? !!subs.data[0].livemode : null;
  return { activeCount: subs.data.length, mrrCents, live, list };
}

export async function GET() {
  const gate = requireAdmin();
  if (gate instanceof NextResponse) return gate;
  try {
    const [su, sub] = await Promise.all([signups(), subscriptions()]);
    return NextResponse.json({
      signups: su,
      subscriptions: sub,
      stripeMode: sub.live == null ? 'unknown' : sub.live ? 'live' : 'test',
      generatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'metrics failed' }, { status: 502 });
  }
}
