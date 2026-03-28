/**
 * Token Bridge — allows the OpenClaw instance to fetch API keys
 * All API services are accessed through Maton gateway.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { user_id, provider, bridge_secret } = body;

  const expectedSecret = process.env.TOKEN_BRIDGE_SECRET;
  if (!expectedSecret) throw new Error('TOKEN_BRIDGE_SECRET environment variable is required');
  if (bridge_secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user_id || !provider) {
    return NextResponse.json({ error: 'user_id and provider required' }, { status: 400 });
  }

  // Maton API key — returns the user's Maton key for gateway API calls
  if (provider === 'maton') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('instance_settings')
      .eq('id', user_id)
      .single();
    const settings = (profile?.instance_settings as Record<string, unknown>) || {};
    const matonKey = (settings.maton_api_key as string) || '';
    if (!matonKey) {
      return NextResponse.json({ error: 'No Maton API key configured. Go to Integrations to connect your services.' }, { status: 404 });
    }
    return NextResponse.json({ access_token: matonKey, provider: 'maton', type: 'api_key' });
  }

  // Maton connections — list active connections from Maton's API
  if (provider === '_maton_connections') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('instance_settings')
      .eq('id', user_id)
      .single();
    const settings = (profile?.instance_settings as Record<string, unknown>) || {};
    const matonKey = (settings.maton_api_key as string) || '';
    if (!matonKey) {
      return NextResponse.json({ connections: [], hasKey: false });
    }
    try {
      const res = await fetch('https://ctrl.maton.ai/connections?status=ACTIVE', {
        headers: { 'Authorization': `Bearer ${matonKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return NextResponse.json({ connections: [], hasKey: true, error: `Maton API error: ${res.status}` });
      }
      const data = await res.json();
      const connections = (data.connections || []).map((c: Record<string, unknown>) => ({
        app: c.app,
        status: c.status,
        connectionId: c.connection_id,
      }));
      return NextResponse.json({ connections, hasKey: true });
    } catch {
      return NextResponse.json({ connections: [], hasKey: true, error: 'Failed to reach Maton' });
    }
  }

  // _list — legacy alias for _maton_connections (old instances may call this)
  // Fall through to _maton_connections handler above won't work since it already returned.
  // Duplicate the Maton connections fetch inline.
  if (provider === '_list') {
    const { data: listProfile } = await supabase
      .from('profiles')
      .select('instance_settings')
      .eq('id', user_id)
      .single();
    const listSettings = (listProfile?.instance_settings as Record<string, unknown>) || {};
    const listKey = (listSettings.maton_api_key as string) || '';
    if (!listKey) {
      return NextResponse.json({ connections: [], hasKey: false });
    }
    try {
      const listRes = await fetch('https://ctrl.maton.ai/connections?status=ACTIVE', {
        headers: { 'Authorization': `Bearer ${listKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const connections = (listData.connections || []).map((c: Record<string, unknown>) => ({
          app: c.app,
          status: c.status,
          connectionId: c.connection_id,
        }));
        return NextResponse.json({ connections, hasKey: true });
      }
    } catch { /* fall through */ }
    return NextResponse.json({ connections: [], hasKey: true, error: 'Failed to reach Maton' });
  }

  // Any other provider — direct OAuth is no longer supported
  return NextResponse.json(
    { error: `Direct OAuth for "${provider}" is no longer supported. All services are accessed through the Maton gateway. Use dopl-maton instead.` },
    { status: 410 }
  );
}
