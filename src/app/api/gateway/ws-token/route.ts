/**
 * GET /api/gateway/ws-token
 * Returns the WebSocket URL and auth token for the current user's OpenClaw instance.
 * Used by the browser to open a direct WS connection to the gateway.
 */

import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { getUserInstance } from '@/lib/gateway/openclaw-proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const instance = await getUserInstance(user!.id);
    if (!instance) {
      return NextResponse.json(
        { error: 'No active OpenClaw instance found. Please set up your agent instance.' },
        { status: 404 }
      );
    }

    // Build WebSocket URL from the instance host/port
    let wsUrl: string;
    if (instance.port === 443) {
      wsUrl = `wss://${instance.host}`;
    } else if (instance.host === 'localhost' || instance.host === '127.0.0.1') {
      wsUrl = `ws://localhost:${instance.port}`;
    } else {
      wsUrl = `ws://${instance.host}:${instance.port}`;
    }

    return NextResponse.json({
      wsUrl,
      token: instance.gatewayToken,
      userId: user!.id,
      instanceId: instance.instanceId,
    });
  } catch (err) {
    console.error('[ws-token] Error:', err);
    return NextResponse.json({ error: 'Failed to get instance info' }, { status: 500 });
  }
}
