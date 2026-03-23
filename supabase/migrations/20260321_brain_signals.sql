-- Brain signals table — stores raw behavioral signals
CREATE TABLE IF NOT EXISTS brain_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type text NOT NULL,  -- 'edit_delta' | 'accept' | 'reject' | 'ignore' | 'correction' | 'engagement'
  domain text,                -- classified domain (email, coding, etc.)
  subdomain text,             -- optional subdomain
  context text,               -- optional context
  signal_data jsonb NOT NULL DEFAULT '{}',  -- type-specific payload
  session_id text,            -- conversation/session reference
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brain_signals_user ON brain_signals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_signals_type ON brain_signals (user_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_brain_signals_domain ON brain_signals (user_id, domain) WHERE domain IS NOT NULL;

-- RLS
ALTER TABLE brain_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own signals" ON brain_signals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert signals" ON brain_signals FOR INSERT WITH CHECK (true);
