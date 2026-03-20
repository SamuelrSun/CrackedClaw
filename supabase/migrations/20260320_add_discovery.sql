-- Phase 4: Add discovery metadata to campaign_leads
ALTER TABLE campaign_leads
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'dataset',
  ADD COLUMN IF NOT EXISTS discovery_method TEXT;

-- Index for fast deduplication checks
CREATE INDEX IF NOT EXISTS idx_campaign_leads_profile_url
  ON campaign_leads(campaign_id, profile_url)
  WHERE profile_url IS NOT NULL;

COMMENT ON COLUMN campaign_leads.source IS 'dataset | agent_discovery | manual';
COMMENT ON COLUMN campaign_leads.discovery_method IS 'google_maps | linkedin | web_search | twitter | slack | github | other';
