/**
 * Brain store — reads/writes brain criteria to/from the memories table
 * using context_scope and memory_type columns.
 *
 * Uses the existing Supabase client pattern from mem0-client.ts.
 */

import { createClient } from '@supabase/supabase-js';
import { mem0Write } from '@/lib/memory/mem0-client';
import type { BrainCriterion, BrainContext, PreferenceType } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Save a brain criterion to the memories table.
 * Stores the criterion as JSON content with memory_type='criterion'
 * and context_scope for hierarchical querying.
 */
export async function saveBrainCriterion(
  userId: string,
  criterion: Omit<BrainCriterion, 'created_at' | 'updated_at'>
): Promise<string | null> {
  const now = new Date().toISOString();
  const full: BrainCriterion = {
    ...criterion,
    created_at: now,
    updated_at: now,
  };

  const contextScope: Record<string, string> = { domain: criterion.domain };
  if (criterion.subdomain) contextScope.subdomain = criterion.subdomain;
  if (criterion.context) contextScope.context = criterion.context;

  // Use mem0Write for dedup + embedding, then patch brain-specific columns
  const memoryId = await mem0Write(userId, JSON.stringify(full), {
    domain: `brain:${criterion.domain}`,
    importance: Math.abs(criterion.weight),
    source: criterion.source,
    metadata: {
      type: 'brain_criterion',
      criterion_id: criterion.id,
      brain_domain: criterion.domain,
      brain_subdomain: criterion.subdomain,
      brain_context: criterion.context,
    },
  });

  if (memoryId) {
    // Patch the brain-specific columns that mem0Write doesn't know about
    await supabase
      .from('memories')
      .update({
        memory_type: 'criterion',
        context_scope: contextScope,
        valid_from: criterion.valid_from || now,
        valid_until: criterion.valid_until || null,
        correction_count: criterion.correction_count,
        preference_type: criterion.preference_type || 'general',
        weight: criterion.weight,
      })
      .eq('id', memoryId);
  }

  return memoryId;
}

/**
 * Load brain criteria matching a context (hierarchical).
 *
 * Querying "email/professional" returns:
 * - Exact match: domain=email, subdomain=professional
 * - Broader: domain=email (no subdomain)
 * - Broadest: domain=general
 *
 * Only returns active criteria (valid_until IS NULL).
 */
