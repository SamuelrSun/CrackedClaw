-- Add enriched data storage to campaign_datasets
ALTER TABLE campaign_datasets 
  ADD COLUMN IF NOT EXISTS enriched_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS url_columns TEXT[] NOT NULL DEFAULT '{}';

-- Add enrichment tracking index
CREATE INDEX IF NOT EXISTS idx_campaign_datasets_campaign_id 
  ON campaign_datasets(campaign_id);

-- Add enrichment_status to campaign_leads for lead-level enrichment
ALTER TABLE campaign_leads
  ADD COLUMN IF NOT EXISTS enriched_data JSONB,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

COMMENT ON COLUMN campaign_datasets.enriched_rows IS 
  'JSONB array of enriched row data. Each element: {row_index: number, data: Record<string,string>, enriched_at: string}';
COMMENT ON COLUMN campaign_datasets.url_columns IS 
  'Detected URL columns in this dataset (e.g., ["linkedin_url", "website"])';
