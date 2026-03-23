/**
 * Auto-trigger hook — checks if enough unprocessed signals have accumulated
 * and fires off aggregation if so.
 *
 * Fire-and-forget: never throws, never blocks.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { runBrainAggregation } from './runner';

const AUTO_TRIGGER_THRESHOLD = 50;

/**
 * Check unprocessed signal count and trigger aggregation if >= threshold.
 * Designed to be called fire-and-forget after signal collection.
 */
export async function checkAndTriggerAggregation(userId: string): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { count, error } = await supabase
      .from('brain_signals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('processed_at', null);

    if (error || (count ?? 0) < AUTO_TRIGGER_THRESHOLD) return;

    // Fire-and-forget aggregation
    void runBrainAggregation(userId).catch((err) => {
      console.error('[brain/auto-trigger] aggregation failed:', err);
    });
  } catch {
    // Never throw — this is fire-and-forget
  }
}
