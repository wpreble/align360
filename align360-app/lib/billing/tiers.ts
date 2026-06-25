// Billing tiers — single source of truth. The setup script creates these as
// Stripe products/prices on Samuel's CONNECTED account (Direct Charges). Ascendance
// (platform) keeps APPLICATION_FEE_PERCENT (50%) of each subscription.
//
// SCOPE: self-serve ALPHA-PILOT products only. The commercial org tiers
// (Full Pilot / SMB / Mid-Market / Enterprise — annual contracts, $3k-$10k flat
// access fees, min 25-150 seats, Founders Circle $35/seat lifetime lock) are
// SALES-LED and handled via Stripe Invoices/Quotes, not self-serve checkout — not
// created here. Source: align360_alpha_pilot_onepager (2026-06).

export const APPLICATION_FEE_PERCENT = Number(process.env.STRIPE_APPLICATION_FEE_PERCENT || '50');

export type Tier = {
  key: string;
  productName: string;
  description: string;
  amountCents: number;
  interval: 'month' | 'year';
  perSeat: boolean;
  minSeats?: number;
  lookupKey: string; // stable id for idempotent setup + checkout lookup
};

export const TIERS: Tier[] = [
  {
    key: 'individual_monthly',
    productName: 'Align360 · Individual',
    description: 'Individual plan, billed monthly. Alpha $49 (public release $99; alpha users grandfathered at $49 through first renewal).',
    amountCents: 4900,
    interval: 'month',
    perSeat: false,
    lookupKey: 'a360_individual_monthly',
  },
  {
    key: 'org_pilot_seat_monthly',
    productName: 'Align360 · Team (Alpha Pilot)',
    description: 'Team plan, per seat, billed monthly. Minimum 5 seats (enforced at checkout).',
    amountCents: 1900,
    interval: 'month',
    perSeat: true,
    minSeats: 5,
    lookupKey: 'a360_org_pilot_seat_monthly',
  },
];
