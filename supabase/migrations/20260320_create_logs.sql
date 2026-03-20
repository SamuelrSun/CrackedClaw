CREATE TABLE IF NOT EXISTS campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_id 
  ON campaign_logs(campaign_id, created_at DESC);

COMMENT ON TABLE campaign_logs IS 
  'Activity log for each campaign — enrichment, scoring, criteria changes, discovery, feedback';
COMMENT ON COLUMN campaign_logs.action IS 
  'enrichment | scoring | criteria_updated | lead_discovered | feedback_processed | draft_generated | workflow_saved | style_extracted';
