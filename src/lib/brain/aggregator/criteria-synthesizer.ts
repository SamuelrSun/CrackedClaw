/**
 * Criteria Synthesizer — the ONE place an LLM is used in the aggregation layer.
 *
 * Takes aggregated patterns and synthesizes them into human-readable
 * BrainCriterion entries, saved via brain-store.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getModelForTask } from '@/lib/ai/model-router';
import { saveBrainCriterion } from '@/lib/brain/brain-store';
import type { BrainCriterion, PreferenceType } from '@/lib/brain/types';
import type { AggregatedPattern } from './types';

const BATCH_SIZE = 10;

/**
 * Synthesize aggregated patterns into BrainCriterion entries using an LLM.
 *
 * Only processes patterns with status='pending' and confidence >= 0.6.
 */
export async function synthesizePatterns(
  userId: string,
  patterns: AggregatedPattern[]
): Promise<BrainCriterion[]> {
  // Filter to eligible patterns
  const eligible = patterns.filter((p) => p.confidence >= 0.6);
  if (eligible.length === 0) return [];

  const allCriteria: BrainCriterion[] = [];

  // Process in batches
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const criteria = await synthesizeBatch(userId, batch);
    allCriteria.push(...criteria);
  }

  return allCriteria;
}

/**
 * Synthesize a batch of patterns (up to 10) in a single LLM call.
 */
async function synthesizeBatch(
  userId: string,
  patterns: AggregatedPattern[]
): Promise<BrainCriterion[]> {
  const supabase = createAdminClient();

  try {
    const { meteredBackground } = await import('@/lib/ai/metered-client');

    const patternsPayload = patterns.map((p, idx) => ({
      index: idx,
      domain: p.domain,
      subdomain: p.subdomain,
      context: p.context,
      pattern_type: p.pattern_type,
      description: p.description,
      occurrence_count: p.occurrence_count,
      confidence: p.confidence,
      evidence: p.evidence.slice(0, 5).map((e) => ({
        signal_type: e.signal_type,
        summary: e.summary,
      })),
    }));

    const response = await meteredBackground({
      model: getModelForTask('synthesis'),
      max_tokens: 2048,
      system: `You are analyzing behavioral patterns detected from a user's interactions with an AI assistant.
Convert each pattern into a clear, actionable preference criterion.

For each pattern, output:
- description: Clear, specific preference statement (e.g., "Prefers direct, informal email tone without formal greetings")
- domain: The topic area this applies to
- subdomain: More specific area (if applicable, otherwise null)
- context: Specific situation this applies to (if applicable, otherwise null)
- weight: How strong this preference seems (-1.0 to 1.0, where negative means anti-preference/dislike, based on confidence and occurrence_count)
- examples: 1-2 concrete examples derived from the evidence
- preference_type: classify as one of: 'personality' (tone, directness, humor), 'process' (workflow, approach, methodology), 'style' (writing/communication style), 'criteria' (decision-making, evaluation), 'knowledge' (domain context, facts about user), 'general' (doesn't fit others)

Return ONLY a JSON array of objects. Each object must have: description, domain, subdomain, context, weight, examples (array of strings), preference_type.
No markdown, no explanation — just the JSON array.`,
      messages: [
        {
          role: 'user',
          content: `Patterns to synthesize:\n${JSON.stringify(patternsPayload, null, 2)}`,
        },
      ],
    }, { userId, source: 'brain_synthesis' });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[brain/synthesizer] LLM returned no valid JSON array');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      description: string;
      domain: string;
      subdomain?: string | null;
      context?: string | null;
      weight: number;
      examples: string[];
      preference_type?: PreferenceType;
    }>;

    const results: BrainCriterion[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < parsed.length && i < patterns.length; i++) {
      const synthesized = parsed[i];
      const pattern = patterns[i];

      if (!synthesized?.description || !synthesized?.domain) continue;

      const criterionId = crypto.randomUUID();

      const validPreferenceTypes: PreferenceType[] = ['personality', 'process', 'style', 'criteria', 'knowledge', 'general'];
      const preferenceType: PreferenceType = synthesized.preference_type && validPreferenceTypes.includes(synthesized.preference_type)
        ? synthesized.preference_type
        : 'general';

      const criterion: Omit<BrainCriterion, 'created_at' | 'updated_at'> = {
        id: criterionId,
        domain: synthesized.domain,
        subdomain: synthesized.subdomain || undefined,
        context: synthesized.context || undefined,
        description: synthesized.description,
        weight: Math.max(-1, Math.min(1, synthesized.weight ?? pattern.confidence)),
        source: 'revealed',
        confidence: pattern.confidence,
        correction_count: 0,
        preference_type: preferenceType,
        examples: synthesized.examples || [],
        valid_from: now,
      };

      // Save criterion via brain-store
      const memoryId = await saveBrainCriterion(userId, criterion);

      if (memoryId) {
        // Update the pattern's status in brain_patterns
        await supabase
          .from('brain_patterns')
          .update({
            status: 'synthesized',
            synthesized_criterion_id: criterionId,
            updated_at: now,
          })
          .eq('user_id', userId)
          .eq('domain', pattern.domain)
          .eq('pattern_type', pattern.pattern_type)
          .eq('status', 'pending');

        results.push({
          ...criterion,
          created_at: now,
          updated_at: now,
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[brain/synthesizer] synthesis failed:', err);
    return [];
  }
}
