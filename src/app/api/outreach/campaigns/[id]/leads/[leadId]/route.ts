/**
 * Individual lead API — GET single lead, PATCH to update override/feedback/status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// ── GET — single lead ─────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; leadId: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { data: lead, error: leadError } = await supabase
    .from('campaign_leads')
    .select('*')
    .eq('id', params.leadId)
    .eq('campaign_id', params.id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

// ── PATCH — update lead override, feedback, status ────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; leadId: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (body.user_override_rank !== undefined) {
    if (!['high', 'medium', 'low', null].includes(body.user_override_rank)) {
      return NextResponse.json(
        { error: 'Invalid rank. Must be high, medium, low, or null.' },
        { status: 400 }
      );
    }
    updates.user_override_rank = body.user_override_rank;
  }

  if (body.user_feedback !== undefined) {
    updates.user_feedback = body.user_feedback;
  }

  if (body.outreach_status !== undefined) {
    if (!['pending', 'sent', 'replied', 'ignored'].includes(body.outreach_status)) {
      return NextResponse.json(
        { error: 'Invalid outreach_status.' },
        { status: 400 }
      );
    }
    updates.outreach_status = body.outreach_status;
  }

  if (body.approval_status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(body.approval_status)) {
      return NextResponse.json(
        { error: 'Invalid approval_status. Must be pending, approved, or rejected.' },
        { status: 400 }
      );
    }
    updates.approval_status = body.approval_status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const { data: lead, error: updateError } = await supabase
    .from('campaign_leads')
    .update(updates)
    .eq('id', params.leadId)
    .eq('campaign_id', params.id)
    .select()
    .single();

  if (updateError || !lead) {
    return NextResponse.json(
      { error: 'Update failed: ' + (updateError?.message ?? 'unknown') },
      { status: 500 }
    );
  }

  return NextResponse.json({ lead });
}
