-- User memory: persistent key-value store per user
CREATE TABLE IF NOT EXISTS public.user_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own memory" ON public.user_memory
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User secrets: encrypted credential storage
CREATE TABLE IF NOT EXISTS public.user_secrets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  encrypted_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

-- Secrets are NOT readable by the user directly (server-side only via service role)
CREATE POLICY "No direct user access to secrets" ON public.user_secrets
  USING (false);
