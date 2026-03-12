/**
 * POST /api/integrations/browser-connect/verify
 * 
 * Called by the OpenClaw gateway agent after the user has logged in
 * to a browser-based integration. Updates the user_integrations record
 * from 'pending' to 'connected'.
 * 
 * Body: { user_id, provider, integration_id, status, account_name?, account_email?, push_secret }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, provider, integration_id, status, account_name, account_email, push_secret } = body;

    // Auth check
    const expectedSecret = process.env.CHAT_PUSH_SECRET || 'crackedclaw-push-2026';
    if (push_secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user_id || !provider) {
      return NextResponse.json({ error: 'user_id and provider required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: status || 'connected',
      updated_at: new Date().toISOString(),
    };

    if (account_name) updateData.account_name = account_name;
    if (account_email) updateData.account_email = account_email;

    // Update by integration_id if provided, otherwise by user_id + provider
    if (integration_id) {
      const { error: updateErr } = await supabase
        .from('user_integrations')
        .update(updateData)
        .eq('id', integration_id)
        .eq('user_id', user_id);

      if (updateErr) {
        console.error('[browser-verify] Update failed:', updateErr);
        return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
      }
    } else {
      const { error: updateErr } = await supabase
        .from('user_integrations')
        .update(updateData)
        .eq('user_id', user_id)
        .eq('provider', provider)
        .eq('status', 'pending');

      if (updateErr) {
        console.error('[browser-verify] Update by provider failed:', updateErr);
        return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, provider, status: updateData.status });
  } catch (err) {
    console.error('[browser-verify] Error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
