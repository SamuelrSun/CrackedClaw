-- Campaign datasets table for storing parsed CSV/Google Sheet data
CREATE TABLE IF NOT EXISTS campaign_datasets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'google_sheet')),
  source_url TEXT,
  source_name TEXT,
  columns JSONB NOT NULL DEFAULT '[]',
  rows JSONB NOT NULL DEFAULT '[]',
  row_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaign_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaign datasets" ON campaign_datasets
  FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

-- Index for fast lookups by campaign_id
CREATE INDEX IF NOT EXISTS campaign_datasets_campaign_id_idx ON campaign_datasets(campaign_id);
