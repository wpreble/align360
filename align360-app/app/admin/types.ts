// Shared client-side shapes for the admin portal. These mirror the JSON the
// /api/admin/* routes return; the server-side source of truth is lib/admin/data.ts.

export type Role = 'superadmin' | 'admin';

export type PaymentState = 'active' | 'trialing' | 'past_due' | 'canceled' | 'org_seat' | 'free';

export type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string | null;
  confirmed: boolean;
  state: PaymentState;
  monthlyCents: number;
  planName: string | null;
  interval: string | null;
  quantity: number;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: number | null;
  subId: string | null;
  orgId: string | null;
  orgName: string | null;
};

export type Truncation = { users: boolean; subs: boolean };
export type Availability = { supabase: boolean; stripe: boolean };

export type Metrics = {
  users: {
    total: number;
    paying: number;
    free: number;
    byState: Record<PaymentState, number>;
    signups30: number;
    signups7: number;
    activeLast30: number;
  };
  revenue: { mrrCents: number; arrCents: number; atRiskCents: number; arpuCents: number };
  subscriptions: { active: number; trialing: number; pastDue: number; canceled: number; pendingCancel: number; canceled30: number };
  rates: { churn30Pct: number | null; trialConversionPct: number | null; trialsResolved: number; paidSharePct: number | null };
  orgs: { total: number; paying: number; seatsPurchased: number; seatsAssigned: number };
  stripeMode: 'live' | 'test' | 'unknown';
  connectScoped: boolean;
  truncated: Truncation;
  available: Availability;
  generatedAt: number;
};

export type UsersPage = {
  items: UserRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unfilteredTotal: number;
  truncated: Truncation;
  available: Availability;
  stripeMode: string;
  connectScoped: boolean;
  generatedAt: number;
};

export type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
  memberCount: number;
  seatsAssigned: number;
  seatsPurchased: number;
  seatsUnused: number;
  state: PaymentState;
  monthlyCents: number;
  planName: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  pendingInvites: number;
  members: { userId: string; email: string | null; role: string; seatAssigned: boolean }[];
  invitations: { email: string; role: string; status: string; created_at: string; expires_at: string }[];
};

export type OrgsResponse = {
  items: OrgRow[];
  totals: { orgs: number; paying: number; seatsPurchased: number; seatsAssigned: number; monthlyCents: number };
  truncated: Truncation;
  generatedAt: number;
};

export type TimeSeries = {
  signupsWeekly: { week: string; signups: number; cumulative: number }[];
  revenueMonthly: { month: string; grossCents: number; netCents: number; charges: number }[];
  currency: string;
  revenueAvailable: boolean;
  revenueTruncated: boolean;
  revenueError: string | null;
  months: number;
  generatedAt: number;
};

export type UserDetail = {
  user: UserRow;
  profile: { full_name: string | null; email: string | null; avatar_url: string | null; is_platform_admin: boolean; created_at: string } | null;
  billing: {
    customerId: string | null;
    subId: string | null;
    state: PaymentState;
    planName: string | null;
    interval: string | null;
    quantity: number;
    monthlyCents: number;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: number | null;
    orgId: string | null;
    orgName: string | null;
    payments: { id: string; amountCents: number; currency: string; status: string; created: number; description: string | null; refunded: boolean }[];
    paymentsError: string | null;
  };
  engagement: {
    onboardingComplete: boolean;
    onboardingAnswered: number;
    onboardingUpdatedAt: string | null;
    assessments: { slug: string; completed_at: string }[];
    reports: { kind: string; slug: string; generated_at: string }[];
    chats: { id: string; title: string | null; updated_at: string }[];
    credits: { credits_granted: number; credits_used: number; period_start: string; period_end: string } | null;
    usageByFeature: Record<string, { events: number; credits: number }>;
    usageEventsSampled: number;
  };
  referrals: {
    code: string | null;
    made: { referred_user_id: string; status: string; attributed_at: string }[];
    referredBy: { referrer_user_id: string; code_used: string; status: string; attributed_at: string } | null;
  };
  feedback: { id: number; message: string; path: string | null; created_at: string }[];
  generatedAt: number;
};

export type Payouts = {
  range: { start: number; end: number };
  currency: string;
  mode: string;
  count: number;
  capped: boolean;
  grossCents: number;
  feeCents: number;
  refundCents: number;
  appFeeCents: number;
  netCents: number;
  connectScoped: boolean;
  applicationFeePercent: number;
};

export type FeedbackItem = { id: number; email: string | null; message: string; path: string | null; created_at: string };
