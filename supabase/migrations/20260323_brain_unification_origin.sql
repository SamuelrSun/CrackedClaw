-- Brain Unification Phase 1: Add origin column to memories table for unified retrieval
-- This enables a single retrieval pipeline that distinguishes between stated facts,
-- learned preferences, and integrated data from connected services.

ALTER TABLE memories ADD COLUMN IF NOT EXISTS origin text DEFAULT 'stated';

-- Backfill existing data based on memory_type and metadata
UPDATE memories SET origin = 'learned' WHERE memory_type = 'criterion' AND origin = 'stated';
UPDATE memories SET origin = 'integrated' WHERE memory_type = 'fact' AND (metadata->>'source' = 'scan' OR metadata->>'source' = 'integration') AND origin = 'stated';
UPDATE memories SET origin = 'extracted' WHERE memory_type = 'fact' AND origin = 'stated';

-- Index for unified queries: fast lookup by user + type + origin for active memories
CREATE INDEX IF NOT EXISTS idx_memories_unified ON memories (user_id, memory_type, origin) WHERE valid_until IS NULL;
