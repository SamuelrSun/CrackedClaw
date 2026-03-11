import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

export const PLANS = {
  free: {
    name: 'Free',
    slug: 'free',
    price: 0,
    monthlyTokens: 40_000,
    weeklyTokens: 10_000,
    features: ['10k tokens/week', 'AI chat', 'Web access', 'Basic memory'],
  },
  starter: {
    name: 'Starter',
    slug: 'starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
    price: 20,
    monthlyTokens: 300_000,
    weeklyTokens: 75_000,
    features: ['300k tokens/month', 'Companion app', 'All integrations', 'Full memory', 'Workflows'],
  },
  pro: {
    name: 'Pro',
    slug: 'pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    price: 50,
    monthlyTokens: 1_200_000,
    weeklyTokens: 300_000,
    features: ['1.2M tokens/month', 'Everything in Starter', 'Priority support', 'Advanced workflows'],
    popular: true,
  },
  power: {
    name: 'Power',
    slug: 'power',
    priceId: process.env.STRIPE_POWER_PRICE_ID || '',
    price: 100,
    monthlyTokens: 3_000_000,
    weeklyTokens: 750_000,
    features: ['3M tokens/month', 'Everything in Pro', 'Highest priority', 'Unlimited conversations'],
  },
} as const;

export type PlanSlug = keyof typeof PLANS;

export function getPlanBySlug(slug: string) {
  return PLANS[slug as PlanSlug] || PLANS.free;
}

export function getTokenLimit(planSlug: string): { monthly: number; weekly: number } {
  const plan = getPlanBySlug(planSlug);
  return { monthly: plan.monthlyTokens, weekly: plan.weeklyTokens };
}
