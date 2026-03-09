-- Drop the restrictive CHECK constraint on integrations.provider
-- This allows dynamic integrations (LinkedIn, Google Sheets, etc.) to be stored

-- Step 1: Drop the existing check constraint
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;

-- Step 2: Also drop the UNIQUE(user_id, provider) constraint so users can have
-- multiple dynamic integrations that resolve to different slugs
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_user_id_provider_key;

-- Step 3: Add a new unique constraint on (user_id, slug) for dynamic integrations
-- The slug is more specific than provider (e.g. "google-sheets" vs "google")
ALTER TABLE integrations ADD CONSTRAINT integrations_user_id_slug_key UNIQUE (user_id, slug);

-- Step 4: Make provider nullable for dynamic integrations (they use slug instead)
ALTER TABLE integrations ALTER COLUMN provider DROP NOT NULL;
