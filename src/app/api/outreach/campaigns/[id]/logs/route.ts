/**
 * Campaign activity logs API.
 * GET  — list logs for campaign, newest first
 * POST — write a log entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── GET — list logs ───────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

    const { data: logs, error, count } = await supabase
      .from('campaign_logs')
      .select('id, action, details, created_at', { count: 'exact' })
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Logs GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      logs: logs ?? [],
      total: count ?? 0,
    });
  } catch (err) {
    console.error('Logs GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST — write a log entry ──────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, details } = body as { action?: string; details?: Record<string, unknown> };

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const { data: inserted, error } = await supabase
      .from('campaign_logs')
      .insert({
        campaign_id: params.id,
        user_id: user.id,
        action,
        details: details ?? {},
      })
      .select('id, action, created_at')
      .single();

    if (error) {
      console.error('Logs POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(inserted);
  } catch (err) {
    console.error('Logs POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
