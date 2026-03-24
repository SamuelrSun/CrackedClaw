/**
 * Unified Memory Formatter — formats unified memory items into a single prompt block.
 *
 * Groups by origin (stated/extracted, learned, integrated) with source attribution.
 * Skips empty sections. Caps output at ~6000 chars (~1500 tokens).
 *
 * Used behind the `unified_memory` feature flag (default: off).
 */

import type { UnifiedMemoryItem } from './unified-retriever';

const MAX_CHARS = 6000; // ~1500 tokens
const MAX_ITEMS = 40;

/**
 * Format unified memory items into a single prompt block for system prompt injection.
 *
 * Sections:
 * 1. "Things you've told me:" — origin is 'stated' or 'extracted'
 * 2. "Preferences I've picked up:" — origin is 'learned', includes weight
 * 3. "From your connected services:" — origin is 'integrated'
 */
export function formatUnifiedContext(items: UnifiedMemoryItem[]): string {
  if (!items || items.length === 0) return '';

  // Truncate to max items to keep token budget
  const capped = items.slice(0, MAX_ITEMS);

  const stated = capped.filter(i => i.origin === 'stated' || i.origin === 'extracted');
  const learned = capped.filter(i => i.origin === 'learned');
  const integrated = capped.filter(i => i.origin === 'integrated');

  // If nothing in any section, return empty
  if (stated.length === 0 && learned.length === 0 && integrated.length === 0) return '';

  const parts: string[] = [
    '## What I Know About You',
    "The following is what I know about you from our conversations and your connected services. Apply this knowledge naturally — don't mention that you're referencing stored memories unless asked.",
    '',
  ];

  if (stated.length > 0) {
    parts.push('**Things you\'ve told me:**');
    for (const m of stated) {
      parts.push(`- ${m.description}`);
    }
    parts.push('');
  }

  if (learned.length > 0) {
    parts.push('**Preferences I\'ve picked up from our interactions:**');
    for (const m of learned) {
      const weightStr = m.weight != null ? ` (strength: ${m.weight >= 0 ? '+' : ''}${m.weight.toFixed(2)})` : '';
      parts.push(`- ${m.description}${weightStr}`);
    }
    parts.push('');
  }

  if (integrated.length > 0) {
    parts.push('**From your connected services:**');
    for (const m of integrated) {
      parts.push(`- ${m.description}`);
    }
    parts.push('');
  }

  let result = parts.join('\n');

  // Cap at ~1500 tokens (~6000 chars)
  if (result.length > MAX_CHARS) {
    result = result.substring(0, MAX_CHARS - 50) + '\n\n(Additional context truncated for brevity.)';
  }

  return result;
}
