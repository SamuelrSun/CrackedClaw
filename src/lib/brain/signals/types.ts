export type SignalType = 'edit_delta' | 'accept' | 'reject' | 'ignore' | 'correction' | 'engagement';

export interface BrainSignal {
  id?: string;
  user_id: string;
  signal_type: SignalType;
  domain?: string;
  subdomain?: string;
  context?: string;
  signal_data: Record<string, unknown>;
  session_id?: string;
  source?: string;
  created_at?: string;
}

export interface EditDeltaSignal extends BrainSignal {
  signal_type: 'edit_delta';
  signal_data: {
    original_snippet: string;
    edited_snippet: string;
    diff_summary: string;
    similarity_score: number;
  };
}

export interface AcceptRejectSignal extends BrainSignal {
  signal_type: 'accept' | 'reject' | 'ignore';
  signal_data: {
    suggestion_type: string;
    suggestion_snippet: string;
    user_action?: string;
  };
}

export interface CorrectionSignal extends BrainSignal {
  signal_type: 'correction';
  signal_data: {
    correction_text: string;
    original_context: string;
    correction_type: 'explicit' | 'implicit';
  };
}

export interface EngagementSignal extends BrainSignal {
  signal_type: 'engagement';
  signal_data: {
    message_length: number;
    response_time_ms?: number;
    has_followup: boolean;
    topic_keywords: string[];
  };
}
