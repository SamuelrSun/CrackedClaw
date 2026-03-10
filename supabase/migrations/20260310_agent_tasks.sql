CREATE TABLE agent_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id text,
  conversation_id uuid,
  name text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  prompt text,
  result text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX agent_tasks_user_id_idx ON agent_tasks (user_id);
CREATE INDEX agent_tasks_conversation_id_idx ON agent_tasks (conversation_id);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON agent_tasks FOR ALL USING (auth.uid() = user_id);
