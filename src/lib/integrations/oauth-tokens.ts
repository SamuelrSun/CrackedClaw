/**
 * Shared OAuth token management — used by both agent tools and scan engine.
 * Handles token refresh for Google (and Microsoft when needed).
 */

import { createClient } from '@/lib/supabase/server';

export async function refreshOAuthToken(
  provider: string,
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  if (provider === 'google') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  }
  return null;
}

export async function getValidToken(userId: string, provider: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'connected')
    .single();

  if (!data?.access_token) throw new Error(`No ${provider} integration connected`);

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  const now = Date.now();

  if (expiresAt && expiresAt - now < 5 * 60 * 1000 && data.refresh_token) {
    try {
      const refreshed = await refreshOAuthToken(provider, data.refresh_token);
      if (refreshed) {
        await supabase.from('user_integrations').update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
          ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
        }).eq('user_id', userId).eq('provider', provider);
        return refreshed.access_token;
      }
    } catch (err) {
      console.error(`Token refresh failed for ${provider}:`, err);
    }
  }

  return data.access_token;
}
