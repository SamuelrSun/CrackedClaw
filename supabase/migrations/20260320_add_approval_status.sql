ALTER TABLE campaign_leads 
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' 
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Existing leads are auto-approved, new discoveries start as pending
COMMENT ON COLUMN campaign_leads.approval_status IS 'pending = awaiting user review, approved = in main dataset, rejected = discarded';
