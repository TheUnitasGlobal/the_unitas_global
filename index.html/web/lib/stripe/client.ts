import Stripe from 'stripe';

// Server-only by convention: import this from Route Handlers / Server
// Actions alone -- it reads STRIPE_SECRET_KEY, which must never reach the
// browser bundle.
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY must be set (see .env.example).');
  }

  // No pinned apiVersion: let the SDK use its bundled default so this file
  // doesn't need to track Stripe's literal-typed apiVersion strings by hand.
  stripeClient = new Stripe(secretKey);
  return stripeClient;
}
