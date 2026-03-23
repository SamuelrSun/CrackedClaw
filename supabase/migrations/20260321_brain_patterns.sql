-- Brain patterns table — stores aggregated patterns detected from signals
CREATE TABLE IF NOT EXISTS brain_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL,
  subdomain text,
  context text,
  pattern_type text NOT NULL,  -- 'preference' | 'style' | 'behavior' | 'anti_pattern'
  description text NOT NULL,   -- human-readable pattern description
  evidence jsonb NOT NULL DEFAULT '[]',  -- array of signal summaries that support this pattern
  occurrence_count int NOT NULL DEFAULT 1,
  confidence float NOT NULL DEFAULT 0.5,  -- 0-1
  status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'synthesized' | 'dismissed'
  synthesized_criterion_id text,  -- links to the BrainCriterion created from this pattern
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_patterns_user ON brain_patterns (user_id, status);
CREATE INDEX IF NOT EXISTS idx_brain_patterns_domain ON brain_patterns (user_id, domain);

ALTER TABLE brain_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own patterns" ON brain_patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage patterns" ON brain_patterns FOR ALL USING (true);

-- Add processed_at column to brain_signals for tracking aggregation
ALTER TABLE brain_signals ADD COLUMN IF NOT EXISTS processed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_brain_signals_unprocessed ON brain_signals (user_id, created_at DESC) WHERE processed_at IS NULL;
