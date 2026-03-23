/**
 * Types for the brain pattern aggregation layer.
 */

export interface AggregatedPattern {
  domain: string;
  subdomain?: string;
  context?: string;
  pattern_type: 'preference' | 'style' | 'behavior' | 'anti_pattern';
  description: string;
  evidence: SignalEvidence[];
  occurrence_count: number;
  confidence: number;
}

export interface SignalEvidence {
  signal_type: string;
  summary: string;
  created_at: string;
}

/**
 * Raw signal row as returned from the brain_signals table.
 */
export interface SignalRow {
  id: string;
  user_id: string;
  signal_type: string;
  domain: string | null;
  subdomain: string | null;
  context: string | null;
  signal_data: Record<string, unknown>;
  session_id: string | null;
  created_at: string;
  processed_at: string | null;
}
