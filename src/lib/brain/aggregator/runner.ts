/**
 * Aggregation Runner — orchestrates pattern aggregation + criteria synthesis.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { aggregatePatterns } from './pattern-aggregator';
import { synthesizePatterns } from './criteria-synthesizer';

const MIN_UNPROCESSED_SIGNALS = 20;

export interface AggregationResult {
  patternsFound: number;
  criteriaSynthesized: number;
}

/**
 * Run the full brain aggregation pipeline for a user.
 *
 * 1. Check if enough unprocessed signals exist (>= 20)
 * 2. Aggregate signals into patterns
 * 3. Synthesize high-confidence patterns into criteria
 */
export async function runBrainAggregation(userId: string): Promise<AggregationResult> {
  const supabase = createAdminClient();

  // 1. Count unprocessed signals
  const { count, error } = await supabase
    .from('brain_signals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('processed_at', null);

  if (error) {
    console.error('[brain/runner] count failed:', error.message);
    return { patternsFound: 0, criteriaSynthesized: 0 };
  }

  if ((count ?? 0) < MIN_UNPROCESSED_SIGNALS) {
    return { patternsFound: 0, criteriaSynthesized: 0 };
  }

  // 2. Aggregate patterns
  const patterns = await aggregatePatterns(userId);

  // 3. Synthesize eligible patterns (confidence >= 0.6)
  const eligiblePatterns = patterns.filter((p) => p.confidence >= 0.6);
  let criteriaSynthesized = 0;

  if (eligiblePatterns.length > 0) {
    const criteria = await synthesizePatterns(userId, eligiblePatterns);
    criteriaSynthesized = criteria.length;
  }

  return {
    patternsFound: patterns.length,
    criteriaSynthesized,
  };
}
