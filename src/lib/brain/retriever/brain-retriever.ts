/**
 * Brain Retriever — semantic similarity-based retrieval of brain criteria.
 *
 * Uses embeddings (not domain classification) to find relevant criteria
 * for the current conversation. Always includes personality criteria.
 *
 * Target latency: <300ms (embedding ~50-100ms + DB queries).
 */

import { createClient } from '@supabase/supabase-js';
import { getEmbedding } from '@/lib/memory/embeddings';
import { loadBrainCriteriaByType } from '../brain-store';
import type { BrainCriterion } from '../types';
import { buildCacheKey, getCached, setCache } from './cache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Check if brain is enabled for a user.
 */
async function isBrainEnabled(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('instance_settings')
      .eq('id', userId)
      .single();
    const settings = (data?.instance_settings as Record<string, unknown>) || {};
    return (settings.brain_enabled as boolean) ?? false;
  } catch {
    return false;
  }
}

/**
 * Retrieve brain criteria relevant to the current conversation.
 *
 * 1. Checks brain_enabled — returns [] if disabled.
 * 2. Always loads personality criteria (apply universally).
 * 3. Semantically searches for topic-relevant criteria using embeddings.
 * 4. Merges, deduplicates, filters weak criteria, sorts, and limits.
 */
export async function retrieveBrainContext(
  userId: string,
  recentMessages: Array<{ role: string; content: string }>,
  options?: { maxCriteria?: number; includePersonality?: boolean }
): Promise<BrainCriterion[]> {
  const maxCriteria = options?.maxCriteria ?? 10;
  const includePersonality = options?.includePersonality ?? true;

  // 1. Check brain_enabled
  const enabled = await isBrainEnabled(userId);
  if (!enabled) return [];

  // Extract last 3-4 user messages for topic signal
  const userMessages = recentMessages
    .filter(m => m.role === 'user')
    .slice(-4)
    .map(m => typeof m.content === 'string' ? m.content : '');

  if (userMessages.length === 0) return [];

  // Check cache
  const cacheKey = buildCacheKey(userId, userMessages);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 2. Always include personality criteria (fire both queries in parallel)
  const queryText = userMessages.join(' ').substring(0, 500);

  const [personalityCriteria, semanticCriteria] = await Promise.all([
    includePersonality
      ? loadBrainCriteriaByType(userId, ['personality'])
      : Promise.resolve([]),
    searchCriteriaBySimilarity(userId, queryText, maxCriteria + 5),
  ]);

  // 4. Merge and deduplicate by criterion ID
  const seen = new Set<string>();
  const merged: Array<BrainCriterion & { _similarity?: number; _isPersonality?: boolean }> = [];

  // Personality first
  for (const c of personalityCriteria) {
    const key = c.id;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({ ...c, _isPersonality: true });
    }
  }

  // Then semantic matches
  for (const c of semanticCriteria) {
    const key = c.id;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }

  // 7. Filter out weak criteria (weight between -0.15 and 0.15)
  const filtered = merged.filter(c => Math.abs(c.weight) >= 0.15);

  // 5. Sort: personality first, then by similarity/importance descending
  filtered.sort((a, b) => {
    if (a._isPersonality && !b._isPersonality) return -1;
    if (!a._isPersonality && b._isPersonality) return 1;
    // Then by absolute weight (stronger preferences first)
    return Math.abs(b.weight) - Math.abs(a.weight);
  });

  // 6. Limit
  const result = filtered.slice(0, maxCriteria) as BrainCriterion[];

  // Clean up internal fields
  for (const c of result) {
    delete (c as Record<string, unknown>)._similarity;
    delete (c as Record<string, unknown>)._isPersonality;
  }

  // Cache the result
  setCache(cacheKey, result);

  return result;
}

/**
 * Search for brain criteria using semantic similarity.
 *
 * Uses the match_memories RPC to find similar memories,
 * then filters for memory_type='criterion' entries.
 */
async function searchCriteriaBySimilarity(
  userId: string,
  queryText: string,
  limit: number
): Promise<BrainCriterion[]> {
  try {
    // Get embedding for the query
    const embedding = await getEmbedding(queryText);

    // Use match_memories RPC with generous limit (we'll filter down)
    const { data, error } = await supabase.rpc('match_memories', {
      query_embedding: embedding,
      match_user_id: userId,
      match_domain: null,
      match_limit: limit * 3, // Over-fetch since we'll filter to criteria only
      match_threshold: 0.3,
    });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Get the IDs from semantic results
    const resultIds = (data as Array<{ id: string; similarity: number }>).map(r => r.id);
    const similarityMap = new Map(
      (data as Array<{ id: string; similarity: number }>).map(r => [r.id, r.similarity])
    );

    // Query for which of these are active criteria
    const { data: criteriaRows, error: criteriaError } = await supabase
      .from('memories')
      .select('id, content, context_scope, valid_from, valid_until, correction_count, importance, preference_type, weight, created_at, updated_at')
      .in('id', resultIds)
      .eq('memory_type', 'criterion')
      .is('valid_until', null);

    if (criteriaError) throw criteriaError;
    if (!criteriaRows || criteriaRows.length === 0) return [];

    // Parse and build BrainCriterion objects
    const criteria: BrainCriterion[] = [];

    for (const row of criteriaRows) {
      try {
        const parsed = JSON.parse(row.content) as BrainCriterion;
        const similarity = similarityMap.get(row.id) ?? 0;

        criteria.push({
          ...parsed,
          id: parsed.id || row.id,
          weight: row.weight ?? parsed.weight ?? 0,
          correction_count: row.correction_count ?? parsed.correction_count ?? 0,
          preference_type: row.preference_type ?? parsed.preference_type ?? 'general',
          valid_from: row.valid_from ?? parsed.valid_from,
          valid_until: row.valid_until ?? parsed.valid_until ?? undefined,
          created_at: row.created_at ?? parsed.created_at,
          updated_at: row.updated_at ?? parsed.updated_at,
          // Stash similarity for sorting (will be cleaned up by caller)
          ...({ _similarity: similarity } as Record<string, unknown>),
        } as BrainCriterion);
      } catch {
        // Skip malformed entries
      }
    }

    // Sort by similarity descending
    criteria.sort((a, b) => {
      const simA = (a as Record<string, unknown>)._similarity as number ?? 0;
      const simB = (b as Record<string, unknown>)._similarity as number ?? 0;
      return simB - simA;
    });

    return criteria.slice(0, limit);
  } catch (err) {
    console.error('[brain] searchCriteriaBySimilarity failed:', err);
    return [];
  }
}
