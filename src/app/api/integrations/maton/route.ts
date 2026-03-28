import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { saveMatonApiKey, getMatonApiKey, validateMatonApiKey } from '@/lib/integrations/maton-key';
import { updateIntegrations } from '@/lib/gateway/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/maton — check if user has a Maton key configured
 */
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const key = await getMatonApiKey(user.id);
  return jsonResponse({
    hasKey: !!key,
    keyPreview: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : null,
  });
}

/**
 * POST /api/integrations/maton — save user's Maton API key
 * Body: { api_key: string }
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let body: { api_key?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const apiKey = body.api_key?.trim();
  if (!apiKey) {
    return errorResponse('api_key is required', 400);
  }

  // Validate the key
  const valid = await validateMatonApiKey(apiKey);
  if (!valid) {
    return errorResponse('Invalid Maton API key — could not connect to Maton', 400);
  }

  // Save to profile
  const saved = await saveMatonApiKey(user.id, apiKey);
  if (!saved) {
    return errorResponse('Failed to save API key', 500);
  }

  // Sync INTEGRATIONS.md with the user's instance (now includes Maton connections)
  updateIntegrations(user.id).catch(err =>
    console.error('[maton] Failed to sync INTEGRATIONS.md:', err)
  );

  return jsonResponse({ success: true, message: 'Maton API key saved' });
}

/**
 * DELETE /api/integrations/maton — remove user's Maton API key
 */
export async function DELETE() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const saved = await saveMatonApiKey(user.id, '');
  if (!saved) {
    return errorResponse('Failed to remove API key', 500);
  }

  // Sync INTEGRATIONS.md (Maton connections removed)
  updateIntegrations(user.id).catch(err =>
    console.error('[maton] Failed to sync INTEGRATIONS.md after key removal:', err)
  );

  return jsonResponse({ success: true, message: 'Maton API key removed' });
}
