-- Workflows table: stores saved automation prompts
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  prompt text not null,
  memory_keys text[] default '{}',
  trigger_phrases text[] default '{}',
  run_count integer default 0,
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.workflows enable row level security;

create policy "Users can manage their own workflows"
  on public.workflows for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index workflows_user_id_idx on public.workflows(user_id);
