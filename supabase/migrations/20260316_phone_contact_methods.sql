-- Add phone contact method fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_pending_at TIMESTAMPTZ;

-- Index for fast lookup by phone number (for inbound SMS routing)
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);

-- NOTE: This migration needs to be applied manually to the live Supabase project.
-- Project ref: hoqawekvprpvcspdgtrf
-- Run via Supabase dashboard SQL editor or via:
--   supabase db push --db-url "postgresql://postgres.hoqawekvprpvcspdgtrf:[password]@aws-east-1.pooler.supabase.com:5432/postgres"
