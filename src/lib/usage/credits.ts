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

/** Human-readable reset label for a given ISO timestamp */
function buildNextResetLabel(resetsAt: string, type: 'daily' | 'weekly'): string {
  if (type === 'daily') {
    const now = new Date();
    const reset = new Date(resetsAt);
    const diffMs = reset.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Resets in less than an hour';
    if (diffHours < 24) return `Resets in ${diffHours}h`;
    return 'Resets tomorrow at midnight UTC';
  } else {
    return 'Resets Monday at midnight UTC';
  }
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

  // ALL plans (including trial/free) use daily + weekly tracking
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

  const weekTokens = (weekRows || []).reduce((sum: number, row: { tokens_used?: number }) => sum + (row.tokens_used || 0), 0);
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

  const nextDailyReset = getNextMidnightUTC();
  const nextWeeklyReset = getNextWeekStartUTC();

  let reason: string | undefined;
  let nextResetLabel: string | undefined;
  if (dailyHit) {
    reason = 'Daily usage limit reached. Come back tomorrow or upgrade your plan.';
    nextResetLabel = buildNextResetLabel(nextDailyReset, 'daily');
  } else if (weeklyHit) {
    reason = 'Weekly usage limit reached. Resets Monday or upgrade your plan.';
    nextResetLabel = buildNextResetLabel(nextWeeklyReset, 'weekly');
  }

  return {
    plan: planSlug,
    planName: plan.name,
    isTrial,
    daily: {
      usedPercent: Math.round(dailyUsedPercent * 10) / 10,
      remaining: Math.round(dailyRemaining * 10) / 10,
      limit: dailyCap,
      resetsAt: nextDailyReset,
    },
    weekly: {
      usedPercent: Math.round(weeklyUsedPercent * 10) / 10,
      remaining: Math.round(weeklyRemaining * 10) / 10,
      limit: weeklyLimit,
      resetsAt: nextWeeklyReset,
    },
    allowed,
    upgradeNeeded: !allowed,
    reason,
    nextResetLabel,
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
