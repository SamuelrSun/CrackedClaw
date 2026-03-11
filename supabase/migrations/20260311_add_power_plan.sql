-- Add 'power' to the organizations plan CHECK constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check 
  CHECK (plan IN ('free', 'starter', 'pro', 'power', 'team', 'enterprise'));

-- Default new orgs to 'free' (was 'starter')
ALTER TABLE organizations ALTER COLUMN plan SET DEFAULT 'free';
