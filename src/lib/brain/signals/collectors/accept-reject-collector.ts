/**
 * Accept/reject collector — detects user acceptance or rejection of AI suggestions.
 */

import type { AcceptRejectSignal } from '../types';

const ACCEPT_PATTERNS = [
  // "thanks/thank" but NOT "thanksgiving", "thankfully", "thankless"
  /\bthanks?\b(?!giving|fully|less)/i,
  /\bperfect\b/i,
  // "great" only standalone or followed by punctuation/end
  /\bgreat\b(?=\s*[!.,;:?]|\s*$)/i,
  /\blooks?\s+good\b/i,
  /\bsend\s+it\b/i,
  /\buse\s+that\b/i,
  /\byes\b/i,
  /\byep\b/i,
  /\byeah\b/i,
  /\bawesome\b/i,
  /\bexactly\b/i,
  /\bnice\b/i,
  /\blove\s+it\b/i,
  /\bnailed\s+it\b/i,
  /\bgo\s+ahead\b/i,
  /\bship\s+it\b/i,
  /\bapproved?\b/i,
  /\blgtm\b/i,
  /^(?:👍|✅|🙌|💯)$/,
];

const REJECT_PATTERNS = [
  /\btry\s+again\b/i,
  /\bredo\b/i,
  /\bdifferent\b/i,
  /\bnot\s+what\s+i\s+wanted\b/i,
  /\bnot\s+quite\b/i,
  /\bnot\s+right\b/i,
  /\bstart\s+over\b/i,
  /\btoo\s+(long|short|formal|casual|wordy|brief)\b/i,
  /\bscrap\s+(that|it|this)\b/i,
  /\bdon'?t\s+(like|want)\b/i,
  /\bnah\b/i,
];

function inferSuggestionType(aiMessage: string): string {
  const lower = aiMessage.toLowerCase();
  if (/(?:here'?s?\s+(?:a\s+)?draft|subject\s*:|dear\s|hi\s|hello\s)/i.test(lower)) return 'draft';
  if (/(?:i\s+recommend|you\s+(?:should|could|might)|suggestion|consider)/i.test(lower)) return 'recommendation';
  if (/(?:the\s+answer|here'?s?\s+(?:the|your)\s+(?:answer|response|result))/i.test(lower)) return 'answer';
  return 'other';
}

/**
 * Count how many patterns match in a given pattern list.
 */
function countMatches(msg: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(msg)) count++;
  }
  return count;
}

/**
 * Detect if the user is accepting or rejecting an AI suggestion.
 *
 * Returns signal data or null if the message is neutral.
 * Confidence: 'high' if 2+ indicators match, 'low' if only 1.
 */
export function detectAcceptReject(
  userMessage: string,
  previousAIMessage: string
): AcceptRejectSignal['signal_data'] | null {
  const msg = userMessage.trim();
  if (msg.length < 2) return null;

  const suggestionType = inferSuggestionType(previousAIMessage);
  const snippet = previousAIMessage.slice(0, 200);

  const acceptCount = countMatches(msg, ACCEPT_PATTERNS);
  const rejectCount = countMatches(msg, REJECT_PATTERNS);

  // Check acceptance
  if (acceptCount > 0 && acceptCount >= rejectCount) {
    return {
      suggestion_type: suggestionType,
      suggestion_snippet: snippet,
      confidence: acceptCount >= 2 ? 'high' : 'low',
    };
  }

  // Check rejection
  if (rejectCount > 0) {
    return {
      suggestion_type: suggestionType,
      suggestion_snippet: snippet,
      user_action: msg.slice(0, 200),
      confidence: rejectCount >= 2 ? 'high' : 'low',
    };
  }

  return null;
}

/**
 * Determine the signal type based on whether the user accepted or rejected.
 */
export function classifyAcceptRejectType(
  userMessage: string
): 'accept' | 'reject' | null {
  const msg = userMessage.trim();

  const acceptCount = countMatches(msg, ACCEPT_PATTERNS);
  const rejectCount = countMatches(msg, REJECT_PATTERNS);

  if (acceptCount > 0 && acceptCount >= rejectCount) return 'accept';
  if (rejectCount > 0) return 'reject';
  return null;
}
