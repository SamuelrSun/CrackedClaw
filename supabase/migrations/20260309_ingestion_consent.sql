-- Add scan_consent column to user_integrations
ALTER TABLE user_integrations
  ADD COLUMN IF NOT EXISTS scan_consent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN user_integrations.scan_consent IS 'Whether the user has consented to data ingestion scanning for this provider';
