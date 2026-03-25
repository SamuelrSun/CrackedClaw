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
import { loadBrainCriteria, loadBrainCriteriaByType } from '@/lib/brain/brain-store';
import type { PreferenceType } from '@/lib/brain/types';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const userId = auth.user.id;
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const type = searchParams.get('type') as PreferenceType | null;

    let criteria;

    if (type) {
      criteria = await loadBrainCriteriaByType(userId, [type]);
    } else if (domain) {
      criteria = await loadBrainCriteria(userId, { domain }, { limit: 50 });
    } else {
      criteria = await loadBrainCriteria(userId, undefined, { limit: 50 });
    }

    const preferences = criteria.map((c) => ({
      id: c.id,
      description: c.description,
      domain: c.domain,
      subdomain: c.subdomain,
      weight: c.weight,
      preference_type: c.preference_type,
      confidence: c.confidence,
      source: c.source,
    }));

    return jsonResponse({ preferences });
  } catch (err) {
    console.error('[api/brain/v1/preferences] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
