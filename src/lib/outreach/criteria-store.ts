/**
 * Criteria store — reads/writes criteria to/from the memory system.
 */

import {
  mem0Write,
  mem0GetAll,
} from '@/lib/memory/mem0-client';
import type { Criterion, CriteriaModel } from './criteria-engine';

function domainFor(campaignSlug: string): string {
  return `outreach:${campaignSlug}`;
}

/**
 * Save all criteria from a CriteriaModel into memory.
 * Each criterion and anti-pattern becomes its own memory record.
 */
export async function saveCriteria(
  userId: string,
  campaignSlug: string,
  model: CriteriaModel
): Promise<void> {
  const domain = domainFor(campaignSlug);

  for (const criterion of model.criteria) {
    const content = JSON.stringify(criterion);
    await mem0Write(userId, content, {
      domain,
      importance: criterion.importance,
      source: criterion.source,
      metadata: {
        type: 'criterion',
        criterion_id: criterion.id,
        version: model.version,
        source: criterion.source,
        campaign_slug: campaignSlug,
      },
    });
  }

  for (const pattern of model.anti_patterns) {
    await mem0Write(userId, pattern, {
      domain,
      importance: 0.7,
      source: 'chat',
      metadata: {
        type: 'anti_pattern',
        version: model.version,
        campaign_slug: campaignSlug,
      },
    });
  }

  // Store the notes if present
  if (model.notes) {
    await mem0Write(userId, model.notes, {
      domain,
      importance: 0.5,
      source: 'chat',
      metadata: {
        type: 'notes',
        version: model.version,
        campaign_slug: campaignSlug,
      },
    });
  }
}

/**
 * Load all criteria for a campaign from memory, reconstruct a CriteriaModel.
 */
export async function loadCriteria(
  userId: string,
  campaignSlug: string
): Promise<CriteriaModel | null> {
  const domain = domainFor(campaignSlug);

  let memories;
  try {
    memories = await mem0GetAll(userId, domain);
  } catch {
    return null;
  }

  if (!memories || memories.length === 0) return null;

  const criteria: Criterion[] = [];
  const anti_patterns: string[] = [];
  let notes = '';

  for (const mem of memories) {
    const meta = (mem.metadata as Record<string, unknown>) || {};
    const type = meta.type as string | undefined;

    if (type === 'criterion') {
      try {
        const c = JSON.parse(mem.memory ?? mem.content ?? '');
        criteria.push(c);
      } catch {
        // skip malformed
      }
    } else if (type === 'anti_pattern') {
      anti_patterns.push(mem.memory ?? mem.content ?? '');
    } else if (type === 'notes') {
      notes = mem.memory ?? mem.content ?? '';
    }
  }

  if (criteria.length === 0 && anti_patterns.length === 0) return null;

  return {
    version: 1,
    campaign_slug: campaignSlug,
    criteria,
    anti_patterns,
    notes,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Update a specific criterion in memory by rewriting it.
 */
export async function updateCriterion(
  userId: string,
  campaignSlug: string,
  criterionId: string,
  updates: Partial<Criterion>
): Promise<void> {
  const domain = domainFor(campaignSlug);
  const memories = await mem0GetAll(userId, domain);

  for (const mem of memories) {
    const meta = (mem.metadata as Record<string, unknown>) || {};
    if (meta.type === 'criterion' && meta.criterion_id === criterionId) {
      try {
        const existing = JSON.parse(mem.memory ?? mem.content ?? '');
        const updated = { ...existing, ...updates };
        const content = JSON.stringify(updated);
        await mem0Write(userId, content, {
          domain,
          importance: updated.importance,
          source: updated.source,
          metadata: {
            type: 'criterion',
            criterion_id: criterionId,
            version: (meta.version as number ?? 1) + 1,
            source: updated.source,
            campaign_slug: campaignSlug,
          },
        });
      } catch {
        // skip
      }
      break;
    }
  }
}
