import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ingestion/consent?provider=google
 * Check if the user has consented to scanning for a given provider.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const provider = request.nextUrl.searchParams.get('provider') || 'google';
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('user_integrations')
    .select('scan_consent, status')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .single();

  return NextResponse.json({
    provider,
    connected: data?.status === 'connected',
    consented: data?.scan_consent === true,
  });
}

/**
 * POST /api/ingestion/consent
 * Record or revoke user consent for data scanning.
 * Body: { provider: string, consent: boolean }
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let body: { provider?: string; consent?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const provider = body.provider || 'google';
  const consent = body.consent !== false; // default true

  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from('user_integrations')
    .update({ scan_consent: consent, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('provider', provider);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ provider, consented: consent });
}
