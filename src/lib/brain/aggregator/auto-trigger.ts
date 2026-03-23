/**
 * Auto-trigger hook — checks if enough unprocessed signals have accumulated
 * and fires off aggregation if so.
 *
 * Fire-and-forget: never throws, never blocks.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { runBrainAggregation } from './runner';

const AUTO_TRIGGER_THRESHOLD = 20;
const INITIAL_LEARNING_THRESHOLD = 10;

/**
 * Check unprocessed signal count and trigger aggregation if >= threshold.
 * Uses a lower threshold for brand-new brains (no existing criteria).
 * Designed to be called fire-and-forget after signal collection.
 */
export async function checkAndTriggerAggregation(userId: string): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { count: signalCount, error } = await supabase
      .from('brain_signals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('processed_at', null);

    if (error || (signalCount ?? 0) === 0) return;

    // Check if user has any existing criteria (for initial learning mode)
    const { count: criteriaCount } = await supabase
      .from('memories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('memory_type', 'criterion')
      .is('valid_until', null);

    const threshold = (criteriaCount ?? 0) === 0
      ? INITIAL_LEARNING_THRESHOLD
      : AUTO_TRIGGER_THRESHOLD;

    if ((signalCount ?? 0) < threshold) return;

    // Fire-and-forget aggregation
    void runBrainAggregation(userId).catch((err) => {
      console.error('[brain/auto-trigger] aggregation failed:', err);
    });
  } catch {
    // Never throw — this is fire-and-forget
  }
}
