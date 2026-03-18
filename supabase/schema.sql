-- OpenClaw Cloud Database Schema
-- Run this in Supabase SQL Editor or via `supabase db push`
-- Last updated: 2026-03-13 — expanded from 8 tables to 26+ to match codebase reality

-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'power')),
  -- Billing / Stripe columns (added Session 13)
  plan_status TEXT DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  -- OpenClaw Gateway / instance columns (added Session 13)
  instance_id TEXT,
  gateway_url TEXT,
  auth_token TEXT,
  instance_status TEXT DEFAULT 'pending',
  instance_settings JSONB DEFAULT '{}'::jsonb,
  -- Credit system columns
  welcome_grant_used BOOLEAN DEFAULT FALSE,
  monthly_pool_credits INTEGER DEFAULT 0,
  pool_last_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ============================================
-- 2. INTEGRATIONS (Dynamic - any type, any config)
-- ============================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT DEFAULT '🔗',
  type TEXT NOT NULL CHECK (type IN ('oauth', 'api_key', 'browser', 'file', 'webhook', 'hybrid')),
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connected', 'error', 'syncing')),
  config JSONB DEFAULT '{}'::jsonb,
  accounts JSONB DEFAULT '[]'::jsonb,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_slug ON integrations(slug);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- ============================================
-- 3. MEMORY_ENTRIES
-- ============================================
CREATE TABLE IF NOT EXISTS memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_entries_user_id ON memory_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_category ON memory_entries(category);

-- ============================================
-- 4. INSTRUCTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instructions_user_id ON instructions(user_id);

-- ============================================
-- 5. CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- ============================================
-- 6. MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================
-- 7. WORKFLOWS
-- ============================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  status TEXT DEFAULT 'inactive',  -- e.g. 'active', 'inactive', 'running'
  config JSONB DEFAULT '{}'::jsonb,
  schedule TEXT,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);

-- ============================================
-- 8. WORKFLOW_RUNS
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- added for user-scoped queries/cascade
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'success')),
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integrations_updated_at ON integrations;
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memory_entries_updated_at ON memory_entries;
CREATE TRIGGER update_memory_entries_updated_at
  BEFORE UPDATE ON memory_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_instructions_updated_at ON instructions;
CREATE TRIGGER update_instructions_updated_at
  BEFORE UPDATE ON instructions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: PROFILES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- RLS POLICIES: INTEGRATIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view own integrations" ON integrations;
CREATE POLICY "Users can view own integrations"
  ON integrations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own integrations" ON integrations;
CREATE POLICY "Users can insert own integrations"
  ON integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own integrations" ON integrations;
CREATE POLICY "Users can update own integrations"
  ON integrations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own integrations" ON integrations;
CREATE POLICY "Users can delete own integrations"
  ON integrations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: MEMORY_ENTRIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own memory entries" ON memory_entries;
CREATE POLICY "Users can view own memory entries"
  ON memory_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own memory entries" ON memory_entries;
CREATE POLICY "Users can insert own memory entries"
  ON memory_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own memory entries" ON memory_entries;
CREATE POLICY "Users can update own memory entries"
  ON memory_entries FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own memory entries" ON memory_entries;
CREATE POLICY "Users can delete own memory entries"
  ON memory_entries FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: INSTRUCTIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view own instructions" ON instructions;
CREATE POLICY "Users can view own instructions"
  ON instructions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own instructions" ON instructions;
CREATE POLICY "Users can insert own instructions"
  ON instructions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own instructions" ON instructions;
CREATE POLICY "Users can update own instructions"
  ON instructions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own instructions" ON instructions;
CREATE POLICY "Users can delete own instructions"
  ON instructions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: CONVERSATIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: MESSAGES
-- ============================================
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON messages;
CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON messages;
CREATE POLICY "Users can delete messages in own conversations"
  ON messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES: WORKFLOWS
-- ============================================
DROP POLICY IF EXISTS "Users can view own workflows" ON workflows;
CREATE POLICY "Users can view own workflows"
  ON workflows FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own workflows" ON workflows;
CREATE POLICY "Users can insert own workflows"
  ON workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workflows" ON workflows;
CREATE POLICY "Users can update own workflows"
  ON workflows FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own workflows" ON workflows;
CREATE POLICY "Users can delete own workflows"
  ON workflows FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: WORKFLOW_RUNS
