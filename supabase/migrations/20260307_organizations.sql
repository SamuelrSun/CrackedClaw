-- Organizations table for managing OpenClaw cloud instances
-- Each organization can have one OpenClaw instance provisioned

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'starter',
  
  -- OpenClaw instance details
  openclaw_instance_id TEXT,
  openclaw_gateway_url TEXT,
  openclaw_auth_token TEXT,
  openclaw_status TEXT DEFAULT 'not_provisioned',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add organization_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policies: users can view/edit their own organization
CREATE POLICY "Users can view own organization" ON organizations
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can update own organization" ON organizations
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own organization" ON organizations
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own organization" ON organizations
  FOR DELETE USING (owner_id = auth.uid());

-- Function to generate a unique slug from name
CREATE OR REPLACE FUNCTION generate_org_slug(org_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert name to lowercase, replace spaces with dashes, remove special chars
  base_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  -- If empty, use random string
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'org';
  END IF;
  
  -- Try base slug first
  final_slug := base_slug;
  
  -- Check for conflicts and add suffix if needed
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;
