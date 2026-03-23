/**
 * Brain Context Formatter — formats retrieved criteria into a system prompt section.
 *
 * Groups by positive (preferences) and negative (anti-preferences),
 * includes preference type tags and weights for transparency.
 */

import type { BrainCriterion } from '../types';

/**
 * Capitalize first letter of a string.
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format a single criterion into a bullet point.
 */
function formatCriterionLine(c: BrainCriterion): string {
  const tag = capitalize(c.preference_type || 'general');
  const sign = c.weight >= 0 ? '+' : '';
  const weightStr = `${sign}${c.weight.toFixed(2)}`;
  return `- [${tag}] ${c.description} (weight: ${weightStr})`;
}

/**
 * Format retrieved brain criteria into a system prompt section.
 *
 * Returns empty string if no criteria — no section added to prompt.
 * Caps output at ~1000 tokens (~4000 chars) to avoid bloating.
 */
export function formatBrainContext(criteria: BrainCriterion[]): string {
  if (!criteria || criteria.length === 0) return '';

  const preferences = criteria.filter(c => c.weight > 0);
  const antiPreferences = criteria.filter(c => c.weight < 0);

  // If somehow nothing passes (all zero weight), return empty
  if (preferences.length === 0 && antiPreferences.length === 0) return '';

  const parts: string[] = [
    '## User Preferences (Brain)',
    "The following preferences have been learned from this user's past interactions. Apply them naturally — don't mention that you're following learned preferences unless asked.",
    '',
  ];

  if (preferences.length > 0) {
    parts.push('**Preferences (things this user likes):**');
    for (const c of preferences) {
      parts.push(formatCriterionLine(c));
    }
    parts.push('');
  }

  if (antiPreferences.length > 0) {
    parts.push('**Anti-preferences (things this user dislikes):**');
    for (const c of antiPreferences) {
      parts.push(formatCriterionLine(c));
    }
    parts.push('');
  }

  parts.push('These preferences update automatically based on interactions. The user can view and edit them in the Brain tab.');

  let result = parts.join('\n');

  // Cap at ~4000 chars (~1000 tokens) to avoid bloating
  if (result.length > 4000) {
    result = result.substring(0, 3950) + '\n\n(Additional preferences truncated for brevity.)';
  }

  return result;
}
