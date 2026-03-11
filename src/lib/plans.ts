/**
 * Plan definitions — safe to import from both client and server components.
 * Does NOT import Stripe SDK.
 */

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
    price: 20,
    monthlyTokens: 300_000,
    weeklyTokens: 75_000,
    features: ['300k tokens/month', 'Companion app', 'All integrations', 'Full memory', 'Workflows'],
  },
  pro: {
    name: 'Pro',
    slug: 'pro',
    price: 50,
    monthlyTokens: 1_200_000,
    weeklyTokens: 300_000,
    features: ['1.2M tokens/month', 'Everything in Starter', 'Priority support', 'Advanced workflows'],
    popular: true,
  },
  power: {
    name: 'Power',
    slug: 'power',
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
