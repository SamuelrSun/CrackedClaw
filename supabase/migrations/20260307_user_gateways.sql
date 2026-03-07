-- User Gateway Connections
-- Stores connection info for users' personal OpenClaw instances

CREATE TABLE IF NOT EXISTS user_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My OpenClaw',
  gateway_url TEXT NOT NULL,
  auth_token TEXT NOT NULL, -- encrypted in app layer
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_ping TIMESTAMPTZ,
  agent_info JSONB DEFAULT '{}'::jsonb, -- stores model, version, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- one gateway per user for now
);

CREATE INDEX IF NOT EXISTS idx_user_gateways_user_id ON user_gateways(user_id);

-- Enable RLS
ALTER TABLE user_gateways ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own gateway" ON user_gateways;
CREATE POLICY "Users can view own gateway"
  ON user_gateways FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own gateway" ON user_gateways;
CREATE POLICY "Users can insert own gateway"
  ON user_gateways FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own gateway" ON user_gateways;
CREATE POLICY "Users can update own gateway"
  ON user_gateways FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own gateway" ON user_gateways;
CREATE POLICY "Users can delete own gateway"
  ON user_gateways FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_user_gateways_updated_at ON user_gateways;
CREATE TRIGGER update_user_gateways_updated_at
  BEFORE UPDATE ON user_gateways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT ALL ON user_gateways TO anon, authenticated;
