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

function getWeekStartUTC(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function getNextWeekStartUTC(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getCreditStatus(userId: string): Promise<CreditStatus> {
  const supabase = createAdminClient();

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, current_period_end')
    .eq('id', userId)
    .single();

  const planSlug = profile?.plan || 'free';
  const plan = getPlanBySlug(planSlug);
  const isTrial = planSlug === 'free';

  const today = getTodayUTC();
  const weekStart = getWeekStartUTC();

  // For trial users: sum ALL-TIME usage to check against 10-credit grant
  // For paid users: sum daily and weekly usage
  if (isTrial) {
    // Get total all-time usage for trial users
    const { data: allTimeRows } = await supabase
      .from('user_usage')
      .select('tokens_used')
      .eq('user_id', userId);
    
    const totalTokens = (allTimeRows || []).reduce((sum, row) => sum + (row.tokens_used || 0), 0);
    const totalCreditsUsed = tokensToCredits(totalTokens);
    const trialTotal = plan.trialGrant; // 10
    const trialRemaining = Math.max(0, trialTotal - totalCreditsUsed);
    const trialUsedPercent = trialTotal > 0 ? Math.min(100, (totalCreditsUsed / trialTotal) * 100) : 0;
    const trialExhausted = trialRemaining <= 0;

    return {
      plan: planSlug,
      isTrial: true,
      daily: {
        usedPercent: 0,
        remaining: 0,
        limit: 0,
        resetsAt: getNextMidnightUTC(),
      },
      weekly: {
        usedPercent: 0,
        remaining: 0,
        limit: 0,
        resetsAt: getNextWeekStartUTC(),
      },
      trial: {
        total: trialTotal,
        remaining: Math.round(trialRemaining * 10) / 10,
        usedPercent: Math.round(trialUsedPercent * 10) / 10,
        exhausted: trialExhausted,
      },
      allowed: !trialExhausted,
      upgradeNeeded: trialExhausted,
      reason: trialExhausted ? 'Trial credits exhausted. Upgrade to continue using Dopl.' : undefined,
    };
  }

  // Paid users: calculate daily and weekly usage
  // Get today's token usage
  const { data: todayRow } = await supabase
    .from('user_usage')
    .select('tokens_used')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  const todayTokens = todayRow?.tokens_used || 0;
  const todayCredits = tokensToCredits(todayTokens);

  // Get this week's token usage (Monday-Sunday)
  const { data: weekRows } = await supabase
    .from('user_usage')
    .select('tokens_used')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .lte('date', today);

  const weekTokens = (weekRows || []).reduce((sum, row) => sum + (row.tokens_used || 0), 0);
  const weekCredits = tokensToCredits(weekTokens);

  // Calculate remaining and percentages
  const dailyCap = plan.dailyCap;
  const weeklyLimit = plan.weeklyLimit;

  const dailyRemaining = dailyCap > 0 ? Math.max(0, dailyCap - todayCredits) : 0;
  const weeklyRemaining = weeklyLimit > 0 ? Math.max(0, weeklyLimit - weekCredits) : 0;

  const dailyUsedPercent = dailyCap > 0 ? Math.min(100, (todayCredits / dailyCap) * 100) : 0;
  const weeklyUsedPercent = weeklyLimit > 0 ? Math.min(100, (weekCredits / weeklyLimit) * 100) : 0;

  // Check if allowed
  const dailyHit = dailyCap > 0 && todayCredits >= dailyCap;
  const weeklyHit = weeklyLimit > 0 && weekCredits >= weeklyLimit;
  const allowed = !dailyHit && !weeklyHit;

  let reason: string | undefined;
  if (dailyHit) {
    reason = 'Daily usage limit reached. Come back tomorrow or upgrade your plan.';
  } else if (weeklyHit) {
    reason = 'Weekly usage limit reached. Resets Monday or upgrade your plan.';
  }

  return {
    plan: planSlug,
    isTrial: false,
    daily: {
      usedPercent: Math.round(dailyUsedPercent * 10) / 10,
      remaining: Math.round(dailyRemaining * 10) / 10,
      limit: dailyCap,
      resetsAt: getNextMidnightUTC(),
    },
    weekly: {
      usedPercent: Math.round(weeklyUsedPercent * 10) / 10,
      remaining: Math.round(weeklyRemaining * 10) / 10,
      limit: weeklyLimit,
      resetsAt: getNextWeekStartUTC(),
    },
    trial: {
      total: 0,
      remaining: 0,
      usedPercent: 0,
      exhausted: true,
    },
    allowed,
    upgradeNeeded: !allowed,
    reason,
  };
}

export async function checkCreditLimit(userId: string): Promise<{ allowed: boolean; reason?: string; status: CreditStatus }> {
  const status = await getCreditStatus(userId);
  return {
    allowed: status.allowed,
    reason: status.reason,
    status,
  };
}
