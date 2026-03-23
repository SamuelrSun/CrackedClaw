/**
 * Cron endpoint for brain aggregation.
 *
 * Called by Vercel cron or external scheduler (every 6 hours).
 * Finds users with 10+ unprocessed brain signals and runs aggregation for each.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runBrainAggregation } from '@/lib/brain/aggregator/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  // Verify cron secret if configured (Vercel cron sends this header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Find users with 10+ unprocessed brain signals
    const { data: userRows, error } = await supabase
      .from('brain_signals')
      .select('user_id')
      .is('processed_at', null)
      .limit(1000);

    if (error) {
      console.error('[brain/cron] Failed to query signals:', error.message);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ processed: 0, users: [], message: 'No unprocessed signals' });
    }

    // Count signals per user
    const userCounts = new Map<string, number>();
    for (const row of userRows) {
      const uid = row.user_id as string;
      userCounts.set(uid, (userCounts.get(uid) || 0) + 1);
    }

    // Filter to users with 10+ signals
    const eligibleUsers = [...userCounts.entries()]
      .filter(([, count]) => count >= 10)
      .map(([userId]) => userId);

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        processed: 0,
        users: [],
        message: `No users with 10+ unprocessed signals (${userCounts.size} users checked)`,
      });
    }

    // Run aggregation for each eligible user
    const results: Array<{ userId: string; patternsFound: number; criteriaSynthesized: number }> = [];

    for (const userId of eligibleUsers) {
      try {
        const result = await runBrainAggregation(userId);
        results.push({
          userId,
          patternsFound: result.patternsFound,
          criteriaSynthesized: result.criteriaSynthesized,
        });
      } catch (err) {
        console.error(`[brain/cron] Aggregation failed for user ${userId}:`, err);
        results.push({ userId, patternsFound: -1, criteriaSynthesized: -1 });
      }
    }

    return NextResponse.json({
      processed: results.length,
      users: results,
      message: `Processed ${results.length} user(s)`,
    });
  } catch (err) {
    console.error('[brain/cron] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
