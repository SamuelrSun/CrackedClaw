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
    name: 'Trial',
    slug: 'free' as const,
    price: 0,
    trialGrant: 0,          // no more one-time grant
    monthlyCredits: 50,     // 50 credits/month recurring
    weeklyLimit: 12.5,      // 12.5/week
    dailyCap: 5.5,          // 5.5/day
    opusCostCredits: 5,
    tagline: 'Try Dopl free',
    multiplierLabel: null as string | null,
  },
  starter: {
    name: 'Starter',
    slug: 'starter' as const,
    price: 10,
    trialGrant: 0,
    monthlyCredits: 100,    // 2× trial
    weeklyLimit: 25,
    dailyCap: 12,
    opusCostCredits: 5,
    tagline: 'For personal use',
    multiplierLabel: '2×' as string | null,
  },
  pro: {
    name: 'Pro',
    slug: 'pro' as const,
    price: 25,
    trialGrant: 0,
    monthlyCredits: 400,    // 8× trial
    weeklyLimit: 100,
    dailyCap: 36,
    opusCostCredits: 5,
    tagline: 'For power users',
    multiplierLabel: '8×' as string | null,
    popular: true,
  },
  power: {
    name: 'Power',
    slug: 'power' as const,
    price: 50,
    trialGrant: 0,
    monthlyCredits: 1000,   // 20× trial
    weeklyLimit: 250,
    dailyCap: 90,
    opusCostCredits: 5,
    tagline: 'For heavy workflows',
    multiplierLabel: '20×' as string | null,
  },
  ultra: {
    name: 'Ultra',
    slug: 'ultra' as const,
    price: 100,
    trialGrant: 0,
    monthlyCredits: 2000,   // 40× trial
    weeklyLimit: 500,
    dailyCap: 150,
    opusCostCredits: 5,
    tagline: 'For teams & heavy automation',
    multiplierLabel: '40×' as string | null,
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
