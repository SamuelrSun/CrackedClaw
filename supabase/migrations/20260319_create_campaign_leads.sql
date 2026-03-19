CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  profile_url TEXT,
  profile_data JSONB DEFAULT '{}',
  rank TEXT CHECK (rank IN ('high', 'medium', 'low')),
  score NUMERIC(5,2) DEFAULT 0,
  criterion_scores JSONB DEFAULT '[]',
  reasoning TEXT,
  user_override_rank TEXT CHECK (user_override_rank IN ('high', 'medium', 'low', NULL)),
  user_feedback TEXT,
  outreach_status TEXT DEFAULT 'pending' CHECK (outreach_status IN ('pending', 'sent', 'replied', 'ignored')),
  source TEXT DEFAULT 'dataset',
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_rank ON campaign_leads(campaign_id, rank);

ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own campaign leads" ON campaign_leads
  FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );
