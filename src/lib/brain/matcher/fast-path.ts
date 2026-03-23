/**
 * Fast Path Orchestrator — ties signal matcher and implicit validator together.
 *
 * Fire-and-forget: never throws, never blocks the response.
 * Called on every signal to provide real-time criterion weight adjustments.
 */

import { matchSignalToCriteria } from './signal-matcher';
import { trackImplicitValidation } from './implicit-validator';
import type { BrainSignal } from '@/lib/brain/signals/types';

/**
 * Process the fast path for a single signal.
 *
 * 1. Match signal against existing criteria and apply micro-adjustments
 * 2. If engagement signal (not a correction), also track implicit validation
 *
 * Always fire-and-forget — wraps everything in try/catch.
 */
export async function processFastPath(params: {
  userId: string;
  signal: BrainSignal;
  sessionId?: string;
}): Promise<void> {
  try {
    const { userId, signal, sessionId } = params;

    // 1. Match signal against existing criteria
    await matchSignalToCriteria(userId, signal);

    // 2. If engagement signal and not a correction, track implicit validation
    // Engagement signals with follow-ups and no correction indicate acceptance
    if (
      signal.signal_type === 'engagement' &&
      signal.domain
    ) {
      await trackImplicitValidation(userId, signal.domain, sessionId);
    }
  } catch (err) {
    // Fire-and-forget: log but never throw
    console.error('[brain/fast-path] processFastPath failed:', err);
  }
}
