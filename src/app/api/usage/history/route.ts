/**
 * GET /api/usage/history?period=day|week|month
 *
 * Returns usage data bucketed by time period for histogram display.
 * - day:   24 hourly buckets (last 24h)
 * - week:  7 daily buckets (last 7 days)
 * - month: 30 daily buckets (last 30 days)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

type Period = 'day' | 'week' | 'month';

interface Bucket {
  label: string;
  timestamp: string; // ISO string — client formats in local timezone
  cost: number;
  count: number;
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const period = (request.nextUrl.searchParams.get('period') || 'day') as Period;
  if (!['day', 'week', 'month'].includes(period)) {
    return NextResponse.json({ error: 'period must be day, week, or month' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const now = new Date();
    let since: Date;
    let bucketCount: number;

    switch (period) {
      case 'day':
        since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        bucketCount = 24;
        break;
      case 'week':
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        bucketCount = 7;
        break;
      case 'month':
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        bucketCount = 30;
        break;
    }

    // Fetch all ledger entries in the time range (limit 10k to avoid runaway queries)
    const { data: entries } = await supabase
      .from('usage_ledger')
      .select('cost_usd, source, created_at')
      .eq('user_id', user!.id)
      .eq('charged', true)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(10000);

    // Build empty buckets
    const buckets: Bucket[] = [];

    // Build buckets with ISO timestamps — client formats labels in local timezone
    const msPerBucket = period === 'day' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    for (let i = 0; i < bucketCount; i++) {
      const bucketTime = new Date(since.getTime() + i * msPerBucket);
      buckets.push({
        label: '', // Client will generate from timestamp
        timestamp: bucketTime.toISOString(),
        cost: 0,
        count: 0,
      });
    }

    // Distribute entries into buckets
    if (entries) {
      for (const entry of entries) {
        const entryTime = new Date(entry.created_at).getTime();
        const elapsed = entryTime - since.getTime();

        let bucketIndex = Math.floor(elapsed / msPerBucket);

        // Clamp to valid range
        bucketIndex = Math.max(0, Math.min(bucketIndex, bucketCount - 1));
        buckets[bucketIndex].cost += Number(entry.cost_usd);
        buckets[bucketIndex].count += 1;
      }
    }

    // Round costs
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
