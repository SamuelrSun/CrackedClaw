import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanBySlug, tokensToCredits } from '@/lib/plans';
import type { CreditStatus } from './types';

export type { CreditStatus } from './types';

function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function getNextMidnightUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function getMonthStart(): string {
  const d = new Date();
  d.setUTCDate(1);
  return d.toISOString().split('T')[0];
}

function getNextMonthStart(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return d.toISOString().split('T')[0];
}

export async function getCreditStatus(userId: string): Promise<CreditStatus> {
  const supabase = createAdminClient();

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, welcome_grant_used, monthly_pool_credits, pool_last_reset, current_period_end')
    .eq('id', userId)
    .single();

  const planSlug = profile?.plan || 'free';
  const plan = getPlanBySlug(planSlug);

  // Get today's token usage
  const today = getTodayUTC();
  const { data: todayRow } = await supabase
    .from('user_usage')
    .select('tokens_used')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  const todayTokens = todayRow?.tokens_used || 0;
  const todayCredits = tokensToCredits(todayTokens);

  // Daily credits used (capped at daily limit)
  const dailyUsed = Math.min(todayCredits, plan.dailyCredits);
  const dailyRemaining = Math.max(0, plan.dailyCredits - todayCredits);

  // Monthly pool balance (stored in profiles)
  const poolBalance = profile?.monthly_pool_credits ?? plan.monthlyPool;

  // If today's usage exceeds daily credits, the overflow came from monthly pool
  const monthlyOverflow = Math.max(0, todayCredits - plan.dailyCredits);

  // Welcome grant
  const welcomeGrantUsed = profile?.welcome_grant_used ?? false;
  const welcomeRemaining = welcomeGrantUsed ? 0 : plan.welcomeGrant;

  // Total available today = daily remaining + monthly pool + welcome grant remaining
  const totalAvailableToday = dailyRemaining + Math.max(0, poolBalance - monthlyOverflow) + welcomeRemaining;

  // Total used this month
  const monthStart = getMonthStart();
  const { data: monthlyRows } = await supabase
    .from('user_usage')
    .select('tokens_used')
    .eq('user_id', userId)
    .gte('date', monthStart)
    .lte('date', today);
  const monthlyTokens = (monthlyRows || []).reduce((sum, row) => sum + (row.tokens_used || 0), 0);

  return {
    plan: planSlug,
    daily: {
      used: Math.round(dailyUsed * 10) / 10,
      limit: plan.dailyCredits,
      remaining: Math.round(Math.max(0, dailyRemaining) * 10) / 10,
      resetsAt: getNextMidnightUTC(),
    },
    monthly: {
      poolBalance: Math.round(Math.max(0, poolBalance) * 10) / 10,
      poolLimit: plan.monthlyPool,
      resetsAt: profile?.current_period_end?.split('T')[0] || getNextMonthStart(),
    },
    welcomeGrant: {
      total: plan.welcomeGrant,
      used: welcomeGrantUsed,
      remaining: welcomeRemaining,
    },
    totalAvailableToday: Math.round(Math.max(0, totalAvailableToday) * 10) / 10,
    totalUsedThisMonth: Math.round(tokensToCredits(monthlyTokens) * 10) / 10,
  };
}

export async function checkCreditLimit(userId: string): Promise<{ allowed: boolean; reason?: string; status: CreditStatus }> {
  const status = await getCreditStatus(userId);

  if (status.totalAvailableToday <= 0) {
    const reason = status.daily.remaining <= 0 && status.monthly.poolBalance <= 0
      ? 'You\'ve used all your credits for today. Come back tomorrow or upgrade your plan.'
      : 'Monthly credit limit reached. Upgrade your plan for more credits.';
    return { allowed: false, reason, status };
  }

  return { allowed: true, status };
}
