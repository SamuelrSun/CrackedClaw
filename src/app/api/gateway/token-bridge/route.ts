/**
 * Token Bridge — allows the OpenClaw instance to fetch user OAuth tokens
 * The instance calls this endpoint to get the user's Google token for gog commands
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
  const { user_id, provider, bridge_secret, account_id } = body;

  const expectedSecret = process.env.TOKEN_BRIDGE_SECRET;
  if (!expectedSecret) throw new Error('TOKEN_BRIDGE_SECRET environment variable is required');
  if (bridge_secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user_id || !provider) {
    return NextResponse.json({ error: 'user_id and provider required' }, { status: 400 });
  }

  let tokenQuery = supabase
    .from('user_integrations')
    .select('id, access_token, refresh_token, expires_at, account_id')
    .eq('user_id', user_id)
    .eq('provider', provider)
    .eq('status', 'connected');

  if (account_id) {
    tokenQuery = tokenQuery.eq('account_id', account_id);
  } else {
    // Default: prefer is_default=true, fall back to first connected
    tokenQuery = tokenQuery.order('is_default', { ascending: false }).order('created_at', { ascending: true });
  }

  const { data } = await tokenQuery.limit(1).maybeSingle();

  if (!data?.access_token) {
    return NextResponse.json({ error: 'No ' + provider + ' integration connected' }, { status: 404 });
  }

  // Refresh if expired, near expiry, or expiry unknown (null)
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  const needsRefresh = !expiresAt || (expiresAt - Date.now() < 5 * 60 * 1000);
  if (needsRefresh && data.refresh_token) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: data.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      if (res.ok) {
        const refreshed = await res.json();
        // Update by row ID to avoid overwriting other accounts for the same provider
        await supabase.from('user_integrations').update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
        }).eq('id', data.id);
        return NextResponse.json({ access_token: refreshed.access_token });
      }
    } catch { /* return current token */ }
  }

  return NextResponse.json({ access_token: data.access_token });
}