export async function loadBrainCriteria(
  userId: string,
  context?: BrainContext,
  options?: { limit?: number; minConfidence?: number; preferenceType?: PreferenceType }
): Promise<BrainCriterion[]> {
  const limit = options?.limit ?? 10;
  const minConfidence = options?.minConfidence ?? 0.3;

  try {
    let query = supabase
      .from('memories')
      .select('id, content, context_scope, valid_from, valid_until, correction_count, importance, preference_type, created_at, updated_at')
      .eq('user_id', userId)
      .eq('memory_type', 'criterion')
      .is('valid_until', null)
      .order('importance', { ascending: false })
      .limit(limit);

    if (options?.preferenceType) {
      query = query.eq('preference_type', options.preferenceType);
    }

    if (context) {
      // Use containedBy won't work for hierarchical — we need an OR query
      // Fetch all active criteria and filter in app for hierarchical matching
      query = query.contains('context_scope', { domain: context.domain });
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const criteria: BrainCriterion[] = [];

    for (const row of data) {
      try {
        const parsed = JSON.parse(row.content) as BrainCriterion;

        // Hierarchical filtering: if querying email/professional,
        // include criteria that match email/professional, email (no subdomain), or general
        if (context) {
          const scope = row.context_scope as Record<string, string> | null;
          if (scope && scope.domain !== 'general' && scope.domain !== context.domain) {
            continue;
          }
          // If we're querying with subdomain, skip criteria that have a *different* subdomain
          if (context.subdomain && scope?.subdomain && scope.subdomain !== context.subdomain) {
            continue;
          }
        }

        // Filter by confidence
        if (parsed.confidence < minConfidence) continue;

        criteria.push({
          ...parsed,
          id: parsed.id || row.id,
          correction_count: row.correction_count ?? parsed.correction_count ?? 0,
          preference_type: (row as Record<string, unknown>).preference_type as PreferenceType ?? parsed.preference_type ?? 'general',
          valid_from: row.valid_from ?? parsed.valid_from,
          valid_until: row.valid_until ?? parsed.valid_until ?? undefined,
          created_at: row.created_at ?? parsed.created_at,
          updated_at: row.updated_at ?? parsed.updated_at,
        });
      } catch {
        // Skip malformed entries
      }
    }

    return criteria.slice(0, limit);
  } catch (err) {
    console.error('[brain] loadBrainCriteria failed:', err);
    return [];
  }
}

/**
 * Update a criterion's weight by delta (bounded -1 to 1) and increment correction_count.
 *
 * Uses a targeted query filtering by content->>id to avoid loading all criteria.
 */
export async function updateCriterionWeight(
  userId: string,
  criterionId: string,
  delta: number
): Promise<void> {
  try {
    // Targeted query: filter by criterion ID stored in JSON content
    const { data: rows, error: findError } = await supabase
      .from('memories')
      .select('id, content, importance, correction_count')
      .eq('user_id', userId)
      .eq('memory_type', 'criterion')
      .is('valid_until', null)
      .filter('content', 'cs', JSON.stringify({ id: criterionId }))
      .limit(1);

    if (findError) throw findError;
    if (!rows || rows.length === 0) return;

    const row = rows[0];
    try {
      const parsed = JSON.parse(row.content) as BrainCriterion;
      if (parsed.id !== criterionId) return; // safety check

      const newWeight = Math.max(-1, Math.min(1, (parsed.weight ?? row.importance ?? 0.5) + delta));
      const newCount = (row.correction_count ?? 0) + 1;

      // Update the parsed content
      parsed.weight = newWeight;
      parsed.correction_count = newCount;
      parsed.updated_at = new Date().toISOString();

      await supabase
        .from('memories')
        .update({
          content: JSON.stringify(parsed),
          importance: Math.abs(newWeight),
          weight: newWeight,
          correction_count: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    } catch {
      // skip malformed
    }
  } catch (err) {
    console.error('[brain] updateCriterionWeight failed:', err);
  }
}

/**
 * Load brain criteria matching ANY of the given preference types,
 * optionally filtered by context (domain/subdomain).
 *
 * Used for smart retrieval — e.g., always load 'personality' type criteria
 * (cross-domain) plus domain-specific criteria.
 */
export async function loadBrainCriteriaByType(
  userId: string,
  types: PreferenceType[],
  context?: BrainContext
): Promise<BrainCriterion[]> {
  try {
    let query = supabase
      .from('memories')
      .select('id, content, context_scope, valid_from, valid_until, correction_count, importance, preference_type, created_at, updated_at')
      .eq('user_id', userId)
      .eq('memory_type', 'criterion')
      .is('valid_until', null)
      .in('preference_type', types)
      .order('importance', { ascending: false })
      .limit(50);

    if (context) {
      query = query.contains('context_scope', { domain: context.domain });
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const criteria: BrainCriterion[] = [];

    for (const row of data) {
      try {
        const parsed = JSON.parse(row.content) as BrainCriterion;

        // Hierarchical filtering (same as loadBrainCriteria)
        if (context) {
          const scope = row.context_scope as Record<string, string> | null;
          if (scope && scope.domain !== 'general' && scope.domain !== context.domain) {
            continue;
          }
          if (context.subdomain && scope?.subdomain && scope.subdomain !== context.subdomain) {
            continue;
          }
        }

        criteria.push({
          ...parsed,
          id: parsed.id || row.id,
          correction_count: row.correction_count ?? parsed.correction_count ?? 0,
          preference_type: (row as Record<string, unknown>).preference_type as PreferenceType ?? parsed.preference_type ?? 'general',
          valid_from: row.valid_from ?? parsed.valid_from,
          valid_until: row.valid_until ?? parsed.valid_until ?? undefined,
          created_at: row.created_at ?? parsed.created_at,
          updated_at: row.updated_at ?? parsed.updated_at,
        });
      } catch {
        // Skip malformed entries
      }
    }

    return criteria;
  } catch (err) {
    console.error('[brain] loadBrainCriteriaByType failed:', err);
    return [];
  }
}

/**
 * Retire a criterion by setting valid_until = now().
 * The criterion remains in the database but won't be returned by loadBrainCriteria.
 */
export async function retireCriterion(
  userId: string,
  criterionId: string
): Promise<void> {
  try {
    const { data: rows, error: findError } = await supabase
      .from('memories')
      .select('id, content')
      .eq('user_id', userId)
      .eq('memory_type', 'criterion')
      .is('valid_until', null);

    if (findError) throw findError;
    if (!rows) return;

    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.content) as BrainCriterion;
        if (parsed.id === criterionId) {
          const now = new Date().toISOString();
          parsed.valid_until = now;
          parsed.updated_at = now;

          await supabase
            .from('memories')
            .update({
              content: JSON.stringify(parsed),
              valid_until: now,
              updated_at: now,
            })
            .eq('id', row.id);

          return;
        }
      } catch {
        // skip malformed
      }
    }
  } catch (err) {
    console.error('[brain] retireCriterion failed:', err);
  }
}
