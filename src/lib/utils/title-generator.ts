/**
 * Generates a short, topic-based conversation title from the first message.
 * No AI calls — pure string extraction.
 */

const FILLER_PREFIXES = [
  /^hey[,\s]+/i,
  /^hi[,\s]+/i,
  /^hello[,\s]+/i,
  /^can\s+you\s+/i,
  /^could\s+you\s+/i,
  /^please\s+/i,
  /^i\s+want\s+to\s+/i,
  /^i\s+need\s+(?:you\s+to\s+)?/i,
  /^i\s+would\s+like\s+(?:you\s+to\s+)?/i,
  /^help\s+me\s+/i,
  /^can\s+you\s+help\s+me\s+/i,
  /^could\s+you\s+help\s+me\s+/i,
  /^what(?:'s|\s+is)\s+/i,
  /^what\s+are\s+/i,
  /^how\s+do\s+(?:i|you)\s+/i,
  /^how\s+(?:can|do)\s+(?:i|you)\s+/i,
  /^build\s+me\s+(?:a\s+)?/i,
  /^make\s+me\s+(?:a\s+)?/i,
  /^write\s+me\s+(?:a\s+)?/i,
  /^give\s+me\s+(?:a\s+)?/i,
  /^show\s+me\s+/i,
  /^tell\s+me\s+/i,
];

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'that',
  'this', 'these', 'those', 'it', 'its', 'my', 'your', 'his', 'her',
  'our', 'their', 'if', 'then', 'than', 'so', 'yet', 'both', 'either',
]);

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (!word) return word;
      // Always capitalize first word; skip stop words for the rest
      if (i === 0 || !STOP_WORDS.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
}

function stripFillerPrefixes(text: string): string {
  let result = text.trim();
  let changed = true;
  // Apply filler removal repeatedly in case of stacked prefixes ("hey can you please...")
  while (changed) {
    changed = false;
    for (const pattern of FILLER_PREFIXES) {
      const stripped = result.replace(pattern, '');
      if (stripped !== result) {
        result = stripped.trim();
        changed = true;
        break; // Restart from the top after each change
      }
    }
  }
  return result.trim();
}

export function generateConversationTitle(firstMessage: string): string {
  const text = firstMessage.trim();

  // Empty or very short greetings → default
  if (!text || text.length <= 2) {
    return 'New Chat';
  }

  // Very short messages — just Title Case them directly
  if (text.length < 30) {
    const cleaned = stripFillerPrefixes(text);
    if (!cleaned || cleaned.length <= 1) return 'New Chat';
    return toTitleCase(cleaned);
  }

  // Longer messages: take the first sentence (up to first . or ?)
  const firstSentenceMatch = text.match(/^[^.?!]+/);
  const firstSentence = firstSentenceMatch ? firstSentenceMatch[0].trim() : text;

  // Strip filler from the front
  const stripped = stripFillerPrefixes(firstSentence);
  if (!stripped || stripped.length <= 1) return 'New Chat';

  // Take up to first 5 meaningful words
  const words = stripped.split(/\s+/).filter(Boolean);
  const capped = words.slice(0, 5).join(' ');

  // Title case
  const titled = toTitleCase(capped);

  // Final length guard — truncate if still too long
  if (titled.length > 40) {
    return titled.substring(0, 37) + '...';
  }

  return titled;
}
