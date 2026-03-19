-- Add outreach draft columns to campaign_leads table
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS draft_subject TEXT;
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS draft_body TEXT;
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS draft_channel TEXT CHECK (draft_channel IN ('email', 'linkedin', 'other'));
