import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { getOrganization } from '@/lib/supabase/data';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PROVISIONING_API_URL = process.env.PROVISIONING_API_URL;
const PROVISIONING_API_SECRET = process.env.PROVISIONING_API_SECRET;

/**
 * POST /api/node/pre-pair
 *
 * Called by the setup script running on the user's machine.
 * Accepts device info and pre-registers it in the gateway's paired.json.
 *
 * Auth: Either session cookie OR X-Gateway-Token header (the org's openclaw_auth_token).
 *
 * Body: { deviceId, publicKey, token, displayName, platform }
 */
export async function POST(req: Request) {
  let org;

  // Try session-based auth first
  const { user, error } = await requireApiAuth();
  if (!error && user) {
    org = await getOrganization(user.id);
  }

  // Fallback: X-Gateway-Token header auth — look up org by gateway token
  if (!org) {
    const gatewayToken = req.headers.get('x-gateway-token');
    if (gatewayToken) {
      const supabase = await createClient();
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('openclaw_auth_token', gatewayToken)
        .single();
      org = data;
    }
  }

  if (!org) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!org.openclaw_instance_id) {
    return jsonResponse({ success: false, error: 'No instance found for this organization' }, 400);
  }

  let body: { deviceId?: string; publicKey?: string; token?: string; displayName?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const { deviceId, publicKey, token, displayName, platform } = body;

  if (!deviceId || !publicKey || !token) {
    return jsonResponse({ success: false, error: 'deviceId, publicKey, and token are required' }, 400);
  }

  if (!PROVISIONING_API_URL) {
    return jsonResponse({ success: false, error: 'Provisioning API not configured' }, 500);
  }

  try {
    const response = await fetch(`${PROVISIONING_API_URL}/instances/${org.openclaw_instance_id}/pre-pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PROVISIONING_API_SECRET ? { Authorization: `Bearer ${PROVISIONING_API_SECRET}` } : {}),
      },
      body: JSON.stringify({ deviceId, publicKey, token, displayName, platform }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Pre-pair provisioning error:', text);
      return jsonResponse({ success: false, error: 'Failed to pre-register device' }, 500);
    }

    const data = await response.json();
    return jsonResponse(data);
  } catch (err) {
    console.error('Pre-pair error:', err);
    return jsonResponse({ success: false, error: 'Failed to contact provisioning API' }, 500);
  }
}
