import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: ['1 agent instance', '100 messages/month', '10 memories'],
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    price: 29,
    features: ['1 agent instance', 'Unlimited messages', 'Unlimited memories', 'Google + integrations', 'Priority support'],
  },
} as const;
