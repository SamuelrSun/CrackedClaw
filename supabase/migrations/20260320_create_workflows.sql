CREATE TABLE IF NOT EXISTS campaign_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discovery', 'enrichment', 'outreach', 'custom')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_criteria TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'agent_inferred',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_workflows_campaign_id
  ON campaign_workflows(campaign_id);

COMMENT ON TABLE campaign_workflows IS
  'Extracted workflows for a campaign — how the user discovers, enriches, and contacts leads';
