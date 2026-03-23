/**
 * Edit delta collector — detects when a user rewrites/edits AI-produced content.
 *
 * Uses simple Jaccard word similarity (no embeddings, no LLM).
 */

import type { EditDeltaSignal } from '../types';

/** Common/stop words to filter out when computing meaningful similarity. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'and', 'but', 'or', 'not', 'no', 'if', 'then',
  'than', 'that', 'this', 'it', 'its', 'i', 'me', 'my', 'we', 'you',
  'your', 'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who',
  'how', 'when', 'where', 'why', 'so', 'just', 'also', 'very', 'too',
  'here', 'there', 'about', 'up', 'out', 'all', 'some', 'any', 'each',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0)
  );
}

/** Tokenize excluding stop words — for meaningful similarity. */
function tokenizeMeaningful(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function buildDiffSummary(original: string, edited: string): string {
  const origWords = tokenize(original);
  const editWords = tokenize(edited);

  const removed: string[] = [];
  const added: string[] = [];

  for (const w of origWords) {
    if (!editWords.has(w)) removed.push(w);
  }
  for (const w of editWords) {
    if (!origWords.has(w)) added.push(w);
  }

  const parts: string[] = [];
  if (removed.length > 0) parts.push(`removed: ${removed.slice(0, 10).join(', ')}`);
  if (added.length > 0) parts.push(`added: ${added.slice(0, 10).join(', ')}`);
  return parts.join('; ') || 'minor edits';
}

/**
 * Detect if the user's message is an edit/rewrite of the AI's message.
 *
 * Returns signal data if similarity is between 0.35 and 0.95 (partial overlap
 * suggesting the user is modifying AI output). Returns null otherwise.
 *
 * Filters out:
 * - Questions (end with ?)
 * - Similarity driven only by common/stop words
 */
export function detectEditDelta(
  aiMessage: string,
  userMessage: string
): EditDeltaSignal['signal_data'] | null {
  // Skip very short messages — unlikely to be edits
  if (userMessage.length < 20 || aiMessage.length < 20) return null;

  // Skip questions — user is asking, not editing
  if (userMessage.trim().endsWith('?')) return null;

  const aiTokens = tokenize(aiMessage);
  const userTokens = tokenize(userMessage);
  const rawSimilarity = jaccardSimilarity(aiTokens, userTokens);

  // Only flag as edit if there's meaningful overlap but clear changes
  if (rawSimilarity < 0.35 || rawSimilarity > 0.95) return null;

  // Check that similarity is driven by meaningful words, not just stop words
  const aiMeaningful = tokenizeMeaningful(aiMessage);
  const userMeaningful = tokenizeMeaningful(userMessage);
  const meaningfulSimilarity = jaccardSimilarity(aiMeaningful, userMeaningful);

  // If meaningful similarity is much lower than raw, the overlap is stop-word driven
  if (meaningfulSimilarity < 0.2) return null;

  return {
    original_snippet: aiMessage.slice(0, 300),
    edited_snippet: userMessage.slice(0, 300),
    diff_summary: buildDiffSummary(aiMessage, userMessage),
    similarity_score: Math.round(rawSimilarity * 1000) / 1000,
  };
}
