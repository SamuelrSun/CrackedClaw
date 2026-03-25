/**
 * GET /api/brain/profile — User memory profile summary.
 *
 * Auth: Brain API key (dpb_sk_...) or Supabase session
 * Rate limit: 30 req/min
 *
 * Response:
 *   {
 *     user_id: string,
 *     fact_count: number,
 *     domains: [{ domain, fact_count, last_updated }],
 *     last_updated: string | null,
 *   }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api/auth';
import { checkRateLimit } from '@/lib/brain-api/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import type { ProfileResponse, DomainSummary } from '@/lib/brain-api/types';

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

export async function GET(request: NextRequest) {
  try {
    // --- Auth ---
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;

    // --- Rate limit ---
    const rl = checkRateLimit(userId, 'profile');
    if (!rl.allowed) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      res.headers.set('Retry-After', String(rl.retryAfter));
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    const supabase = createAdminClient();

    // --- Fetch all facts grouped by domain ---
    // Supabase doesn't support GROUP BY natively, so we fetch relevant columns
    // and aggregate in-process. Capped at 2000 rows (sufficient for any real user).
    const { data: rows, error: dbError } = await supabase
      .from('memories')
      .select('id, domain, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(2000);

    if (dbError) {
      console.error('[api/brain/profile] db error:', dbError);
      return errorResponse('Failed to load profile', 500);
    }

    if (!rows || rows.length === 0) {
      const response: ProfileResponse = {
        user_id: userId,
        fact_count: 0,
        domains: [],
        last_updated: null,
      };
      const res = jsonResponse(response);
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    // --- Aggregate by domain ---
    interface DomainAgg {
      count: number;
      latest: string;
    }
    const domainMap = new Map<string, DomainAgg>();

    for (const row of rows) {
      const domain = (row.domain as string) || 'general';
      const updatedAt = row.updated_at as string;
      const agg = domainMap.get(domain);
      if (!agg) {
        domainMap.set(domain, { count: 1, latest: updatedAt });
      } else {
        agg.count++;
        if (updatedAt > agg.latest) agg.latest = updatedAt;
      }
    }

    const domains: DomainSummary[] = Array.from(domainMap.entries())
      .map(([domain, agg]) => ({
        domain,
        fact_count: agg.count,
        last_updated: agg.latest,
      }))
      .sort((a, b) => b.fact_count - a.fact_count);

    const lastUpdated =
      rows[0]?.updated_at ? (rows[0].updated_at as string) : null;

    const response: ProfileResponse = {
      user_id: userId,
      fact_count: rows.length,
      domains,
      last_updated: lastUpdated,
    };

    const res = jsonResponse(response);
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (err) {
    console.error('[api/brain/profile] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
