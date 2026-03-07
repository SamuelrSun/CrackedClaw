-- OpenClaw Cloud Context Scanners Schema
-- Extends the user_context table to support scanner results

-- ============================================================================
-- Alter user_context to support scanner results
-- ============================================================================

-- Add new columns for scanner data (if they don't exist)
ALTER TABLE public.user_context
    ADD COLUMN IF NOT EXISTS scan_type TEXT,
    ADD COLUMN IF NOT EXISTS scan_result JSONB,
    ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS suggested_automations JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Update the check constraint on source to include scanner types
-- First drop the old constraint if it exists
ALTER TABLE public.user_context DROP CONSTRAINT IF EXISTS user_context_source_check;

-- Add new constraint with all valid sources
ALTER TABLE public.user_context 
    ADD CONSTRAINT user_context_source_check 
    CHECK (source IN ('gmail', 'calendar', 'notion', 'slack', 'github', 'manual', 'drive', 'contacts'));

-- Drop the context_type constraint (we'll use scan_type instead for scanner results)
ALTER TABLE public.user_context DROP CONSTRAINT IF EXISTS user_context_context_type_check;

-- Make context_type nullable for scanner results that don't use it
ALTER TABLE public.user_context ALTER COLUMN context_type DROP NOT NULL;

-- Create a unique constraint for upsert operations (user_id + scan_type)
ALTER TABLE public.user_context DROP CONSTRAINT IF EXISTS user_context_user_scan_type_unique;
ALTER TABLE public.user_context 
    ADD CONSTRAINT user_context_user_scan_type_unique 
    UNIQUE (user_id, scan_type);

-- Index for scan_type queries
CREATE INDEX IF NOT EXISTS idx_user_context_scan_type ON public.user_context(scan_type);
CREATE INDEX IF NOT EXISTS idx_user_context_scanned_at ON public.user_context(scanned_at);

-- ============================================================================
-- TABLE: context_gathering_jobs
-- Track async context gathering jobs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.context_gathering_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    integrations JSONB DEFAULT '[]'::jsonb,
    progress JSONB DEFAULT '{}'::jsonb,
    results JSONB DEFAULT '[]'::jsonb,
    combined_insights JSONB DEFAULT '[]'::jsonb,
    suggested_workflows JSONB DEFAULT '[]'::jsonb,
    error TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_context_jobs_user_id ON public.context_gathering_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_context_jobs_status ON public.context_gathering_jobs(status);
CREATE INDEX IF NOT EXISTS idx_context_jobs_user_status ON public.context_gathering_jobs(user_id, status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_context_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_context_job_updated_at ON public.context_gathering_jobs;
CREATE TRIGGER trigger_context_job_updated_at
    BEFORE UPDATE ON public.context_gathering_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_context_job_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY for context_gathering_jobs
-- ============================================================================
ALTER TABLE public.context_gathering_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own jobs" ON public.context_gathering_jobs;
CREATE POLICY "Users can view own jobs" ON public.context_gathering_jobs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own jobs" ON public.context_gathering_jobs;
CREATE POLICY "Users can insert own jobs" ON public.context_gathering_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own jobs" ON public.context_gathering_jobs;
CREATE POLICY "Users can update own jobs" ON public.context_gathering_jobs
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to context_jobs" ON public.context_gathering_jobs;
CREATE POLICY "Service role has full access to context_jobs" ON public.context_gathering_jobs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT ALL ON public.context_gathering_jobs TO authenticated;
GRANT ALL ON public.context_gathering_jobs TO service_role;
