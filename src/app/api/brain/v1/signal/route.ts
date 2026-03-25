export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
import { requireBrainAuth } from '@/lib/brain-api-auth';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import { recordSignal } from '@/lib/brain/signals/signal-buffer';
import { processFastPath } from '@/lib/brain/matcher/fast-path';
import type { SignalType, BrainSignal } from '@/lib/brain/signals/types';

const VALID_SIGNAL_TYPES: SignalType[] = [
  'correction',
  'accept',
  'reject',
  'edit_delta',
  'engagement',
];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { type, data, domain, subdomain, context, session_id } = body as {
      type?: string;
      data?: Record<string, unknown>;
      domain?: string;
      subdomain?: string;
      context?: string;
      session_id?: string;
    };

    // Validate type
    if (!type || !VALID_SIGNAL_TYPES.includes(type as SignalType)) {
      return errorResponse(
        `Invalid signal type. Must be one of: ${VALID_SIGNAL_TYPES.join(', ')}`,
        400,
      );
    }

    // Validate data
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return errorResponse('data must be a non-null object', 400);
    }

    const userId = auth.user.id;
    const source = auth.keyName ?? 'external';

    const signal: BrainSignal = {
      user_id: userId,
      signal_type: type as SignalType,
      signal_data: data,
      domain,
      subdomain,
      context,
      session_id,
      source,
    };

    // Record the signal to DB
    recordSignal(signal);

    // Fire-and-forget: run fast path matching
    void processFastPath({ userId, signal, sessionId: session_id }).catch(() => {});

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[api/brain/v1/signal] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
