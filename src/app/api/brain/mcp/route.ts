import { NextRequest, NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api-auth';
import { handleMcpRequest } from '@/lib/brain/mcp/server';

export const dynamic = 'force-dynamic';

// CORS preflight for MCP clients
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
    },
  });
}

export async function POST(request: NextRequest) {
  // Auth
  const auth = await requireBrainAuth(request);
  if ('error' in auth) return auth.error;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // Handle MCP request
  try {
    const result = await handleMcpRequest(body, auth.user.id);
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    console.error('[mcp] handler error:', err);
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
