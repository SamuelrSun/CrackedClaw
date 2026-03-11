-- Workers table: represents automated workflows displayed on the Workforce page
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Identity
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  role TEXT,
  avatar_config JSONB DEFAULT '{}',
  -- What they do
  cron_job_id TEXT,
  workflow_type TEXT DEFAULT 'cron',
  schedule TEXT,
  schedule_cron TEXT,
  -- Status
  status TEXT DEFAULT 'idle' CHECK (status IN ('active', 'idle', 'error', 'paused')),
  last_active_at TIMESTAMPTZ,
  last_result TEXT,
  error_message TEXT,
  -- Stats
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  -- Display
  desk_position INTEGER,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workers_user_id ON workers(user_id);
CREATE INDEX idx_workers_status ON workers(user_id, status);

-- RLS
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own workers" ON workers FOR ALL USING (auth.uid() = user_id);

-- Worker activity log
CREATE TABLE IF NOT EXISTS worker_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT DEFAULT 'run',
  summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_worker_activity_worker ON worker_activity(worker_id, created_at DESC);
CREATE INDEX idx_worker_activity_user ON worker_activity(user_id);

ALTER TABLE worker_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own worker activity" ON worker_activity FOR ALL USING (auth.uid() = user_id);
