/**
 * Correction collector — detects when a user corrects the AI.
 *
 * Pattern-matches for explicit and implicit correction markers.
 */

import type { CorrectionSignal } from '../types';

// Strong correction indicators — a single match is sufficient
const STRONG_PATTERNS = [
  /\bthat'?s\s+(not\s+right|wrong|incorrect)\b/i,
  /\bthat'?s\s+not\s+what\b/i,
  /\bnot\s+what\s+i\b/i,
  /\bi\s+meant\b/i,
  /\bwrong\b/i,
];

// Weaker explicit patterns — need 2+ matches to emit
const EXPLICIT_PATTERNS = [
  // "no" but NOT "no problem", "no worries", "no way", "no doubt", "no thanks"
  /\bno[,.]?\s(?!problem|worries|way\b|doubt\b|thanks\b|thank\b|kidding\b|joke\b|idea\b|wonder\b)/i,
  /\bnot\s+quite\b/i,
  // "actually" only when followed by correction context
  /\bactually[,.]?\s+(?:i\s+meant|i\s+want|can\s+you|it\s+should|it'?s|that\s+should|please|let'?s|change|make\s+it|use)\b/i,
];

// Implicit correction markers — need 2+ matches to emit
const IMPLICIT_PATTERNS = [
  /\binstead\b/i,
  /\bi'?d\s+rather\b/i,
  /\bdon'?t\b/i,
  /\bstop\b/i,
  /\bchange\b/i,
  /\blet\s+me\s+clarify\b/i,
  /\bwhat\s+i\s+(want|need)\b/i,
  /\bplease\s+(use|do|make|try)\b/i,
];

/**
 * Detect if the user is correcting the AI's previous response.
 *
 * Returns correction signal data with type (explicit/implicit) or null.
 * Requires at least 2 correction indicators OR 1 strong indicator.
 */
export function detectCorrection(
  userMessage: string,
  previousAIMessage: string
): CorrectionSignal['signal_data'] | null {
  const msg = userMessage.trim();
  if (msg.length < 3) return null;

  // Check strong patterns — a single match is enough
  for (const pattern of STRONG_PATTERNS) {
    if (pattern.test(msg)) {
      return {
        correction_text: msg.slice(0, 300),
        original_context: previousAIMessage.slice(0, 200),
        correction_type: 'explicit',
      };
    }
  }

  // Count explicit pattern matches — need 2+
  let explicitCount = 0;
  for (const pattern of EXPLICIT_PATTERNS) {
    if (pattern.test(msg)) explicitCount++;
  }
  if (explicitCount >= 2) {
    return {
      correction_text: msg.slice(0, 300),
      original_context: previousAIMessage.slice(0, 200),
      correction_type: 'explicit',
    };
  }

  // Count all weaker indicators (explicit + implicit) — need 2+
  let implicitCount = 0;
  for (const pattern of IMPLICIT_PATTERNS) {
    if (pattern.test(msg)) implicitCount++;
  }

  const totalWeak = explicitCount + implicitCount;
  if (totalWeak >= 2) {
    return {
      correction_text: msg.slice(0, 300),
      original_context: previousAIMessage.slice(0, 200),
      correction_type: totalWeak > 2 || explicitCount > 0 ? 'explicit' : 'implicit',
    };
  }

  return null;
}
