/**
 * Aggregation Runner — orchestrates pattern aggregation + criteria synthesis.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { aggregatePatterns } from './pattern-aggregator';
import { synthesizePatterns } from './criteria-synthesizer';
import { pruneOldSignals } from '../signals/signal-buffer';

// Adaptive thresholds based on whether user already has criteria.
// Lower thresholds let first-time users see results faster.
const THRESHOLD_NEW_BRAIN = 8;   // no existing criteria yet
const THRESHOLD_HAS_CRITERIA = 15; // already has some learned criteria

export interface AggregationResult {
  patternsFound: number;
  criteriaSynthesized: number;
}

/**
 * Run the full brain aggregation pipeline for a user.
 *
 * 1. Check if user has existing criteria to pick the right threshold
 * 2. Check if enough unprocessed signals exist
 * 3. Aggregate signals into patterns
 * 4. Synthesize high-confidence patterns into criteria
 * 5. Prune old processed signals
 */
export async function runBrainAggregation(userId: string): Promise<AggregationResult> {
  const supabase = createAdminClient();

  // 1. Check if user has any existing criteria
  const { count: criteriaCount, error: criteriaError } = await supabase
    .from('memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('memory_type', 'criterion')
    .is('valid_until', null);

  if (criteriaError) {
    console.error('[brain/runner] criteria count failed:', criteriaError.message);
    // Fall through with a safe default
  }

  const isNewBrain = (criteriaCount ?? 0) === 0;
  const minSignals = isNewBrain ? THRESHOLD_NEW_BRAIN : THRESHOLD_HAS_CRITERIA;

  // 2. Count unprocessed signals
  const { count, error } = await supabase
    .from('brain_signals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('processed_at', null);

  if (error) {
    console.error('[brain/runner] count failed:', error.message);
    return { patternsFound: 0, criteriaSynthesized: 0 };
  }

  if ((count ?? 0) < minSignals) {
    return { patternsFound: 0, criteriaSynthesized: 0 };
  }

  // 3. Aggregate patterns (creates new / merges into existing)
  const patterns = await aggregatePatterns(userId);

  // 4. Synthesize ALL eligible pending patterns from the DB (not just freshly returned ones).
  //    Previous bug: only freshly-created patterns were passed to the synthesizer,
  //    but patterns accumulate confidence over multiple aggregation runs. By the time
  //    they reach >= 0.6 confidence, they're no longer in the return value.
  const { data: pendingPatterns } = await supabase
    .from('brain_patterns')
    .select('domain, subdomain, context, pattern_type, description, evidence, occurrence_count, confidence')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('confidence', 0.6)
    .order('confidence', { ascending: false })
    .limit(20);

  const eligiblePatterns = (pendingPatterns || []).map((p) => ({
    domain: p.domain,
    subdomain: p.subdomain || undefined,
    context: p.context || undefined,
    pattern_type: p.pattern_type,
    description: p.description,
    evidence: (p.evidence as Array<{ signal_type: string; summary: string; created_at: string }>) || [],
    occurrence_count: p.occurrence_count,
    confidence: p.confidence,
  }));

  let criteriaSynthesized = 0;

  if (eligiblePatterns.length > 0) {
    const criteria = await synthesizePatterns(userId, eligiblePatterns);
    criteriaSynthesized = criteria.length;
  }

  // 5. Prune old processed signals (fire-and-forget)
  void pruneOldSignals(userId).catch(() => {});

  return {
    patternsFound: patterns.length,
    criteriaSynthesized,
  };
}
