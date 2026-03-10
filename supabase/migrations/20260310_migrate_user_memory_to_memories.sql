-- Migrate existing user_memory entries to memories table
-- Note: embeddings will be NULL — they'll be generated on first access/update
INSERT INTO memories (user_id, content, domain, importance, metadata, created_at, updated_at)
SELECT
  user_id,
  key || ': ' || value,
  CASE category
    WHEN 'credential' THEN 'general'
    WHEN 'preference' THEN 'general'
    WHEN 'project' THEN 'coding'
    WHEN 'contact' THEN 'email'
    WHEN 'fact' THEN 'general'
    WHEN 'context' THEN 'general'
    WHEN 'schedule' THEN 'calendar'
    WHEN 'personal' THEN 'general'
    ELSE 'general'
  END,
  importance::float / 5.0,  -- convert 1-5 to 0-1
  jsonb_build_object('source', coalesce(source, 'chat'), 'migrated_from', 'user_memory', 'original_category', category, 'tags', coalesce(tags, '{}'::text[])),
  created_at,
  updated_at
FROM user_memory
WHERE NOT EXISTS (
  SELECT 1 FROM memories m WHERE m.user_id = user_memory.user_id AND m.content = user_memory.key || ': ' || user_memory.value
);
