/**
 * GET /api/integrations/status
 * Returns all connected integration providers for the current user.
 * Includes both legacy OAuth (user_integrations) and Maton connections.
 */

import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { getMatonApiKey } from '@/lib/integrations/maton-key';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();
    const connected: string[] = [];

    // Legacy OAuth connections
    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('provider, status')
      .eq('user_id', user.id)
      .eq('status', 'connected');

    for (const i of (integrations || [])) {
      if (!connected.includes(i.provider)) connected.push(i.provider);
    }

    // Maton connections
    try {
      const matonKey = await getMatonApiKey(user.id);
      if (matonKey) {
        const res = await fetch('https://ctrl.maton.ai/connections?status=ACTIVE', {
          headers: { 'Authorization': `Bearer ${matonKey}` },
          signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
          const data = await res.json();
          for (const conn of (data.connections || [])) {
            const app = conn.app as string;
            if (app && !connected.includes(app)) connected.push(app);
          }
        }
      }
    } catch {
      // Don't fail the whole request if Maton is down
    }

    return jsonResponse({ connected });
  } catch (err) {
    console.error('Integration status error:', err);
    return errorResponse('An unexpected error occurred', 500);
  }
}
