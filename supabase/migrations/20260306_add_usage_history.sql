-- Create usage_history table for daily token tracking
CREATE TABLE IF NOT EXISTS usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create index for efficient queries by user and date
CREATE INDEX IF NOT EXISTS idx_usage_history_user_date 
  ON usage_history(user_id, date DESC);

-- Enable RLS
ALTER TABLE usage_history ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own usage history
CREATE POLICY "Users can view own usage history" ON usage_history
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: users can insert their own usage history
CREATE POLICY "Users can insert own usage history" ON usage_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: users can update their own usage history
CREATE POLICY "Users can update own usage history" ON usage_history
  FOR UPDATE USING (auth.uid() = user_id);
