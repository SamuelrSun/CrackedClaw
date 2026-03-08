-- Fix: organizations.owner_id should cascade delete when user is deleted
ALTER TABLE public.organizations 
  DROP CONSTRAINT IF EXISTS organizations_owner_id_fkey;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_owner_id_fkey 
  FOREIGN KEY (owner_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
