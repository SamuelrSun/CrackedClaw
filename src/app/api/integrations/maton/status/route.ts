import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { getMatonApiKey } from '@/lib/integrations/maton-key';

export const dynamic = 'force-dynamic';

interface MatonConnectionDetail {
  connection_id?: string;
  status?: string;
  app?: string;
  method?: string;
  creation_time?: string;
  last_updated_time?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/integrations/maton/status?connectionId={id}
 * Poll the status of a Maton connection.
 * Returns: { connectionId, status, app }
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('connectionId');

  if (!connectionId) {
    return errorResponse('connectionId query param is required', 400);
  }

  const apiKey = await getMatonApiKey(user.id);
  if (!apiKey) {
    return errorResponse('No Maton API key configured', 400);
  }

  try {
    const res = await fetch(`https://ctrl.maton.ai/connections/${encodeURIComponent(connectionId)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return errorResponse('Connection not found', 404);
      }
      return errorResponse(`Maton API error: ${res.status}`, 502);
    }

    const data = await res.json() as { connection?: MatonConnectionDetail };
    const conn = data.connection;

    if (!conn) {
      return errorResponse('Invalid response from Maton', 502);
    }

    return jsonResponse({
      connectionId: conn.connection_id,
      status: conn.status || 'UNKNOWN',
      app: conn.app,
      method: conn.method,
      createdAt: conn.creation_time,
      updatedAt: conn.last_updated_time,
      oauthUrl: conn.url,
    });
  } catch (err) {
    console.error('[maton/status] Error:', err);
    return errorResponse('Failed to reach Maton', 502);
  }
}
