   CREATE TABLE IF NOT EXISTS user_gateways (                                                                                                                                                 
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                                                                                                                                           
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,                                                                                                                       
     name TEXT NOT NULL DEFAULT 'My OpenClaw',                                                                                                                                                
     gateway_url TEXT NOT NULL,                                                                                                                                                               
     auth_token TEXT NOT NULL,                                                                                                                                                                
     status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),                                                                                    
     last_ping TIMESTAMPTZ,                                                                                                                                                                   
     agent_info JSONB DEFAULT '{}'::jsonb,                                                                                                                                                    
     created_at TIMESTAMPTZ DEFAULT NOW(),                                                                                                                                                    
     updated_at TIMESTAMPTZ DEFAULT NOW(),                                                                                                                                                    
     UNIQUE(user_id)                                                                                                                                                                          
   );                                                                                                                                                                                         
   ALTER TABLE user_gateways ENABLE ROW LEVEL SECURITY;                                                                                                                                       
   DROP POLICY IF EXISTS "Users can view own gateway" ON user_gateways;                                                                                                                       
   CREATE POLICY "Users can view own gateway" ON user_gateways FOR SELECT USING (auth.uid() = user_id);                                                                                       
   DROP POLICY IF EXISTS "Users can insert own gateway" ON user_gateways;                                                                                                                     
   CREATE POLICY "Users can insert own gateway" ON user_gateways FOR INSERT WITH CHECK (auth.uid() = user_id);                                                                                
   DROP POLICY IF EXISTS "Users can update own gateway" ON user_gateways;                                                                                                                     
   CREATE POLICY "Users can update own gateway" ON user_gateways FOR UPDATE USING (auth.uid() = user_id);                                                                                     
   DROP POLICY IF EXISTS "Users can delete own gateway" ON user_gateways;                                                                                                                     
   CREATE POLICY "Users can delete own gateway" ON user_gateways FOR DELETE USING (auth.uid() = user_id);                                                                                     
                                                                                                                                                                                              
   -- 2. ORGANIZATIONS                                                                                                                                                                        
   CREATE TABLE IF NOT EXISTS organizations (                                                                                                                                                 
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                                                                                                                                           
     name TEXT NOT NULL,                                                                                                                                                                      
     slug TEXT UNIQUE,                                                                                                                                                                        
     owner_id UUID NOT NULL REFERENCES auth.users(id),                                                                                                                                        
     plan TEXT DEFAULT 'starter' CHECK (plan IN ('free', 'starter', 'pro', 'team', 'enterprise')),                                                                                            
     openclaw_instance_id TEXT,                                                                                                                                                               
     openclaw_gateway_url TEXT,                                                                                                                                                               
     openclaw_auth_token TEXT,                                                                                                                                                                
     created_at TIMESTAMPTZ DEFAULT NOW(),                                                                                                                                                    
     updated_at TIMESTAMPTZ DEFAULT NOW()                                                                                                                                                     
   );                                                                                                                                                                                         
   ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;                                                                                                                                       
   DROP POLICY IF EXISTS "Users can view own organizations" ON organizations;                                                                                                                 
   CREATE POLICY "Users can view own organizations" ON organizations FOR SELECT USING (auth.uid() = owner_id);                                                                                
   DROP POLICY IF EXISTS "Users can insert own organizations" ON organizations;                                                                                                               
   CREATE POLICY "Users can insert own organizations" ON organizations FOR INSERT WITH CHECK (auth.uid() = owner_id);                                                                         
   DROP POLICY IF EXISTS "Users can update own organizations" ON organizations;                                                                                                               
   CREATE POLICY "Users can update own organizations" ON organizations FOR UPDATE USING (auth.uid() = owner_id);                                                                              
                                                                                                                                                                                              
   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);                                                                                           
                                                                                                                                                                                              
   -- 3. INTEGRATIONS COLUMNS                                                                                                                                                                 
   ALTER TABLE integrations ADD COLUMN IF NOT EXISTS name TEXT;                                                                                                                               
   ALTER TABLE integrations ADD COLUMN IF NOT EXISTS slug TEXT;                                                                                                                               
   ALTER TABLE integrations ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🔗';                                                                                                                  
   ALTER TABLE integrations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'oauth';                                                                                                               
   ALTER TABLE integrations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disconnected';                                                                                                      
   ALTER TABLE integrations ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';                                                                                                               
   ALTER TABLE integrations ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ;                                                                                                                   
                                                                                                                                                                                              
   -- 4. ACTIVITY LOG                                                                                                                                                                         
   CREATE TABLE IF NOT EXISTS activity_log (                                                                                                                                                  
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                                                                                                                                           
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,                                                                                                                       
     action TEXT NOT NULL,                                                                                                                                                                    
     detail TEXT,                                                                                                                                                                             
     metadata JSONB DEFAULT '{}',                                                                                                                                                             
     created_at TIMESTAMPTZ DEFAULT NOW()                                                                                                                                                     
   );                                                                                                                                                                                         
   CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);                                                                                                              
   CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);                                                                                                   
   ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;                                                                                                                                        
   DROP POLICY IF EXISTS "Users can view own activity" ON activity_log;                                                                                                                       
   CREATE POLICY "Users can view own activity" ON activity_log FOR SELECT USING (auth.uid() = user_id);                                                                                       
   DROP POLICY IF EXISTS "Users can insert own activity" ON activity_log;                                                                                                                     
   CREATE POLICY "Users can insert own activity" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);                                                                                
                                                                                                                                                                                              
   -- 5. TOKEN USAGE                                                                                                                                                                          
   CREATE TABLE IF NOT EXISTS token_usage (                                                                                                                                                   
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                                                                                                                                           
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,                                                                                                                       
     used INTEGER DEFAULT 0,                                                                                                                                                                  
     limit_amount INTEGER DEFAULT 1000000,                                                                                                                                                    
     reset_date DATE DEFAULT (CURRENT_DATE + INTERVAL '1 month'),                                                                                                                             
     created_at TIMESTAMPTZ DEFAULT NOW(),                                                                                                                                                    
     updated_at TIMESTAMPTZ DEFAULT NOW(),                                                                                                                                                    
     UNIQUE(user_id)                                                                                                                                                                          
   );                                                                                                                                                                                         
   ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;                                                                                                                                         
   DROP POLICY IF EXISTS "Users can view own usage" ON token_usage;                                                                                                                           
   CREATE POLICY "Users can view own usage" ON token_usage FOR SELECT USING (auth.uid() = user_id);                                                                                           
   DROP POLICY IF EXISTS "Users can update own usage" ON token_usage;                                                                                                                         
   CREATE POLICY "Users can update own usage" ON token_usage FOR UPDATE USING (auth.uid() = user_id);                                                                                         
   DROP POLICY IF EXISTS "Users can insert own usage" ON token_usage;                                                                                                                         
   CREATE POLICY "Users can insert own usage" ON token_usage FOR INSERT WITH CHECK (auth.uid() = user_id);                                                                                    
                                                                                                                                                                                              
   -- 6. USAGE HISTORY                                                                                                                                                                        
   CREATE TABLE IF NOT EXISTS usage_history (                                                                                                                                                 
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                                                                                                                                           
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,                                                                                                                       
     date DATE NOT NULL,                                                                                                                                                                      
     tokens_used INTEGER DEFAULT 0,                                                                                                                                                           
     created_at TIMESTAMPTZ DEFAULT NOW(),                                                                                                                                                    
     UNIQUE(user_id, date)                                                                                                                                                                    
   );                                                                                                                                                                                         
   CREATE INDEX IF NOT EXISTS idx_usage_history_user_date ON usage_history(user_id, date DESC);                                                                                               
   ALTER TABLE usage_history ENABLE ROW LEVEL SECURITY;                                                                                                                                       
   DROP POLICY IF EXISTS "Users can view own usage history" ON usage_history;                                                                                                                 
   CREATE POLICY "Users can view own usage history" ON usage_history FOR SELECT USING (auth.uid() = user_id);                                                                                 
   DROP POLICY IF EXISTS "Users can insert own usage history" ON usage_history;                                                                                                               
   CREATE POLICY "Users can insert own usage history" ON usage_history FOR INSERT WITH CHECK (auth.uid() = user_id);                                                                          
   DROP POLICY IF EXISTS "Users can update own usage history" ON usage_history;                                                                                                               
   CREATE POLICY "Users can update own usage history" ON usage_history FOR UPDATE USING (auth.uid() = user_id);                                                                               
                                                                                                                                                                                              
   -- 7. TEAM INVITATIONS                                                                                                                                                                     
   CREATE TABLE IF NOT EXISTS team_invitations (                                                                                                                                              
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                                                                                                                                           
     organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,                                                                                                                     
     email TEXT NOT NULL,                                                                                                                                                                     
     role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),                                                                                                                          
     invited_by UUID REFERENCES auth.users(id),                                                                                                                                               
     token TEXT UNIQUE NOT NULL,                                                                                                                                                              
     expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),                                                                                                                     
     accepted_at TIMESTAMPTZ,                                                                                                                                                                 
     created_at TIMESTAMPTZ DEFAULT NOW()                                                                                                                                                     
   );                                                                                                                                                                                         
   ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;                                                                                                                                    
   DROP POLICY IF EXISTS "Users can view invitations they sent" ON team_invitations;                                                                                                          
   CREATE POLICY "Users can view invitations they sent" ON team_invitations FOR SELECT USING (auth.uid() = invited_by);                                                                       
   DROP POLICY IF EXISTS "Users can insert invitations" ON team_invitations;                                                                                                                  
   CREATE POLICY "Users can insert invitations" ON team_invitations FOR INSERT WITH CHECK (auth.uid() = invited_by);                                                                          
                                                                                                                                                                                              
   -- 8. WORKFLOW STATUS                                                                                                                                                                      
   ALTER TABLE workflows ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';                                                                                                               
   CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);                                                                                                                      
                                                                                                                                                                                              
   -- 9. GRANT PERMISSIONS                                                                                                                                                                    
   GRANT ALL ON user_gateways TO anon, authenticated;                                                                                                                                         
   GRANT ALL ON organizations TO anon, authenticated;                                                                                                                                         
   GRANT ALL ON activity_log TO anon, authenticated;                                                                                                                                          
   GRANT ALL ON token_usage TO anon, authenticated;                                                                                                                                           
   GRANT ALL ON usage_history TO anon, authenticated;                                                                                                                                         
   GRANT ALL ON team_invitations TO anon, authenticated; 