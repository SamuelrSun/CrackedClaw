/**
 * Implicit Validation Tracker — tracks the ABSENCE of correction as a positive signal.
 *
 * When a user sends a follow-up message WITHOUT correcting the AI, every criterion
 * in the same domain gets a tiny positive nudge (+0.01). This is very subtle but
 * compounds over time — criteria that are consistently "right" slowly gain confidence.
 *
 * Rate limited: only applies once per criterion per session.
 */

import { loadBrainCriteria, updateCriterionWeight } from '@/lib/brain/brain-store';

const IMPLICIT_NUDGE = 0.01;

// Track which criteria have been nudged in a given session to avoid duplicates.
// Key: `${userId}:${sessionId}:${criterionId}`
const nudgedInSession = new Set<string>();

// Periodically clean up old entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let lastCleanup = Date.now();

function maybeCleanup(): void {
  if (Date.now() - lastCleanup > CLEANUP_INTERVAL_MS) {
    nudgedInSession.clear();
    lastCleanup = Date.now();
  }
}

/**
 * Apply implicit validation nudges to criteria in a domain.
 *
 * Called when a user sends a follow-up message that isn't a correction,
 * indicating the AI's previous response was acceptable.
 */
export async function trackImplicitValidation(
  userId: string,
  domain: string,
  sessionId?: string
): Promise<void> {
  maybeCleanup();

  const effectiveSession = sessionId || 'default';

  // Load criteria for this domain
  const criteria = await loadBrainCriteria(userId, { domain }, { limit: 50, minConfidence: 0.1 });

  if (criteria.length === 0) return;

  for (const criterion of criteria) {
    // Rate limit: only nudge once per criterion per session
    const key = `${userId}:${effectiveSession}:${criterion.id}`;
    if (nudgedInSession.has(key)) continue;

    // Apply the tiny positive nudge
    await updateCriterionWeight(userId, criterion.id, IMPLICIT_NUDGE);
    nudgedInSession.add(key);
  }
}
