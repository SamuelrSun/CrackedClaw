/**
 * Brain feature types — generalized preference/criteria learning system.
 */

export type PreferenceType = 'personality' | 'process' | 'style' | 'criteria' | 'knowledge' | 'general';

export interface BrainCriterion {
  id: string;
  domain: string;           // e.g. "email", "scheduling", "coding"
  subdomain?: string;       // e.g. "professional", "personal"
  context?: string;         // e.g. "fundraising", "recruiting"
  description: string;      // e.g. "Prefers concise subject lines"
  weight: number;           // -1.0 to 1.0 (negative = anti-preference)
  source: 'stated' | 'revealed' | 'refined';
  confidence: number;       // 0.0 - 1.0
  correction_count: number;
  preference_type: PreferenceType;  // auto-classified: personality, process, style, criteria, knowledge, general
  examples?: string[];      // concrete examples from conversations
  valid_from: string;       // ISO timestamp
  valid_until?: string;     // null = still active
  created_at: string;
  updated_at: string;
}

export interface BrainContext {
  domain: string;
  subdomain?: string;
  context?: string;
}

export interface BrainConfig {
  enabled: boolean;
  max_criteria_per_query: number;  // default 10
  extraction_model: string;        // default 'claude-sonnet-4-20250514'
  min_confidence: number;          // default 0.3
}
