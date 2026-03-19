CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT DEFAULT 'setup' CHECK (status IN ('setup', 'scanning', 'active', 'paused')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS campaigns_user_slug ON campaigns(user_id, slug);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaigns" ON campaigns FOR ALL USING (auth.uid() = user_id);
