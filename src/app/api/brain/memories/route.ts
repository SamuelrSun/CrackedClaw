/**
 * GET /api/brain/memories
 *
 * Returns memory_type='fact' rows for the authenticated user.
 * Supports query params: ?search=, ?domain=, ?limit=
 */

import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { mem0Write } from '@/lib/memory/mem0-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const domain = searchParams.get('domain');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);

    const supabase = await createClient();

    let query = supabase
      .from('memories')
      .select('id, content, domain, importance, metadata, created_at, updated_at')
      .eq('user_id', user.id)
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
      console.error('[api/brain/memories] db error:', dbError);
      return errorResponse('Failed to load memories', 500);
    }

    // Group by domain
    const domainGroups: Record<string, Array<{
      id: string;
      content: string;
      domain: string;
      importance: number;
      source: string;
      created_at: string;
      updated_at: string;
    }>> = {};

    for (const row of rows || []) {
      const d = row.domain || 'general';
      const meta = (row.metadata || {}) as Record<string, unknown>;
      const item = {
        id: row.id,
        content: row.content || '',
        domain: d,
        importance: row.importance || 0.5,
        source: (meta.source as string) || 'chat',
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      if (!domainGroups[d]) domainGroups[d] = [];
      domainGroups[d].push(item);
    }

    return jsonResponse({
      memories: rows?.map(row => {
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
      }) || [],
      grouped: domainGroups,
      total: (rows || []).length,
    });
  } catch (err) {
    console.error('[api/brain/memories] error:', err);
    return errorResponse('Failed to load memories', 500);
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const content = body.content?.trim();
    if (!content) return errorResponse('content is required', 400);

    const domain = body.domain || 'general';

    await mem0Write(user.id, content, {
      domain,
      source: 'user_input',
      importance: 0.8,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[api/brain/memories] POST error:', err);
    return errorResponse('Failed to add memory', 500);
  }
}