-- ============================================
DROP POLICY IF EXISTS "Users can view runs of own workflows" ON workflow_runs;
CREATE POLICY "Users can view runs of own workflows"
  ON workflow_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_runs.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert runs for own workflows" ON workflow_runs;
CREATE POLICY "Users can insert runs for own workflows"
  ON workflow_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_runs.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update runs of own workflows" ON workflow_runs;
CREATE POLICY "Users can update runs of own workflows"
  ON workflow_runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_runs.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete runs of own workflows" ON workflow_runs;
CREATE POLICY "Users can delete runs of own workflows"
  ON workflow_runs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_runs.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

-- ============================================
-- 9. MEMORIES (Vector-backed memory store, replaces memory_entries for AI recall)
-- ============================================
-- Note: 'embedding' column requires pgvector extension. If not available, omit it.
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  -- embedding vector(1536),  -- Uncomment if pgvector is enabled
  domain TEXT,
  importance FLOAT DEFAULT 0.5,
  metadata JSONB DEFAULT '{}'::jsonb,
  key TEXT,  -- optional unique key for upsert (e.g. 'installed_skills')
  type TEXT DEFAULT 'fact',  -- 'fact', 'system', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (user_id, key)  -- only enforced when key is not null
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_domain ON memories(domain);
CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(user_id, key) WHERE key IS NOT NULL;

-- ============================================
-- 10. USER_INTEGRATIONS (OAuth token store — actual connected accounts)
-- ============================================
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,          -- e.g. 'google', 'slack', 'microsoft'
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scope TEXT,
  account_id TEXT,                 -- provider's user/account ID
  account_email TEXT,
  account_name TEXT,
  account_picture TEXT,
  team_id TEXT,
  team_name TEXT,
  status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'pending')),
  raw_response TEXT,               -- raw OAuth token response JSON
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON user_integrations(status);
CREATE INDEX IF NOT EXISTS idx_user_integrations_account_id ON user_integrations(user_id, provider, account_id);

-- ============================================
-- 11. OAUTH_FLOWS (Pending OAuth state machine)
-- ============================================
CREATE TABLE IF NOT EXISTS oauth_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  state TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  scopes TEXT[] DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_oauth_flows_state ON oauth_flows(state);
CREATE INDEX IF NOT EXISTS idx_oauth_flows_user_id ON oauth_flows(user_id);

-- ============================================
-- 12. USER_GATEWAYS (Self-hosted OpenClaw gateway connections)
-- ============================================
CREATE TABLE IF NOT EXISTS user_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gateway_url TEXT NOT NULL,
  auth_token TEXT,
  name TEXT DEFAULT 'My OpenClaw',
  status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_ping TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_gateways_user_id ON user_gateways(user_id);

-- ============================================
-- 13. USER_SECRETS (Encrypted key-value secrets per user)
-- ============================================
CREATE TABLE IF NOT EXISTS user_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_secrets_user_id ON user_secrets(user_id);

-- ============================================
-- 14. USER_USAGE (Daily token/message usage per user)
-- ============================================
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_date ON user_usage(user_id, date);

-- RPC helper: increment_usage (called by usage tracker)
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_date DATE,
  p_messages INTEGER DEFAULT 0,
  p_tokens INTEGER DEFAULT 0,
  p_tool_calls INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_usage (user_id, date, messages_sent, tokens_used, tool_calls)
  VALUES (p_user_id, p_date, p_messages, p_tokens, p_tool_calls)
  ON CONFLICT (user_id, date) DO UPDATE SET
    messages_sent = user_usage.messages_sent + EXCLUDED.messages_sent,
    tokens_used   = user_usage.tokens_used   + EXCLUDED.tokens_used,
    tool_calls    = user_usage.tool_calls    + EXCLUDED.tool_calls,
    updated_at    = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 15. TOKEN_USAGE (Monthly token quota per user, legacy)
-- ============================================
CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  used INTEGER DEFAULT 0,
  limit_amount INTEGER DEFAULT 1000000,
  reset_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);

-- ============================================
-- 16. USAGE_HISTORY (Daily token usage history for charting)
-- ============================================
CREATE TABLE IF NOT EXISTS usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_history_user_id ON usage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_date ON usage_history(user_id, date);

-- ============================================
-- 17. ACTIVITY_LOG (User-facing action audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,   -- e.g. 'workflow.run', 'memory.add'
  detail TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);

