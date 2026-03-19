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

  // Get relay port
  let relayPort: number | null = null;
  try {
    const parsed = new URL(profile.gateway_url);
    const host = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80);
    const base = port === 443 ? `https://${host}` : `http://${host}:${port}`;
    const res = await fetch(`${base}/status`, {
      headers: { 'Authorization': `Bearer ${profile.auth_token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      relayPort = data.browser?.relay?.port ?? null;
    }
  } catch { /* ignore — relay port is optional */ }

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
