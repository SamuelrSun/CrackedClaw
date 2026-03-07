-- Add status field to workflows table
ALTER TABLE workflows 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending'));

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
