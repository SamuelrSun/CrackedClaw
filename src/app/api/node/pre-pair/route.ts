import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { getOrganization } from '@/lib/supabase/data';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PROVISIONING_API_URL = process.env.PROVISIONING_API_URL;
const PROVISIONING_API_SECRET = process.env.PROVISIONING_API_SECRET;

/**
 * POST /api/node/pre-pair
 *
 * Called by the Companion app (or setup script) running on the user's machine.
 * Accepts device info and pre-registers it so the gateway can auto-approve the
 * incoming `openclaw node run` pairing request.
 *
 * Auth: Either session cookie OR X-Gateway-Token header (the org's openclaw_auth_token).
 *
 * Body: { deviceId, token, displayName?, platform?, publicKey? }
 *
 * Returns: { success: true, gatewayUrl, instanceId }
 *
 * The Companion app follows this up by polling the gateway directly:
 *   GET  <gatewayUrl>/api/nodes/pending  → find the pending request
 *   POST <gatewayUrl>/api/nodes/approve  → approve it { requestId }
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

  // publicKey is optional — Companion app flow doesn't use keypair-based auth
  if (!deviceId || !token) {
    return jsonResponse({ success: false, error: 'deviceId and token are required' }, 400);
  }

  // If provisioning API is configured, call it to pre-register with the instance.
  // This is best-effort — even if it fails, the Companion app will poll-and-approve directly.
  if (PROVISIONING_API_URL) {
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
        console.warn('Pre-pair provisioning returned non-OK (continuing):', text);
      }
    } catch (err) {
      // Non-fatal: log and continue; Companion will auto-approve via gateway poll
      console.warn('Pre-pair provisioning call failed (continuing):', err);
    }
  }

  // Return the gateway URL and instance ID so the Companion can poll the gateway directly
  return jsonResponse({
    success: true,
    gatewayUrl: org.openclaw_gateway_url,
    instanceId: org.openclaw_instance_id,
  });
}
