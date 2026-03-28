import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { getMatonApiKey } from '@/lib/integrations/maton-key';
import { updateIntegrations } from '@/lib/gateway/workspace';
import { isMatonSupported } from '@/lib/integrations/maton-services';

export const dynamic = 'force-dynamic';

// Map registry IDs to Maton app names when they differ
const REGISTRY_TO_MATON: Record<string, string> = {
  'google': 'google-mail',           // Default Google to Gmail
  'google-workspace': 'google-mail',
  'gmail': 'google-mail',
  'google-calendar': 'google-calendar',
  'google-drive': 'google-drive',
  'google-sheets': 'google-sheets',
  'google-docs': 'google-docs',
  'google-contacts': 'google-contacts',
  'google-meet': 'google-meet',
  'microsoft': 'microsoft-teams',     // Default Microsoft to Teams
  'microsoft-365': 'microsoft-teams',
  'outlook': 'outlook',
  'teams': 'microsoft-teams',
  'whatsapp': 'whatsapp-business',
  'instagram': 'instagram-business',
  'facebook': 'facebook-pages',
  'twitter': 'twitter',
  'tiktok': 'tiktok-business',
  'onedrive': 'microsoft-onedrive',
  'imessage': '',  // Not supported by Maton
};

function resolveMatonApp(registryId: string): string {
  const mapped = REGISTRY_TO_MATON[registryId.toLowerCase()];
  if (mapped !== undefined) return mapped; // Could be empty string for unsupported
  return registryId.toLowerCase();
}

interface MatonConnectionResponse {
  connection_id?: string;
  status?: string;
  url?: string;
  app?: string;
  method?: string;
  error?: string;
  message?: string;
}

/**
 * POST /api/integrations/maton/connect
 * Create a new Maton connection for a service.
 * Body: { app: string, method?: string }
 * Returns: { connectionId, oauthUrl, app }
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let body: { app?: string; method?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const rawApp = body.app?.trim();
  if (!rawApp) {
    return errorResponse('app is required (e.g., "slack", "google-mail")', 400);
  }

  // Resolve registry ID to Maton app name (handles google→google-mail, etc.)
  const app = resolveMatonApp(rawApp);
  if (!app) {
    return errorResponse(`"${rawApp}" is not available via Maton`, 400);
  }

  // Verify the resolved app is supported
  if (!isMatonSupported(app) && !isMatonSupported(rawApp)) {
    return errorResponse(`"${rawApp}" is not supported by Maton`, 400);
  }

  // Get user's Maton API key
  const apiKey = await getMatonApiKey(user.id);
  if (!apiKey) {
    return errorResponse('No Maton API key configured. Go to Integrations to add your key.', 400);
  }

  try {
    // Create connection via Maton Control API
    const res = await fetch('https://ctrl.maton.ai/connections', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app,
        method: body.method || 'OAUTH2',
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[maton/connect] Maton API error ${res.status}:`, errText);
      if (res.status === 401) {
        return errorResponse('Maton API key is invalid or expired', 401);
      }
      if (res.status === 400) {
        return errorResponse(`Maton rejected the request: ${errText}`, 400);
      }
      return errorResponse(`Maton API error: ${res.status}`, 502);
    }

    const data = await res.json() as MatonConnectionResponse;
    const connectionId = data.connection_id;

    if (!connectionId) {
      console.error('[maton/connect] No connection_id in response:', data);
      return errorResponse('Maton did not return a connection ID', 502);
    }

    // Maton's POST /connections only returns { connection_id }.
    // The OAuth URL and status are on the detail endpoint.
    const detailRes = await fetch(`https://ctrl.maton.ai/connections/${connectionId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!detailRes.ok) {
      console.error(`[maton/connect] Failed to fetch connection detail: ${detailRes.status}`);
      return errorResponse(`Failed to fetch connection details from Maton`, 502);
    }

    const detail = await detailRes.json();
    const connection = detail.connection || detail;
    const oauthUrl = connection.url || null;
    const status = (connection.status as string) || 'PENDING';

    if (!oauthUrl && status === 'PENDING') {
      // Connection created but no OAuth URL available yet
      console.error('[maton/connect] PENDING connection with no URL:', detail);
      return errorResponse('Connection created but no OAuth URL returned. Please try again.', 502);
    }

    if (!oauthUrl) {
      // Immediately active (API_KEY type connections)
      return jsonResponse({
        connectionId,
        oauthUrl: null,
        app,
        status,
        message: 'Connection created (no OAuth required)',
      });
    }

    return jsonResponse({
      connectionId,
      oauthUrl,
      app,
      status,
    });
  } catch (err) {
    console.error('[maton/connect] Error:', err);
    return errorResponse('Failed to connect to Maton. Please try again.', 502);
  }
}
