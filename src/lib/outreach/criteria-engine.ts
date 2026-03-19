/**
 * Outreach criteria engine — type definitions.
 */

export interface Criterion {
  id: string;           // e.g. "school-tier"
  category: string;     // e.g. "education"
  description: string;  // e.g. "Prefers candidates from top-tier universities"
  importance: number;   // 0-1
  source: 'user_stated' | 'agent_discovered' | 'refined';
  thresholds?: string;  // e.g. "Ivy (0.9) > UC (0.7) > Other (0.3)"
  interaction_effects?: string[];
}

export interface CriteriaModel {
  version: number;
  campaign_slug: string;
  criteria: Criterion[];
  anti_patterns: string[];
  notes: string;
  updated_at: string;
}
