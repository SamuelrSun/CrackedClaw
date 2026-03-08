-- Cron jobs table: scheduled workflow executions
create table if not exists public.cron_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid references public.workflows(id) on delete set null,
  name text not null,
  description text,
  schedule text not null, -- cron expression e.g. "0 6 * * *"
  prompt text not null, -- the prompt to run (can be same as workflow or custom)
  enabled boolean default true,
  last_run_at timestamptz,
  last_run_status text, -- 'success' | 'error' | 'running'
  last_run_output text,
  next_run_at timestamptz,
  run_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cron_jobs enable row level security;

create policy "Users can manage their own cron jobs"
  on public.cron_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cron_jobs_user_id_idx on public.cron_jobs(user_id);
create index cron_jobs_enabled_idx on public.cron_jobs(enabled) where enabled = true;
