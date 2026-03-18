/**
 * Plan definitions — safe to import from both client and server components.
 * Does NOT import Stripe SDK.
 */

export const PLANS = {
  free: {
    name: 'Free',
    slug: 'free' as const,
    price: 0,
    dailyCredits: 5,
    monthlyPool: 0,
    maxMonthly: 30,
    rolloverCap: 0,
    welcomeGrant: 20,
    opusCostCredits: 5,
    tagline: 'Try Dopl for free',
  },
  starter: {
    name: 'Starter',
    slug: 'starter' as const,
    price: 10,
    dailyCredits: 5,
    monthlyPool: 100,
    maxMonthly: 250,
    rolloverCap: 200,
    welcomeGrant: 20,
    opusCostCredits: 5,
    tagline: 'For personal use',
  },
  pro: {
    name: 'Pro',
    slug: 'pro' as const,
    price: 25,
    dailyCredits: 10,
    monthlyPool: 400,
    maxMonthly: 700,
    rolloverCap: 800,
    welcomeGrant: 0,
    opusCostCredits: 5,
    tagline: 'For power users',
    popular: true,
  },
  power: {
    name: 'Power',
    slug: 'power' as const,
    price: 50,
    dailyCredits: 25,
    monthlyPool: 1200,
    maxMonthly: 1950,
    rolloverCap: 2400,
    welcomeGrant: 0,
    opusCostCredits: 5,
    tagline: 'For heavy workflows',
  },
} as const;

export type PlanSlug = keyof typeof PLANS;

export const ALL_FEATURES = [
  'AI chat & full memory',
  'Companion app',
  'All integrations',
  'Workflows & agents',
  'Browser relay',
  'Opus model access',
] as const;

export const TOKENS_PER_CREDIT = 10_000;

export function getPlanBySlug(slug: string) {
  return PLANS[slug as PlanSlug] || PLANS.free;
}

export function tokensToCredits(tokens: number): number {
  return tokens / TOKENS_PER_CREDIT;
}

export function creditsToTokens(credits: number): number {
  return credits * TOKENS_PER_CREDIT;
}

/** For backward compat with enforcement — returns monthly token limit */
export function getTokenLimit(planSlug: string): { monthly: number } {
  const plan = getPlanBySlug(planSlug);
  return { monthly: plan.maxMonthly * TOKENS_PER_CREDIT };
}
