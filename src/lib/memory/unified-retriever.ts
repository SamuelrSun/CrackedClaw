/**
 * Unified Memory Retriever — single retrieval pipeline across all memory types.
 *
 * Replaces the dual-pipeline approach (mem0Search/mem0GetCore + retrieveBrainContext)
 * with ONE semantic search across facts and criteria, plus always-include items.
 *
 * Used behind the `unified_memory` feature flag (default: off).
 */

import { createClient } from '@supabase/supabase-js';
import { getEmbedding } from './embeddings';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UnifiedMemoryItem {
  id: string;
  content: string;
  description: string;
  memory_type: 'fact' | 'criterion';
  origin: 'stated' | 'extracted' | 'learned' | 'integrated';
  domain: string;
  weight: number | null;
  preference_type: string | null;
  importance: number;
  relevance_score: number;
}

interface MemoryRow {
  id: string;
  content: string;
  memory_type: string;
  origin: string;
  domain: string;
  weight: number | null;
  preference_type: string | null;
  importance: number;
  metadata: Record<string, unknown> | null;
  similarity?: number;
}

/**
 * Retrieve unified context across all memory types for a user.
 *
 * 1. Embeds recent messages and does a single pgvector search across ALL memory types.
 * 2. Always includes personality criteria and high-importance facts.
 * 3. Merges, deduplicates by cosine similarity > 0.95, sorts, caps at limit.
 */
export async function retrieveUnifiedContext(
  userId: string,
  recentMessages: Array<{ role: string; content: string }>,
  options?: { maxItems?: number }
): Promise<UnifiedMemoryItem[]> {
  const maxItems = options?.maxItems ?? 25;

  // Extract user messages for query text
  const userMessages = recentMessages
    .filter(m => m.role === 'user')
    .slice(-4)
    .map(m => typeof m.content === 'string' ? m.content : '');

  if (userMessages.length === 0) return [];

  const queryText = userMessages.join(' ').substring(0, 500);

  // Run semantic search and always-include queries in parallel
  const [semanticResults, alwaysInclude] = await Promise.all([
    semanticSearchAll(userId, queryText, maxItems * 2),
    loadAlwaysInclude(userId),
  ]);

  // Merge, deduplicate, sort
  return mergeAndScore(semanticResults, alwaysInclude, maxItems);
}

/**
 * Single semantic search across ALL memory types (facts + criteria).
 * Uses the existing match_memories RPC.
 */
async function semanticSearchAll(
  userId: string,
  queryText: string,
  limit: number
): Promise<UnifiedMemoryItem[]> {
  try {
    const embedding = await getEmbedding(queryText);

    const { data, error } = await supabase.rpc('match_memories', {
      query_embedding: embedding,
      match_user_id: userId,
      match_domain: null,
      match_limit: limit,
      match_threshold: 0.3,
    });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Get full rows with brain-specific columns for the matched IDs
    const ids = (data as Array<{ id: string; similarity: number }>).map(r => r.id);
    const similarityMap = new Map(
      (data as Array<{ id: string; similarity: number }>).map(r => [r.id, r.similarity])
    );

    const { data: rows, error: rowsError } = await supabase
      .from('memories')
      .select('id, content, memory_type, origin, domain, weight, preference_type, importance, metadata')
      .in('id', ids)
      .is('valid_until', null);

    if (rowsError) throw rowsError;
    if (!rows || rows.length === 0) return [];

    return (rows as MemoryRow[]).map(row => toUnifiedItem(row, similarityMap.get(row.id) ?? 0));
  } catch (err) {
    console.error('[unified-retriever] semanticSearchAll failed:', err);
    return [];
  }
}

/**
 * Load items that should ALWAYS be included regardless of query:
 * - Personality criteria (preference_type='personality', active)
 * - High-importance facts (importance >= 0.7)
 */
async function loadAlwaysInclude(userId: string): Promise<UnifiedMemoryItem[]> {
  try {
    // Personality criteria
    const personalityPromise = supabase
      .from('memories')
      .select('id, content, memory_type, origin, domain, weight, preference_type, importance, metadata')
      .eq('user_id', userId)
      .eq('memory_type', 'criterion')
      .eq('preference_type', 'personality')
      .is('valid_until', null)
      .order('importance', { ascending: false })
      .limit(10);

    // High-importance facts
    const highImportancePromise = supabase
      .from('memories')
      .select('id, content, memory_type, origin, domain, weight, preference_type, importance, metadata')
      .eq('user_id', userId)
      .eq('memory_type', 'fact')
      .gte('importance', 0.7)
      .is('valid_until', null)
      .order('importance', { ascending: false })
      .limit(15);

    const [personalityResult, highImportanceResult] = await Promise.all([
      personalityPromise,
      highImportancePromise,
    ]);

    const items: UnifiedMemoryItem[] = [];

    if (personalityResult.data) {
      for (const row of personalityResult.data as MemoryRow[]) {
        items.push(toUnifiedItem(row, 1.0)); // Always-include gets max relevance
      }
    }

    if (highImportanceResult.data) {
      for (const row of highImportanceResult.data as MemoryRow[]) {
        items.push(toUnifiedItem(row, 0.9)); // High importance gets near-max relevance
      }
    }

    return items;
  } catch (err) {
    console.error('[unified-retriever] loadAlwaysInclude failed:', err);
    return [];
  }
}

/**
 * Convert a database row to a UnifiedMemoryItem.
 * For criteria, parse the JSON content to extract description.
 */
function toUnifiedItem(row: MemoryRow, similarity: number): UnifiedMemoryItem {
  let description = row.content;

  // Criteria store structured JSON in content — extract the description
  if (row.memory_type === 'criterion') {
    try {
      const parsed = JSON.parse(row.content);
      description = parsed.description || parsed.content || row.content;
    } catch {
      // Content is plain text, use as-is
    }
  }

  return {
    id: row.id,
    content: row.content,
    description,
    memory_type: (row.memory_type || 'fact') as 'fact' | 'criterion',
    origin: (row.origin || 'stated') as 'stated' | 'extracted' | 'learned' | 'integrated',
    domain: row.domain || 'general',
    weight: row.weight,
    preference_type: row.preference_type,
    importance: row.importance ?? 0.5,
    relevance_score: similarity,
  };
}

/**
 * Merge semantic results with always-include items.
 * Deduplicate by ID (not cosine — we already have IDs).
 * Sort by relevance, cap at limit.
 */
function mergeAndScore(
  semantic: UnifiedMemoryItem[],
  alwaysInclude: UnifiedMemoryItem[],
  maxItems: number
): UnifiedMemoryItem[] {
  const seen = new Set<string>();
  const merged: UnifiedMemoryItem[] = [];

  // Always-include items first (personality + high-importance)
  for (const item of alwaysInclude) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  // Then semantic results
  for (const item of semantic) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  // Sort: always-include items first (relevance 1.0/0.9), then by relevance_score
  merged.sort((a, b) => {
    // Personality criteria always first
    if (a.preference_type === 'personality' && b.preference_type !== 'personality') return -1;
    if (b.preference_type === 'personality' && a.preference_type !== 'personality') return 1;
    // Then by relevance score
    return b.relevance_score - a.relevance_score;
  });

  return merged.slice(0, maxItems);
}
