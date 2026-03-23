/**
 * Engagement collector — captures engagement signals from every user message.
 *
 * Always returns data (every message has engagement signals).
 */

import type { EngagementSignal } from '../types';

const FOLLOWUP_PATTERNS = [
  /\?/,
  /\bcan\s+you\s+also\b/i,
  /\bwhat\s+about\b/i,
  /\btell\s+me\s+more\b/i,
  /\belaborate\b/i,
  /\bexpand\s+on\b/i,
  /\bgo\s+on\b/i,
  /\bcontinue\b/i,
  /\bwhat\s+else\b/i,
  /\band\s+also\b/i,
  /\bfollow.?up\b/i,
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'that', 'this', 'was', 'are',
  'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'so',
  'if', 'then', 'than', 'too', 'very', 'just', 'about', 'also', 'into',
  'like', 'how', 'what', 'when', 'where', 'who', 'which', 'why', 'all',
  'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any', 'only',
  'own', 'same', 'such', 'here', 'there', 'these', 'those', 'your', 'my',
  'his', 'her', 'its', 'our', 'their', 'them', 'they', 'you', 'we', 'me',
  'him', 'she', 'he', 'i', 'up', 'out', 'get', 'got', 'make', 'made',
  'know', 'think', 'want', 'need', 'use', 'said', 'say', 'way', 'well',
  'back', 'even', 'give', 'take', 'come', 'look', 'find', 'good', 'new',
  'first', 'last', 'long', 'great', 'little', 'right', 'still', 'much',
  'please', 'thank', 'thanks', 'okay', 'sure',
]);

function extractTopicKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

  // Deduplicate and take top keywords by frequency
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

/**
 * Collect engagement signals from a user message.
 *
 * Always returns data — every message has engagement characteristics.
 */
export function collectEngagement(
  userMessage: string,
  previousAITimestamp?: number
): EngagementSignal['signal_data'] {
  const hasFollowup = FOLLOWUP_PATTERNS.some((p) => p.test(userMessage));

  const responseTimeMs =
    previousAITimestamp != null ? Date.now() - previousAITimestamp : undefined;

  return {
    message_length: userMessage.length,
    response_time_ms: responseTimeMs,
    has_followup: hasFollowup,
    topic_keywords: extractTopicKeywords(userMessage),
  };
}
