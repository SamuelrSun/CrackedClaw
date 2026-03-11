import { createAdminClient } from '@/lib/supabase/admin';
import { getTokenLimit } from '@/lib/stripe';

export interface TokenLimitResult {
  allowed: boolean;
  reason?: string;
  usage: {
    weekly: number;
    monthly: number;
    weeklyLimit: number;
    monthlyLimit: number;
  };
}

/**
 * Returns the Monday of the week containing the given date (UTC).
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

/**
 * Returns the first day of the current month (UTC).
 */
function getMonthStart(date: Date): string {
  const d = new Date(date);
  d.setUTCDate(1);
  return d.toISOString().split('T')[0];
}

/**
 * Check whether a user is within their plan's token limits.
 * Returns allowed=false and a reason if they've exceeded weekly or monthly limits.
 */
export async function checkTokenLimit(userId: string): Promise<TokenLimitResult> {
  try {
    const supabase = createAdminClient();

    // Get the user's organization plan
    const { data: org } = await supabase
      .from('organizations')
      .select('plan')
      .eq('owner_id', userId)
      .single();

    const planSlug = org?.plan || 'free';
    const { monthly: monthlyLimit, weekly: weeklyLimit } = getTokenLimit(planSlug);

    const now = new Date();
    const weekStart = getWeekStart(now);
    const monthStart = getMonthStart(now);
    const today = now.toISOString().split('T')[0];

    // Query weekly usage (Monday to today)
    const { data: weeklyRows } = await supabase
      .from('user_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('date', weekStart)
      .lte('date', today);

    const weeklyUsed = (weeklyRows || []).reduce((sum, row) => sum + (row.tokens_used || 0), 0);

    // Query monthly usage
    const { data: monthlyRows } = await supabase
      .from('user_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', today);

    const monthlyUsed = (monthlyRows || []).reduce((sum, row) => sum + (row.tokens_used || 0), 0);

    const usage = {
      weekly: weeklyUsed,
      monthly: monthlyUsed,
      weeklyLimit,
      monthlyLimit,
    };

    if (weeklyUsed >= weeklyLimit) {
      return { allowed: false, reason: 'Weekly token limit reached', usage };
    }

    if (monthlyUsed >= monthlyLimit) {
      return { allowed: false, reason: 'Monthly token limit reached', usage };
    }

    return { allowed: true, usage };
  } catch (err) {
    // On error, allow the request (fail open — don't block users due to tracking bugs)
    console.error('Token limit check failed:', err);
    return {
      allowed: true,
      usage: { weekly: 0, monthly: 0, weeklyLimit: 10_000, monthlyLimit: 40_000 },
    };
  }
}
