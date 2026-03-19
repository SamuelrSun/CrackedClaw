import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('gateway_url, auth_token')
    .eq('id', user.id)
    .single();

  if (!profile?.gateway_url || !profile?.auth_token) {
    return NextResponse.json({ key: null });
  }

  // Get relay port: try instance_settings first, then probe provisioning server
  const { data: fullProfile } = await supabase
    .from('profiles')
    .select('instance_settings, instance_id')
    .eq('id', user.id)
    .single();

  let relayPort: number | null = null;
  const settings = (fullProfile?.instance_settings as Record<string, unknown>) || {};
  if (typeof settings.gatewayPort === 'number') {
    relayPort = settings.gatewayPort + 3;
  }

  // Fallback: probe the provisioning server for the instance config
  if (!relayPort && fullProfile?.instance_id && process.env.PROVISIONING_API_URL && process.env.PROVISIONING_API_SECRET) {
    try {
      const res = await fetch(
        `${process.env.PROVISIONING_API_URL}/api/instances/${fullProfile.instance_id}/config`,
        {
          headers: { 'Authorization': `Bearer ${process.env.PROVISIONING_API_SECRET}` },
          signal: AbortSignal.timeout(3000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (typeof data.gatewayPort === 'number') {
          relayPort = data.gatewayPort + 3;
          // Backfill instance_settings so future calls are fast
          await supabase.from('profiles').update({
            instance_settings: { ...settings, gatewayPort: data.gatewayPort }
          }).eq('id', user.id);
        }
      }
    } catch { /* ignore */ }
  }

  // Build connection key (same logic as settings page)
  const parsed = new URL(profile.gateway_url);
  const instanceHost = parsed.hostname;
  const payload: Record<string, unknown> = { h: instanceHost, t: profile.auth_token };
  if (relayPort) payload.p = relayPort;

  const key = `dopl_${Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')}`;

  return NextResponse.json({ key });
}
