import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');

  try {
    const supabase = await createClient();

    let query = supabase
      .from('scan_logs')
      .select('id, mode, status, target_provider, total_memories, duration_ms, results_summary, created_at, completed_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (provider) {
      query = query.eq('target_provider', provider);
    }

    const { data, error: dbError } = await query;

    if (dbError) {
      console.warn('scan_logs query error:', dbError.message);
      return jsonResponse({ scans: [] });
    }

    const scans = (data || []).map((row) => ({
      id: row.id,
      mode: row.mode,
      status: row.status,
      provider: row.target_provider,
      memoriesCreated: row.total_memories ?? 0,
      durationMs: row.duration_ms ?? 0,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));

    return jsonResponse({ scans });
  } catch (err) {
    console.error('scan history error:', err);
    return errorResponse('Failed to fetch scan history', 500);
  }
}
