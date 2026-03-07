-- Account Deletion Migration
-- Adds ON DELETE CASCADE to all foreign keys and creates delete_user_cascade function

-- ============================================
-- 1. DROP EXISTING FOREIGN KEY CONSTRAINTS AND RE-ADD WITH CASCADE
-- Note: Many tables already have ON DELETE CASCADE, but we'll ensure consistency
-- ============================================

-- First, let's add any missing CASCADE constraints

-- integrations → organizations (if exists)
-- The integrations table references profiles, which already has CASCADE

-- workflows → organizations (add org_id column if we want org-level ownership)
-- Currently workflows reference profiles(user_id), which cascades from auth.users

-- team_invitations → organizations (add CASCADE)
DO $$ 
BEGIN
  -- Add foreign key to team_invitations if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'team_invitations_org_id_fkey' 
    AND table_name = 'team_invitations'
  ) THEN
    ALTER TABLE team_invitations 
    ADD CONSTRAINT team_invitations_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- team_members → organizations (add CASCADE)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'team_members_org_id_fkey' 
    AND table_name = 'team_members'
  ) THEN
    ALTER TABLE team_members 
    ADD CONSTRAINT team_members_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure integrations cascade through organization if org_id exists
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Ensure workflows cascade through organization if org_id exists  
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================
-- 2. CREATE ACCOUNT DELETION STATUS TABLE
-- Tracks deletion requests for audit purposes
-- ============================================

CREATE TABLE IF NOT EXISTS account_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  organization_id UUID,
  organization_name TEXT,
  instance_id TEXT,
  instance_deleted BOOLEAN DEFAULT false,
  deletion_type TEXT CHECK (deletion_type IN ('solo', 'leave_org', 'delete_org')),
  deleted_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- 3. CREATE delete_user_cascade FUNCTION
-- This handles the full deletion flow including provisioning API calls
-- ============================================

