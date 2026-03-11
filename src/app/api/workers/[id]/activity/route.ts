import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/workers/:id/activity — log activity + update worker stats
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { event_type, summary, metadata, success } = body;

  const supabase = await createClient();

  // Verify worker belongs to user
  const { data: worker } = await supabase
    .from('workers')
    .select('id, total_runs, successful_runs, failed_runs')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!worker) return errorResponse('Worker not found', 404);

  // Log the activity
  await supabase.from('worker_activity').insert({
    worker_id: id,
    user_id: user.id,
    event_type: event_type || 'run',
    summary: summary || null,
    metadata: metadata || {},
  });

  // Update worker stats
  const statsUpdate: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (event_type === 'run' || success !== undefined) {
    statsUpdate.total_runs = (worker.total_runs || 0) + 1;
    if (success !== false) {
      statsUpdate.successful_runs = (worker.successful_runs || 0) + 1;
      statsUpdate.status = 'active';
      if (summary) statsUpdate.last_result = summary;
    } else {
      statsUpdate.failed_runs = (worker.failed_runs || 0) + 1;
      statsUpdate.status = 'error';
      if (summary) statsUpdate.error_message = summary;
    }
  }

  await supabase.from('workers').update(statsUpdate).eq('id', id);

  return jsonResponse({ success: true });
}
