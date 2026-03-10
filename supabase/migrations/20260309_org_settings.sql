-- Add settings jsonb column to organizations for AI/channel config
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
