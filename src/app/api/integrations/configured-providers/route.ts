import { NextResponse } from 'next/server';
import { OAUTH_PROVIDERS, isProviderConfigured } from '@/lib/oauth/providers';
import type { OAuthProvider } from '@/lib/oauth/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured: string[] = [];
  for (const provider of Object.keys(OAUTH_PROVIDERS)) {
    if (isProviderConfigured(provider as OAuthProvider)) {
      configured.push(provider);
    }
  }
  const hasMatonKey = !!process.env.MATON_API_KEY;
  return NextResponse.json({ providers: configured, hasMatonKey });
}
