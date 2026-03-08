-- Dynamic integrations support
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS is_dynamic boolean DEFAULT false;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS needs_node boolean DEFAULT false;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS resolved_config jsonb;

-- Node pairings table
CREATE TABLE IF NOT EXISTS node_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  node_name text,
  capabilities text[] DEFAULT '{}',
  status text DEFAULT 'pending',
  last_seen timestamptz,
  paired_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, node_id)
);

-- Browser sessions log
CREATE TABLE IF NOT EXISTS browser_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  integration_slug text,
  status text DEFAULT 'idle',
  login_url text,
  last_action text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- RLS
ALTER TABLE node_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users own their node pairings" ON node_pairings FOR ALL USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Users own their browser sessions" ON browser_sessions FOR ALL USING (user_id = auth.uid());

-- Installed skills
CREATE TABLE IF NOT EXISTS installed_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id text NOT NULL,
  skill_name text NOT NULL,
  version text DEFAULT '1.0.0',
  source text DEFAULT 'builtin',
  config jsonb DEFAULT '{}',
  installed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

ALTER TABLE installed_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users own their skills" ON installed_skills FOR ALL USING (user_id = auth.uid());

-- Workflow memory
CREATE TABLE IF NOT EXISTS workflow_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_integrations text[] DEFAULT '{}',
  specific_resources jsonb DEFAULT '[]',
  execution_notes text DEFAULT '',
  success_count int DEFAULT 0,
  failure_count int DEFAULT 0,
  learnings jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Workflow run history
CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  trigger_type text DEFAULT 'manual',
  output jsonb,
  error text,
  duration_ms int,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE workflow_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users own workflow memory" ON workflow_memory FOR ALL USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Users own workflow runs" ON workflow_runs FOR ALL USING (user_id = auth.uid());

-- Files for RAG
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  size bigint NOT NULL,
  type text NOT NULL,
  mode text NOT NULL DEFAULT 'temp',
  storage_path text NOT NULL,
  url text,
  conversation_id uuid,
  embedding_status text DEFAULT 'pending',
  chunk_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS file_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES files(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index int NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users own their files" ON files FOR ALL USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Users own their chunks" ON file_chunks FOR ALL USING (user_id = auth.uid());
