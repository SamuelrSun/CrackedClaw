import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { sendBrowserCommand, type BrowserCommand } from '@/lib/node/browser-session';

export const dynamic = 'force-dynamic';

// POST /api/node/browser - Proxy a browser command through the user's node
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { command } = await request.json() as { command: BrowserCommand };
    if (!command?.action) return errorResponse('command.action required', 400);

    const result = await sendBrowserCommand(user.id, command);
    return jsonResponse(result);
  } catch {
    return errorResponse('Failed to send browser command', 500);
  }
}
