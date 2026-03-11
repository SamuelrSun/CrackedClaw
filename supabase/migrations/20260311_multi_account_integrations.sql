-- Migration: Multi-Account Integration Support
-- Allows users to connect multiple accounts per provider

-- ============================================================
-- 1. Drop old unique constraint and add new partial indexes
-- ============================================================

ALTER TABLE user_integrations DROP CONSTRAINT IF EXISTS user_integrations_user_id_provider_key;

-- Unique constraint for rows with account_id: no duplicate accounts per provider per user
CREATE UNIQUE INDEX idx_user_integrations_unique_account
  ON user_integrations(user_id, provider, account_id)
  WHERE account_id IS NOT NULL;

-- For rows without account_id, keep old behavior (one per provider per user)
CREATE UNIQUE INDEX idx_user_integrations_unique_null_account
  ON user_integrations(user_id, provider)
  WHERE account_id IS NULL;

-- ============================================================
-- 2. Add is_default column
-- ============================================================

ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Set existing integrations as default (earliest created per user+provider)
UPDATE user_integrations SET is_default = true WHERE id IN (
  SELECT DISTINCT ON (user_id, provider) id
  FROM user_integrations
  ORDER BY user_id, provider, created_at ASC
);

-- ============================================================
-- 3. Expand provider CHECK constraints on both tables
-- ============================================================

ALTER TABLE user_integrations DROP CONSTRAINT IF EXISTS user_integrations_provider_check;
ALTER TABLE oauth_flows DROP CONSTRAINT IF EXISTS oauth_flows_provider_check;

ALTER TABLE user_integrations ADD CONSTRAINT user_integrations_provider_check
  CHECK (provider IN ('google', 'slack', 'notion', 'github', 'microsoft365', 'linear', 'discord', 'zoom', 'twitter', 'hubspot', 'jira', 'figma', 'reddit'));

ALTER TABLE oauth_flows ADD CONSTRAINT oauth_flows_provider_check
  CHECK (provider IN ('google', 'slack', 'notion', 'github', 'microsoft365', 'linear', 'discord', 'zoom', 'twitter', 'hubspot', 'jira', 'figma', 'reddit'));
