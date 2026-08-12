import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin/guard';
import { loadCustomerOwners, listSubscriptions, wantsFresh } from '@/lib/admin/data';
import { getStripe, stripeConfigured, connectedOptions, connectScoped } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Raw subscription ledger: every subscription, every line item, and exactly what
 * each contributes to MRR.
 *
 * This exists because an MRR number nobody can decompose is worse than no MRR
 * number. Any figure on the Overview tab has to be traceable to the individual
 * Stripe rows behind it, including the rows that do NOT map to an Align360
 * account — those are invisible in the Users tab by construction, and they are
 * exactly where a wrong total hides.
 *
 * Superadmin only: this is the full revenue ledger with customer emails.
 */
export async function GET(req: Request) {
  const gate = requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;
  if (!stripeConfigured) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const fresh = wantsFresh(req);

  try {
    const [subsRes, owners] = await Promise.all([listSubscriptions(fresh), loadCustomerOwners(fresh)]);
    const stripe = getStripe();

    // Re-walk with items expanded so multi-item subscriptions are visible. The
    // shared snapshot deliberately keeps only the first item for its headline
    // math; this endpoint's job is to show what that simplification hides.
    const detail = new Map<string, {
      items: { priceId: string | null; productId: string | null; unitAmount: number | null; currency: string; interval: string | null; intervalCount: number | null; quantity: number }[];
    }>();
    for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 }, connectedOptions())) {
      detail.set(s.id, {
        items: (s.items?.data ?? []).map((i) => ({
          priceId: i.price?.id ?? null,
          productId: typeof i.price?.product === 'string' ? i.price.product : i.price?.product?.id ?? null,
          unitAmount: i.price?.unit_amount ?? null,
          currency: i.price?.currency ?? 'usd',
          interval: i.price?.recurring?.interval ?? null,
          intervalCount: i.price?.recurring?.interval_count ?? null,
          quantity: i.quantity ?? 1,
        })),
      });
    }

    // Product names, for grouping by what was actually sold.
    const productNames = new Map<string, string>();
    try {
      for await (const p of stripe.products.list({ limit: 100 }, connectedOptions())) productNames.set(p.id, p.name);
    } catch { /* ids will stand in for names */ }

    const rows = subsRes.subs.map((s) => {
      const d = detail.get(s.id);
      const owner = owners.get(s.customerId) ?? null;
      return {
        id: s.id,
        status: s.status,
        customerId: s.customerId,
        customerEmail: s.customerEmail,
        /** null = this subscription maps to no Align360 user or org. */
        owner,
        planName: s.planName,
        countedMonthlyCents: s.monthlyCents,
        countsTowardMrr: s.status === 'active',
        itemCount: d?.items.length ?? 0,
        items: (d?.items ?? []).map((i) => ({
          ...i,
          productName: i.productId ? productNames.get(i.productId) ?? null : null,
        })),
        created: s.created,
        currentPeriodEnd: s.currentPeriodEnd,
        livemode: s.livemode,
      };
    });

    // Group active subscriptions by product so a total that is dominated by one
    // product (or by something that is not this app at all) is obvious at a glance.
    const byProduct: Record<string, { subs: number; monthlyCents: number }> = {};
    for (const r of rows) {
      if (r.status !== 'active') continue;
      const key = r.items[0]?.productName || r.items[0]?.productId || r.planName || '(unknown)';
      const b = (byProduct[key] ||= { subs: 0, monthlyCents: 0 });
      b.subs += 1;
      b.monthlyCents += r.countedMonthlyCents;
    }

    return NextResponse.json({
      totalSubs: rows.length,
      activeSubs: rows.filter((r) => r.status === 'active').length,
      mrrCents: rows.filter((r) => r.status === 'active').reduce((n, r) => n + r.countedMonthlyCents, 0),
      multiItemSubs: rows.filter((r) => r.itemCount > 1).length,
      unmappedActive: rows.filter((r) => r.status === 'active' && !r.owner).length,
      byProduct,
      connectScoped,
      rows,
      truncated: subsRes.truncated,
      generatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'subscriptions failed' }, { status: 502 });
  }
}
