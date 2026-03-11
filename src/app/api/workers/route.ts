import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/workers — list all workers for the current user
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const { data: workers, error: dbError } = await supabase
    .from('workers')
    .select('*')
    .eq('user_id', user.id)
    .order('desk_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (dbError) return errorResponse(dbError.message, 500);
  return jsonResponse({ workers: workers || [] });
}

// POST /api/workers — create a new worker
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const body = await request.json();
  const { name, title, role, avatar_config, cron_job_id, workflow_type, schedule, schedule_cron } = body;

  if (!name || !title) return errorResponse('name and title are required', 400);

  const supabase = await createClient();

  // Auto-assign desk position
  const { data: existing } = await supabase
    .from('workers')
    .select('desk_position')
    .eq('user_id', user.id)
    .order('desk_position', { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.desk_position ?? -1) + 1;

  const { data: worker, error: dbError } = await supabase
    .from('workers')
    .insert({
      user_id: user.id,
      name,
      title,
      role: role || null,
      avatar_config: avatar_config || {},
      cron_job_id: cron_job_id || null,
      workflow_type: workflow_type || 'cron',
      schedule: schedule || null,
      schedule_cron: schedule_cron || null,
      status: 'idle',
      desk_position: nextPosition,
    })
    .select()
    .single();

  if (dbError) return errorResponse(dbError.message, 500);

  // Log creation
  await supabase.from('worker_activity').insert({
    worker_id: worker.id,
    user_id: user.id,
    event_type: 'created',
    summary: `${name} was hired as ${title}`,
  });

  return jsonResponse({ worker });
}
