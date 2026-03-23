/**
 * Main brain signal collector — orchestrates all individual collectors.
 *
 * This is the single entry point called from the chat handler.
 * FIRE AND FORGET — never throws, never blocks the response.
 */

import { classifyDomain } from '@/lib/memory/domain-classifier';
import { classifyBrainContext } from '@/lib/brain/brain-classifier';
import { recordSignal } from './signal-buffer';
import { detectEditDelta } from './collectors/edit-delta-collector';
import { detectCorrection } from './collectors/correction-collector';
import { collectEngagement } from './collectors/engagement-collector';
import { detectAcceptReject, classifyAcceptRejectType } from './collectors/accept-reject-collector';
import { processFastPath } from '../matcher/fast-path';
import type { BrainSignal } from './types';

export async function collectBrainSignals(params: {
  userId: string;
  userMessage: string;
  aiMessage: string;
  previousAIMessage?: string;
  previousAITimestamp?: number;
  sessionId?: string;
  brainEnabled: boolean;
}): Promise<void> {
  if (!params.brainEnabled) return;

  try {
    const {
      userId,
      userMessage,
      aiMessage,
      previousAIMessage,
      previousAITimestamp,
      sessionId,
    } = params;

    // Classify domain using the simple regex classifier (synchronous fallback)
    const regexDomain = classifyDomain(userMessage + ' ' + aiMessage);

    const baseSignal: Pick<BrainSignal, 'user_id' | 'domain' | 'subdomain' | 'context' | 'session_id'> = {
      user_id: userId,
      domain: regexDomain !== 'general' ? regexDomain : undefined,
      session_id: sessionId,
    };

    // Fire-and-forget: LLM-based classification to enrich domain/subdomain/context.
    // Runs async — updates signals retroactively if the LLM returns before they're processed.
    void (async () => {
      try {
        const brainContext = await classifyBrainContext([
          { role: 'user', content: userMessage },
          { role: 'assistant', content: aiMessage },
        ]);
        if (brainContext.domain && brainContext.domain !== 'general') {
          baseSignal.domain = brainContext.domain;
        }
        if (brainContext.subdomain) {
          baseSignal.subdomain = brainContext.subdomain;
        }
        if (brainContext.context) {
          baseSignal.context = brainContext.context;
        }
      } catch {
        // Fall back silently to regex classification — already set above
      }
    })();

    // Helper: record signal and also run fast path (fire-and-forget)
    const recordAndFastPath = (signal: BrainSignal) => {
      recordSignal(signal);
      // Fast path: immediately match signal against existing criteria
      void processFastPath({ userId, signal, sessionId }).catch(() => {});
    };

    // 1. Engagement (always fires)
    const engagement = collectEngagement(userMessage, previousAITimestamp);
    recordAndFastPath({
      ...baseSignal,
      signal_type: 'engagement',
      signal_data: engagement,
    } as BrainSignal);

    // 2. Edit delta — compare AI output with user's follow-up
    const editDelta = detectEditDelta(aiMessage, userMessage);
    if (editDelta) {
      recordAndFastPath({
        ...baseSignal,
        signal_type: 'edit_delta',
        signal_data: editDelta,
      } as BrainSignal);
    }

    // 3. Correction detection
    const aiContext = previousAIMessage || aiMessage;
    const correction = detectCorrection(userMessage, aiContext);
    if (correction) {
      recordAndFastPath({
        ...baseSignal,
        signal_type: 'correction',
        signal_data: correction,
      } as BrainSignal);
    }

    // 4. Accept/reject detection
    const acceptRejectData = detectAcceptReject(userMessage, aiMessage);
    if (acceptRejectData) {
      const signalType = classifyAcceptRejectType(userMessage);
      if (signalType) {
        recordAndFastPath({
          ...baseSignal,
          signal_type: signalType,
          signal_data: acceptRejectData,
        } as BrainSignal);
      }
    }
  } catch (err) {
    // Fire-and-forget: log but never throw
    console.error('[brain/collector] signal collection failed:', err);
  }
}
