-- OpenClaw instance mapping: links users to their provisioned gateway instances
CREATE TABLE IF NOT EXISTS openclaw_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  instance_id text NOT NULL, -- e.g. "oc-f2da86c0"
  host text DEFAULT '164.92.75.153',
  port integer NOT NULL,
  gateway_token text NOT NULL,
  status text DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'error')),
  model text DEFAULT 'claude-sonnet-4',
  skills_installed text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX openclaw_instances_user_idx ON openclaw_instances (user_id, status);
CREATE UNIQUE INDEX openclaw_instances_instance_idx ON openclaw_instances (instance_id);

ALTER TABLE openclaw_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own instances" ON openclaw_instances FOR ALL USING (auth.uid() = user_id);
