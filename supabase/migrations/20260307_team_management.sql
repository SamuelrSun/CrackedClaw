-- ============================================
-- TEAM MANAGEMENT TABLES
-- ============================================

-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,  -- Organization/team ID (can be same as owner's user_id)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_org_id ON team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

-- Team Invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_org_id ON team_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires_at ON team_invitations(expires_at);

-- Updated_at trigger for team_members
DROP TRIGGER IF EXISTS update_team_members_updated_at ON team_members;
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: TEAM_MEMBERS
-- ============================================

-- Users can view team members in their organization
DROP POLICY IF EXISTS "Users can view org team members" ON team_members;
CREATE POLICY "Users can view org team members"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.org_id = team_members.org_id
      AND tm.accepted_at IS NOT NULL
    )
  );

-- Users can insert team members in their org (owners/admins)
DROP POLICY IF EXISTS "Admins can insert team members" ON team_members;
CREATE POLICY "Admins can insert team members"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.org_id = team_members.org_id
      AND tm.role IN ('owner', 'admin')
      AND tm.accepted_at IS NOT NULL
    )
    OR
    -- Allow users to create their own org membership
    (team_members.user_id = auth.uid() AND team_members.role = 'owner')
  );

-- Owners can update team members
DROP POLICY IF EXISTS "Owners can update team members" ON team_members;
CREATE POLICY "Owners can update team members"
  ON team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.org_id = team_members.org_id
      AND tm.role = 'owner'
      AND tm.accepted_at IS NOT NULL
    )
  );

-- Owners and admins can delete team members (except owners)
DROP POLICY IF EXISTS "Admins can delete team members" ON team_members;
CREATE POLICY "Admins can delete team members"
  ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.org_id = team_members.org_id
      AND tm.role IN ('owner', 'admin')
      AND tm.accepted_at IS NOT NULL
    )
    AND team_members.role != 'owner'
  );

-- ============================================
-- RLS POLICIES: TEAM_INVITATIONS
-- ============================================

-- Users can view invitations in their org
DROP POLICY IF EXISTS "Users can view org invitations" ON team_invitations;
CREATE POLICY "Users can view org invitations"
  ON team_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.org_id = team_invitations.org_id
      AND tm.accepted_at IS NOT NULL
    )
    OR
    -- Allow users to view invitations sent to them by token
    team_invitations.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can create invitations
DROP POLICY IF EXISTS "Admins can create invitations" ON team_invitations;
CREATE POLICY "Admins can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.org_id = team_invitations.org_id
      AND tm.role IN ('owner', 'admin')
      AND tm.accepted_at IS NOT NULL
    )
  );

-- Admins can update invitations (mark as accepted)
DROP POLICY IF EXISTS "Admins can update invitations" ON team_invitations;
CREATE POLICY "Admins can update invitations"
  ON team_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.org_id = team_invitations.org_id
      AND tm.role IN ('owner', 'admin')
      AND tm.accepted_at IS NOT NULL
    )
    OR
    -- Allow invited user to accept their own invitation
    team_invitations.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can delete invitations
DROP POLICY IF EXISTS "Admins can delete invitations" ON team_invitations;
CREATE POLICY "Admins can delete invitations"
  ON team_invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.org_id = team_invitations.org_id
      AND tm.role IN ('owner', 'admin')
      AND tm.accepted_at IS NOT NULL
    )
    OR
    -- Allow invited user to decline their own invitation
    team_invitations.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON team_members TO anon, authenticated;
GRANT ALL ON team_invitations TO anon, authenticated;
