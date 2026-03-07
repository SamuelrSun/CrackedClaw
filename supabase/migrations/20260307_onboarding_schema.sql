-- OpenClaw Cloud Onboarding Schema
-- Tracks user onboarding progress, integrations, and gathered context

-- ============================================================================
-- TABLE: onboarding_state
-- Tracks where user is in the onboarding flow
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.onboarding_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    phase TEXT DEFAULT 'welcome' CHECK (phase IN ('welcome', 'integrations', 'context_gathering', 'workflow_setup', 'complete', 'derailed')),
    completed_steps JSONB DEFAULT '[]'::jsonb,
    skipped_steps JSONB DEFAULT '[]'::jsonb,
    gathered_context JSONB DEFAULT '{}'::jsonb,
    suggested_workflows JSONB DEFAULT '[]'::jsonb,
    agent_name TEXT,
    user_display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- One onboarding state per user
    UNIQUE(user_id)
);

-- Index for quick user lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_state_user_id ON public.onboarding_state(user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_onboarding_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_onboarding_state_updated_at ON public.onboarding_state;
CREATE TRIGGER trigger_onboarding_state_updated_at
    BEFORE UPDATE ON public.onboarding_state
    FOR EACH ROW
    EXECUTE FUNCTION public.update_onboarding_state_updated_at();

-- ============================================================================
-- TABLE: user_context
-- Gleaned context from integrations (emails, calendar patterns, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gmail', 'calendar', 'notion', 'slack', 'github', 'manual')),
    context_type TEXT NOT NULL CHECK (context_type IN ('summary', 'tasks', 'contacts', 'patterns', 'templates', 'preferences')),
    content JSONB NOT NULL,
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_context_user_id ON public.user_context(user_id);
CREATE INDEX IF NOT EXISTS idx_user_context_source ON public.user_context(source);
CREATE INDEX IF NOT EXISTS idx_user_context_type ON public.user_context(context_type);
CREATE INDEX IF NOT EXISTS idx_user_context_user_source ON public.user_context(user_id, source);

-- ============================================================================
-- TABLE: oauth_flows
-- In-progress OAuth states for CSRF protection
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.oauth_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL,
    state TEXT NOT NULL,  -- CSRF token
    redirect_uri TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    
    -- State must be unique for security
    UNIQUE(state)
);

-- Index for state lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_oauth_flows_state ON public.oauth_flows(state);
CREATE INDEX IF NOT EXISTS idx_oauth_flows_user_id ON public.oauth_flows(user_id);

-- Auto-expire old pending flows (clean up after 1 hour)
CREATE OR REPLACE FUNCTION public.expire_old_oauth_flows()
RETURNS void AS $$
BEGIN
    UPDATE public.oauth_flows
    SET status = 'expired'
    WHERE status = 'pending'
    AND created_at < now() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TABLE: user_integrations
-- Connected integrations with OAuth tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'slack', 'notion', 'github', 'microsoft')),
    account_email TEXT,
    account_name TEXT,
    access_token TEXT,  -- Encrypted at app layer
    refresh_token TEXT, -- Encrypted at app layer
    token_expires_at TIMESTAMPTZ,
    scopes JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,  -- Extra provider-specific data
    status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- One integration per provider/account combo per user
    UNIQUE(user_id, provider, account_email)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON public.user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON public.user_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider ON public.user_integrations(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON public.user_integrations(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Users can only access their own rows
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- onboarding_state policies
DROP POLICY IF EXISTS "Users can view own onboarding state" ON public.onboarding_state;
CREATE POLICY "Users can view own onboarding state" ON public.onboarding_state
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own onboarding state" ON public.onboarding_state;
CREATE POLICY "Users can insert own onboarding state" ON public.onboarding_state
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own onboarding state" ON public.onboarding_state;
CREATE POLICY "Users can update own onboarding state" ON public.onboarding_state
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to onboarding_state" ON public.onboarding_state;
CREATE POLICY "Service role has full access to onboarding_state" ON public.onboarding_state
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- user_context policies
DROP POLICY IF EXISTS "Users can view own context" ON public.user_context;
CREATE POLICY "Users can view own context" ON public.user_context
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own context" ON public.user_context;
CREATE POLICY "Users can insert own context" ON public.user_context
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own context" ON public.user_context;
CREATE POLICY "Users can update own context" ON public.user_context
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own context" ON public.user_context;
CREATE POLICY "Users can delete own context" ON public.user_context
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to user_context" ON public.user_context;
CREATE POLICY "Service role has full access to user_context" ON public.user_context
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- oauth_flows policies
DROP POLICY IF EXISTS "Users can view own oauth flows" ON public.oauth_flows;
CREATE POLICY "Users can view own oauth flows" ON public.oauth_flows
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own oauth flows" ON public.oauth_flows;
CREATE POLICY "Users can insert own oauth flows" ON public.oauth_flows
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own oauth flows" ON public.oauth_flows;
CREATE POLICY "Users can update own oauth flows" ON public.oauth_flows
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to oauth_flows" ON public.oauth_flows;
CREATE POLICY "Service role has full access to oauth_flows" ON public.oauth_flows
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- user_integrations policies
DROP POLICY IF EXISTS "Users can view own integrations" ON public.user_integrations;
CREATE POLICY "Users can view own integrations" ON public.user_integrations
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own integrations" ON public.user_integrations;
CREATE POLICY "Users can insert own integrations" ON public.user_integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own integrations" ON public.user_integrations;
CREATE POLICY "Users can update own integrations" ON public.user_integrations
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own integrations" ON public.user_integrations;
CREATE POLICY "Users can delete own integrations" ON public.user_integrations
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to user_integrations" ON public.user_integrations;
CREATE POLICY "Service role has full access to user_integrations" ON public.user_integrations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT ALL ON public.onboarding_state TO authenticated;
GRANT ALL ON public.user_context TO authenticated;
GRANT ALL ON public.oauth_flows TO authenticated;
GRANT ALL ON public.user_integrations TO authenticated;

GRANT ALL ON public.onboarding_state TO service_role;
GRANT ALL ON public.user_context TO service_role;
GRANT ALL ON public.oauth_flows TO service_role;
GRANT ALL ON public.user_integrations TO service_role;
