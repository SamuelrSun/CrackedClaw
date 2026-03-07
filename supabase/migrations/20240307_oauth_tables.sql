-- OAuth Integration Tables for OpenClaw Cloud
-- Run this migration in your Supabase SQL editor

-- =======================
-- OAuth Flows Table
-- =======================
-- Tracks pending and completed OAuth authorization flows
CREATE TABLE IF NOT EXISTS oauth_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'slack', 'notion')),
  state TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  scopes TEXT[] DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Index for state lookups (used in callback)
CREATE INDEX IF NOT EXISTS idx_oauth_flows_state ON oauth_flows(state);

-- Index for cleanup of expired flows
CREATE INDEX IF NOT EXISTS idx_oauth_flows_expires_at ON oauth_flows(expires_at);

-- RLS Policies for oauth_flows
ALTER TABLE oauth_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own oauth flows" ON oauth_flows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own oauth flows" ON oauth_flows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own oauth flows" ON oauth_flows
  FOR UPDATE USING (auth.uid() = user_id);

-- =======================
-- User Integrations Table
-- =======================
-- Stores OAuth tokens and connected account info
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'slack', 'notion')),
  
  -- Token storage (consider encrypting access_token and refresh_token)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scope TEXT,
  
  -- Account info
  account_id TEXT,
  account_email TEXT,
  account_name TEXT,
  account_picture TEXT,
  team_id TEXT,
  team_name TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  
  -- Raw response for debugging
  raw_response JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each user can only have one integration per provider
  UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider 
  ON user_integrations(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_user_integrations_status 
  ON user_integrations(status);

-- RLS Policies for user_integrations
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations" ON user_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own integrations" ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations" ON user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations" ON user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- =======================
-- Cleanup Function
-- =======================
-- Function to clean up expired OAuth flows (run periodically via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_flows()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_flows 
  WHERE expires_at < NOW() AND status = 'pending';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- Comments
-- =======================
COMMENT ON TABLE oauth_flows IS 'Tracks OAuth authorization flows with state tokens';
COMMENT ON TABLE user_integrations IS 'Stores OAuth tokens and connected account info';
COMMENT ON COLUMN user_integrations.access_token IS 'OAuth access token - consider encryption at rest';
COMMENT ON COLUMN user_integrations.refresh_token IS 'OAuth refresh token for Google - consider encryption at rest';
