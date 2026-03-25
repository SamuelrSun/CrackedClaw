-- Brain API keys table — allows external tools to authenticate with the Brain API
CREATE TABLE IF NOT EXISTS brain_api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text DEFAULT 'Default',
  scopes text[] DEFAULT '{read,write}',
  last_used_at timestamptz,
  request_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_brain_api_keys_hash ON brain_api_keys (key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brain_api_keys_user ON brain_api_keys (user_id) WHERE revoked_at IS NULL;

ALTER TABLE brain_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own keys" ON brain_api_keys FOR ALL USING (auth.uid() = user_id);

-- Add source column to brain_signals (needed for Phase 5 — tracks origin of signals)
ALTER TABLE brain_signals ADD COLUMN IF NOT EXISTS source text DEFAULT 'dopl';
