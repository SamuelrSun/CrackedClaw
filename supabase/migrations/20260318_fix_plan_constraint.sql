-- Fix plan CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'power'));

-- Add credit tracking columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_grant_used BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_pool_credits INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pool_last_reset TIMESTAMPTZ DEFAULT NOW();
