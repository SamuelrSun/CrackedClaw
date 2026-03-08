/**
 * Skill Opportunity Detector
 * Runs after each user message to see if suggesting a skill would help.
 */

import { findSkillsForQuery, findSkillsForIntegration, type SkillDefinition } from './registry';

export interface SkillSuggestion {
  skill: SkillDefinition;
  reason: string;
  confidence: number;
}

/**
 * Detect if a skill would help based on the user's message and context.
 * Returns the best suggestion, or null if nothing is relevant/not-installed.
 */
export function detectSkillOpportunity(
  message: string,
  connectedIntegrations: string[],
  installedSkillIds: string[]
): SkillSuggestion | null {
  const candidates: SkillSuggestion[] = [];

  // 1. Check message triggers
  const msgMatches = findSkillsForQuery(message);
  for (const skill of msgMatches) {
    if (installedSkillIds.includes(skill.id)) continue;
    candidates.push({
      skill,
      reason: `You're working with ${skill.name.toLowerCase()} — this skill gives me better capabilities for it`,
      confidence: 0.85,
    });
  }

  // 2. Check connected integrations that have skills not installed
  for (const slug of connectedIntegrations) {
    const integrationSkills = findSkillsForIntegration(slug);
    for (const skill of integrationSkills) {
      if (installedSkillIds.includes(skill.id)) continue;
      if (candidates.some(c => c.skill.id === skill.id)) continue;
      candidates.push({
        skill,
        reason: `You have ${slug} connected — the ${skill.name} skill makes me significantly more capable with it`,
        confidence: 0.7,
      });
    }
  }

  if (!candidates.length) return null;

  // Return highest confidence
  return candidates.sort((a, b) => b.confidence - a.confidence)[0];
}
