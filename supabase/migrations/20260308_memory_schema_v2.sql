-- Add rich metadata columns to user_memory
ALTER TABLE public.user_memory 
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'fact',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS importance integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS summary text;

-- category values: 'credential' | 'preference' | 'project' | 'contact' | 'fact' | 'context' | 'schedule'
-- source values: 'chat' | 'scan' | 'user_input'
-- importance: 1 (trivial) to 5 (critical)

-- Index for fast category filtering
CREATE INDEX IF NOT EXISTS idx_user_memory_category ON public.user_memory(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_memory_importance ON public.user_memory(user_id, importance DESC);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_user_memory_search ON public.user_memory 
  USING gin(to_tsvector('english', coalesce(key, '') || ' ' || coalesce(value, '') || ' ' || coalesce(summary, '')));
