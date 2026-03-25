/**
 * GET /api/brain/v1/export — Export the user's entire brain as JSON
 *
 * Returns all facts, criteria, and recent signals in a portable format.
 * Users can download this to back up or migrate their brain.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api-auth';
import { corsOptions } from '@/lib/brain/v1/cors';
import { createAdminClient } from '@/lib/supabase/admin';

export async function OPTIONS() {
  return corsOptions('GET, OPTIONS');
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const userId = auth.user.id;
    const admin = createAdminClient();

    // Fetch all data in parallel
    const [memoriesResult, criteriaResult, signalsResult] = await Promise.all([
      // All facts
      admin
        .from('memories')
        .select('id, content, domain, importance, metadata, memory_type, context_scope, preference_type, weight, created_at, updated_at')
        .eq('user_id', userId)
        .eq('memory_type', 'fact')
        .is('valid_until', null)
        .order('importance', { ascending: false })
        .limit(1000),
      // All active criteria
      admin
        .from('memories')
        .select('id, content, domain, importance, metadata, memory_type, context_scope, preference_type, weight, correction_count, created_at, updated_at')
        .eq('user_id', userId)
        .eq('memory_type', 'criterion')
        .is('valid_until', null)
        .order('importance', { ascending: false })
        .limit(500),
      // Recent signals (last 30 days)
      admin
        .from('brain_signals')
        .select('id, signal_type, domain, subdomain, context, signal_data, source, session_id, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    // Parse criteria content (stored as JSON strings)
    const criteria = (criteriaResult.data || []).map((row) => {
      try {
        const parsed = JSON.parse(row.content);
        return {
          id: row.id,
          description: parsed.description || row.content,
          domain: parsed.domain || row.domain,
          subdomain: parsed.subdomain,
          weight: row.weight ?? parsed.weight,
          preference_type: row.preference_type ?? parsed.preference_type,
          confidence: parsed.confidence,
          source: parsed.source,
          examples: parsed.examples,
          correction_count: row.correction_count,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      } catch {
        return {
          id: row.id,
          description: row.content,
          domain: row.domain,
          weight: row.weight,
          preference_type: row.preference_type,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }
    });

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      brain: {
        memories: (memoriesResult.data || []).map((m) => ({
          id: m.id,
          content: m.content,
          domain: m.domain,
          importance: m.importance,
          source: (m.metadata as Record<string, unknown>)?.source || 'unknown',
          created_at: m.created_at,
          updated_at: m.updated_at,
        })),
        preferences: criteria,
        signals: signalsResult.data || [],
      },
      stats: {
        total_memories: (memoriesResult.data || []).length,
        total_preferences: criteria.length,
        total_signals: (signalsResult.data || []).length,
      },
    };

    return NextResponse.json(exportData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': `attachment; filename="dopl-brain-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error('[api/brain/v1/export] error:', err);
    return NextResponse.json(
      { error: 'Failed to export brain' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }
}