-- ============================================
-- 18. SCAN_LOGS (Integration/memory scan history)
-- ============================================
CREATE TABLE IF NOT EXISTS scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT,                    -- e.g. 'quick', 'deep'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  target_provider TEXT,         -- e.g. 'google', 'slack'
  total_memories INTEGER DEFAULT 0,
  duration_ms INTEGER,
  results_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scan_logs_user_id ON scan_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_created_at ON scan_logs(user_id, created_at DESC);

-- ============================================
-- 19. AGENT_INSTANCES (Canvas-style autonomous agents)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  task TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'idle', 'completed', 'failed', 'stopped')),
  model TEXT,
  position_x FLOAT DEFAULT 40,
  position_y FLOAT DEFAULT 40,
  integrations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_instances_user_id ON agent_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_status ON agent_instances(status);

-- ============================================
-- 20. AGENT_MESSAGES (Messages exchanged with an agent instance)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_instances(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_agent_id ON agent_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at ON agent_messages(agent_id, created_at);

-- ============================================
-- 21. AGENT_TASKS (Background subagent task tracking with Realtime)
--     Source: supabase/migrations/20260315_agent_tasks_realtime.sql
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Background Task',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'done', 'failed', 'killed')),
  prompt TEXT,
  result TEXT,
  error TEXT,
  model TEXT,
  label TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_id ON agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_status ON agent_tasks(user_id, status);

-- Enable Realtime for live subagent card updates
ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;

-- Auto-update updated_at for agent_tasks
CREATE OR REPLACE FUNCTION update_agent_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_tasks_updated_at ON agent_tasks;
CREATE TRIGGER agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW EXECUTE FUNCTION update_agent_tasks_updated_at();

-- ============================================
-- 22. FILES (Uploaded files metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  type TEXT NOT NULL,           -- MIME type
  mode TEXT NOT NULL CHECK (mode IN ('temp', 'memory')),
  storage_path TEXT NOT NULL,   -- path within Supabase Storage bucket
  url TEXT,                     -- signed/public URL
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'complete', 'failed', 'skipped')),
  chunk_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,       -- for temp files (24h TTL)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_conversation_id ON files(conversation_id);
CREATE INDEX IF NOT EXISTS idx_files_mode ON files(user_id, mode);

-- ============================================
-- 23. FILE_CHUNKS (Text chunks extracted from files for search)
-- ============================================
CREATE TABLE IF NOT EXISTS file_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_user_id ON file_chunks(user_id);

-- ============================================
-- 24. INSTALLED_SKILLS (Skills installed per user)
-- ============================================
CREATE TABLE IF NOT EXISTS installed_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  version TEXT NOT NULL,
  source TEXT,                  -- e.g. 'registry', 'clawhub'
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_installed_skills_user_id ON installed_skills(user_id);

-- ============================================
-- 25. WORKERS (AI worker agents shown in the virtual office UI)
-- ============================================
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  role TEXT,
  avatar_config JSONB DEFAULT '{}'::jsonb,
  cron_job_id TEXT,             -- linked cron job ID from OpenClaw gateway
  workflow_type TEXT DEFAULT 'cron',
  schedule TEXT,
  schedule_cron TEXT,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'paused', 'error')),
  desk_position INTEGER,        -- order on the office desk
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  last_result TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workers_user_id ON workers(user_id);
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);

-- ============================================
-- 26. WORKER_ACTIVITY (Event log for worker actions)
-- ============================================
CREATE TABLE IF NOT EXISTS worker_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,     -- e.g. 'created', 'run', 'error'
  summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_activity_worker_id ON worker_activity(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_activity_user_id ON worker_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_activity_created_at ON worker_activity(created_at DESC);

-- ============================================
-- 27. WORKFLOW_MEMORY (Per-workflow learned execution context)
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  linked_integrations TEXT[] DEFAULT '{}',
  specific_resources JSONB DEFAULT '[]'::jsonb,
  execution_notes TEXT,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  learnings JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_memory_workflow_id ON workflow_memory(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_memory_user_id ON workflow_memory(user_id);

-- ============================================
-- 28. CRON_JOBS (Scheduled recurring jobs)
-- ============================================
CREATE TABLE IF NOT EXISTS cron_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,       -- cron expression e.g. '0 9 * * 1'
  enabled BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_user_id ON cron_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled ON cron_jobs(enabled);

-- ============================================
-- 29. CONTEXT_GATHERING_JOBS (Integration context scan jobs)
-- ============================================
CREATE TABLE IF NOT EXISTS context_gathering_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  integrations TEXT[] DEFAULT '{}',
  progress JSONB DEFAULT '{}'::jsonb,
  results JSONB DEFAULT '[]'::jsonb,
  combined_insights JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_context_gathering_jobs_user_id ON context_gathering_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_context_gathering_jobs_status ON context_gathering_jobs(status);

-- ============================================
-- 30. USER_CONTEXT (Cached integration scan results per source)
-- ============================================
CREATE TABLE IF NOT EXISTS user_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT,                  -- e.g. 'gmail', 'calendar'
  scan_type TEXT NOT NULL,      -- unique key alongside user_id
  content JSONB,
  scan_result JSONB,
  insights JSONB DEFAULT '[]'::jsonb,
  suggested_automations JSONB DEFAULT '[]'::jsonb,
  confidence FLOAT DEFAULT 1.0,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, scan_type)
);

