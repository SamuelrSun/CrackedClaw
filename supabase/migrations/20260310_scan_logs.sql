-- Scan logs for persistent scan tracking + log display
CREATE TABLE IF NOT EXISTS scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mode text DEFAULT 'quick' CHECK (mode IN ('quick', 'deep')),
  status text DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
  target_provider text,
  total_memories integer DEFAULT 0,
  duration_ms integer,
  results_summary jsonb DEFAULT '{}',
  progress_log jsonb DEFAULT '[]', -- Array of progress events for replay
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX scan_logs_user_idx ON scan_logs (user_id, created_at DESC);

ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own scans" ON scan_logs FOR ALL USING (auth.uid() = user_id);
