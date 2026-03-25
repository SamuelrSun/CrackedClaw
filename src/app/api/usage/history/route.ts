/**
 * GET /api/usage/history?period=day|week|month&tz=America/Los_Angeles
 *
 * Returns usage data bucketed by time period for histogram display.
 * - day:   24 hourly buckets (last 24h)
 * - week:  7 daily buckets (last 7 days)
 * - month: 30 daily buckets (last 30 days)
 *
 * Labels are generated using the client's timezone (via `tz` param).
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

type Period = 'day' | 'week' | 'month';

interface Bucket {
  label: string;
  cost: number;
  count: number;
}

const VALID_PERIODS: Period[] = ['day', 'week', 'month'];
const MAX_ROWS = 5000;

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const periodParam = request.nextUrl.searchParams.get('period') || 'day';
  if (!VALID_PERIODS.includes(periodParam as Period)) {
    return NextResponse.json({ error: 'period must be day, week, or month' }, { status: 400 });
  }
  const period = periodParam as Period;
  const tz = request.nextUrl.searchParams.get('tz') || 'UTC';

  try {
    const supabase = createAdminClient();
    const now = new Date();

    // Compute time range
    const msPerHour = 60 * 60 * 1000;
    const msPerDay = 24 * msPerHour;
    let since: Date;
    let bucketCount: number;
    let bucketMs: number;

    if (period === 'day') {
      since = new Date(now.getTime() - 24 * msPerHour);
      bucketCount = 24;
      bucketMs = msPerHour;
    } else if (period === 'week') {
      since = new Date(now.getTime() - 7 * msPerDay);
      bucketCount = 7;
      bucketMs = msPerDay;
    } else {
      since = new Date(now.getTime() - 30 * msPerDay);
      bucketCount = 30;
      bucketMs = msPerDay;
    }

    // Fetch ledger entries (capped)
    const { data: entries } = await supabase
      .from('usage_ledger')
      .select('cost_usd, created_at')
      .eq('user_id', user!.id)
      .eq('charged', true)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(MAX_ROWS);

    // Build bucket labels using the user's timezone
    const buckets: Bucket[] = [];
    const formatter = createLabelFormatter(period, tz);

    for (let i = 0; i < bucketCount; i++) {
      const bucketTime = new Date(since.getTime() + i * bucketMs);
      buckets.push({ label: formatter(bucketTime), cost: 0, count: 0 });
    }

    // Distribute entries into buckets
    if (entries) {
      for (const entry of entries) {
        const elapsed = new Date(entry.created_at).getTime() - since.getTime();
        const bucketIndex = Math.max(0, Math.min(
          Math.floor(elapsed / bucketMs),
          bucketCount - 1,
        ));
        buckets[bucketIndex].cost += Number(entry.cost_usd);
        buckets[bucketIndex].count += 1;
      }
    }

    // Round costs to avoid floating point noise
    for (const b of buckets) {
      b.cost = Math.round(b.cost * 10000) / 10000;
    }

    const total = buckets.reduce((sum, b) => sum + b.cost, 0);
    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);

    return NextResponse.json({
      period,
      buckets,
      total: Math.round(total * 100) / 100,
      totalCount,
    });
  } catch (err) {
    console.error('[api/usage/history] error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage history' }, { status: 500 });
  }
}

/**
 * Create a label formatter for the given period and timezone.
 * Uses Intl.DateTimeFormat to respect the user's timezone.
 */
function createLabelFormatter(period: Period, tz: string): (date: Date) => string {
  // Validate timezone — fall back to UTC if invalid
  let validTz = 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    validTz = tz;
  } catch {
    // Invalid timezone string — use UTC
  }

  if (period === 'day') {
    const fmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      timeZone: validTz,
    });
    return (date: Date) => fmt.format(date); // "9 AM", "10 PM", etc.
  }

  if (period === 'week') {
    const fmt = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: validTz,
    });
    return (date: Date) => fmt.format(date); // "Mon", "Tue", etc.
  }

  // month
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    timeZone: validTz,
  });
  return (date: Date) => fmt.format(date); // "3/25", "3/26", etc.
}
