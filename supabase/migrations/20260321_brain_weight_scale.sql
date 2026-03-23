-- Add explicit weight column (signed, -1.0 to 1.0) to memories
ALTER TABLE memories ADD COLUMN IF NOT EXISTS weight float DEFAULT 0.0;
-- The importance column stays for backward compat (always positive)
