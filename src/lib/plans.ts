/**
 * Plan definitions — safe to import from both client and server components.
 * Does NOT import Stripe SDK.
 *
 * NOTE: After adding the 'ultra' plan, run this SQL in Supabase:
 *   ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
 *   ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
 *     CHECK (plan IN ('free', 'starter', 'pro', 'power', 'ultra'));
 */

export const PLANS = {
  free: {
    name: 'Free',
    slug: 'free' as const,
    price: 0,
    trialGrant: 10,        // one-time grant
    monthlyCredits: 0,     // no recurring credits
    weeklyLimit: 0,
    dailyCap: 0,           // no daily cap on trial (burn all at once)
    opusCostCredits: 5,
    tagline: 'Try Dopl free',
    multiplierLabel: null as string | null, // no multiplier shown
  },
  starter: {
    name: 'Starter',
    slug: 'starter' as const,
    price: 10,
    trialGrant: 0,
    monthlyCredits: 100,
    weeklyLimit: 25,
    dailyCap: 12,
    opusCostCredits: 5,
    tagline: 'For personal use',
    multiplierLabel: null as string | null, // base plan, no multiplier
  },
  pro: {
    name: 'Pro',
    slug: 'pro' as const,
    price: 25,
    trialGrant: 0,
    monthlyCredits: 400,
    weeklyLimit: 100,
    dailyCap: 36,
    opusCostCredits: 5,
    tagline: 'For power users',
    multiplierLabel: '4×' as string | null,
    popular: true,
  },
  power: {
    name: 'Power',
    slug: 'power' as const,
    price: 50,
    trialGrant: 0,
    monthlyCredits: 1000,
    weeklyLimit: 250,
    dailyCap: 90,
    opusCostCredits: 5,
    tagline: 'For heavy workflows',
    multiplierLabel: '10×' as string | null,
  },
  ultra: {
    name: 'Ultra',
    slug: 'ultra' as const,
    price: 100,
    trialGrant: 0,
    monthlyCredits: 2000,
    weeklyLimit: 500,
    dailyCap: 150,
    opusCostCredits: 5,
    tagline: 'For teams & heavy automation',
    multiplierLabel: '20×' as string | null,
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
  'Pro-rated upgrades',
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
  return { monthly: plan.monthlyCredits * TOKENS_PER_CREDIT };
}
