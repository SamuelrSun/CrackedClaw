import { NextResponse } from 'next/server';
import { OAUTH_PROVIDERS, isProviderConfigured } from '@/lib/oauth/providers';
import type { OAuthProvider } from '@/lib/oauth/providers';
import { createClient } from '@/lib/supabase/server';
import { hasMatonApiKey } from '@/lib/integrations/maton-key';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured: string[] = [];
  for (const provider of Object.keys(OAUTH_PROVIDERS)) {
    if (isProviderConfigured(provider as OAuthProvider)) {
      configured.push(provider);
    }
  }

  // Check per-user Maton API key (falls back to env var for backward compat)
  let hasMatonKey = !!process.env.MATON_API_KEY;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const userHasKey = await hasMatonApiKey(user.id);
      hasMatonKey = hasMatonKey || userHasKey;
    }
  } catch {
    // Fail silently — just use env var check
  }

  return NextResponse.json({ providers: configured, hasMatonKey });
}
