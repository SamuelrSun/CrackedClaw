export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
import { requireBrainAuth } from '@/lib/brain-api-auth';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const userId = auth.user.id;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const domain = searchParams.get('domain');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);

    const supabase = createAdminClient();

    let query = supabase
      .from('memories')
      .select('id, content, domain, importance, metadata, created_at, updated_at')
      .eq('user_id', userId)
      .eq('memory_type', 'fact')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (domain) {
      query = query.eq('domain', domain);
    }

    if (search) {
      query = query.ilike('content', `%${search}%`);
    }

    const { data: rows, error: dbError } = await query;

    if (dbError) {
      console.error('[api/brain/v1/memories] db error:', dbError);
      return errorResponse('Failed to load memories', 500);
    }

    const memories = (rows || []).map((row) => {
      const meta = (row.metadata || {}) as Record<string, unknown>;
      return {
        id: row.id,
        content: row.content || '',
        domain: row.domain || 'general',
        importance: row.importance || 0.5,
        source: (meta.source as string) || 'chat',
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return jsonResponse({
      memories,
      total: memories.length,
    });
  } catch (err) {
    console.error('[api/brain/v1/memories] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
