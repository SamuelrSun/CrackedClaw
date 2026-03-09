-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,  -- The actual memory text: "Sam prefers morning meetings"
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension (1536); Voyage-3-lite uses 512
  domain text DEFAULT 'general', -- email, calendar, coding, job_search, sales, fenna, general
  metadata jsonb DEFAULT '{}', -- extra context: source conversation, timestamp, etc.
  importance float DEFAULT 0.5, -- 0-1 score for prioritization
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  accessed_at timestamptz DEFAULT now() -- for LRU-style relevance
);

-- Index for fast vector similarity search
CREATE INDEX memories_embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for filtering by user + domain
CREATE INDEX memories_user_domain_idx ON memories (user_id, domain);

-- RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own memories" ON memories FOR ALL USING (auth.uid() = user_id);

-- Function for similarity search
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_domain text DEFAULT NULL,
  match_limit int DEFAULT 5,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  content text,
  domain text,
  metadata jsonb,
  importance float,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.domain,
    m.metadata,
    m.importance,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE m.user_id = match_user_id
    AND (match_domain IS NULL OR m.domain = match_domain)
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_limit;
END;
$$;
