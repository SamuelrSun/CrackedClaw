-- Add preference_type to memories for brain criteria
ALTER TABLE memories ADD COLUMN IF NOT EXISTS preference_type text DEFAULT 'general';
-- Values: 'personality' | 'process' | 'style' | 'criteria' | 'knowledge' | 'general'

-- Add preference_type to brain_patterns
ALTER TABLE brain_patterns ADD COLUMN IF NOT EXISTS preference_type text DEFAULT 'general';

-- Index for type-based retrieval
CREATE INDEX IF NOT EXISTS idx_memories_preference_type ON memories (user_id, preference_type) WHERE memory_type = 'criterion';
