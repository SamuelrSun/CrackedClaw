CREATE TABLE IF NOT EXISTS public.user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  messages_sent integer DEFAULT 0,
  tokens_used integer DEFAULT 0,
  tool_calls integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own usage" ON public.user_usage FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION increment_usage(p_user_id uuid, p_date date, p_messages int, p_tokens int, p_tool_calls int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_usage (user_id, date, messages_sent, tokens_used, tool_calls)
  VALUES (p_user_id, p_date, p_messages, p_tokens, p_tool_calls)
  ON CONFLICT (user_id, date) DO UPDATE SET
    messages_sent = user_usage.messages_sent + p_messages,
    tokens_used = user_usage.tokens_used + p_tokens,
    tool_calls = user_usage.tool_calls + p_tool_calls,
    updated_at = now();
END;
$$;
