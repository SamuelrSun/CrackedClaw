import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { getMatonApiKey } from '@/lib/integrations/maton-key';

export const dynamic = 'force-dynamic';

interface MatonConnection {
  connection_id: string;
  status: string;
  app: string;
  method: string;
  creation_time: string;
  last_updated_time: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/integrations/maton/connections
 * List all Maton connections for the user.
 * Optional query params: ?app=slack&status=ACTIVE
 * Returns: { connections: [...] }
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const apiKey = await getMatonApiKey(user.id);
  if (!apiKey) {
    return jsonResponse({ connections: [], hasKey: false });
  }

  const { searchParams } = new URL(request.url);
  const app = searchParams.get('app');
  const status = searchParams.get('status');

  try {
    const url = new URL('https://ctrl.maton.ai/connections');
    if (app) url.searchParams.set('app', app);
    if (status) url.searchParams.set('status', status);

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 401) {
        return jsonResponse({ connections: [], error: 'Invalid Maton API key', hasKey: true });
      }
      return errorResponse(`Maton API error: ${res.status}`, 502);
    }

    const data = await res.json() as { connections?: MatonConnection[] };
    const connections = (data.connections || []).map((c) => ({
      connectionId: c.connection_id,
      status: c.status,
      app: c.app,
      method: c.method,
      createdAt: c.creation_time,
      updatedAt: c.last_updated_time,
    }));

    // Group by app for easy UI consumption
    const grouped: Record<string, typeof connections> = {};
    for (const conn of connections) {
      if (!grouped[conn.app]) grouped[conn.app] = [];
      grouped[conn.app].push(conn);
    }

    return jsonResponse({ connections, grouped, hasKey: true });
  } catch (err) {
    console.error('[maton/connections] Error:', err);
    return errorResponse('Failed to reach Maton', 502);
  }
}

/**
 * DELETE /api/integrations/maton/connections
 * Delete a Maton connection.
 * Body: { connectionId: string }
 */
export async function DELETE(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let body: { connectionId?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const connectionId = body.connectionId?.trim();
  if (!connectionId) {
    return errorResponse('connectionId is required', 400);
  }

  const apiKey = await getMatonApiKey(user.id);
  if (!apiKey) {
    return errorResponse('No Maton API key configured', 400);
  }

  try {
    const res = await fetch(`https://ctrl.maton.ai/connections/${encodeURIComponent(connectionId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return jsonResponse({ success: true, message: 'Connection already deleted' });
      }
      return errorResponse(`Maton API error: ${res.status}`, 502);
    }

    return jsonResponse({ success: true, connectionId });
  } catch (err) {
    console.error('[maton/connections] Delete error:', err);
    return errorResponse('Failed to reach Maton', 502);
  }
}
