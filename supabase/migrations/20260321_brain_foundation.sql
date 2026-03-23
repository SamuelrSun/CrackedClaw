-- Brain feature: temporal + hierarchical context support
ALTER TABLE memories ADD COLUMN IF NOT EXISTS context_scope jsonb DEFAULT '{}';
-- e.g. {"domain": "email", "subdomain": "professional", "context": "fundraising"}

ALTER TABLE memories ADD COLUMN IF NOT EXISTS valid_from timestamptz DEFAULT now();
ALTER TABLE memories ADD COLUMN IF NOT EXISTS valid_until timestamptz;  -- null = still valid
ALTER TABLE memories ADD COLUMN IF NOT EXISTS correction_count int DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'fact';
-- memory_type: 'fact' | 'criterion' | 'preference' | 'anti_pattern' | 'style'

-- Index for brain queries
CREATE INDEX IF NOT EXISTS idx_memories_brain ON memories (user_id, memory_type) WHERE valid_until IS NULL;
CREATE INDEX IF NOT EXISTS idx_memories_context_scope ON memories USING gin (context_scope);
