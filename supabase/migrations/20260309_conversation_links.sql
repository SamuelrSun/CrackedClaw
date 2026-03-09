-- Conversation links: allows conversations to share context
CREATE TABLE IF NOT EXISTS conversation_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  target_conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  link_type text DEFAULT 'context', -- 'context', 'continuation', 'reference'
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_conversation_id, target_conversation_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_conv_links_source ON conversation_links(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_links_target ON conversation_links(target_conversation_id);

-- RLS: users can only see/manage their own conversation links
ALTER TABLE conversation_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation links"
  ON conversation_links FOR SELECT
  USING (
    source_conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own conversation links"
  ON conversation_links FOR INSERT
  WITH CHECK (
    source_conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
    AND
    target_conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own conversation links"
  ON conversation_links FOR DELETE
  USING (
    source_conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );
