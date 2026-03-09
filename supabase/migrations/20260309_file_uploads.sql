-- File uploads table (alternate schema for direct Supabase Storage uploads)
-- Note: the primary files table already exists; this adds the uploaded_files
-- table for the chat file-upload feature with public_url support.

CREATE TABLE IF NOT EXISTS uploaded_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  storage_path text NOT NULL,
  public_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own files" ON uploaded_files
  FOR ALL USING (auth.uid() = user_id);

-- Storage buckets (run in Supabase dashboard if not already created):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('user-files', 'user-files', false) ON CONFLICT DO NOTHING;
