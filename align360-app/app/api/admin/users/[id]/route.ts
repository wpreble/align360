import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { loadSnapshot, supabaseConfigured, wantsFresh } from '@/lib/admin/data';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-user drilldown: who they are, what they pay, and what they have actually
 * done in the product.
 *
 * The engagement half of this was the largest blind spot in the old portal —
 * onboarding, assessment_answers, reports, chats, usage_events and credit
 * balances are all populated by the app and none of them were read by any admin
 * route, so "who is paying" could never be followed by "are they using it".
 *
 * Every read here is service-role (bypasses RLS) and strictly read-only.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gate = requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const userId = params.id;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  try {
    const snap = await loadSnapshot(wantsFresh(req));
    const user = snap.users.find((u) => u.id === userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!supabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured in this environment.' }, { status: 503 });
    }

    const supabase = createServiceClient();

    const [profile, onboarding, answers, reports, chats, credits, usage, feedback, referralCode, referralsMade, referredBy] =
      await Promise.all([
        supabase.from('profiles').select('full_name, email, avatar_url, is_platform_admin, created_at').eq('id', userId).maybeSingle(),
        supabase.from('onboarding').select('answers, updated_at').eq('user_id', userId).maybeSingle(),
        supabase.from('assessment_answers').select('slug, completed_at').eq('user_id', userId).order('completed_at', { ascending: false }),
        supabase.from('reports').select('kind, slug, generated_at').eq('user_id', userId).order('generated_at', { ascending: false }),
        supabase.from('chats').select('id, title, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(25),
        supabase.from('credit_balances').select('credits_granted, credits_used, period_start, period_end').eq('owner_type', 'user').eq('owner_id', userId).maybeSingle(),
        supabase.from('usage_events').select('feature, credits_charged, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
        supabase.from('feedback').select('id, message, path, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('referral_codes').select('code, created_at').eq('user_id', userId).maybeSingle(),
        supabase.from('referrals').select('referred_user_id, status, attributed_at').eq('referrer_user_id', userId),
        supabase.from('referrals').select('referrer_user_id, code_used, status, attributed_at').eq('referred_user_id', userId).maybeSingle(),
      ]);

    // Onboarding is stored as a free-form jsonb blob; report how far along it is
    // rather than dumping the user's answers into the admin view.
    const onboardingAnswers = (onboarding.data?.answers ?? {}) as Record<string, unknown>;
    const onboardingCount = Object.keys(onboardingAnswers).length;

    const usageRows = (usage.data ?? []) as { feature: string; credits_charged: number; created_at: string }[];
    const usageByFeature: Record<string, { events: number; credits: number }> = {};
    for (const e of usageRows) {
      const bucket = (usageByFeature[e.feature] ||= { events: 0, credits: 0 });
      bucket.events += 1;
      bucket.credits += e.credits_charged || 0;
    }

    // Payment history straight from Stripe for whichever customer id this user owns.
    let payments: { id: string; amountCents: number; currency: string; status: string; created: number; description: string | null; refunded: boolean }[] = [];
    let paymentsError: string | null = null;
    const customerId = snap.subs.find((s) => s.id === user.subId)?.customerId ?? null;
    if (customerId && stripeConfigured) {
      try {
        const charges = await getStripe().charges.list({ customer: customerId, limit: 25 });
        payments = charges.data.map((c) => ({
          id: c.id,
          amountCents: c.amount,
          currency: c.currency,
          status: c.status,
          created: c.created,
          description: c.description ?? null,
          refunded: c.refunded,
        }));
      } catch (e) {
        paymentsError = e instanceof Error ? e.message : 'payment history unavailable';
      }
    }

    return NextResponse.json({
      user,
      profile: profile.data ?? null,
      billing: {
        customerId,
        subId: user.subId,
        state: user.state,
        planName: user.planName,
        interval: user.interval,
        quantity: user.quantity,
        monthlyCents: user.monthlyCents,
        currentPeriodEnd: user.currentPeriodEnd,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
        trialEnd: user.trialEnd,
        orgId: user.orgId,
        orgName: user.orgName,
        payments,
        paymentsError,
      },
      engagement: {
        onboardingComplete: onboardingCount > 0,
        onboardingAnswered: onboardingCount,
        onboardingUpdatedAt: onboarding.data?.updated_at ?? null,
        assessments: (answers.data ?? []) as { slug: string; completed_at: string }[],
        reports: (reports.data ?? []) as { kind: string; slug: string; generated_at: string }[],
        chats: (chats.data ?? []) as { id: string; title: string | null; updated_at: string }[],
        credits: credits.data ?? null,
        usageByFeature,
        usageEventsSampled: usageRows.length,
      },
      referrals: {
        code: referralCode.data?.code ?? null,
        made: (referralsMade.data ?? []) as { referred_user_id: string; status: string; attributed_at: string }[],
        referredBy: referredBy.data ?? null,
      },
      feedback: (feedback.data ?? []) as { id: number; message: string; path: string | null; created_at: string }[],
      generatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'user detail failed' }, { status: 502 });
  }
}
