/**
 * Signal Matcher (Fast Path) — matches incoming signals against existing brain criteria
 * and applies immediate micro-adjustments to criterion weights.
 *
 * This runs on EVERY signal, so it must be fast. No LLM calls.
 * Just keyword matching and a single DB update.
 */

import { loadBrainCriteria, updateCriterionWeight } from '@/lib/brain/brain-store';
import type { BrainCriterion } from '@/lib/brain/types';
import type { BrainSignal } from '@/lib/brain/signals/types';

// Weight adjustment magnitudes
const ADJUST_ACCEPT = 0.03;
const ADJUST_REJECT = -0.05;
const ADJUST_CORRECTION = -0.07;
const ADJUST_EDIT_CONTRADICTS = -0.04;
const ADJUST_EDIT_ALIGNS = 0.02;
const ADJUST_ENGAGEMENT = 0.01;

// Relevance thresholds
const KEYWORD_OVERLAP_THRESHOLD = 0.3;
const LOW_WEIGHT_THRESHOLD = -0.8;

// Simple in-memory cache with TTL
const criteriaCache = new Map<string, { criteria: BrainCriterion[]; expiresAt: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Extract lowercase meaningful words from text, filtering stopwords.
 */
function extractKeywords(text: string): Set<string> {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'and', 'but', 'or', 'not', 'no', 'if', 'then',
    'than', 'that', 'this', 'it', 'its', 'i', 'me', 'my', 'we', 'you',
    'your', 'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who',
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w))
  );
}

/**
 * Calculate Jaccard similarity between two keyword sets.
 */
function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extract text content from signal data for keyword comparison.
 */
function getSignalText(signal: BrainSignal): string {
  const data = signal.signal_data;
  const parts: string[] = [];

  if (data.correction_text) parts.push(String(data.correction_text));
  if (data.original_context) parts.push(String(data.original_context));
  if (data.suggestion_snippet) parts.push(String(data.suggestion_snippet));
  if (data.diff_summary) parts.push(String(data.diff_summary));
  if (data.original_snippet) parts.push(String(data.original_snippet));
  if (data.edited_snippet) parts.push(String(data.edited_snippet));
  if (data.topic_keywords && Array.isArray(data.topic_keywords)) {
    parts.push((data.topic_keywords as string[]).join(' '));
  }

  return parts.join(' ');
}

/**
 * Check if a signal is relevant to a given criterion.
 */
function isRelevant(signal: BrainSignal, criterion: BrainCriterion): boolean {
  // Domain match: same domain+subdomain → always relevant
  if (
    signal.domain &&
    criterion.domain === signal.domain &&
    (!signal.subdomain || !criterion.subdomain || criterion.subdomain === signal.subdomain)
  ) {
    return true;
  }

  // Keyword overlap between signal content and criterion description
  const signalKeywords = extractKeywords(getSignalText(signal));
  const criterionKeywords = extractKeywords(criterion.description + ' ' + (criterion.examples?.join(' ') || ''));
  const overlap = keywordOverlap(signalKeywords, criterionKeywords);

  return overlap >= KEYWORD_OVERLAP_THRESHOLD;
}

/**
 * Determine the weight adjustment for a signal-criterion match.
 */
function getAdjustment(signal: BrainSignal, criterion: BrainCriterion): number {
  switch (signal.signal_type) {
    case 'accept':
      return ADJUST_ACCEPT;

    case 'reject':
      return ADJUST_REJECT;

    case 'correction':
      return ADJUST_CORRECTION;

    case 'edit_delta': {
      // Check if edit aligns with or contradicts the criterion
      const diffSummary = String(signal.signal_data.diff_summary || '');
      const criterionKeywords = extractKeywords(criterion.description);
      const editKeywords = extractKeywords(diffSummary);
      const overlap = keywordOverlap(editKeywords, criterionKeywords);
      // Higher overlap between edit and criterion description → likely contradicts
      // (user is editing away from what the criterion says)
      return overlap >= 0.3 ? ADJUST_EDIT_CONTRADICTS : ADJUST_EDIT_ALIGNS;
    }

    case 'engagement': {
      // High engagement (long message, follow-up) → subtle positive reinforcement
      const msgLength = (signal.signal_data.message_length as number) || 0;
      const hasFollowup = signal.signal_data.has_followup as boolean;
      if (msgLength > 100 || hasFollowup) {
        return ADJUST_ENGAGEMENT;
      }
      return 0;
    }

    case 'ignore':
      return 0; // Ignore signals don't adjust criteria

    default:
      return 0;
  }
}

/**
 * Load criteria with brief in-memory caching.
 */
async function getCachedCriteria(userId: string, domain?: string): Promise<BrainCriterion[]> {
  const cacheKey = `${userId}:${domain || 'all'}`;
  const cached = criteriaCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.criteria;
  }

  const context = domain ? { domain } : undefined;
  const criteria = await loadBrainCriteria(userId, context, { limit: 50, minConfidence: 0.1 });

  criteriaCache.set(cacheKey, {
    criteria,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return criteria;
}

/**
 * Match a signal against existing brain criteria and apply weight adjustments.
 *
 * Iterates through ALL criteria and adjusts every match (not just the first).
 * Returns an array of all adjustments made.
 * Fast: no LLM calls, just keyword matching + DB updates.
 */
export async function matchSignalToCriteria(
  userId: string,
  signal: BrainSignal
): Promise<{ matched: boolean; adjustments: Array<{ criterionId: string; adjustment: number }> }> {
  // Load criteria (cached briefly)
  const criteria = await getCachedCriteria(userId, signal.domain);

  if (criteria.length === 0) {
    return { matched: false, adjustments: [] };
  }

  const adjustments: Array<{ criterionId: string; adjustment: number }> = [];

  // Iterate through ALL criteria and adjust every match
  for (const criterion of criteria) {
    if (!isRelevant(signal, criterion)) continue;

    const adjustment = getAdjustment(signal, criterion);
    if (adjustment === 0) continue;

    // Apply the adjustment
    await updateCriterionWeight(userId, criterion.id, adjustment);

    adjustments.push({ criterionId: criterion.id, adjustment });

    // Log if weight drops below threshold (flagging, not auto-retiring)
    const newWeight = criterion.weight + adjustment;
    if (newWeight < LOW_WEIGHT_THRESHOLD) {
      console.warn(
        `[brain/matcher] Criterion "${criterion.id}" weight dropped to ~${newWeight.toFixed(2)} — flagged for review`
      );
    }
  }

  // Invalidate cache for this user if any weights changed
  if (adjustments.length > 0) {
    for (const key of criteriaCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        criteriaCache.delete(key);
      }
    }
  }

  return { matched: adjustments.length > 0, adjustments };
}
