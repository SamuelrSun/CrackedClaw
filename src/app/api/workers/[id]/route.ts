import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workers/:id — get worker details + recent activity
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: worker }, { data: activity }] = await Promise.all([
    supabase.from('workers').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase
      .from('worker_activity')
      .select('*')
      .eq('worker_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (!worker) return errorResponse('Worker not found', 404);
  return jsonResponse({ worker, activity: activity || [] });
}

// PATCH /api/workers/:id — update worker
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const supabase = await createClient();

  const allowedFields = [
    'name', 'title', 'role', 'avatar_config', 'status', 'schedule', 'schedule_cron',
    'cron_job_id', 'desk_position', 'last_result', 'last_active_at', 'error_message',
    'total_runs', 'successful_runs', 'failed_runs',
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const { data: worker, error: dbError } = await supabase
    .from('workers')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (dbError) return errorResponse(dbError.message, 500);
  if (!worker) return errorResponse('Worker not found', 404);

  // Log status changes
  if (body.status === 'paused') {
    await supabase.from('worker_activity').insert({
      worker_id: id, user_id: user.id, event_type: 'paused', summary: `${worker.name} was paused`,
    });
  } else if (body.status === 'active') {
    await supabase.from('worker_activity').insert({
      worker_id: id, user_id: user.id, event_type: 'resumed', summary: `${worker.name} resumed work`,
    });
  }

  return jsonResponse({ worker });
}

// DELETE /api/workers/:id — remove worker
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  const { error: dbError } = await supabase
    .from('workers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (dbError) return errorResponse(dbError.message, 500);
  return jsonResponse({ success: true });
}
