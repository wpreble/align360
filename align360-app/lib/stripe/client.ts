import Stripe from 'stripe';

/** True once a Stripe secret key is present (test or live). */
export const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

let _stripe: Stripe | null = null;

/** Lazily-instantiated server-side Stripe client. Throws if no key is set. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  if (!_stripe) _stripe = new Stripe(key); // SDK-pinned API version
  return _stripe;
}

/**
 * Connect revenue-share config (set via env). The connected account receives the
 * share; the platform retains the application fee. Kept in env so business terms
 * never live in the (public) repo.
 */
export const connect = {
  connectedAccountId: process.env.STRIPE_CONNECTED_ACCOUNT_ID || '',
  applicationFeePercent: Number(process.env.STRIPE_APPLICATION_FEE_PERCENT || '0'),
};

/**
 * Request options that scope a Stripe call to the CONNECTED account.
 *
 * This matters more than it looks. Align360 sells via Direct Charges on Samuel's
 * connected account: checkout, sync, topup, cancel-individual and the product
 * setup script all pass `{ stripeAccount }`. Every subscription, customer,
 * charge and balance transaction for Align360 therefore lives on the CONNECTED
 * account, not the platform.
 *
 * A Stripe read WITHOUT these options silently returns the PLATFORM account's
 * data instead — a different business's revenue — with no error and no empty
 * result to tip you off. The admin dashboard did exactly that and reported
 * another company's MRR as Align360's. Any new admin read must pass this.
 */
export function connectedOptions(): { stripeAccount?: string } {
  return connect.connectedAccountId ? { stripeAccount: connect.connectedAccountId } : {};
}

/** True when Stripe reads are correctly scoped to Align360's connected account. */
export const connectScoped = !!connect.connectedAccountId;