CREATE INDEX IF NOT EXISTS idx_user_context_user_id ON user_context(user_id);
CREATE INDEX IF NOT EXISTS idx_user_context_scan_type ON user_context(user_id, scan_type);

-- ============================================
-- 31. CONVERSATION_LINKS (Links between related conversations)
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  target_conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  link_type TEXT DEFAULT 'context',  -- e.g. 'context', 'followup', 'reference'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_conversation_id, target_conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_links_source ON conversation_links(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_links_target ON conversation_links(target_conversation_id);

-- ============================================
-- 32. ACCOUNT_DELETION_LOG (Audit trail for account deletions)
-- ============================================
CREATE TABLE IF NOT EXISTS account_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  instance_id TEXT,
  deletion_type TEXT,           -- e.g. 'full_delete', 'soft_delete'
  deleted_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_log_user_id ON account_deletion_log(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_log_created_at ON account_deletion_log(created_at DESC);

-- ============================================
-- UPDATED_AT TRIGGERS for new tables
-- ============================================

DROP TRIGGER IF EXISTS update_memories_updated_at ON memories;
CREATE TRIGGER update_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_integrations_updated_at ON user_integrations;
CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_gateways_updated_at ON user_gateways;
CREATE TRIGGER update_user_gateways_updated_at
  BEFORE UPDATE ON user_gateways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_secrets_updated_at ON user_secrets;
CREATE TRIGGER update_user_secrets_updated_at
  BEFORE UPDATE ON user_secrets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_usage_updated_at ON user_usage;
CREATE TRIGGER update_user_usage_updated_at
  BEFORE UPDATE ON user_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_token_usage_updated_at ON token_usage;
CREATE TRIGGER update_token_usage_updated_at
  BEFORE UPDATE ON token_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_instances_updated_at ON agent_instances;
CREATE TRIGGER update_agent_instances_updated_at
  BEFORE UPDATE ON agent_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workers_updated_at ON workers;
CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cron_jobs_updated_at ON cron_jobs;
CREATE TRIGGER update_cron_jobs_updated_at
  BEFORE UPDATE ON cron_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_context_updated_at ON user_context;
CREATE TRIGGER update_user_context_updated_at
  BEFORE UPDATE ON user_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS: Enable on all new tables
-- ============================================
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_gathering_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_links ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: MEMORIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own memories" ON memories;
CREATE POLICY "Users can view own memories" ON memories FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own memories" ON memories;
CREATE POLICY "Users can insert own memories" ON memories FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own memories" ON memories;
CREATE POLICY "Users can update own memories" ON memories FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own memories" ON memories;
CREATE POLICY "Users can delete own memories" ON memories FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: USER_INTEGRATIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view own user_integrations" ON user_integrations;
CREATE POLICY "Users can view own user_integrations" ON user_integrations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own user_integrations" ON user_integrations;
CREATE POLICY "Users can insert own user_integrations" ON user_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own user_integrations" ON user_integrations;
CREATE POLICY "Users can update own user_integrations" ON user_integrations FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own user_integrations" ON user_integrations;
CREATE POLICY "Users can delete own user_integrations" ON user_integrations FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: OAUTH_FLOWS
-- ============================================
DROP POLICY IF EXISTS "Users can view own oauth_flows" ON oauth_flows;
CREATE POLICY "Users can view own oauth_flows" ON oauth_flows FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own oauth_flows" ON oauth_flows;
CREATE POLICY "Users can insert own oauth_flows" ON oauth_flows FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own oauth_flows" ON oauth_flows;
CREATE POLICY "Users can update own oauth_flows" ON oauth_flows FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: USER_GATEWAYS
-- ============================================
DROP POLICY IF EXISTS "Users can view own gateways" ON user_gateways;
CREATE POLICY "Users can view own gateways" ON user_gateways FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own gateways" ON user_gateways;
CREATE POLICY "Users can insert own gateways" ON user_gateways FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own gateways" ON user_gateways;
CREATE POLICY "Users can update own gateways" ON user_gateways FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own gateways" ON user_gateways;
CREATE POLICY "Users can delete own gateways" ON user_gateways FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: USER_SECRETS (service_role only reads encrypted secrets)
-- ============================================
DROP POLICY IF EXISTS "Service role manages secrets" ON user_secrets;
CREATE POLICY "Service role manages secrets" ON user_secrets FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- RLS POLICIES: USER_USAGE
-- ============================================
DROP POLICY IF EXISTS "Users can view own usage" ON user_usage;
CREATE POLICY "Users can view own usage" ON user_usage FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: TOKEN_USAGE
-- ============================================
DROP POLICY IF EXISTS "Users can view own token_usage" ON token_usage;
CREATE POLICY "Users can view own token_usage" ON token_usage FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: USAGE_HISTORY
-- ============================================
DROP POLICY IF EXISTS "Users can view own usage_history" ON usage_history;
CREATE POLICY "Users can view own usage_history" ON usage_history FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: ACTIVITY_LOG
-- ============================================
DROP POLICY IF EXISTS "Users can view own activity_log" ON activity_log;
CREATE POLICY "Users can view own activity_log" ON activity_log FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own activity_log" ON activity_log;
CREATE POLICY "Users can insert own activity_log" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: SCAN_LOGS
-- ============================================
DROP POLICY IF EXISTS "Users can view own scan_logs" ON scan_logs;
CREATE POLICY "Users can view own scan_logs" ON scan_logs FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: AGENT_INSTANCES
-- ============================================
DROP POLICY IF EXISTS "Users can view own agent_instances" ON agent_instances;
CREATE POLICY "Users can view own agent_instances" ON agent_instances FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own agent_instances" ON agent_instances;
CREATE POLICY "Users can insert own agent_instances" ON agent_instances FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own agent_instances" ON agent_instances;
CREATE POLICY "Users can update own agent_instances" ON agent_instances FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own agent_instances" ON agent_instances;
CREATE POLICY "Users can delete own agent_instances" ON agent_instances FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: AGENT_MESSAGES
-- ============================================
DROP POLICY IF EXISTS "Users can view own agent_messages" ON agent_messages;
CREATE POLICY "Users can view own agent_messages" ON agent_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM agent_instances WHERE agent_instances.id = agent_messages.agent_id AND agent_instances.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own agent_messages" ON agent_messages;
CREATE POLICY "Users can insert own agent_messages" ON agent_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM agent_instances WHERE agent_instances.id = agent_messages.agent_id AND agent_instances.user_id = auth.uid()));

