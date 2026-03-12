import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTokenLimit } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

function getMonthStart(date: Date): string {
  const d = new Date(date);
  d.setUTCDate(1);
  return d.toISOString().split('T')[0];
}

function getNextMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d.toISOString().split('T')[0];
}

function getNextMonthStart(date: Date): string {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return d.toISOString().split('T')[0];
}

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = createAdminClient();

    // Get user's plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    const planSlug = profile?.plan || 'free';
    const { monthly: monthlyLimit, weekly: weeklyLimit } = getTokenLimit(planSlug);

    const now = new Date();
    const weekStart = getWeekStart(now);
    const monthStart = getMonthStart(now);
    const today = now.toISOString().split('T')[0];

    // Weekly usage
    const { data: weeklyRows } = await supabase
      .from('user_usage')
      .select('tokens_used')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', today);

    const weeklyUsed = (weeklyRows || []).reduce((sum, row) => sum + (row.tokens_used || 0), 0);

    // Monthly usage
    const { data: monthlyRows } = await supabase
      .from('user_usage')
      .select('tokens_used')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .lte('date', today);

    const monthlyUsed = (monthlyRows || []).reduce((sum, row) => sum + (row.tokens_used || 0), 0);

    const percentWeekly = Math.round((weeklyUsed / weeklyLimit) * 100);
    const percentMonthly = Math.round((monthlyUsed / monthlyLimit) * 100);

    return NextResponse.json({
      plan: planSlug,
      weekly: {
        used: weeklyUsed,
        limit: weeklyLimit,
        resetDate: getNextMonday(now),
      },
      monthly: {
        used: monthlyUsed,
        limit: monthlyLimit,
        resetDate: getNextMonthStart(now),
      },
      percentWeekly,
      percentMonthly,
    });
  } catch (err) {
    console.error('Usage status error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
