-- Usage Ledger: tracks every AI call with exact token counts and cost
CREATE TABLE IF NOT EXISTS usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- What model was used
  model TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  
  -- Token counts
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  
  -- Cost in USD (8 decimal places for micro-costs)
  cost_usd NUMERIC(10, 8) NOT NULL DEFAULT 0,
  
  -- Whether this cost was charged to user (chat) or absorbed (background)
  charged BOOLEAN NOT NULL DEFAULT false,
  
  -- Where the call originated
  source TEXT NOT NULL,
  
  -- Optional context
  conversation_id UUID,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_user ON usage_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_date ON usage_ledger(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_source ON usage_ledger(user_id, source);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_charged ON usage_ledger(user_id, charged, created_at);

ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON usage_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- Allow service role to insert (server-side tracking)
CREATE POLICY "Service can insert usage" ON usage_ledger
  FOR INSERT WITH CHECK (true);
