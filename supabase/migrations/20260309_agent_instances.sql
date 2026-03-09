CREATE TABLE agent_instances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  task text NOT NULL,
  status text DEFAULT 'running' CHECK (status IN ('running', 'idle', 'done', 'failed', 'scheduled')),
  model text DEFAULT 'claude-sonnet-4-20250514',
  position_x integer DEFAULT 0,
  position_y integer DEFAULT 0,
  integrations text[],
  schedule_cron text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE agent_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid REFERENCES agent_instances(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agents" ON agent_instances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own agent messages" ON agent_messages FOR ALL
  USING (agent_id IN (SELECT id FROM agent_instances WHERE user_id = auth.uid()));
