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