-- ============================================
-- RLS POLICIES: AGENT_TASKS (from migration 20260315)
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view own tasks" ON agent_tasks FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert own tasks" ON agent_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update own tasks" ON agent_tasks FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role full access to agent_tasks" ON agent_tasks FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: FILES
-- ============================================
DROP POLICY IF EXISTS "Users can view own files" ON files;
CREATE POLICY "Users can view own files" ON files FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own files" ON files;
CREATE POLICY "Users can insert own files" ON files FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own files" ON files;
CREATE POLICY "Users can delete own files" ON files FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: FILE_CHUNKS
-- ============================================
DROP POLICY IF EXISTS "Users can view own file_chunks" ON file_chunks;
CREATE POLICY "Users can view own file_chunks" ON file_chunks FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: INSTALLED_SKILLS
-- ============================================
DROP POLICY IF EXISTS "Users can view own installed_skills" ON installed_skills;
CREATE POLICY "Users can view own installed_skills" ON installed_skills FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own installed_skills" ON installed_skills;
CREATE POLICY "Users can insert own installed_skills" ON installed_skills FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own installed_skills" ON installed_skills;
CREATE POLICY "Users can delete own installed_skills" ON installed_skills FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: WORKERS
-- ============================================
DROP POLICY IF EXISTS "Users can view own workers" ON workers;
CREATE POLICY "Users can view own workers" ON workers FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own workers" ON workers;
CREATE POLICY "Users can insert own workers" ON workers FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own workers" ON workers;
CREATE POLICY "Users can update own workers" ON workers FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own workers" ON workers;
CREATE POLICY "Users can delete own workers" ON workers FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: WORKER_ACTIVITY
-- ============================================
DROP POLICY IF EXISTS "Users can view own worker_activity" ON worker_activity;
CREATE POLICY "Users can view own worker_activity" ON worker_activity FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own worker_activity" ON worker_activity;
CREATE POLICY "Users can insert own worker_activity" ON worker_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: WORKFLOW_MEMORY
-- ============================================
DROP POLICY IF EXISTS "Users can view own workflow_memory" ON workflow_memory;
CREATE POLICY "Users can view own workflow_memory" ON workflow_memory FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own workflow_memory" ON workflow_memory;
CREATE POLICY "Users can insert own workflow_memory" ON workflow_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own workflow_memory" ON workflow_memory;
CREATE POLICY "Users can update own workflow_memory" ON workflow_memory FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: CRON_JOBS
-- ============================================
DROP POLICY IF EXISTS "Users can view own cron_jobs" ON cron_jobs;
CREATE POLICY "Users can view own cron_jobs" ON cron_jobs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own cron_jobs" ON cron_jobs;
CREATE POLICY "Users can insert own cron_jobs" ON cron_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own cron_jobs" ON cron_jobs;
CREATE POLICY "Users can update own cron_jobs" ON cron_jobs FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own cron_jobs" ON cron_jobs;
CREATE POLICY "Users can delete own cron_jobs" ON cron_jobs FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: CONTEXT_GATHERING_JOBS
-- ============================================
DROP POLICY IF EXISTS "Users can view own context_gathering_jobs" ON context_gathering_jobs;
CREATE POLICY "Users can view own context_gathering_jobs" ON context_gathering_jobs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own context_gathering_jobs" ON context_gathering_jobs;
CREATE POLICY "Users can insert own context_gathering_jobs" ON context_gathering_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: USER_CONTEXT
-- ============================================
DROP POLICY IF EXISTS "Users can view own user_context" ON user_context;
CREATE POLICY "Users can view own user_context" ON user_context FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can upsert own user_context" ON user_context;
CREATE POLICY "Users can upsert own user_context" ON user_context FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own user_context" ON user_context;
CREATE POLICY "Users can update own user_context" ON user_context FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: CONVERSATION_LINKS
-- ============================================
DROP POLICY IF EXISTS "Users can view own conversation_links" ON conversation_links;
CREATE POLICY "Users can view own conversation_links" ON conversation_links FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_links.source_conversation_id AND conversations.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own conversation_links" ON conversation_links;
CREATE POLICY "Users can insert own conversation_links" ON conversation_links FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_links.source_conversation_id AND conversations.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own conversation_links" ON conversation_links;
CREATE POLICY "Users can delete own conversation_links" ON conversation_links FOR DELETE
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_links.source_conversation_id AND conversations.user_id = auth.uid()));