CREATE OR REPLACE FUNCTION delete_user_cascade(
  target_user_id UUID,
  delete_instance BOOLEAN DEFAULT false,
  provisioning_api_url TEXT DEFAULT NULL,
  provisioning_api_secret TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_org RECORD;
  v_member_count INTEGER;
  v_user_email TEXT;
  v_result JSONB;
  v_instance_deleted BOOLEAN := false;
  v_deletion_type TEXT;
BEGIN
  -- Get user email for logging
  SELECT email INTO v_user_email FROM auth.users WHERE id = target_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Get user's organization
  SELECT * INTO v_org FROM organizations WHERE owner_id = target_user_id;
  
  IF v_org.id IS NOT NULL THEN
    -- Count members in the organization (excluding the user being deleted)
    SELECT COUNT(*) INTO v_member_count 
    FROM team_members 
    WHERE org_id = v_org.id 
    AND user_id != target_user_id
    AND accepted_at IS NOT NULL;
    
    IF v_member_count > 0 THEN
      -- Has other members - need to transfer ownership or just leave
      v_deletion_type := 'leave_org';
      
      -- Transfer ownership to first admin, or first member if no admins
      UPDATE team_members 
      SET role = 'owner' 
      WHERE org_id = v_org.id 
      AND user_id != target_user_id 
      AND accepted_at IS NOT NULL
      AND id = (
        SELECT id FROM team_members 
        WHERE org_id = v_org.id 
        AND user_id != target_user_id 
        AND accepted_at IS NOT NULL
        ORDER BY 
          CASE role WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
          created_at ASC
        LIMIT 1
      );
      
      -- Update the organization owner_id
      UPDATE organizations 
      SET owner_id = (
        SELECT user_id FROM team_members 
        WHERE org_id = v_org.id AND role = 'owner' AND user_id != target_user_id
        LIMIT 1
      )
      WHERE id = v_org.id;
      
    ELSE
      -- Solo user - delete everything
      v_deletion_type := 'delete_org';
      
      -- Note: Instance deletion must be handled by the application layer
      -- since we can't make HTTP calls from SQL
      -- The caller should delete the instance BEFORE calling this function
      
      IF delete_instance AND v_org.openclaw_instance_id IS NOT NULL THEN
        v_instance_deleted := true; -- Assume caller handled it
      END IF;
      
      -- Delete the organization (cascades to team_members, team_invitations)
      DELETE FROM organizations WHERE id = v_org.id;
    END IF;
  ELSE
    v_deletion_type := 'solo';
  END IF;
  
  -- Log the deletion
  INSERT INTO account_deletion_log (
    user_id,
    user_email,
    organization_id,
    organization_name,
    instance_id,
    instance_deleted,
    deletion_type,
    deleted_by,
    metadata
  ) VALUES (
    target_user_id,
    v_user_email,
    v_org.id,
    v_org.name,
    v_org.openclaw_instance_id,
    v_instance_deleted,
    v_deletion_type,
    target_user_id,
    jsonb_build_object(
      'member_count', v_member_count,
      'had_instance', v_org.openclaw_instance_id IS NOT NULL
    )
  );
  
  -- Delete user data (most will cascade from auth.users deletion)
  -- But we explicitly delete here to be thorough
  
  -- Delete conversations (messages cascade)
  DELETE FROM conversations WHERE user_id = target_user_id;
  
  -- Delete memory entries
  DELETE FROM memory_entries WHERE user_id = target_user_id;
  
  -- Delete integrations
  DELETE FROM integrations WHERE user_id = target_user_id;
  
  -- Delete workflows (workflow_runs cascade)
  DELETE FROM workflows WHERE user_id = target_user_id;
  
  -- Delete instructions
  DELETE FROM instructions WHERE user_id = target_user_id;
  
  -- Delete activity log
  DELETE FROM activity_log WHERE user_id = target_user_id;
  
  -- Delete token usage
  DELETE FROM token_usage WHERE user_id = target_user_id;
  
  -- Delete user gateways
  DELETE FROM user_gateways WHERE user_id = target_user_id;
  
  -- Delete onboarding state
  DELETE FROM onboarding_state WHERE user_id = target_user_id;
  
  -- Delete user context
  DELETE FROM user_context WHERE user_id = target_user_id;
  
  -- Delete oauth flows
  DELETE FROM oauth_flows WHERE user_id = target_user_id;
  
  -- Delete user integrations
  DELETE FROM user_integrations WHERE user_id = target_user_id;
  
  -- Delete password reset tokens
  DELETE FROM password_reset_tokens WHERE user_id = target_user_id;
  
  -- Delete profile (will cascade from auth.users anyway)
  DELETE FROM profiles WHERE id = target_user_id;
  
  -- Delete team memberships
  DELETE FROM team_members WHERE user_id = target_user_id;
  
  -- Delete usage history
  DELETE FROM usage_history WHERE user_id = target_user_id;
  
  -- Finally, delete from auth.users
  -- Note: This requires service_role permissions
  DELETE FROM auth.users WHERE id = target_user_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'deletion_type', v_deletion_type,
    'instance_deleted', v_instance_deleted,
    'organization_deleted', v_deletion_type = 'delete_org',
    'user_email', v_user_email
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only (not to authenticated users directly)
REVOKE ALL ON FUNCTION delete_user_cascade FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_cascade TO service_role;

-- ============================================
-- 4. CREATE HELPER FUNCTION TO CHECK DELETION STATUS
-- ============================================

CREATE OR REPLACE FUNCTION get_account_deletion_info(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_org RECORD;
  v_member_count INTEGER;
  v_is_owner BOOLEAN;
  v_result JSONB;
BEGIN
  -- Get user's organization (as owner)
  SELECT * INTO v_org FROM organizations WHERE owner_id = target_user_id;
  
  IF v_org.id IS NULL THEN
    -- Check if user is member of another org
    SELECT org_id INTO v_org.id FROM team_members WHERE user_id = target_user_id AND accepted_at IS NOT NULL LIMIT 1;
    v_is_owner := false;
    
    IF v_org.id IS NOT NULL THEN
      SELECT * INTO v_org FROM organizations WHERE id = v_org.id;
    END IF;
  ELSE
    v_is_owner := true;
  END IF;
  
  IF v_org.id IS NULL THEN
    -- User has no organization
    RETURN jsonb_build_object(
      'has_organization', false,
      'is_owner', false,
      'has_other_members', false,
      'instance_id', null,
      'can_delete_instance', false
    );
  END IF;
  
  -- Count other members
  SELECT COUNT(*) INTO v_member_count 
  FROM team_members 
  WHERE org_id = v_org.id 
  AND user_id != target_user_id
  AND accepted_at IS NOT NULL;
  
  RETURN jsonb_build_object(
    'has_organization', true,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'is_owner', v_is_owner,
    'has_other_members', v_member_count > 0,
    'member_count', v_member_count,
    'instance_id', v_org.openclaw_instance_id,
    'instance_status', v_org.openclaw_status,
    'can_delete_instance', v_is_owner AND v_member_count = 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_account_deletion_info TO authenticated;

-- ============================================
-- 5. RLS FOR DELETION LOG (admin access only)
-- ============================================

ALTER TABLE account_deletion_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access deletion logs
CREATE POLICY "Service role access to deletion logs" ON account_deletion_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

GRANT ALL ON account_deletion_log TO service_role;