-- ============================================
-- DELETE USER CASCADE FUNCTION (from migration 20260314)
-- ============================================
DROP FUNCTION IF EXISTS delete_user_cascade(UUID, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS delete_user_cascade(UUID);

CREATE OR REPLACE FUNCTION delete_user_cascade(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_email TEXT;
  v_instance_id TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = target_user_id;
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT instance_id INTO v_instance_id FROM profiles WHERE id = target_user_id;

  DELETE FROM agent_instances WHERE user_id = target_user_id;
  BEGIN DELETE FROM agent_tasks WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM conversations WHERE user_id = target_user_id;
  DELETE FROM memories WHERE user_id = target_user_id;
  BEGIN DELETE FROM user_secrets WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM file_chunks WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM files WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM user_integrations WHERE user_id = target_user_id;
  BEGIN DELETE FROM oauth_flows WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM installed_skills WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM workflow_runs WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM workflow_memory WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM workflows WHERE user_id = target_user_id;
  BEGIN DELETE FROM activity_log WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM token_usage WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_usage WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM usage_history WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM instructions WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_gateways WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_context WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM cron_jobs WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    INSERT INTO account_deletion_log (user_id, user_email, instance_id, deletion_type, deleted_by, metadata)
    VALUES (target_user_id, v_user_email, v_instance_id, 'full_delete', target_user_id,
      jsonb_build_object('had_instance', v_instance_id IS NOT NULL));
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  DELETE FROM profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'deletion_type', 'full_delete', 'user_email', v_user_email);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION delete_user_cascade(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_cascade(UUID) TO service_role;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
